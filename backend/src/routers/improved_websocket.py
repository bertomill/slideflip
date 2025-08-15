"""
Improved WebSocket router with cleaner message handling and better service integration
"""

import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, Any, List, Optional

from src.core.improved_websocket_manager import websocket_manager, ClientSession
from src.core.logger import get_service_logger, get_websocket_logger
from src.models.websocket_messages import (
    MessageType, ProcessingStatus, ClientMessage,
    FileUploadMessage, ThemeSelectionMessage, ContentPlanningMessage,
    SlideGenerationMessage, ResearchRequestMessage, StatusRequestMessage,
    ProgressUpdateMessage, SlideCompleteMessage, ContentPlanResponseMessage,
    StatusResponseMessage, ErrorResponseMessage
)

# Import service orchestrator
from src.core.service_orchestrator import get_service_orchestrator
# Import services
from src.services.agentic_research_service import AgenticResearchService
from src.services.file_service import FileService
from src.services.llm_service import LLMService
from src.services.slide_service import SlideService

logger = get_service_logger("websocket_handler")
ws_logger = get_websocket_logger()

# Initialize service orchestrator
orchestrator = get_service_orchestrator()

# Initialize services
file_service = FileService()
llm_service = LLMService()
slide_service = SlideService()

# Global research service instance
research_service = None


class WebSocketMessageHandler:
    """Handles WebSocket message processing with proper service integration"""

    def __init__(self):
        self._register_handlers()
        self._initialize_research_service()

    def _register_handlers(self):
        """Register message handlers"""
        websocket_manager.register_message_handler(
            MessageType.FILE_UPLOAD, self.handle_file_upload)
        websocket_manager.register_message_handler(
            MessageType.SLIDE_DESCRIPTION, self.handle_slide_description)  # Add missing handler
        websocket_manager.register_message_handler(
            MessageType.THEME_SELECTION, self.handle_theme_selection)
        websocket_manager.register_message_handler(
            MessageType.CONTENT_PLANNING, self.handle_content_planning)
        websocket_manager.register_message_handler(
            MessageType.SLIDE_GENERATION, self.handle_slide_generation)
        websocket_manager.register_message_handler(
            MessageType.RESEARCH_REQUEST, self.handle_research_request)
        websocket_manager.register_message_handler(
            MessageType.STATUS_REQUEST, self.handle_status_request)

    def _initialize_research_service(self):
        """Initialize research service with websocket manager"""
        global research_service
        if AgenticResearchService and not research_service:
            research_service = AgenticResearchService(websocket_manager)
            logger.info("Research service initialized with WebSocket manager")

    async def handle_file_upload(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle file upload message"""
        try:
            # Validate message format
            message = FileUploadMessage(**message_dict)

            # Check if client is already processing
            if websocket_manager.is_client_processing(session.client_id):
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

                # Mark the upload step as completed
                session.set_step_completed("step_1_upload", {
                    "files": file_result["files"],
                    "content": file_result["content"]
                })

                # Also store a basic slide description from the file content for later use
                if file_result["content"]:
                    session.session_data[
                        "slide_description"] = f"Create slides based on uploaded content: {file_result['content'][:200]}..."

                # Send completion
                await self._send_progress(session, "upload", 100, "File upload completed successfully")
                session.status = ProcessingStatus.IDLE
                # Next step is slide description
                session.current_step = "step_1b_slide_description"
            else:
                await self._send_error(session, "FILE_PROCESSING_ERROR", file_result["error"])
                session.status = ProcessingStatus.ERROR

        except Exception as e:
            logger.error(
                f"Error handling file upload for {session.client_id}: {e}")
            await self._send_error(session, "PROCESSING_ERROR", str(e))
            session.status = ProcessingStatus.ERROR
        finally:
            await websocket_manager.set_client_processing(session.client_id, False)

    async def handle_slide_description(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle slide description message"""
        try:
            # Check if client is already processing
            if websocket_manager.is_client_processing(session.client_id):
                await self._send_error(session, "ALREADY_PROCESSING", "Another operation is in progress")
                return

            # Set processing status
            await websocket_manager.set_client_processing(session.client_id, True)
            session.status = ProcessingStatus.PROCESSING
            session.current_step = "slide_description"

            # Send progress update
            await self._send_progress(session, "slide_description", 25, "Processing slide description...")

            # Extract description from message
            description = message_dict.get("data", {}).get("description", "")
            if not description:
                await self._send_error(session, "VALIDATION_ERROR", "Slide description is required")
                session.status = ProcessingStatus.ERROR
                return

            # Store the description in session data
            session.session_data["slide_description"] = description

            # Mark the slide description step as completed
            session.set_step_completed("step_1b_slide_description", {
                "description": description,
                "length": len(description)
            })

            # Update current step to indicate user should proceed to theme selection
            session.current_step = "step_2_theme"

            # Send completion
            await self._send_progress(session, "slide_description", 100, "Slide description stored successfully")
            session.status = ProcessingStatus.IDLE

            # Send success response
            await websocket_manager.send_message(session.client_id, {
                "type": "slide_description_success",
                "data": {
                    "description": description,
                    "length": len(description)
                }
            })

        except Exception as e:
            logger.error(
                f"Error handling slide description for {session.client_id}: {e}")
            await self._send_error(session, "PROCESSING_ERROR", str(e))
            session.status = ProcessingStatus.ERROR
        finally:
            await websocket_manager.set_client_processing(session.client_id, False)

    async def _process_file_upload(self, session: ClientSession, file_data) -> Dict[str, Any]:
        """Process uploaded file"""
        try:
            await self._send_progress(session, "upload", 30, "Decoding file content...")

            # Handle both FileUploadData object and dict formats
            if hasattr(file_data, 'filename'):
                # Pydantic model object
                filename = file_data.filename
                content = file_data.content
                file_type = file_data.file_type
            else:
                # Dict format (fallback)
                filename = file_data.get('filename')
                content = file_data.get('content')
                file_type = file_data.get('file_type')

            if not all([filename, content, file_type]):
                raise ValueError(
                    "Missing required file data: filename, content, or file_type")

            # Save file and get FileInfo object
            file_info = await file_service.save_file(
                client_id=session.client_id,
                filename=filename,
                content=content,
                file_type=file_type
            )

            await self._send_progress(session, "upload", 60, "Extracting text content...")

            # Extract content from saved file
            extracted_content = await file_service.extract_text_from_file(file_info.file_path)

            if not extracted_content:
                # Fallback: try to extract content directly
                import base64
                try:
                    decoded_content = base64.b64decode(content)
                    extracted_content = decoded_content.decode(
                        'utf-8', errors='ignore')
                except Exception:
                    extracted_content = "Could not extract text content from file"

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
            # Validate step prerequisites
            validation = websocket_manager.validate_step_prerequisites(
                session.client_id, "step_2_theme")
            if not validation["valid"]:
                await self._send_error(session, "STEP_VALIDATION_ERROR", validation["error"])
                return

            # Fix frontend data structure - extract nested theme_id
            if "data" in message_dict and isinstance(message_dict["data"], dict):
                theme_data = message_dict["data"]

                # Handle nested theme_id structure from frontend
                if "theme_id" in theme_data and isinstance(theme_data["theme_id"], dict):
                    actual_theme_id = theme_data["theme_id"].get(
                        "theme_id", "")
                    theme_data["theme_id"] = actual_theme_id

                # Add missing required fields if not present
                if "theme_name" not in theme_data:
                    theme_data["theme_name"] = f"Theme_{actual_theme_id[:8]}"

                if "color_palette" not in theme_data:
                    theme_data["color_palette"] = ["#000000",
                                                   "#ffffff", "#cccccc"]  # Default palette

            message = ThemeSelectionMessage(**message_dict)

            # Store theme selection
            session.session_data["selected_theme"] = {
                "theme_id": message.data.theme_id,
                "theme_name": message.data.theme_name,
                "color_palette": message.data.color_palette,
                "slide_count": message.data.slide_count
            }

            # Mark the theme step as completed
            session.set_step_completed("step_2_theme", {
                "theme_id": message.data.theme_id,
                "theme_name": message.data.theme_name,
                "color_palette": message.data.color_palette,
                "slide_count": message.data.slide_count
            })

            session.current_step = "step_3_research"  # Next step is research

            await self._send_progress(session, "theme", 100, "Theme selection saved successfully")

        except Exception as e:
            logger.error(
                f"Error handling theme selection for {session.client_id}: {e}")
            await self._send_error(session, "THEME_SELECTION_ERROR", str(e))

    async def handle_content_planning(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle content planning message"""
        try:
            # Fix frontend data structure - handle invalid include_research format
            if "data" in message_dict and isinstance(message_dict["data"], dict):
                planning_data = message_dict["data"]

                # Fix include_research if it's sent as array instead of boolean
                if "include_research" in planning_data:
                    include_research = planning_data["include_research"]
                    if isinstance(include_research, list):
                        # Convert list to boolean (non-empty list = True)
                        planning_data["include_research"] = len(include_research) > 0 and bool(
                            include_research[0]) if include_research else False
                    elif not isinstance(include_research, bool):
                        planning_data["include_research"] = bool(
                            include_research)

                # Ensure research_topics is a list
                if "research_topics" not in planning_data:
                    planning_data["research_topics"] = []
                elif not isinstance(planning_data["research_topics"], list):
                    planning_data["research_topics"] = []

                # Handle AI agent selection
                if "use_ai_agent" not in planning_data:
                    planning_data["use_ai_agent"] = False
                elif not isinstance(planning_data["use_ai_agent"], bool):
                    planning_data["use_ai_agent"] = bool(
                        planning_data["use_ai_agent"])

                # Handle content style
                if "content_style" not in planning_data:
                    planning_data["content_style"] = "professional"

            message = ContentPlanningMessage(**message_dict)

            ws_logger.log_processing(
                session.client_id, "content_planning_started",
                include_research=message.data.include_research,
                research_topics_count=len(
                    message.data.research_topics) if message.data.research_topics else 0
            )

            # Check if client is already processing
            if websocket_manager.is_client_processing(session.client_id):
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
            logger.error(
                f"Error handling content planning for {session.client_id}: {e}")
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
            extracted_content = session.session_data.get(
                "extracted_content", "")
            if not extracted_content:
                return {
                    "success": False,
                    "error": "No uploaded content found"
                }

            await self._send_progress(session, "content", 25, "Analyzing document structure...")
            await asyncio.sleep(0.3)

            # Handle research if requested
            research_results = None
            if planning_data.include_research and planning_data.research_topics:
                await self._send_progress(session, "content", 35, "Conducting web research...")
                research_results = await self._conduct_research(session, planning_data.research_topics, extracted_content)
                await self._send_progress(session, "content", 45, "Research completed, analyzing findings...")

            await self._send_progress(session, "content", 50, "Processing content with AI...")
            await asyncio.sleep(0.2)

            # Determine if AI agent should be used
            use_ai_agent = getattr(planning_data, 'use_ai_agent', False)
            content_style = getattr(
                planning_data, 'content_style', 'professional')

            await self._send_progress(session, "content", 70,
                                      f"Generating content outline{'with AI agent' if use_ai_agent else ''}...")

            # Use the enhanced LLM service with proper agent integration
            logger.info(
                f"Starting content planning with use_ai_agent={use_ai_agent}")
            uploaded_files = session.session_data.get("uploaded_files", [])
            theme_info = session.session_data.get("selected_theme", {})

            content_plan = await llm_service.generate_content_plan(
                description=session.session_data.get(
                    "slide_description", "Generate slide content"),
                research_data=research_results.get(
                    "synthesized_content") if research_results else None,
                theme=theme_info.get("theme_name", "default"),
                uploaded_files=uploaded_files,
                theme_info=theme_info,
                use_ai_agent=use_ai_agent,
                content_style=content_style
            )

            await self._send_progress(session, "content", 85, "Optimizing content structure...")
            await asyncio.sleep(0.2)

            await self._send_progress(session, "content", 95, "Finalizing content plan...")
            await asyncio.sleep(0.1)

            # Store research results in session for later use
            if research_results:
                session.session_data["research_results"] = research_results

            # The enhanced LLM service already returns the correct format
            if isinstance(content_plan, dict):
                plan_content = content_plan.get("content_plan", "")
                slide_count = content_plan.get("slide_count", 1)
                suggestions = content_plan.get("suggestions", [])
                ai_generated = content_plan.get("ai_generated", False)
            else:
                # Fallback for unexpected format
                plan_content = str(content_plan)
                slide_count = 1
                suggestions = []
                ai_generated = False

            # Ensure plan_content is a string for response validation
            if not isinstance(plan_content, str):
                plan_content = str(plan_content)

            # Default suggestions if none provided
            if not suggestions:
                suggestions = ["Add more visual elements",
                               "Include data charts", "Add conclusion slide"]

            return {
                "success": True,
                "plan": plan_content,
                "suggestions": suggestions,
                "slide_count": slide_count,
                "research_included": bool(research_results),
                "ai_agent_used": ai_generated,
                "generation_mode": content_plan.get("generation_mode", "standard") if isinstance(content_plan, dict) else "standard"
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
            if websocket_manager.is_client_processing(session.client_id):
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
            logger.error(
                f"Error handling slide generation for {session.client_id}: {e}")
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

    async def _conduct_research(self, session: ClientSession, research_topics: List[str], document_content: str) -> Optional[Dict[str, Any]]:
        """Conduct web research using the research service"""
        try:
            if not research_service:
                logger.warning("Research service not available")
                return None

            if not research_topics:
                return None

            # Combine research topics into a single query
            research_query = " OR ".join(research_topics)

            # Create research options
            research_options = {
                "maxResults": 5,
                "includeImages": True,
                "includeAnswer": "advanced",
                "timeRange": "month",
                "excludeSocial": True,
                "research_depth": "standard",
                "focus_areas": research_topics,
                "presentation_style": "executive",
                "quality_threshold": 0.7
            }

            # Execute research
            research_result = await research_service.start_research(
                query=research_query,
                description=f"Research for slide content: {document_content[:200]}...",
                options=research_options,
                client_id=session.client_id
            )

            return research_result

        except Exception as e:
            logger.error(f"Research error: {e}")
            return None

    async def handle_research_request(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle research request message"""
        try:
            message = ResearchRequestMessage(**message_dict)

            # Check if client is already processing
            if websocket_manager.is_client_processing(session.client_id):
                await self._send_error(session, "ALREADY_PROCESSING", "Another operation is in progress")
                return

            await websocket_manager.set_client_processing(session.client_id, True)
            session.status = ProcessingStatus.RESEARCHING

            # Conduct research
            research_results = await self._conduct_research(
                session,
                [message.data.query],
                session.session_data.get("extracted_content", "")
            )

            if research_results:
                session.session_data["research_results"] = research_results
                await self._send_progress(session, "research", 100, "Research completed successfully")
            else:
                await self._send_error(session, "RESEARCH_ERROR", "Research service unavailable")

        except Exception as e:
            logger.error(
                f"Error handling research request for {session.client_id}: {e}")
            await self._send_error(session, "RESEARCH_ERROR", str(e))
        finally:
            await websocket_manager.set_client_processing(session.client_id, False)

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
            logger.error(
                f"Error handling status request for {session.client_id}: {e}")
            await self._send_error(session, "STATUS_ERROR", str(e))

    def _calculate_progress(self, session: ClientSession) -> int:
        """Calculate overall progress based on current step"""
        step_progress = {
            "idle": 0,
            "upload": 15,
            "theme": 30,
            "research": 45,
            "content": 65,
            "generate": 85,
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

    # Ensure message handlers are registered
    message_handler._register_handlers()

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
                logger.info(
                    f"Timeout waiting for message from client {client_id}")
                await websocket_manager.disconnect_client(client_id, "Timeout")
                break
            except WebSocketDisconnect:
                logger.info(f"Client {client_id} disconnected normally")
                break
            except Exception as e:
                logger.error(
                    f"Error in message loop for client {client_id}: {e}")
                await websocket_manager.disconnect_client(client_id, "Error in message processing")
                break

    except Exception as e:
        logger.error(
            f"Critical error in WebSocket endpoint for client {client_id}: {e}")

    finally:
        # Ensure cleanup
        await websocket_manager.disconnect_client(client_id, "Connection ended")
