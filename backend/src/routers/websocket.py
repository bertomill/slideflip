"""
WebSocket router for SlideFlip Backend
Handles WebSocket connections and message processing
"""

import asyncio
import json
import logging
import os
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Any

from src.core.websocket_manager import WebSocketManager
from src.handlers.file_handler import FileHandler
from src.handlers.slide_handler import SlideHandler
from src.models.message_models import (
    ClientMessage,
    ServerMessage,
    FileUploadMessage,
    SlideDescriptionMessage,
    SlideGenerationMessage,
    ProcessingStatus,
    ThemeMessage,
    ResearchRequestMessage,
    ContentPlanningMessage,
    ContentPlanResponseMessage,
    ProgressUpdateMessage
)
from src.services.file_service import FileService, FileInfo
from src.services.slide_service import SlideService
from src.services.knowledge_graph_service import KnowledgeGraphService
from src.services.kg_task_manager import KnowledgeGraphTaskManager
from src.services.graph_query_service import GraphQueryService
from src.services.llm_service import LLMService
from src.services.kg_processing import process_file_for_knowledge_graph, perform_final_clustering, get_current_timestamp
from src.handlers.kg_message_handlers import (
    handle_kg_status_request,
    handle_force_clustering_request,
    handle_clear_kg_request,
    handle_force_reprocessing_request
)

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services
file_service = FileService()
slide_service = SlideService()
kg_task_manager = KnowledgeGraphTaskManager()
websocket_manager = WebSocketManager()

# Phase 2: Enhanced progress tracking constants
PROGRESS_STEPS = {
    "file_processing": 20,
    "research": 40,
    "content_planning": 60,
    "slide_generation": 80,
    "finalization": 100
}

# Phase 2: Enhanced error codes
ERROR_CODES = {
    "VALIDATION_ERROR": "VAL001",
    "PROCESSING_ERROR": "PROC001",
    "SERVICE_ERROR": "SVC001",
    "TIMEOUT_ERROR": "TIME001",
    "RESOURCE_ERROR": "RES001"
}


async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time communication with frontend"""
    try:
        # Connect the client with better error handling
        logger.info(f"Connecting client {client_id}")
        await websocket_manager.connect(websocket, client_id)

        # Note: Session initialization is now handled by the WebSocket manager
        # No need to call initialize_client_session here as it's already done

        # Check if this client has pending knowledge graph tasks that need clustering
        if await kg_task_manager.is_clustering_needed(client_id):
            logger.info(f"Client {client_id} has pending knowledge graph tasks, performing clustering")
            # Wait for any pending tasks to complete
            await kg_task_manager.wait_for_client_tasks(client_id)

            # Perform clustering if needed
            if await kg_task_manager.is_clustering_needed(client_id):
                logger.info(
                    f"Client {client_id} reconnected, performing pending clustering")
                kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
                await perform_final_clustering(client_id, kg_service, kg_task_manager)
                await kg_task_manager.mark_clustering_completed(client_id)

        else:
            logger.info(f"Client {client_id} has no pending knowledge graph tasks")
        
        # Try to load existing graphs if available
        if await kg_task_manager.load_existing_graphs_if_available(client_id):
            logger.info(
                f"Client {client_id} reconnected, loaded existing knowledge graphs")

            # Check if new processing is needed
            processing_status = await kg_task_manager.check_if_new_processing_needed(client_id)

            # Send a status update to the client
            try:
                logger.info("Existing knowledge graphs loaded succes")
                status_message = ServerMessage(
                    type="kg_status_response",
                    data={
                        "processing_status": await kg_task_manager.get_processing_status(client_id),
                        "graph_statistics": kg_task_manager.client_kg_services[client_id].get_graph_statistics(),
                        "efficiency_status": kg_task_manager.client_kg_services[client_id].get_processing_efficiency_status(),
                        "reconnection_status": {
                            "graphs_loaded": True,
                            "new_processing_needed": processing_status["needs_processing"],
                            "reason": processing_status["reason"]
                        },
                        "message": "Existing knowledge graphs loaded successfully"
                    }
                )
                await asyncio.wait_for(
                    websocket.send_text(status_message.model_dump_json()),
                    timeout=10.0
                )
            except Exception as e:
                logger.warning(f"Could not send status update to client {client_id}: {e}")
        else:
            logger.info(f"Client {client_id} has no existing knowledge graphs")
        # Main message loop
        while True:
            try:
                # Receive message from client with timeout
                data = await asyncio.wait_for(websocket.receive_text(), timeout=300.0)  # 5 minutes (300 seconds) - increased from 60 seconds
                message_data = json.loads(data)
            except asyncio.TimeoutError:
                logger.warning(f"Client {client_id} connection timed out")
                break
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from client {client_id}: {e}")
                try:
                    error_message = ServerMessage(
                        type="error",
                        data={
                            "error": "Invalid JSON format",
                            "details": str(e),
                            "error_code": ERROR_CODES["VALIDATION_ERROR"]
                        }
                    )
                    await websocket.send_text(error_message.model_dump_json())
                except Exception as send_error:
                    logger.error(
                        f"Error sending JSON error message: {send_error}")
                    break
                continue
            except Exception as e:
                logger.error(
                    f"Error receiving message from client {client_id}: {e}")
                break

            # Parse the message
            try:
                message = ClientMessage(**message_data)
                await asyncio.wait_for(
                    handle_client_message(websocket, client_id, message),
                    timeout=300.0  # 5 minutes (300 seconds) - increased from 60 seconds
                )
            except asyncio.TimeoutError:
                logger.error(
                    f"Message handling timed out for client {client_id}")
                try:
                    timeout_message = ServerMessage(
                        type="error",
                        data={
                            "error": "Message processing timed out",
                            "error_code": ERROR_CODES["TIMEOUT_ERROR"]
                        }
                    )
                    await websocket.send_text(timeout_message.model_dump_json())
                except Exception as send_error:
                    logger.error(
                        f"Error sending timeout message: {send_error}")
                break
            except Exception as e:
                logger.error(f"Error parsing message: {e}")
                try:
                    error_message = ServerMessage(
                        type="error",
                        data={
                            "error": "Invalid message format",
                            "details": str(e),
                            "error_code": ERROR_CODES["VALIDATION_ERROR"]
                        }
                    )
                    await asyncio.wait_for(
                        websocket.send_text(error_message.model_dump_json()),
                        timeout=10.0
                    )
                except Exception as send_error:
                    logger.error(f"Error sending error message: {send_error}")
                    break

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected normally")
        websocket_manager.disconnect(client_id)

        # Note: We don't clear the knowledge graph tasks on disconnect
        # as the client might reconnect and we want to preserve the work
        # The tasks will continue running in the background
        logger.info(
            f"Knowledge graph tasks for client {client_id} will continue running")

    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        websocket_manager.disconnect(client_id)

        # Same note about preserving tasks
        logger.info(
            f"Knowledge graph tasks for client {client_id} will continue running")


async def initialize_client_session(websocket: WebSocket, client_id: str):
    """Phase 2: Initialize client session with enhanced data tracking"""
    try:
        # Initialize client data structure with all 5 steps
        websocket_manager.update_client_data(client_id, {
            "session_id": client_id,
            "step_1_upload": {"completed": False, "data": {}},
            "step_2_theme": {"completed": False, "data": {}},
            "step_3_research": {"completed": False, "data": {}},
            "step_4_content": {"completed": False, "data": {}},
            "step_5_preview": {"completed": False, "data": {}},
            "current_step": "step_1_upload",
            "overall_progress": 0,
            "session_start_time": get_current_timestamp(),
            "last_activity": get_current_timestamp()
        })

        # Send session initialization confirmation
        session_message = ServerMessage(
            type="session_initialized",
            data={
                "session_id": client_id,
                "current_step": "step_1_upload",
                "overall_progress": 0,
                "available_steps": list(websocket_manager.get_client_data(client_id).keys()),
                "message": "Session initialized successfully"
            }
        )
        await asyncio.wait_for(
            websocket.send_text(session_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(f"Session initialized for client {client_id}")

    except Exception as e:
        logger.error(f"Error initializing session for client {client_id}: {e}")


async def send_enhanced_progress_update(
    websocket: WebSocket,
    client_id: str,
    step: str,
    progress: int,
    message: str,
    step_data: Dict[str, Any] = None
):
    """Phase 2: Enhanced progress update with step-specific tracking"""
    try:
        # Update client data
        client_data = websocket_manager.get_client_data(client_id)
        if client_data:
            client_data["current_step"] = step
            client_data["overall_progress"] = progress
            client_data["last_activity"] = get_current_timestamp()

            if step_data:
                step_key = f"step_{step.split('_')[0]}_{step.split('_')[1]}"
                if step_key in client_data:
                    client_data[step_key]["completed"] = progress >= 100
                    client_data[step_key]["data"].update(step_data)

            websocket_manager.update_client_data(client_id, client_data)

        # Send progress update message
        progress_message = ServerMessage(
            type="progress_update",
            data={
                "step": step,
                "progress": progress,
                "message": message,
                "timestamp": get_current_timestamp(),
                "overall_progress": progress,
                "current_step": step,
                "step_data": step_data or {}
            }
        )

        await asyncio.wait_for(
            websocket.send_text(progress_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(
            f"Progress update sent to client {client_id}: {step} - {progress}% - {message}")

    except Exception as e:
        logger.error(f"Error sending progress update: {e}")


async def validate_step_prerequisites(client_id: str, current_step: str) -> Dict[str, Any]:
    """Phase 2: Validate that previous steps are completed before proceeding"""
    client_data = websocket_manager.get_client_data(client_id)
    if not client_data:
        return {"valid": False, "error": "Client session not found", "error_code": ERROR_CODES["VALIDATION_ERROR"]}

    step_requirements = {
        "step_2_theme": ["step_1_upload"],
        "step_3_research": ["step_1_upload", "step_2_theme"],
        "step_4_content": ["step_1_upload", "step_2_theme"],
        "step_5_preview": ["step_1_upload", "step_2_theme"]  # Remove step_4_content requirement since user can generate slide immediately
    }

    if current_step in step_requirements:
        for required_step in step_requirements[current_step]:
            if not client_data.get(required_step, {}).get("completed", False):
                return {
                    "valid": False,
                    "error": f"Step {required_step} must be completed before {current_step}",
                    "error_code": ERROR_CODES["VALIDATION_ERROR"],
                    "missing_step": required_step
                }

    return {"valid": True}


async def handle_client_message(websocket: WebSocket, client_id: str, message: ClientMessage):
    """Handle different types of client messages"""
    try:
        # Phase 2: Update last activity timestamp
        websocket_manager.update_client_data(
            client_id, {"last_activity": get_current_timestamp()})

        if message.type == "file_upload":
            await handle_file_upload(websocket, client_id, message.data)
        elif message.type == "slide_description":
            logger.info(f"Received slide description from client {client_id}")
            await handle_slide_description(websocket, client_id, message.data)
        elif message.type == "theme_selection":
            logger.info(f"Received theme selection from client {client_id}")
            await handle_theme_selection(websocket, client_id, message.data)
        #TODO: Not being used
        elif message.type == "research_request":
            logger.info(f"Received research request from client {client_id}")
            await handle_research_request(websocket, client_id, message.data)
        #TODO: Not being used
        elif message.type == "content_planning":
            logger.info(
                f"Received content planning request from client {client_id}")
            await handle_content_planning(websocket, client_id, message.data)
        elif message.type in ["generate_slide", "process_slide"]:
            logger.info(f"=== RECEIVED SLIDE GENERATION MESSAGE ===")
            logger.info(f"Message type: {message.type}")
            logger.info(f"Client ID: {client_id}")
            logger.info(f"Message data: {message.data}")
            logger.info(f"Received slide generation/processing request from client {client_id}")
            await handle_generate_slide(websocket, client_id, message.data)
        elif message.type == "ping":
            # Respond to ping with pong
            pong_message = ServerMessage(type="pong", data={})
            await asyncio.wait_for(
                websocket.send_text(pong_message.model_dump_json()),
                timeout=5.0
            )
        elif message.type == "clear_kg":
            # Handle knowledge graph clear request
            await handle_clear_kg_request(websocket, client_id, kg_task_manager)
        elif message.type == "kg_status":
            # Handle knowledge graph status request
            await handle_kg_status_request(websocket, client_id, kg_task_manager)
        elif message.type == "force_clustering":
            # Handle force clustering request
            await handle_force_clustering_request(websocket, client_id, kg_task_manager)
        elif message.type == "force_reprocessing":
            # Handle force reprocessing request
            await handle_force_reprocessing_request(websocket, client_id, kg_task_manager)
        elif message.type == "get_session_status":
            # Phase 2: Handle session status request
            await handle_session_status_request(websocket, client_id)
        else:
            logger.warning(f"Unknown message type: {message.type}")
            error_message = ServerMessage(
                type="error",
                data={
                    "error": f"Unknown message type: {message.type}",
                    "error_code": ERROR_CODES["VALIDATION_ERROR"]
                }
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=5.0
            )

    except Exception as e:
        logger.error(f"Error handling message: {e}")
        try:
            error_message = ServerMessage(
                type="error",
                data={
                    "error": "Internal server error",
                    "details": str(e),
                    "error_code": ERROR_CODES["SERVICE_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(f"Error sending error message: {send_error}")
            raise


async def handle_session_status_request(websocket: WebSocket, client_id: str):
    """Phase 2: Handle session status request"""
    try:
        client_data = websocket_manager.get_client_data(client_id)
        if not client_data:
            error_message = ServerMessage(
                type="error",
                data={
                    "error": "Session not found",
                    "error_code": ERROR_CODES["VALIDATION_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        # Calculate overall progress based on completed steps
        completed_steps = sum(1 for step in ["step_1_upload", "step_2_theme", "step_3_research", "step_4_content", "step_5_preview"]
                              if client_data.get(step, {}).get("completed", False))
        overall_progress = (completed_steps / 5) * 100

        status_message = ServerMessage(
            type="session_status",
            data={
                "session_id": client_id,
                "current_step": client_data.get("current_step", "step_1_upload"),
                "overall_progress": overall_progress,
                "step_details": {
                    "step_1_upload": client_data.get("step_1_upload", {}),
                    "step_2_theme": client_data.get("step_2_theme", {}),
                    "step_3_research": client_data.get("step_3_research", {}),
                    "step_4_content": client_data.get("step_4_content", {}),
                    "step_5_preview": client_data.get("step_5_preview", {})
                },
                "session_start_time": client_data.get("session_start_time"),
                "last_activity": client_data.get("last_activity"),
                "message": "Session status retrieved successfully"
            }
        )

        await asyncio.wait_for(
            websocket.send_text(status_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(f"Session status sent to client {client_id}")

    except Exception as e:
        logger.error(f"Error handling session status request: {e}")
        try:
            error_message = ServerMessage(
                type="error",
                data={
                    "error": "Failed to get session status",
                    "details": str(e),
                    "error_code": ERROR_CODES["SERVICE_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(f"Error sending session status error: {send_error}")


async def handle_file_upload(websocket: WebSocket, client_id: str, data: dict):
    """Handle file upload from client"""
    try:
        # Phase 2: Send enhanced progress update
        await send_enhanced_progress_update(
            websocket, client_id, "file_processing", 10,
            "File upload request received, starting processing..."
        )

        # Process the file upload
        file_data = FileUploadMessage(**data)

        logger.info(f"Raw data received from client: {data}")
        logger.info(f"Saving file {file_data.filename} for client {client_id}")
        logger.info(f"File upload data fields: {list(file_data.__dict__.keys())}")
        logger.info(f"File data type: {type(file_data)}")

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "file_processing", 30,
            "Validating file and checking processing status..."
        )

        # Check if file already exists and has been processed
        if await kg_task_manager.is_file_processed(client_id, file_data.filename):
            logger.info(f"🔍 EARLY RETURN: File {file_data.filename} already processed for client {client_id}, skipping knowledge graph extraction")

            # Phase 2: Update progress
            await send_enhanced_progress_update(
                websocket, client_id, "file_processing", 60,
                "File already processed, extracting content..."
            )

            # Still save the file and send success, but skip KG processing
            file_path = await file_service.save_uploaded_file(
                file_data.filename,
                file_data.content,
                file_data.file_type,
                client_id
            )

            # Extract content (text and images) for all supported files
            content_info = await file_service.extract_content_from_file(str(file_path))

            # Store extracted content in slide service
            if client_id:
                await slide_service.store_file_content(client_id, str(file_path), file_data.filename)

            # Phase 2: Update progress and mark step as completed
            await send_enhanced_progress_update(
                websocket, client_id, "file_processing", 100,
                "File processing completed successfully",
                {
                    "filename": file_data.filename,
                    "file_path": str(file_path),
                    "file_size": len(file_data.content),
                    "file_type": file_data.file_type,
                    "note": "File already processed for knowledge graph"
                }
            )

            # Send success message with existing processing note
            success_data = {
                "filename": file_data.filename,
                "file_path": str(file_path),
                "file_size": len(file_data.content),
                "file_type": file_data.file_type,
                "note": "File already processed for knowledge graph"
            }

            if content_info:
                # Include a conservative text snippet to avoid large WS messages
                text_value = content_info.get('text') or ''
                max_chars = 10000
                text_snippet = text_value[:max_chars]
                success_data["content_info"] = {
                    "text": text_snippet,
                    "text_length": len(text_value),
                    "images_count": len(content_info.get('images', [])),
                    "images": content_info.get('images', [])
                }

            success_message = ServerMessage(
                type="file_upload_success",
                data=success_data
            )
            await asyncio.wait_for(
                websocket.send_text(success_message.model_dump_json()),
                timeout=10.0
            )

            # Return early since file was already processed
            return

        # Check if we can skip processing due to existing clustered graph
        if await kg_task_manager.can_skip_processing(client_id):
            logger.info(f"🔍 EARLY RETURN: Client {client_id} has existing clustered graph, skipping knowledge graph extraction for new file")

            # Phase 2: Update progress
            await send_enhanced_progress_update(
                websocket, client_id, "file_processing", 70,
                "Existing graph found, skipping KG processing..."
            )

            # Still save the file and send success, but skip KG processing
            file_path = await file_service.save_uploaded_file(
                file_data.filename,
                file_data.content,
                file_data.file_type,
                client_id
            )

            # Extract content (text and images) for all supported files
            content_info = await file_service.extract_content_from_file(str(file_path))

            # Store extracted content in slide service
            if client_id:
                await slide_service.store_file_content(client_id, str(file_path), file_data.filename)

            # Phase 2: Update progress and mark step as completed
            await send_enhanced_progress_update(
                websocket, client_id, "file_processing", 100,
                "File processing completed successfully",
                {
                    "filename": file_data.filename,
                    "file_path": str(file_path),
                    "file_size": len(file_data.content),
                    "file_type": file_data.file_type,
                    "note": "File saved but knowledge graph processing skipped - existing clustered graph found"
                }
            )

            # Send success message with existing graph note
            success_data = {
                "filename": file_data.filename,
                "file_path": str(file_path),
                "file_size": len(file_data.content),
                "file_type": file_data.file_type,
                "note": "File saved but knowledge graph processing skipped - existing clustered graph found"
            }

            if content_info:
                text_value = content_info.get('text') or ''
                max_chars = 10000
                text_snippet = text_value[:max_chars]
                success_data["content_info"] = {
                    "text": text_snippet,
                    "text_length": len(text_value),
                    "images_count": len(content_info.get('images', [])),
                    "images": content_info.get('images', [])
                }

            success_message = ServerMessage(
                type="file_upload_success",
                data=success_data
            )
            await asyncio.wait_for(
                websocket.send_text(success_message.model_dump_json()),
                timeout=10.0
            )

            # Return early since processing was skipped
            return

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "file_processing", 80,
            "Saving file and extracting content..."
        )

        # Save file to disk
        file_path = await file_service.save_uploaded_file(
            file_data.filename,
            file_data.content,
            file_data.file_type,
            client_id
        )

        # Extract content (text and images) for all supported files
        content_info = await file_service.extract_content_from_file(str(file_path))

        # Store extracted content in slide service
        if client_id:
            await slide_service.store_file_content(client_id, str(file_path), file_data.filename)

        # Check if we should skip knowledge graph processing for faster uploads
        skip_kg = os.getenv("SKIP_KNOWLEDGE_GRAPH", "true").lower() == "true"

        logger.info(f"skip_kg value: {skip_kg}")
        
        # Send file upload success message IMMEDIATELY after file processing
        # Don't wait for knowledge graph processing to complete
        success_data = {
            "filename": file_data.filename,
            "file_path": str(file_path),
            "file_size": len(file_data.content),
            "file_type": file_data.file_type
        }

        # Add content information if available
        if content_info:
            text_value = content_info.get('text') or ''
            max_chars = 10000
            text_snippet = text_value[:max_chars]
            success_data["content_info"] = {
                "text": text_snippet,
                "text_length": len(text_value),
                "images_count": len(content_info.get('images', [])),
                "images": content_info.get('images', [])
            }

        # Add note about knowledge graph processing
        if skip_kg:
            success_data["note"] = "Knowledge graph processing skipped for faster upload"
        else:
            success_data["note"] = "Knowledge graph processing started in background - file ready for use"

        # Send success message IMMEDIATELY - don't wait for KG processing
        success_message = ServerMessage(
            type="file_upload_success",
            data=success_data
        )
        
        logger.info(f"🔍 About to send success message for {file_data.filename}")
        logger.info(f"🔍 Success message data: {success_data}")
        logger.info(f"🔍 Success message JSON: {success_message.model_dump_json()}")
        logger.info(f"🔍 WebSocket ready state check before sending...")
        
        # Check websocket state
        try:
            websocket_state = websocket.client_state
            logger.info(f"🔍 WebSocket client state: {websocket_state}")
        except Exception as state_error:
            logger.warning(f"🔍 Could not check websocket state: {state_error}")
        
        try:
            await asyncio.wait_for(
                websocket.send_text(success_message.model_dump_json()),
                timeout=10.0
            )
            logger.info(f"✅ SUCCESS: Success message sent successfully for {file_data.filename}")
        except Exception as send_error:
            logger.error(f"❌ ERROR: Failed to send success message for {file_data.filename}: {send_error}")
            logger.error(f"❌ Send error type: {type(send_error)}")
            import traceback
            logger.error(f"❌ Send error traceback: {traceback.format_exc()}")
            raise  # Re-raise to ensure the error is handled

        logger.info(f"File uploaded successfully: {file_data.filename} - success message sent immediately")

        # Now start knowledge graph processing in the background (if enabled)
        if not skip_kg:
            try:
                logger.info(f"Starting knowledge graph processing in background for file: {file_data.filename}")
                
                # Send status update about background processing starting
                try:
                    status_message = ServerMessage(
                        type="kg_processing_status",
                        data={
                            "filename": file_data.filename,
                            "status": "started",
                            "message": "Knowledge graph processing started in background",
                            "progress": 0,
                            "client_id": client_id
                        }
                    )
                    await websocket.send_text(status_message.model_dump_json())
                except Exception as send_error:
                    logger.error(f"Could not send KG processing status message: {send_error}")
                
                # Phase 2: Send progress update about background processing
                await send_enhanced_progress_update(
                    websocket, client_id, "file_processing", 90,
                    "Knowledge graph processing started in background..."
                )

                # Get or create knowledge graph service for this client
                kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
                
                logger.info(f"Knowledge graph service created/retrieved for client {client_id}")
                logger.info(f"Current file graphs: {len(kg_service.file_graphs)}")
                logger.info(f"Current graph: {len(kg_service.graph.nodes) if kg_service.graph else 0} nodes")

                # Get file info for knowledge graph processing
                file_info = FileInfo(
                    filename=file_data.filename,
                    file_path=str(file_path),
                    file_size=len(file_data.content),
                    file_type=file_data.file_type,
                    upload_time=get_current_timestamp()
                )

                # Use the already extracted content for knowledge graph
                content_text = content_info.get('text', '') if content_info else ''
                
                logger.info(f"Starting background knowledge graph extraction for file: {file_data.filename}")
                logger.info(f"Content length: {len(content_text)} characters")

                # Create and track the processing task
                processing_task = asyncio.create_task(process_file_for_knowledge_graph(
                    kg_service, file_info, content_text, client_id, kg_task_manager
                ))

                # Add task to manager for tracking
                await kg_task_manager.add_processing_task(client_id, file_data.filename, processing_task)

                # Mark that clustering will be needed
                await kg_task_manager.mark_clustering_needed(client_id)

                logger.info(f"Background knowledge graph extraction started for file: {file_data.filename}")

            except Exception as e:
                logger.error(f"Error starting background knowledge graph extraction: {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                
                # Send error notification to client about KG processing failure
                # (but file upload was already successful)
                try:
                    error_message = ServerMessage(
                        type="kg_processing_error",
                        data={
                            "filename": file_data.filename,
                            "error": f"Knowledge graph processing failed: {str(e)}",
                            "note": "File was uploaded successfully, but AI processing failed"
                        }
                    )
                    await websocket.send_text(error_message.model_dump_json())
                except Exception as send_error:
                    logger.error(f"Could not send KG processing error message: {send_error}")

        logger.info(f"File upload handler completed for {file_data.filename} (KG processing: {'started in background' if not skip_kg else 'skipped'})")

    except Exception as e:
        logger.error(f"Error handling file upload: {e}")
        try:
            error_message = ServerMessage(
                type="file_upload_error",
                data={"error": "Failed to process file upload",
                      "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending file upload error: {send_error}")
            raise


async def handle_slide_description(websocket: WebSocket, client_id: str, data: dict):
    """Handle slide description from client"""
    try:
        # Phase 2: Send enhanced progress update
        await send_enhanced_progress_update(
            websocket, client_id, "slide_description", 25,
            "Slide description received, processing..."
        )

        # Process the slide description
        description_data = SlideDescriptionMessage(**data)

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_description", 50,
            "Storing slide description..."
        )

        # Store the description
        await slide_service.store_slide_description(client_id, description_data.description)

        # Phase 2: Update progress and mark step as completed
        await send_enhanced_progress_update(
            websocket, client_id, "slide_description", 100,
            "Slide description stored successfully",
            {
                "description": description_data.description,
                "length": len(description_data.description)
            }
        )

        # Send success message
        success_message = ServerMessage(
            type="slide_description_success",
            data={
                "description": description_data.description,
                "length": len(description_data.description)
            }
        )
        await asyncio.wait_for(
            websocket.send_text(success_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(f"Slide description stored for client {client_id}")

    except Exception as e:
        logger.error(f"Error handling slide description: {e}")
        try:
            error_message = ServerMessage(
                type="slide_description_error",
                data={
                    "error": "Failed to process slide description",
                    "details": str(e),
                    "error_code": ERROR_CODES["PROCESSING_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(
                f"Error sending slide description error: {send_error}")
            raise


async def handle_theme_selection(websocket: WebSocket, client_id: str, data: dict):
    """Handle theme selection from client"""
    try:
        # Phase 2: Validate step prerequisites
        validation = await validate_step_prerequisites(client_id, "step_2_theme")
        if not validation["valid"]:
            error_message = ServerMessage(
                type="theme_selection_error",
                data={
                    "error": validation["error"],
                    "error_code": validation["error_code"],
                    "missing_step": validation.get("missing_step")
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        # Phase 2: Send enhanced progress update
        await send_enhanced_progress_update(
            websocket, client_id, "theme_selection", 25,
            "Theme selection received, processing..."
        )

        # Process the theme selection
        theme_data = ThemeMessage(**data)

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "theme_selection", 50,
            "Storing theme information..."
        )

        # Store the theme information
        await slide_service.store_theme_selection(client_id, theme_data)

        # Phase 2: Update progress and mark step as completed
        await send_enhanced_progress_update(
            websocket, client_id, "theme_selection", 100,
            "Theme selection completed successfully",
            {
                "theme_id": theme_data.theme_id,
                "theme_name": theme_data.theme_name,
                "color_palette": theme_data.color_palette
            }
        )

        # Send success message
        success_message = ServerMessage(
            type="theme_selection_success",
            data={
                "theme_id": theme_data.theme_id,
                "theme_name": theme_data.theme_name,
                "color_palette": theme_data.color_palette
            }
        )
        await asyncio.wait_for(
            websocket.send_text(success_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(
            f"Theme selection stored for client {client_id}: {theme_data.theme_id}")

    except Exception as e:
        logger.error(f"Error handling theme selection: {e}")
        try:
            error_message = ServerMessage(
                type="theme_selection_error",
                data={
                    "error": "Failed to process theme selection",
                    "details": str(e),
                    "error_code": ERROR_CODES["PROCESSING_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(f"Error sending theme selection error: {send_error}")
            raise


async def handle_generate_slide(websocket: WebSocket, client_id: str, data: dict):
    """Handle slide generation request from client - matches frontend API behavior exactly"""
    try:
        logger.info(f"=== SLIDE GENERATION STARTED ===")
        logger.info(f"Client ID: {client_id}")
        logger.info(f"Received data: {data}")
        logger.info(f"Data type: {type(data)}")
        logger.info(f"Data keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        logger.info(f"Received slide generation request for client {client_id} with data: {data}")

        # Phase 2: Send enhanced progress update
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 10,
            "Slide generation request received, starting process..."
        )

        # Parse the generation data using the updated SlideGenerationMessage model
        try:
            generation_data = SlideGenerationMessage(**data)
            description = generation_data.description
            theme = generation_data.theme
            wants_research = generation_data.wants_research
            researchData = generation_data.researchData
            contentPlan = generation_data.contentPlan
            userFeedback = generation_data.userFeedback
            documents = generation_data.documents
            model = generation_data.model
            if model != "gpt-4o":
                model = "gpt-4o"
            logger.info(f"Using parameterized request - description: {description[:50]}..., theme: {theme}, research: {wants_research}")
        except Exception as e:
            logger.error(f"Error parsing generation data: {e}")
            error_message = ServerMessage(
                type="slide_generation_error",
                data={
                    "error": "Invalid generation parameters",
                    "details": str(e),
                    "error_code": ERROR_CODES["VALIDATION_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        # Validate required parameters - description is mandatory for slide generation
        if not description:
            error_message = ServerMessage(
                type="slide_generation_error",
                data={
                    "error": "Description is required",
                    "error_code": ERROR_CODES["VALIDATION_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 20,
            "Validating request parameters..."
        )

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 30,
            "Analyzing uploaded files and generating slide content..."
        )

        # Initialize knowledge graph service and query service for document content
        kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
        llm_service = LLMService()
        logger.info(f"Knowledge graph service: {kg_service}")
        logger.info(f"LLM service: {llm_service}")
        query_service = GraphQueryService(
            knowledge_graph_service=kg_service,
            llm_service=llm_service
        )

        # Query the knowledge graph for relevant content instead of using raw document content
        graph_query_result = None
        kg_has_content = False
        try:
            logger.info(f"Querying knowledge graph for client {client_id} with description: {description[:100]}...")
            
            # First check if the knowledge graph has any content
            if kg_service and hasattr(kg_service, 'graph'):
                graph = kg_service.graph
                if graph and len(graph.nodes) > 0:
                    kg_has_content = True
                    logger.info(f"Knowledge graph has {len(graph.nodes)} nodes for client {client_id}")
                else:
                    logger.info(f"Knowledge graph is empty for client {client_id}")
            else:
                logger.info(f"No knowledge graph service available for client {client_id}")
            
            if kg_has_content:
                graph_query_result = await query_service.query_graph_for_slide_content(
                    slide_description=description,
                    top_k=10,  # Get top 10 results for each category
                    similarity_threshold=0.3,  # Balanced similarity threshold
                    include_embeddings=False,  # Don't include embedding data in response
                    max_tokens=1500  # Limit LLM response tokens
                )
                
                if "error" in graph_query_result:
                    logger.warning(f"Graph query failed for client {client_id}: {graph_query_result['error']}")
                    # Continue without graph query results - slide generation will still work
                else:
                    # Debug: Log the structure of graph_query_result
                    logger.info(f"Graph query result structure for client {client_id}: {list(graph_query_result.keys())}")
                    logger.info(f"Graph query result metadata: {graph_query_result.get('metadata', 'NOT_FOUND')}")
                    
                    # The knowledge graph service returns counts in the results section, not metadata
                    results = graph_query_result.get('results', {})
                    entities = results.get('entities', [])
                    facts = results.get('facts', [])
                    chunks = results.get('chunks', [])
                    
                    # Debug: Log what we found in results
                    logger.info(f"Results section keys: {list(results.keys()) if results else 'NO_RESULTS'}")
                    logger.info(f"Entities count: {len(entities) if entities else 0}")
                    logger.info(f"Facts count: {len(facts) if facts else 0}")
                    logger.info(f"Chunks count: {len(chunks) if chunks else 0}")
                    
                    total_entities = len(entities) if entities else 0
                    total_facts = len(facts) if facts else 0
                    total_chunks = len(chunks) if chunks else 0
                    
                    logger.info(f"Graph query successful for client {client_id}: "
                               f"Found {total_entities} entities, "
                               f"{total_facts} facts, "
                               f"{total_chunks} chunks")
                    
                    # Send progress update with knowledge graph results summary
                    await send_enhanced_progress_update(
                        websocket, client_id, "slide_generation", 38,
                        f"Knowledge graph analysis complete: Found {total_entities} relevant entities and {total_facts} facts"
                    )
            else:
                logger.info(f"Knowledge graph is empty for client {client_id}, skipping graph query")
                
        except Exception as e:
            logger.error(f"Error querying knowledge graph for client {client_id}: {e}")
            # Continue without graph query results - slide generation will still work
            graph_query_result = None
            
            # Send progress update indicating fallback
            await send_enhanced_progress_update(
                websocket, client_id, "slide_generation", 38,
                "Knowledge graph analysis unavailable, proceeding with standard content generation"
            )

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 40,
            "Starting AI-powered slide generation with knowledge graph insights..."
        )

        # Convert knowledge graph results to document format for the LLM service
        # This maintains compatibility with the frontend API behavior
        processed_documents = []
        content_source = "none"
        
        if graph_query_result and "error" not in graph_query_result:
            # Extract key insights and facts from knowledge graph
            entities = graph_query_result.get("results", {}).get("entities", [])
            facts = graph_query_result.get("results", {}).get("facts", [])
            chunks = graph_query_result.get("results", {}).get("chunks", [])
            
            # Create document entries from knowledge graph content
            if entities:
                entity_content = "\n".join([f"• {entity.get('name', 'Unknown')}: {entity.get('description', 'No description')}" for entity in entities[:5]])
                processed_documents.append({
                    "filename": "knowledge_graph_entities",
                    "success": True,
                    "content": f"Key Entities Found:\n{entity_content}"
                })
            
            if facts:
                fact_content = "\n".join([f"• {fact.get('content', 'No content')}" for fact in facts[:5]])
                processed_documents.append({
                    "filename": "knowledge_graph_facts",
                    "success": True,
                    "content": f"Key Facts Found:\n{fact_content}"
                })
            
            if chunks:
                chunk_content = "\n".join([f"• {chunk.get('content', 'No content')[:200]}..." for chunk in chunks[:3]])
                processed_documents.append({
                    "filename": "knowledge_graph_chunks",
                    "success": True,
                    "content": f"Relevant Content:\n{chunk_content}"
                })
            
            content_source = "knowledge_graph"
            logger.info(f"Using knowledge graph content for client {client_id}: {len(processed_documents)} document entries")
        
        # If no knowledge graph content, try to get extracted content from files
        if not processed_documents:
            try:
                # Use the global file service to maintain state
                # file_service = FileService()  # This was creating a new instance and losing state
                
                logger.info(f"Attempting to retrieve files for client {client_id}")
                logger.info(f"Global file_service client_files keys: {list(file_service.client_files.keys())}")
                logger.info(f"Global file_service client_files for {client_id}: {len(file_service.client_files.get(client_id, []))}")
                
                # Debug: Check what's happening with file retrieval
                debug_info = await file_service.debug_client_files(client_id)
                logger.info(f"Debug info for client {client_id}: {debug_info}")
                
                client_files = await file_service.get_client_files(client_id)
                logger.info(f"Retrieved {len(client_files)} files for client {client_id}")
                
                if client_files:
                    logger.info(f"Found {len(client_files)} files for client {client_id}, extracting content...")
                    
                    # Extract content from files with length limits
                    MAX_CONTENT_LENGTH = 2000  # Limit each file's content to 2000 characters
                    MAX_TOTAL_CONTENT = 8000   # Limit total content to 8000 characters
                    total_content_length = 0
                    
                    for file_info in client_files:
                        if total_content_length >= MAX_TOTAL_CONTENT:
                            logger.info(f"Reached total content limit for client {client_id}")
                            break
                            
                        try:
                            # Extract text content from file
                            file_path = str(file_info.file_path)
                            extracted_text = await file_service.extract_text_from_file(file_path)
                            
                            if extracted_text:
                                # Truncate content if it's too long
                                if len(extracted_text) > MAX_CONTENT_LENGTH:
                                    extracted_text = extracted_text[:MAX_CONTENT_LENGTH] + "..."
                                
                                # Check if adding this content would exceed total limit
                                if total_content_length + len(extracted_text) <= MAX_TOTAL_CONTENT:
                                    processed_documents.append({
                                        "filename": file_info.filename,
                                        "success": True,
                                        "content": extracted_text
                                    })
                                    total_content_length += len(extracted_text)
                                    logger.info(f"Added content from {file_info.filename} (length: {len(extracted_text)})")
                                else:
                                    # Add partial content to fit within limit
                                    remaining_space = MAX_TOTAL_CONTENT - total_content_length
                                    if remaining_space > 100:  # Only add if there's meaningful space
                                        partial_content = extracted_text[:remaining_space] + "..."
                                        processed_documents.append({
                                            "filename": file_info.filename,
                                            "success": True,
                                            "content": partial_content
                                        })
                                        total_content_length += len(partial_content)
                                        logger.info(f"Added partial content from {file_info.filename} to fit within limit")
                                    break
                            else:
                                logger.warning(f"No text content extracted from {file_info.filename}")
                                
                        except Exception as e:
                            logger.error(f"Error extracting content from {file_info.filename}: {e}")
                            # Add a placeholder to indicate the file had issues
                            processed_documents.append({
                                "filename": file_info.filename,
                                "success": False,
                                "content": f"Error extracting content: {str(e)}"
                            })
                    
                    logger.info(f"Extracted content from {len(processed_documents)} files for client {client_id}, total length: {total_content_length}")
                    
                    if processed_documents:
                        content_source = "file_extraction"
                        # Send progress update about file content extraction
                        await send_enhanced_progress_update(
                            websocket, client_id, "slide_generation", 42,
                            f"File content extraction complete: {len(processed_documents)} files processed, total content: {total_content_length} characters"
                        )
                    else:
                        await send_enhanced_progress_update(
                            websocket, client_id, "slide_generation", 42,
                            "No content could be extracted from uploaded files"
                        )
                    
                else:
                    logger.info(f"No files found for client {client_id}")
                    
            except Exception as e:
                logger.error(f"Error extracting file content for client {client_id}: {e}")
                # Continue without file content - slide generation will still work
        
        # If still no content, use the documents parameter if provided
        if not processed_documents and documents:
            logger.info(f"Using provided documents parameter for client {client_id}")
            processed_documents = documents
            content_source = "provided_documents"

        # Log content source information
        if processed_documents:
            logger.info(f"Using {content_source} content for slide generation: {len(processed_documents)} documents")
            await send_enhanced_progress_update(
                websocket, client_id, "slide_generation", 45,
                f"Content preparation complete: Using {content_source} content ({len(processed_documents)} documents)"
            )
        else:
            logger.info(f"No content available for slide generation for client {client_id}")
            await send_enhanced_progress_update(
                websocket, client_id, "slide_generation", 45,
                "Content preparation complete: No additional content available, using description only"
            )

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 50,
            "Generating slide HTML using AI..."
        )

        # Generate the slide using the new LLM service method that matches frontend API
        try:
            slide_html = await llm_service.generate_slide_html(
                description=description,
                theme=theme,
                researchData=researchData,
                contentPlan=contentPlan,
                userFeedback=userFeedback,
                documents=processed_documents,
                model=model
            )
            
            logger.info(f"Slide HTML generated successfully for client {client_id}, length: {len(slide_html)}")
            
        except Exception as e:
            logger.error(f"Error generating slide HTML: {e}")
            error_message = ServerMessage(
                type="slide_generation_error",
                data={
                    "error": "Failed to generate slide HTML",
                    "details": str(e),
                    "error_code": ERROR_CODES["PROCESSING_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 95,
            "Finalizing slide generation..."
        )

        # Validate HTML content size before sending
        if len(slide_html) > 50000:  # 50KB limit
            logger.warning(f"HTML content too large ({len(slide_html)} chars), truncating")
            slide_html = slide_html[:50000]

        # Prepare response data that matches frontend API response format
        message_data = {
            "status": ProcessingStatus.COMPLETED,
            "slide_html": slide_html,
            "ppt_file_path": "",  # Not generated in this implementation
            "processing_time": 0,  # Could be calculated if needed
            "theme": theme,
            "wants_research": wants_research,
            "message": "Slide generation completed successfully",
            "content_source": content_source,
            "documents_processed": len(processed_documents) if processed_documents else 0
        }
        
        # Add knowledge graph context information if available
        if graph_query_result and "error" not in graph_query_result:
            # The knowledge graph service returns counts in the results section, not metadata
            results = graph_query_result.get('results', {})
            entities = results.get('entities', [])
            facts = results.get('facts', [])
            chunks = results.get('chunks', [])
            relationships = results.get('relationships', [])
            high_level_insights = graph_query_result.get('high_level_insights', {})
            
            message_data["knowledge_graph_used"] = True
            message_data["knowledge_graph_summary"] = {
                "entities_found": len(entities) if entities else 0,
                "facts_found": len(facts) if facts else 0,
                "chunks_found": len(chunks) if chunks else 0,
                "relationships_found": len(relationships) if relationships else 0,
                "main_themes": high_level_insights.get('main_themes', [])[:3],
                "central_entities": high_level_insights.get('central_entities', [])[:3]
            }
            logger.info(f"Knowledge graph context included in completion message for client {client_id}")
        else:
            message_data["knowledge_graph_used"] = False
            message_data["knowledge_graph_summary"] = None

        completion_message = ServerMessage(
            type="slide_generation_complete",
            data=message_data
        )

        # Log the message size
        message_json = completion_message.model_dump_json()
        logger.info(f"Sending completion message, size: {len(message_json)} bytes")
        logger.info(f"Completion message type: {completion_message.type}")
        logger.info(f"Completion message data keys: {list(completion_message.data.keys())}")
        logger.info(f"Slide HTML length: {len(slide_html)} characters")

        # Check if message is too large for WebSocket
        if len(message_json) > 65536:  # 64KB limit
            logger.warning(f"Message too large ({len(message_json)} bytes), implementing chunking")
            # For now, truncate the HTML content
            # Limit to 30KB
            message_data["slide_html"] = message_data["slide_html"][:30000]
            completion_message = ServerMessage(
                type="slide_generation_complete",
                data=message_data
            )
            message_json = completion_message.model_dump_json()
            logger.info(f"Truncated message size: {len(message_json)} bytes")

        logger.info(f"About to send slide_generation_complete message to client {client_id}")
        await asyncio.wait_for(
            websocket.send_text(message_json),
            timeout=10.0
        )
        logger.info(f"Successfully sent slide_generation_complete message to client {client_id}")

        # Phase 2: Update progress and mark step as completed
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 100,
            "Slide generation completed successfully",
            {
                "slide_html": slide_html[:100] + "..." if len(slide_html) > 100 else slide_html,
                "ppt_file_path": message_data.get("ppt_file_path", ""),
                "processing_time": message_data.get("processing_time", 0),
                "theme": theme,
                "wants_research": wants_research,
                "knowledge_graph_used": message_data.get("knowledge_graph_used", False),
                "knowledge_graph_summary": message_data.get("knowledge_graph_summary"),
                "content_source": content_source,
                "documents_processed": len(processed_documents) if processed_documents else 0
            }
        )

        logger.info(f"Slide generation completed for client {client_id} with theme: {theme}, research: {wants_research}, content source: {content_source}")

        # Log knowledge graph integration summary
        if graph_query_result and "error" not in graph_query_result:
            # The knowledge graph service returns counts in the results section, not metadata
            results = graph_query_result.get('results', {})
            entities = results.get('entities', [])
            facts = results.get('facts', [])
            chunks = results.get('chunks', [])
            relationships = results.get('relationships', [])
            high_level_insights = graph_query_result.get('high_level_insights', {})
            
            logger.info(f"Knowledge graph integration summary for client {client_id}:")
            logger.info(f"  - Entities used: {len(entities) if entities else 0}")
            logger.info(f"  - Facts used: {len(facts) if facts else 0}")
            logger.info(f"  - Chunks used: {len(chunks) if chunks else 0}")
            logger.info(f"  - Relationships used: {len(relationships) if relationships else 0}")
            
            if high_level_insights:
                logger.info(f"  - Main themes: {high_level_insights.get('main_themes', [])}")
                logger.info(f"  - Central entities: {high_level_insights.get('central_entities', [])}")
                logger.info(f"  - Key relationships: {high_level_insights.get('key_relationships', [])}")
        else:
            if content_source == "file_extraction":
                logger.info(f"File extraction used for client {client_id} - {len(processed_documents)} files processed")
            elif content_source == "provided_documents":
                logger.info(f"Provided documents used for client {client_id} - {len(processed_documents)} documents")
            else:
                logger.info(f"No additional content used for client {client_id} - standard generation mode")

    except Exception as e:
        logger.error(f"Error generating slide: {e}")
        try:
            error_message = ServerMessage(
                type="slide_generation_error",
                data={
                    "error": "Failed to generate slide",
                    "details": str(e),
                    "error_code": ERROR_CODES["PROCESSING_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(f"Error sending slide generation error: {send_error}")
            raise


async def handle_research_request(websocket: WebSocket, client_id: str, data: dict):
    """Handle research request from client"""
    try:
        # Phase 2: Validate step prerequisites
        validation = await validate_step_prerequisites(client_id, "step_3_research")
        if not validation["valid"]:
            error_message = ServerMessage(
                type="research_error",
                data={
                    "error": validation["error"],
                    "error_code": validation["error_code"],
                    "missing_step": validation.get("missing_step")
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        logger.info(f"Processing research request for client {client_id}")

        # Parse the research request data
        research_data = ResearchRequestMessage(**data)

        # Phase 2: Send enhanced progress update
        await send_enhanced_progress_update(
            websocket, client_id, "research", 10,
            "Research request received, starting process..."
        )

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "research", 25,
            "Initializing research service..."
        )

        # Create status callback for progress updates
        async def send_research_progress(message: str, progress: int):
            try:
                # Phase 2: Use enhanced progress update
                await send_enhanced_progress_update(
                    websocket, client_id, "research",
                    # Scale progress from 25% to 85%
                    min(25 + (progress * 0.6), 85),
                    message
                )
            except Exception as e:
                logger.error(f"Error sending research progress: {e}")

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "research", 30,
            "Performing research using external APIs..."
        )

        # Perform research using the research service
        research_result = await slide_service.research_service.perform_research(
            query=research_data.description,
            options=research_data.research_options,
            client_id=client_id
        )

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "research", 90,
            "Storing research results..."
        )

        # Store research data
        await slide_service.store_research_data(client_id, research_result)

        # Phase 2: Update progress and mark step as completed
        await send_enhanced_progress_update(
            websocket, client_id, "research", 100,
            "Research completed successfully",
            {
                "research_data": research_result,
                "query": research_data.description,
                "options": research_data.research_options
            }
        )

        # Send completion message
        completion_message = ServerMessage(
            type="research_complete",
            data={
                "status": ProcessingStatus.COMPLETED,
                "research_data": research_result,
                "message": "Research completed successfully"
            }
        )
        await asyncio.wait_for(
            websocket.send_text(completion_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(f"Research completed for client {client_id}")

    except Exception as e:
        logger.error(f"Error handling research request: {e}")
        try:
            error_message = ServerMessage(
                type="research_error",
                data={
                    "error": "Failed to process research request",
                    "details": str(e),
                    "error_code": ERROR_CODES["PROCESSING_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(f"Error sending research error: {send_error}")
            raise


async def handle_content_planning(websocket: WebSocket, client_id: str, data: dict):
    """Handle content planning request from client"""
    try:
        # Phase 2: Validate step prerequisites
        validation = await validate_step_prerequisites(client_id, "step_4_content")
        if not validation["valid"]:
            error_message = ServerMessage(
                type="content_planning_error",
                data={
                    "error": validation["error"],
                    "error_code": validation["error_code"],
                    "missing_step": validation.get("missing_step")
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        logger.info(
            f"Processing content planning request for client {client_id}")

        # Parse the content planning data
        planning_data = ContentPlanningMessage(**data)

        # Phase 2: Send enhanced progress update
        await send_enhanced_progress_update(
            websocket, client_id, "content_planning", 10,
            "Content planning request received, starting process..."
        )

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "content_planning", 25,
            "Analyzing content requirements..."
        )

        # Create status callback for progress updates
        async def send_planning_progress(message: str, progress: int):
            try:
                # Phase 2: Use enhanced progress update
                await send_enhanced_progress_update(
                    websocket, client_id, "content_planning",
                    # Scale progress from 25% to 85%
                    min(25 + (progress * 0.6), 85),
                    message
                )
            except Exception as e:
                logger.error(f"Error sending content planning progress: {e}")

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "content_planning", 30,
            "Generating content plan using AI..."
        )

        # Generate content plan using AI
        content_plan_result = await slide_service.generate_content_plan(
            client_id=client_id,
            description=planning_data.description,
            research_data=planning_data.research_data,
            theme=planning_data.theme
        )

        # Phase 2: Update progress and mark step as completed
        await send_enhanced_progress_update(
            websocket, client_id, "content_planning", 100,
            "Content planning completed successfully",
            {
                "content_plan": content_plan_result["content_plan"],
                "suggestions": content_plan_result["suggestions"],
                "estimated_slide_count": content_plan_result["estimated_slide_count"]
            }
        )

        # Send completion message with content plan
        completion_message = ServerMessage(
            type="content_planning_complete",
            data={
                "status": ProcessingStatus.COMPLETED,
                "content_plan": content_plan_result["content_plan"],
                "suggestions": content_plan_result["suggestions"],
                "estimated_slide_count": content_plan_result["estimated_slide_count"],
                "message": "Content plan generated successfully"
            }
        )
        await asyncio.wait_for(
            websocket.send_text(completion_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(f"Content planning completed for client {client_id}")

    except Exception as e:
        logger.error(f"Error handling content planning: {e}")
        try:
            error_message = ServerMessage(
                type="content_planning_error",
                data={
                    "error": "Failed to process content planning request",
                    "details": str(e),
                    "error_code": ERROR_CODES["PROCESSING_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(f"Error sending content planning error: {send_error}")
            raise
