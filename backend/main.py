#!/usr/bin/env python3
"""
Main entry point for the SlideFlip Backend
Handles WebSocket connections and file processing for slide generation
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Dict, List
import json
import os
from pathlib import Path

# Import our custom modules
from src.core.config import Settings
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
from src.services.file_service import FileService
from src.services.slide_service import SlideService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global settings
settings = Settings()

# Initialize services
file_service = FileService()
slide_service = SlideService()

# WebSocket connection manager
websocket_manager = WebSocketManager()

# Background task for cleaning up stale connections
async def cleanup_stale_connections():
    """Periodically clean up stale WebSocket connections"""
    while True:
        try:
            await asyncio.sleep(30)  # Run every 30 seconds instead of 60
            await websocket_manager.cleanup_stale_connections()
            
            # Log connection statistics
            stats = websocket_manager.get_connection_stats()
            if stats["total_connections"] > 0:
                logger.info(f"Connection stats: {stats}")
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting SlideFlip Backend...")
    
    # Create necessary directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(cleanup_stale_connections())
    
    logger.info("Backend started successfully")
    yield
    
    # Cancel cleanup task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    logger.info("Shutting down SlideFlip Backend...")

# Create FastAPI app
app = FastAPI(
    title="SlideFlip Backend",
    description="Backend API for SlideFlip presentation generator",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "SlideFlip Backend is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    stats = websocket_manager.get_connection_stats()
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "file_service": "running",
            "slide_service": "running",
            "websocket_manager": "running"
        },
        "websocket_stats": stats
    }

@app.get("/debug/connections")
async def debug_connections():
    """Debug endpoint to show current WebSocket connections"""
    stats = websocket_manager.get_connection_stats()
    connections = websocket_manager.get_all_connection_info()
    return {
        "stats": stats,
        "connections": connections
    }

@app.get("/debug/client-folders")
async def debug_client_folders():
    """Debug endpoint to list client folders and their contents"""
    try:
        client_folders = file_service.list_client_folders()
        folder_details = []
        
        for client_id in client_folders:
            folder_path = file_service.get_client_folder_path(client_id)
            folder_size = file_service.get_client_folder_size(client_id)
            files = await file_service.get_client_files(client_id)
            
            # Get content statistics
            content_stats = await slide_service.get_client_content_stats(client_id)
            
            folder_details.append({
                "client_id": client_id,
                "folder_path": str(folder_path),
                "folder_size": folder_size,
                "file_count": len(files),
                "files": [f.model_dump() for f in files],
                "content_stats": content_stats
            })
        
        return {
            "total_clients": len(client_folders),
            "client_folders": folder_details
        }
    except Exception as e:
        logger.error(f"Error in debug_client_folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{file_path:path}")
async def download_file(file_path: str):
    """Download endpoint for generated PPT files"""
    try:
        import os
        from pathlib import Path
        
        logger.info(f"Download request for file path: {file_path}")
        
        # Handle different path formats
        if file_path.startswith("uploads/"):
            # Remove the uploads/ prefix and handle as client folder
            relative_path = file_path[8:]  # Remove "uploads/"
            if relative_path.startswith("client_"):
                upload_dir = Path(file_service.settings.UPLOAD_DIR)
                requested_file = upload_dir / relative_path
                
                # Prevent directory traversal attacks
                if not requested_file.resolve().is_relative_to(upload_dir.resolve()):
                    raise HTTPException(status_code=403, detail="Access denied")
            else:
                raise HTTPException(status_code=404, detail="Invalid file path")
        elif file_path.startswith("client_"):
            # Direct client folder path
            upload_dir = Path(file_service.settings.UPLOAD_DIR)
            requested_file = upload_dir / file_path
            
            # Prevent directory traversal attacks
            if not requested_file.resolve().is_relative_to(upload_dir.resolve()):
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            # File is in the output directory (backward compatibility)
            output_dir = Path("output")
            requested_file = output_dir / file_path
            
            # Prevent directory traversal attacks
            if not requested_file.resolve().is_relative_to(output_dir.resolve()):
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if file exists
        if not requested_file.exists():
            logger.error(f"File not found: {requested_file}")
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file info
        file_size = requested_file.stat().st_size
        file_name = requested_file.name
        
        logger.info(f"Serving file: {requested_file} (size: {file_size} bytes)")
        
        # Return file as downloadable response
        from fastapi.responses import FileResponse
        return FileResponse(
            path=str(requested_file),
            filename=file_name,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving file {file_path}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/debug/check-file/{file_path:path}")
async def check_file_exists(file_path: str):
    """Debug endpoint to check if a file exists"""
    try:
        import os
        from pathlib import Path
        
        logger.info(f"Checking file existence for: {file_path}")
        
        # Handle different path formats (same logic as download endpoint)
        if file_path.startswith("uploads/"):
            relative_path = file_path[8:]  # Remove "uploads/"
            if relative_path.startswith("client_"):
                upload_dir = Path(file_service.settings.UPLOAD_DIR)
                requested_file = upload_dir / relative_path
            else:
                return {"exists": False, "error": "Invalid file path"}
        elif file_path.startswith("client_"):
            upload_dir = Path(file_service.settings.UPLOAD_DIR)
            requested_file = upload_dir / file_path
        else:
            output_dir = Path("output")
            requested_file = output_dir / file_path
        
        exists = requested_file.exists()
        size = requested_file.stat().st_size if exists else 0
        
        return {
            "file_path": str(requested_file),
            "exists": exists,
            "size": size,
            "parent_exists": requested_file.parent.exists() if requested_file.parent else False
        }
        
    except Exception as e:
        logger.error(f"Error checking file {file_path}: {e}")
        return {"exists": False, "error": str(e)}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time communication with frontend"""
    try:
        # Connect the client with better error handling
        await websocket_manager.connect(websocket, client_id)
        
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
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        websocket_manager.disconnect(client_id)

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
        
        # Save file to disk
        file_path = await file_service.save_uploaded_file(
            file_data.filename,
            file_data.content,
            file_data.file_type,
            client_id
        )
        
        # Extract content (text and images) for HTML files
        content_info = None
        if file_data.filename.lower().endswith(('.html', '.htm')):
            content_info = await file_service.extract_content_from_file(str(file_path))
        
        # Store extracted content in slide service
        if client_id:
            await slide_service.store_file_content(client_id, str(file_path), file_data.filename)
        
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

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 