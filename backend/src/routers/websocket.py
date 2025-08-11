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
    ThemeMessage
)
from src.services.file_service import FileService, FileInfo
from src.services.slide_service import SlideService
from src.services.knowledge_graph_service import KnowledgeGraphService
from src.services.kg_task_manager import KnowledgeGraphTaskManager
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

async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time communication with frontend"""
    try:
        # Connect the client with better error handling
        await websocket_manager.connect(websocket, client_id)
        
        # Check if this client has pending knowledge graph tasks that need clustering
        if await kg_task_manager.is_clustering_needed(client_id):
            # Wait for any pending tasks to complete
            await kg_task_manager.wait_for_client_tasks(client_id)
            
            # Perform clustering if needed
            if await kg_task_manager.is_clustering_needed(client_id):
                logger.info(f"Client {client_id} reconnected, performing pending clustering")
                kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
                await perform_final_clustering(client_id, kg_service, kg_task_manager)
                await kg_task_manager.mark_clustering_completed(client_id)
        
        # Try to load existing graphs if available
        if await kg_task_manager.load_existing_graphs_if_available(client_id):
            logger.info(f"Client {client_id} reconnected, loaded existing knowledge graphs")
            
            # Check if new processing is needed
            processing_status = await kg_task_manager.check_if_new_processing_needed(client_id)
            
            # Send a status update to the client
            try:
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
                        data={"error": "Invalid JSON format", "details": str(e)}
                    )
                    await websocket.send_text(error_message.model_dump_json())
                except Exception as send_error:
                    logger.error(f"Error sending JSON error message: {send_error}")
                    break
                continue
            except Exception as e:
                logger.error(f"Error receiving message from client {client_id}: {e}")
                break
            
            # Parse the message
            try:
                message = ClientMessage(**message_data)
                await asyncio.wait_for(
                    handle_client_message(websocket, client_id, message),
                    timeout=60.0
                )
            except asyncio.TimeoutError:
                logger.error(f"Message handling timed out for client {client_id}")
                try:
                    timeout_message = ServerMessage(
                        type="error",
                        data={"error": "Message processing timed out"}
                    )
                    await websocket.send_text(timeout_message.model_dump_json())
                except Exception as send_error:
                    logger.error(f"Error sending timeout message: {send_error}")
                break
            except Exception as e:
                logger.error(f"Error parsing message: {e}")
                try:
                    error_message = ServerMessage(
                        type="error",
                        data={"error": "Invalid message format", "details": str(e)}
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
        logger.info(f"Knowledge graph tasks for client {client_id} will continue running")
        
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        websocket_manager.disconnect(client_id)
        
        # Same note about preserving tasks
        logger.info(f"Knowledge graph tasks for client {client_id} will continue running")

async def handle_client_message(websocket: WebSocket, client_id: str, message: ClientMessage):
    """Handle different types of client messages"""
    try:
        if message.type == "file_upload":
            await handle_file_upload(websocket, client_id, message.data)
        elif message.type == "slide_description":
            logger.info(f"Received slide description from client {client_id}")
            await handle_slide_description(websocket, client_id, message.data)
        elif message.type == "theme_selection":
            logger.info(f"Received theme selection from client {client_id}")
            await handle_theme_selection(websocket, client_id, message.data)
        elif message.type in ["generate_slide", "process_slide"]:
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
        else:
            logger.warning(f"Unknown message type: {message.type}")
            error_message = ServerMessage(
                type="error",
                data={"error": f"Unknown message type: {message.type}"}
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
                data={"error": "Internal server error", "details": str(e)}
            )
            await websocket.send_text(error_message.model_dump_json())
        except Exception as send_error:
            logger.error(f"Error sending error message: {send_error}")
            raise

async def handle_file_upload(websocket: WebSocket, client_id: str, data: dict):
    """Handle file upload from client"""
    try:
        # Send acknowledgment
        ack_message = ServerMessage(
            type="file_upload_ack",
            data={"status": "received", "message": "File upload request received"}
        )
        await asyncio.wait_for(
            websocket.send_text(ack_message.model_dump_json()),
            timeout=10.0
        )
        
        # Process the file upload
        file_data = FileUploadMessage(**data)
        
        logger.info(f"Saving file {file_data.filename} for client {client_id}")
        
        # Check if file already exists and has been processed
        if await kg_task_manager.is_file_processed(client_id, file_data.filename):
            logger.info(f"File {file_data.filename} already processed for client {client_id}, skipping knowledge graph extraction")
            
            # Still save the file and send success, but skip KG processing
            file_path = await file_service.save_uploaded_file(
                file_data.filename,
                file_data.content,
                file_data.file_type,
                client_id
            )
            
            # Extract content (text and images) for HTML files
            content_info = None
            if file_data.filename.lower().endswith(('.html', '.htm', '.txt', '.md')):
                content_info = await file_service.extract_content_from_file(str(file_path))
            
            # Store extracted content in slide service
            if client_id:
                await slide_service.store_file_content(client_id, str(file_path), file_data.filename)
            
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
            logger.info(f"Client {client_id} has existing clustered graph, skipping knowledge graph extraction for new file")
            
            # Still save the file and send success, but skip KG processing
            file_path = await file_service.save_uploaded_file(
                file_data.filename,
                file_data.content,
                file_data.file_type,
                client_id
            )
            
            # Extract content (text and images) for HTML files
            content_info = None
            if file_data.filename.lower().endswith(('.html', '.htm', '.txt', '.md')):
                content_info = await file_service.extract_content_from_file(str(file_path))
            
            # Store extracted content in slide service
            if client_id:
                await slide_service.store_file_content(client_id, str(file_path), file_data.filename)
            
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
        
        # Save file to disk
        file_path = await file_service.save_uploaded_file(
            file_data.filename,
            file_data.content,
            file_data.file_type,
            client_id
        )
        
        # Extract content (text and images) for HTML files
        content_info = None
        if file_data.filename.lower().endswith(('.html', '.htm', '.txt', '.md')):
            content_info = await file_service.extract_content_from_file(str(file_path))
        
        # Store extracted content in slide service
        if client_id:
            await slide_service.store_file_content(client_id, str(file_path), file_data.filename)
        
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
            
            logger.info(f"Started knowledge graph extraction for file: {file_data.filename}")
            
        except Exception as e:
            logger.error(f"Error starting knowledge graph extraction: {e}")
        
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
                data={"error": "Failed to process file upload", "details": str(e)}
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
        # Send acknowledgment
        ack_message = ServerMessage(
            type="slide_description_ack",
            data={"status": "received", "message": "Slide description received"}
        )
        await asyncio.wait_for(
            websocket.send_text(ack_message.model_dump_json()),
            timeout=10.0
        )
        
        # Process the slide description
        description_data = SlideDescriptionMessage(**data)
        
        # Store the description
        await slide_service.store_slide_description(client_id, description_data.description)
        
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
                data={"error": "Failed to process slide description", "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending slide description error: {send_error}")
            raise

async def handle_theme_selection(websocket: WebSocket, client_id: str, data: dict):
    """Handle theme selection from client"""
    try:
        # Send acknowledgment
        ack_message = ServerMessage(
            type="theme_selection_ack",
            data={"status": "received", "message": "Theme selection received"}
        )
        await asyncio.wait_for(
            websocket.send_text(ack_message.model_dump_json()),
            timeout=10.0
        )
        
        # Process the theme selection
        theme_data = ThemeMessage(**data)
        
        # Store the theme information
        await slide_service.store_theme_selection(client_id, theme_data)
        
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
        
        logger.info(f"Theme selection stored for client {client_id}: {theme_data.theme_id}")
        
    except Exception as e:
        logger.error(f"Error handling theme selection: {e}")
        try:
            error_message = ServerMessage(
                type="theme_selection_error",
                data={"error": "Failed to process theme selection", "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending theme selection error: {send_error}")
            raise

async def handle_generate_slide(websocket: WebSocket, client_id: str, data: dict):
    """Handle slide generation request from client"""
    try:
        logger.info(f"Received slide generation request for client {client_id} with data: {data}")
        
        # Send processing started message
        processing_message = ServerMessage(
            type="slide_generation_started",
            data={
                "status": ProcessingStatus.STARTED,
                "message": "Starting slide generation process..."
            }
        )
        await asyncio.wait_for(
            websocket.send_text(processing_message.model_dump_json()),
            timeout=10.0
        )
        logger.info(f"Sent slide_generation_started message to client {client_id}")
        
        # Get stored files for this client
        files = await file_service.get_client_files(client_id)
        
        logger.info(f"Retrieved {len(files)} files for client {client_id}")
        
        if not files:
            error_message = ServerMessage(
                type="slide_generation_error",
                data={"error": "No files found for processing. Please upload files first."}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
            return
        
        # Determine if this is a parameterized request or basic request
        has_parameters = 'theme' in data or 'wants_research' in data
        logger.info(f"Request type: {'parameterized' if has_parameters else 'basic'}")
        
        if has_parameters:
            # Parameterized request - use SlideGenerationMessage
            try:
                generation_data = SlideGenerationMessage(**data)
                description = generation_data.description
                theme = generation_data.theme
                wants_research = generation_data.wants_research
                logger.info(f"Using parameterized request - description: {description[:50]}..., theme: {theme}, research: {wants_research}")
            except Exception as e:
                logger.error(f"Error parsing generation data: {e}")
                error_message = ServerMessage(
                    type="slide_generation_error",
                    data={"error": "Invalid generation parameters", "details": str(e)}
                )
                await asyncio.wait_for(
                    websocket.send_text(error_message.model_dump_json()),
                    timeout=10.0
                )
                return
        else:
            # Basic request - get description from stored data
            description = await slide_service.get_slide_description(client_id)
            theme = "default"
            wants_research = False
            logger.info(f"Using basic request - description: {description[:50] if description else 'None'}...")
            
            if not description:
                error_message = ServerMessage(
                    type="slide_generation_error",
                    data={"error": "No slide description found. Please provide a description first."}
                )
                await asyncio.wait_for(
                    websocket.send_text(error_message.model_dump_json()),
                    timeout=10.0
                )
                return
        
        # Update processing status
        processing_message = ServerMessage(
            type="slide_generation_status",
            data={
                "status": ProcessingStatus.ANALYZING,
                "message": "Analyzing uploaded files and generating slide content...",
                "progress": 0
            }
        )
        await asyncio.wait_for(
            websocket.send_text(processing_message.model_dump_json()),
            timeout=10.0
        )
        logger.info(f"Sent initial status update to client {client_id}")
        
        # Create status callback function
        async def send_status_update(message: str, progress: int):
            try:
                logger.info(f"Sending status update to client {client_id}: {message} (progress: {progress}%)")
                status_message = ServerMessage(
                    type="slide_generation_status",
                    data={
                        "status": ProcessingStatus.PROCESSING,
                        "message": message,
                        "progress": progress
                    }
                )
                await asyncio.wait_for(
                    websocket.send_text(status_message.model_dump_json()),
                    timeout=10.0
                )
            except Exception as e:
                logger.error(f"Error sending status update: {e}")
        
        # Generate the slide with the provided parameters and status callback
        logger.info(f"Starting slide generation for client {client_id}")
        slide_result = await slide_service.generate_slide_with_params(
            files, 
            description,
            theme,
            wants_research,
            client_id,
            status_callback=send_status_update
        )
        
        # Send completion message with the generated slide HTML and PPT file path
        slide_html = slide_result.get("slide_html", "")
        
        # Validate HTML content size before sending
        if len(slide_html) > 50000:  # 50KB limit
            logger.warning(f"HTML content too large ({len(slide_html)} chars), truncating")
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
        
        completion_message = ServerMessage(
            type="slide_generation_complete",
            data=message_data
        )
        
        # Log the message size
        message_json = completion_message.model_dump_json()
        logger.info(f"Sending completion message, size: {len(message_json)} bytes")
        
        # Check if message is too large for WebSocket
        if len(message_json) > 65536:  # 64KB limit
            logger.warning(f"Message too large ({len(message_json)} bytes), implementing chunking")
            # For now, truncate the HTML content
            message_data["slide_html"] = message_data["slide_html"][:30000]  # Limit to 30KB
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
        
        logger.info(f"Slide generation completed for client {client_id} with theme: {theme}, research: {wants_research}")
        
    except Exception as e:
        logger.error(f"Error generating slide: {e}")
        try:
            error_message = ServerMessage(
                type="slide_generation_error",
                data={"error": "Failed to generate slide", "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending slide generation error: {send_error}")
            raise
