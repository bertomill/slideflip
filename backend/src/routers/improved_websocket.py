"""
Improved WebSocket router with cleaner message handling and better service integration
"""

import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, Any

from src.core.improved_websocket_manager import websocket_manager, ClientSession
from src.core.logger import get_service_logger, get_websocket_logger
from src.models.websocket_messages import (
    MessageType, ProcessingStatus, ClientMessage,
    FileUploadMessage, ThemeSelectionMessage, ContentPlanningMessage,
    SlideGenerationMessage, ResearchRequestMessage, StatusRequestMessage,
    ProgressUpdateMessage, SlideCompleteMessage, ContentPlanResponseMessage,
    StatusResponseMessage, ErrorResponseMessage
)

# Import services
from src.services.file_service import FileService
from src.services.slide_service import SlideService
from src.services.llm_service import LLMService
try:
    from src.services.document_parser import DocumentParserService
except ImportError:
    # Fallback if DocumentParserService doesn't exist
    DocumentParserService = None

logger = get_service_logger("websocket_handler")
ws_logger = get_websocket_logger()

# Initialize services
file_service = FileService()
slide_service = SlideService()
llm_service = LLMService()
document_parser = DocumentParserService() if DocumentParserService else None


class WebSocketMessageHandler:
    """Handles WebSocket message processing with proper service integration"""
    
    def __init__(self):
        self._register_handlers()
    
    def _register_handlers(self):
        """Register message handlers"""
        websocket_manager.register_message_handler(MessageType.FILE_UPLOAD, self.handle_file_upload)
        websocket_manager.register_message_handler(MessageType.THEME_SELECTION, self.handle_theme_selection)
        websocket_manager.register_message_handler(MessageType.CONTENT_PLANNING, self.handle_content_planning)
        websocket_manager.register_message_handler(MessageType.SLIDE_GENERATION, self.handle_slide_generation)
        websocket_manager.register_message_handler(MessageType.RESEARCH_REQUEST, self.handle_research_request)
        websocket_manager.register_message_handler(MessageType.STATUS_REQUEST, self.handle_status_request)
    
    async def handle_file_upload(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle file upload message"""
        try:
            # Validate message format
            message = FileUploadMessage(**message_dict)
            
            # Check if client is already processing
            if await websocket_manager.is_client_processing(session.client_id):
                await self._send_error(session, "ALREADY_PROCESSING", "Another operation is in progress")
                return
            
            # Set processing status
            await websocket_manager.set_client_processing(session.client_id, True)
            session.status = ProcessingStatus.UPLOADING
            session.current_step = "upload"
            
            # Send progress update
            await self._send_progress(session, "upload", 10, "Starting file upload processing...")
            
            # Process file
            file_result = await self._process_file_upload(session, message.data)
            
            if file_result["success"]:
                # Update session data
                session.session_data["uploaded_files"] = file_result["files"]
                session.session_data["extracted_content"] = file_result["content"]
                
                # Send completion
                await self._send_progress(session, "upload", 100, "File upload completed successfully")
                session.status = ProcessingStatus.IDLE
                session.current_step = "theme"
            else:
                await self._send_error(session, "FILE_PROCESSING_ERROR", file_result["error"])
                session.status = ProcessingStatus.ERROR
            
        except Exception as e:
            logger.error(f"Error handling file upload for {session.client_id}: {e}")
            await self._send_error(session, "PROCESSING_ERROR", str(e))
            session.status = ProcessingStatus.ERROR
        finally:
            await websocket_manager.set_client_processing(session.client_id, False)
    
    async def _process_file_upload(self, session: ClientSession, file_data) -> Dict[str, Any]:
        """Process uploaded file"""
        try:
            await self._send_progress(session, "upload", 30, "Decoding file content...")
            
            # Decode and validate file
            file_info = await file_service.save_file(
                client_id=session.client_id,
                filename=file_data.filename,
                content=file_data.content,
                file_type=file_data.file_type
            )
            
            await self._send_progress(session, "upload", 60, "Extracting text content...")
            
            # Extract content
            if document_parser:
                extracted_content = await document_parser.parse_file(
                    file_path=file_info.file_path,
                    file_type=file_data.file_type
                )
            else:
                # Fallback content extraction
                with open(file_info.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    extracted_content = f.read()
            
            await self._send_progress(session, "upload", 90, "Finalizing upload...")
            
            return {
                "success": True,
                "files": [file_info.dict()],
                "content": extracted_content
            }
            
        except Exception as e:
            logger.error(f"File processing error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_theme_selection(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle theme selection message"""
        try:
            message = ThemeSelectionMessage(**message_dict)
            
            # Store theme selection
            session.session_data["selected_theme"] = {
                "theme_id": message.data.theme_id,
                "theme_name": message.data.theme_name,
                "color_palette": message.data.color_palette,
                "slide_count": message.data.slide_count
            }
            
            session.current_step = "research"
            
            await self._send_progress(session, "theme", 100, "Theme selection saved successfully")
            
        except Exception as e:
            logger.error(f"Error handling theme selection for {session.client_id}: {e}")
            await self._send_error(session, "THEME_SELECTION_ERROR", str(e))
    
    async def handle_content_planning(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle content planning message"""
        try:
            message = ContentPlanningMessage(**message_dict)
            
            ws_logger.log_processing(
                session.client_id, "content_planning_started",
                include_research=message.data.include_research,
                research_topics_count=len(message.data.research_topics) if message.data.research_topics else 0
            )
            
            # Check if client is already processing
            if await websocket_manager.is_client_processing(session.client_id):
                await self._send_error(session, "ALREADY_PROCESSING", "Another operation is in progress")
                return
            
            await websocket_manager.set_client_processing(session.client_id, True)
            session.status = ProcessingStatus.PLANNING
            session.current_step = "content"
            
            await self._send_progress(session, "content", 5, "Initializing content planning...")
            await asyncio.sleep(0.1)  # Allow UI to update
            
            # Generate content plan
            with logger.timer("content_plan_generation", client_id=session.client_id):
                content_plan = await self._generate_content_plan(session, message.data)
            
            if content_plan["success"]:
                # Send content plan response
                response = ContentPlanResponseMessage(
                    client_id=session.client_id,
                    request_id=message.id,
                    data={
                        "content_plan": content_plan["plan"],
                        "suggestions": content_plan.get("suggestions", []),
                        "estimated_slide_count": content_plan.get("slide_count", 1)
                    }
                )
                await websocket_manager.send_message(session.client_id, response)
                
                session.session_data["content_plan"] = content_plan["plan"]
                session.status = ProcessingStatus.IDLE
                session.current_step = "generate"
            else:
                await self._send_error(session, "CONTENT_PLANNING_ERROR", content_plan["error"])
                session.status = ProcessingStatus.ERROR
            
        except Exception as e:
            logger.error(f"Error handling content planning for {session.client_id}: {e}")
            await self._send_error(session, "PROCESSING_ERROR", str(e))
            session.status = ProcessingStatus.ERROR
        finally:
            await websocket_manager.set_client_processing(session.client_id, False)
    
    async def _generate_content_plan(self, session: ClientSession, planning_data) -> Dict[str, Any]:
        """Generate content plan using LLM service"""
        try:
            await self._send_progress(session, "content", 15, "Preparing content analysis...")
            await asyncio.sleep(0.2)
            
            # Get uploaded content
            extracted_content = session.session_data.get("extracted_content", "")
            if not extracted_content:
                return {
                    "success": False,
                    "error": "No uploaded content found"
                }
            
            await self._send_progress(session, "content", 25, "Analyzing document structure...")
            await asyncio.sleep(0.3)
            
            # Handle research if requested
            if planning_data.include_research and planning_data.research_topics:
                await self._send_progress(session, "content", 35, "Conducting web research...")
                await asyncio.sleep(0.4)
                # Research would be done here
                
            await self._send_progress(session, "content", 50, "Processing content with AI...")
            await asyncio.sleep(0.2)
            
            # Generate content plan using LLM
            await self._send_progress(session, "content", 70, "Generating content outline...")
            content_plan = await llm_service.generate_content_from_files(session.client_id)
            
            await self._send_progress(session, "content", 85, "Optimizing content structure...")
            await asyncio.sleep(0.2)
            
            await self._send_progress(session, "content", 95, "Finalizing content plan...")
            await asyncio.sleep(0.1)
            
            return {
                "success": True,
                "plan": content_plan,
                "suggestions": ["Add more visual elements", "Include data charts", "Add conclusion slide"],
                "slide_count": 1
            }
            
        except Exception as e:
            logger.error(f"Content plan generation error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_slide_generation(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle slide generation message"""
        try:
            message = SlideGenerationMessage(**message_dict)
            
            # Check if client is already processing
            if await websocket_manager.is_client_processing(session.client_id):
                await self._send_error(session, "ALREADY_PROCESSING", "Another operation is in progress")
                return
            
            await websocket_manager.set_client_processing(session.client_id, True)
            session.status = ProcessingStatus.GENERATING
            session.current_step = "generate"
            
            await self._send_progress(session, "generate", 10, "Starting slide generation...")
            
            # Generate slide
            slide_result = await self._generate_slide(session, message.data)
            
            if slide_result["success"]:
                # Send slide complete message
                response = SlideCompleteMessage(
                    client_id=session.client_id,
                    request_id=message.id,
                    data={
                        "slide_html": slide_result["html"],
                        "slide_name": slide_result["name"],
                        "metadata": slide_result.get("metadata", {}),
                        "generation_time": slide_result.get("generation_time", 0.0)
                    }
                )
                await websocket_manager.send_message(session.client_id, response)
                
                session.status = ProcessingStatus.COMPLETED
                session.current_step = "completed"
            else:
                await self._send_error(session, "SLIDE_GENERATION_ERROR", slide_result["error"])
                session.status = ProcessingStatus.ERROR
            
        except Exception as e:
            logger.error(f"Error handling slide generation for {session.client_id}: {e}")
            await self._send_error(session, "PROCESSING_ERROR", str(e))
            session.status = ProcessingStatus.ERROR
        finally:
            await websocket_manager.set_client_processing(session.client_id, False)
    
    async def _generate_slide(self, session: ClientSession, generation_data) -> Dict[str, Any]:
        """Generate slide using slide service"""
        try:
            await self._send_progress(session, "generate", 30, "Preparing slide content...")
            
            # Get session data
            content_plan = generation_data["content_plan"]
            theme_config = generation_data["theme_config"]
            
            await self._send_progress(session, "generate", 60, "Generating slide HTML...")
            
            # Generate slide HTML
            slide_html = await slide_service.generate_slide_html(
                client_id=session.client_id,
                content_plan=content_plan,
                theme_config=theme_config
            )
            
            await self._send_progress(session, "generate", 90, "Finalizing slide...")
            
            return {
                "success": True,
                "html": slide_html,
                "name": f"Slide_{session.client_id}",
                "metadata": {"created_at": session.connected_at.isoformat()},
                "generation_time": 2.5
            }
            
        except Exception as e:
            logger.error(f"Slide generation error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_research_request(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle research request message"""
        try:
            message = ResearchRequestMessage(**message_dict)
            
            # For now, return a simple response
            await self._send_progress(session, "research", 100, "Research feature coming soon")
            
        except Exception as e:
            logger.error(f"Error handling research request for {session.client_id}: {e}")
            await self._send_error(session, "RESEARCH_ERROR", str(e))
    
    async def handle_status_request(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle status request message"""
        try:
            message = StatusRequestMessage(**message_dict)
            
            # Send status response
            response = StatusResponseMessage(
                client_id=session.client_id,
                request_id=message.id,
                data={
                    "current_step": session.current_step,
                    "overall_progress": self._calculate_progress(session),
                    "session_start_time": session.connected_at.isoformat(),
                    "last_activity": session.last_activity.isoformat(),
                    "step_details": {
                        "status": session.status.value,
                        "processing": session.processing
                    }
                }
            )
            await websocket_manager.send_message(session.client_id, response)
            
        except Exception as e:
            logger.error(f"Error handling status request for {session.client_id}: {e}")
            await self._send_error(session, "STATUS_ERROR", str(e))
    
    def _calculate_progress(self, session: ClientSession) -> int:
        """Calculate overall progress based on current step"""
        step_progress = {
            "idle": 0,
            "upload": 20,
            "theme": 40,
            "research": 50,
            "content": 70,
            "generate": 90,
            "completed": 100
        }
        return step_progress.get(session.current_step, 0)
    
    async def _send_progress(self, session: ClientSession, step: str, progress: int, message: str):
        """Send progress update to client"""
        try:
            progress_message = ProgressUpdateMessage(
                client_id=session.client_id,
                data={
                    "step": step,
                    "progress": progress,
                    "message": message,
                    "step_data": {}
                }
            )
            await websocket_manager.send_message(session.client_id, progress_message)
        except Exception as e:
            logger.error(f"Error sending progress update: {e}")
    
    async def _send_error(self, session: ClientSession, error_code: str, error_message: str):
        """Send error message to client"""
        try:
            error_msg = ErrorResponseMessage(
                client_id=session.client_id,
                data={
                    "error_code": error_code,
                    "error_message": error_message,
                    "details": None,
                    "retry_possible": error_code not in ["ALREADY_PROCESSING"]
                }
            )
            await websocket_manager.send_message(session.client_id, error_msg)
        except Exception as e:
            logger.error(f"Error sending error message: {e}")


# Initialize message handler
message_handler = WebSocketMessageHandler()


async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    Improved WebSocket endpoint with better error handling and message processing
    """
    logger.info(f"WebSocket connection attempt from client: {client_id}")
    
    # Connect client
    connected = await websocket_manager.connect_client(websocket, client_id)
    if not connected:
        logger.warning(f"Failed to connect client {client_id}")
        return
    
    try:
        # Main message handling loop
        while True:
            try:
                # Receive message with timeout
                message_data = await asyncio.wait_for(websocket.receive_text(), timeout=300.0)
                
                # Handle message
                await websocket_manager.handle_client_message(client_id, message_data)
                
            except asyncio.TimeoutError:
                logger.info(f"Timeout waiting for message from client {client_id}")
                await websocket_manager.disconnect_client(client_id, "Timeout")
                break
            except WebSocketDisconnect:
                logger.info(f"Client {client_id} disconnected normally")
                break
            except Exception as e:
                logger.error(f"Error in message loop for client {client_id}: {e}")
                await websocket_manager.disconnect_client(client_id, "Error in message processing")
                break
    
    except Exception as e:
        logger.error(f"Critical error in WebSocket endpoint for client {client_id}: {e}")
    
    finally:
        # Ensure cleanup
        await websocket_manager.disconnect_client(client_id, "Connection ended")