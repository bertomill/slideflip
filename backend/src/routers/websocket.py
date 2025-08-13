"""
WebSocket router for SlideFlip Backend
Handles WebSocket connections and message processing
"""

import asyncio
import json
import logging
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
    ProgressUpdateMessage,
    AgenticResearchRequestMessage,
    EnhancedResearchOptions
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
            logger.info(
                f"Client {client_id} has pending knowledge graph tasks, performing clustering")
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
            logger.info(
                f"Client {client_id} has no pending knowledge graph tasks")

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
                logger.warning(
                    f"Could not send status update to client {client_id}: {e}")
        else:
            logger.info(f"Client {client_id} has no existing knowledge graphs")
        # Main message loop
        while True:
            try:
                # Receive message from client with timeout
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
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
                    timeout=60.0
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
        "step_5_preview": ["step_1_upload", "step_2_theme", "step_4_content"]
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
        elif message.type == "research_request":
            logger.info(f"Received research request from client {client_id}")
            await handle_research_request(websocket, client_id, message.data)
        elif message.type == "agentic_research_request":
            logger.info(
                f"Received agentic research request from client {client_id}")
            await handle_agentic_research_request(websocket, client_id, message.data)
        elif message.type == "content_planning":
            logger.info(
                f"Received content planning request from client {client_id}")
            await handle_content_planning(websocket, client_id, message.data)
        elif message.type in ["generate_slide", "process_slide"]:
            logger.info(
                f"Received slide generation/processing request from client {client_id}")
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

        logger.info(f"Saving file {file_data.filename} for client {client_id}")

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "file_processing", 30,
            "Validating file and checking processing status..."
        )

        # Check if file already exists and has been processed
        if await kg_task_manager.is_file_processed(client_id, file_data.filename):
            logger.info(
                f"File {file_data.filename} already processed for client {client_id}, skipping knowledge graph extraction")

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
                success_data["content_info"] = {
                    "text_length": len(content_info.get('text', '')) if content_info.get('text') else 0,
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
            logger.info(
                f"Client {client_id} has existing clustered graph, skipping knowledge graph extraction for new file")

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
                success_data["content_info"] = {
                    "text_length": len(content_info.get('text', '')) if content_info.get('text') else 0,
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

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "file_processing", 90,
            "Starting knowledge graph extraction..."
        )

        # Start knowledge graph extraction process
        try:
            # Get or create knowledge graph service for this client
            kg_service = await kg_task_manager.get_or_create_kg_service(client_id)

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

            # Create and track the processing task
            processing_task = asyncio.create_task(process_file_for_knowledge_graph(
                kg_service, file_info, content_text, client_id, kg_task_manager
            ))

            # Add task to manager for tracking
            await kg_task_manager.add_processing_task(client_id, file_data.filename, processing_task)

            # Mark that clustering will be needed
            await kg_task_manager.mark_clustering_needed(client_id)

            logger.info(
                f"Started knowledge graph extraction for file: {file_data.filename}")

        except Exception as e:
            logger.error(f"Error starting knowledge graph extraction: {e}")

        # Phase 2: Update progress and mark step as completed
        await send_enhanced_progress_update(
            websocket, client_id, "file_processing", 100,
            "File processing completed successfully",
            {
                "filename": file_data.filename,
                "file_path": str(file_path),
                "file_size": len(file_data.content),
                "file_type": file_data.file_type
            }
        )

        # Prepare success data
        success_data = {
            "filename": file_data.filename,
            "file_path": str(file_path),
            "file_size": len(file_data.content),
            "file_type": file_data.file_type
        }

        # Add content information if available
        if content_info:
            success_data["content_info"] = {
                "text_length": len(content_info.get('text', '')) if content_info.get('text') else 0,
                "images_count": len(content_info.get('images', [])),
                "images": content_info.get('images', [])
            }

        # Send success message
        success_message = ServerMessage(
            type="file_upload_success",
            data=success_data
        )
        await asyncio.wait_for(
            websocket.send_text(success_message.model_dump_json()),
            timeout=10.0
        )

        logger.info(f"File uploaded successfully: {file_data.filename}")

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
    """Handle slide generation request from client"""
    try:
        # Phase 2: Validate step prerequisites
        validation = await validate_step_prerequisites(client_id, "step_5_preview")
        if not validation["valid"]:
            error_message = ServerMessage(
                type="slide_generation_error",
                data={
                    "error": validation["error"],
                    "error_code": validation["error_code"],
                    "missing_step": validation.get("missing_step")
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        logger.info(
            f"Received slide generation request for client {client_id} with data: {data}")

        # Phase 2: Send enhanced progress update
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 10,
            "Slide generation request received, starting process..."
        )

        # Get stored files for this client
        files = await file_service.get_client_files(client_id)

        logger.info(f"Retrieved {len(files)} files for client {client_id}")

        if not files:
            error_message = ServerMessage(
                type="slide_generation_error",
                data={
                    "error": "No files found for processing. Please upload files first.",
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

        # Determine if this is a parameterized request or basic request
        has_parameters = 'theme' in data or 'wants_research' in data
        logger.info(
            f"Request type: {'parameterized' if has_parameters else 'basic'}")

        if has_parameters:
            # Parameterized request - use SlideGenerationMessage
            try:
                generation_data = SlideGenerationMessage(**data)
                description = generation_data.description
                theme = generation_data.theme
                wants_research = generation_data.wants_research
                logger.info(
                    f"Using parameterized request - description: {description[:50]}..., theme: {theme}, research: {wants_research}")
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
        else:
            # Basic request - get description from stored data
            description = await slide_service.get_slide_description(client_id)
            theme = "default"
            wants_research = False
            logger.info(
                f"Using basic request - description: {description[:50] if description else 'None'}...")

            if not description:
                error_message = ServerMessage(
                    type="slide_generation_error",
                    data={
                        "error": "No slide description found. Please provide a description first.",
                        "error_code": ERROR_CODES["VALIDATION_ERROR"]
                    }
                )
                await websocket.send_text(error_message.model_dump_json())
                return

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 30,
            "Analyzing uploaded files and generating slide content..."
        )

        # Phase 2: Query knowledge graph for relevant content using enhanced GraphQueryService
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 35,
            "Querying knowledge graph for relevant content..."
        )

        # Initialize knowledge graph service and query service
        kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
        llm_service = LLMService()
        logger.info(f"Knowledge graph service: {kg_service}")
        logger.info(f"LLM service: {llm_service}")
        query_service = GraphQueryService(
            knowledge_graph_service=kg_service,
            llm_service=llm_service
        )

        # Query the knowledge graph for relevant content
        graph_query_result = None
        try:
            logger.info(f"Querying knowledge graph for client {client_id} with description: {description[:100]}...")
            
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
                logger.info(f"Graph query successful for client {client_id}: "
                           f"Found {graph_query_result['metadata']['total_entities_found']} entities, "
                           f"{graph_query_result['metadata']['total_facts_found']} facts")
                
                # Log the key insights for debugging
                insights = graph_query_result.get('high_level_insights', {})
                if insights:
                    logger.info(f"Key insights for client {client_id}: "
                               f"Main themes: {insights.get('main_themes', [])[:3]}, "
                               f"Central entities: {insights.get('central_entities', [])[:3]}")
                
                # Send progress update with knowledge graph results summary
                await send_enhanced_progress_update(
                    websocket, client_id, "slide_generation", 38,
                    f"Knowledge graph analysis complete: Found {graph_query_result['metadata']['total_entities_found']} relevant entities and {graph_query_result['metadata']['total_facts_found']} facts"
                )
                
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

        # Create status callback function
        async def send_status_update(message: str, progress: int):
            try:
                # Phase 2: Use enhanced progress update
                await send_enhanced_progress_update(
                    websocket, client_id, "slide_generation",
                    # Scale progress from 30% to 90%
                    min(30 + (progress * 0.6), 90),
                    message
                )
            except Exception as e:
                logger.error(f"Error sending status update: {e}")

        # Generate the slide with the provided parameters and status callback
        logger.info(f"Starting slide generation for client {client_id}")
        
        # Pass graph query results as additional context if available
        generation_kwargs = {
            "files": files,
            "description": description,
            "theme": theme,
            "wants_research": wants_research,
            "client_id": client_id,
            "status_callback": send_status_update
        }
        
        # Add knowledge graph context if available
        if graph_query_result and "error" not in graph_query_result:
            generation_kwargs["knowledge_graph_context"] = {
                "entities": graph_query_result.get("results", {}).get("entities", []),
                "facts": graph_query_result.get("results", {}).get("facts", []),
                "chunks": graph_query_result.get("results", {}).get("chunks", []),
                "relationships": graph_query_result.get("results", {}).get("relationships", []),
                "insights": graph_query_result.get("high_level_insights", {}),
                "llm_analysis": graph_query_result.get("llm_analysis", {})
            }
            logger.info(f"Using knowledge graph context for client {client_id}: "
                       f"{len(generation_kwargs['knowledge_graph_context']['entities'])} entities, "
                       f"{len(generation_kwargs['knowledge_graph_context']['facts'])} facts")
        else:
            logger.info(f"No knowledge graph context available for client {client_id}, proceeding with standard generation")
        
        slide_result = await slide_service.generate_slide_with_params(**generation_kwargs)

        # Phase 2: Update progress
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 95,
            "Finalizing slide generation..."
        )

        # Send completion message with the generated slide HTML and PPT file path
        slide_html = slide_result.get("slide_html", "")

        # Validate HTML content size before sending
        if len(slide_html) > 50000:  # 50KB limit
            logger.warning(
                f"HTML content too large ({len(slide_html)} chars), truncating")
            slide_html = slide_html[:50000]

        # Log message size for debugging
        message_data = {
            "status": ProcessingStatus.COMPLETED,
            "slide_html": slide_html,
            "ppt_file_path": slide_result.get("ppt_file_path", ""),
            "processing_time": slide_result.get("processing_time", 0),
            "theme": theme,
            "wants_research": wants_research,
            "message": "Slide generation completed successfully"
        }
        
        # Add knowledge graph context information if available
        if graph_query_result and "error" not in graph_query_result:
            message_data["knowledge_graph_used"] = True
            message_data["knowledge_graph_summary"] = {
                "entities_found": graph_query_result['metadata']['total_entities_found'],
                "facts_found": graph_query_result['metadata']['total_facts_found'],
                "chunks_found": graph_query_result['metadata']['total_chunks_found'],
                "relationships_found": graph_query_result['metadata']['total_relationships_found'],
                "main_themes": graph_query_result.get('high_level_insights', {}).get('main_themes', [])[:3],
                "central_entities": graph_query_result.get('high_level_insights', {}).get('central_entities', [])[:3]
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
        logger.info(
            f"Sending completion message, size: {len(message_json)} bytes")

        # Check if message is too large for WebSocket
        if len(message_json) > 65536:  # 64KB limit
            logger.warning(
                f"Message too large ({len(message_json)} bytes), implementing chunking")
            # For now, truncate the HTML content
            # Limit to 30KB
            message_data["slide_html"] = message_data["slide_html"][:30000]
            completion_message = ServerMessage(
                type="slide_generation_complete",
                data=message_data
            )
            message_json = completion_message.model_dump_json()
            logger.info(f"Truncated message size: {len(message_json)} bytes")

        await asyncio.wait_for(
            websocket.send_text(message_json),
            timeout=10.0
        )

        # Phase 2: Update progress and mark step as completed
        await send_enhanced_progress_update(
            websocket, client_id, "slide_generation", 100,
            "Slide generation completed successfully",
            {
                "slide_html": slide_html[:100] + "..." if len(slide_html) > 100 else slide_html,
                "ppt_file_path": slide_result.get("ppt_file_path", ""),
                "processing_time": slide_result.get("processing_time", 0),
                "theme": theme,
                "wants_research": wants_research,
                "knowledge_graph_used": message_data.get("knowledge_graph_used", False),
                "knowledge_graph_summary": message_data.get("knowledge_graph_summary")
            }
        )

        logger.info(
            f"Slide generation completed for client {client_id} with theme: {theme}, research: {wants_research}")

        # Log knowledge graph integration summary
        if graph_query_result and "error" not in graph_query_result:
            logger.info(f"Knowledge graph integration summary for client {client_id}:")
            logger.info(f"  - Entities used: {graph_query_result['metadata']['total_entities_found']}")
            logger.info(f"  - Facts used: {graph_query_result['metadata']['total_facts_found']}")
            logger.info(f"  - Chunks used: {graph_query_result['metadata']['total_chunks_found']}")
            logger.info(f"  - Relationships used: {graph_query_result['metadata']['total_relationships_found']}")
            
            insights = graph_query_result.get('high_level_insights', {})
            if insights:
                logger.info(f"  - Main themes: {insights.get('main_themes', [])}")
                logger.info(f"  - Central entities: {insights.get('central_entities', [])}")
                logger.info(f"  - Key relationships: {insights.get('key_relationships', [])}")
        else:
            logger.info(f"No knowledge graph context used for client {client_id} - standard generation mode")

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


async def handle_agentic_research_request(websocket: WebSocket, client_id: str, data: dict):
    """Handle agentic research request from client"""
    try:
        logger.info(
            f"Processing agentic research request for client {client_id}")

        # Parse enhanced research request
        query = data.get("query", "")
        description = data.get("description", "")
        options = data.get("options", {})

        # Validate required parameters
        if not query or not description:
            error_message = ServerMessage(
                type="agentic_research_error",
                data={
                    "error": "Query and description are required",
                    "error_code": ERROR_CODES["VALIDATION_ERROR"]
                }
            )
            await websocket.send_text(error_message.model_dump_json())
            return

        # Check if agentic research is enabled
        from src.core.config import Settings
        settings = Settings()

        if not settings.ENABLE_AGENTIC_RESEARCH:
            # Fallback to regular research
            logger.info(
                f"Agentic research disabled, falling back to regular research for client {client_id}")
            await handle_research_request(websocket, client_id, {
                "description": description,
                "research_options": options,
                "wants_research": True
            })
            return

        # Initialize agentic research service
        from src.services.agentic_research_service import AgenticResearchService
        research_service = AgenticResearchService(websocket_manager)

        # Send initial progress update
        await send_enhanced_progress_update(
            websocket, client_id, "agentic_research", 5,
            "Starting agentic research workflow..."
        )

        # Start research workflow
        result = await research_service.start_research(
            query=query,
            description=description,
            options=options,
            client_id=client_id
        )

        # Send completion message
        completion_message = ServerMessage(
            type="agentic_research_complete",
            data={
                "status": "completed",
                "workflow_id": result["workflow_id"],
                "research_data": result["synthesized_content"],
                "quality_score": result["quality_score"],
                "sources": result["sources"],
                "enabled_agents": result["enabled_agents"],
                "processing_time": result["processing_time"],
                "cost_metrics": result["cost_metrics"],
                "message": "Agentic research completed successfully"
            }
        )

        await websocket.send_text(completion_message.model_dump_json())
        logger.info(f"Agentic research completed for client {client_id}")

        # Update progress to completed
        await send_enhanced_progress_update(
            websocket, client_id, "agentic_research", 100,
            "Agentic research completed successfully",
            {
                "workflow_id": result["workflow_id"],
                "quality_score": result["quality_score"],
                "sources_count": len(result["sources"]),
                "enabled_agents": result["enabled_agents"]
            }
        )

    except Exception as e:
        logger.error(f"Error handling agentic research request: {e}")
        error_message = ServerMessage(
            type="agentic_research_error",
            data={
                "error": "Failed to process agentic research request",
                "details": str(e),
                "error_code": ERROR_CODES["PROCESSING_ERROR"]
            }
        )
        await websocket.send_text(error_message.model_dump_json())
