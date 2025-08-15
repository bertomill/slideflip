"""
Improved WebSocket Manager with better connection handling and state management
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any, Callable
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
import weakref
from dataclasses import dataclass, field

from src.models.websocket_messages import (
    BaseWebSocketMessage, ServerMessage, ClientMessage,
    ProcessingStatus, MessageType, AcknowledgeMessage,
    ErrorResponseMessage, SessionInitializedMessage,
    PongMessage, StatusResponseMessage
)
from src.core.logger import get_websocket_logger, get_logger

logger = get_logger("websocket.manager")
ws_logger = get_websocket_logger()


@dataclass
class ClientSession:
    """Client session data with connection management"""
    client_id: str
    websocket: WebSocket
    connected_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    current_step: str = "step_1_upload"  # Updated to use step-based naming
    status: ProcessingStatus = ProcessingStatus.IDLE
    processing: bool = False
    session_data: Dict[str, Any] = field(default_factory=dict)
    message_queue: asyncio.Queue = field(
        default_factory=lambda: asyncio.Queue(maxsize=100))

    # Step-based workflow tracking (matching old system)
    step_1_upload: Dict[str, Any] = field(
        default_factory=lambda: {"completed": False, "data": {}})
    step_1b_slide_description: Dict[str, Any] = field(
        default_factory=lambda: {"completed": False, "data": {}})
    step_2_theme: Dict[str, Any] = field(
        default_factory=lambda: {"completed": False, "data": {}})
    step_3_research: Dict[str, Any] = field(
        default_factory=lambda: {"completed": False, "data": {}})
    step_4_content: Dict[str, Any] = field(
        default_factory=lambda: {"completed": False, "data": {}})
    step_5_preview: Dict[str, Any] = field(
        default_factory=lambda: {"completed": False, "data": {}})
    overall_progress: int = 0
    session_start_time: str = field(
        default_factory=lambda: datetime.now().isoformat())

    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.now()

    def is_stale(self, timeout_minutes: int = 30) -> bool:
        """Check if session is stale based on last activity"""
        return (datetime.now() - self.last_activity) > timedelta(minutes=timeout_minutes)

    def get_step_data(self, step_name: str) -> Dict[str, Any]:
        """Get step data by name"""
        return getattr(self, step_name, {"completed": False, "data": {}})

    def set_step_completed(self, step_name: str, data: Dict[str, Any] = None):
        """Mark a step as completed with optional data"""
        if hasattr(self, step_name):
            step_data = getattr(self, step_name)
            step_data["completed"] = True
            if data:
                step_data["data"].update(data)
            self._update_overall_progress()

    def _update_overall_progress(self):
        """Update overall progress based on completed steps"""
        total_steps = 6
        completed_steps = sum([
            1 if self.step_1_upload["completed"] else 0,
            1 if self.step_1b_slide_description["completed"] else 0,
            1 if self.step_2_theme["completed"] else 0,
            1 if self.step_3_research["completed"] else 0,
            1 if self.step_4_content["completed"] else 0,
            1 if self.step_5_preview["completed"] else 0
        ])
        self.overall_progress = int((completed_steps / total_steps) * 100)


class ImprovedWebSocketManager:
    """Enhanced WebSocket manager with better connection handling"""

    def __init__(self, max_connections: int = 50):
        self.max_connections = max_connections
        self._sessions: Dict[str, ClientSession] = {}
        self._connection_lock = asyncio.Lock()
        self._processing_clients: Set[str] = set()
        self._message_handlers: Dict[MessageType, Callable] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._initialized = False

    def _start_cleanup_task(self):
        """Start background cleanup task"""
        try:
            if self._cleanup_task is None or self._cleanup_task.done():
                self._cleanup_task = asyncio.create_task(
                    self._cleanup_stale_connections())
        except RuntimeError:
            # No event loop running, will start cleanup task later
            pass

    async def initialize(self):
        """Initialize the manager with running event loop"""
        if not self._initialized:
            self._start_cleanup_task()
            self._initialized = True

    async def _cleanup_stale_connections(self):
        """Clean up stale connections periodically"""
        while True:
            try:
                await asyncio.sleep(300)  # Check every 5 minutes
                stale_clients = []

                async with self._connection_lock:
                    for client_id, session in self._sessions.items():
                        if session.is_stale():
                            stale_clients.append(client_id)

                for client_id in stale_clients:
                    logger.info(
                        f"Cleaning up stale connection for client {client_id}")
                    await self.disconnect_client(client_id, "Connection timeout")

            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")

    async def connect_client(self, websocket: WebSocket, client_id: str) -> bool:
        """Connect a new client with proper error handling"""
        # Ensure manager is initialized
        await self.initialize()

        async with self._connection_lock:
            try:
                # Check connection limits
                if len(self._sessions) >= self.max_connections:
                    ws_logger.log_connection(
                        client_id, "rejected",
                        reason="connection_limit_reached",
                        active_connections=len(self._sessions),
                        max_connections=self.max_connections
                    )
                    await websocket.close(code=1013, reason="Server overloaded")
                    return False

                # Disconnect existing session if any
                if client_id in self._sessions:
                    ws_logger.log_connection(
                        client_id, "replacing_existing",
                        active_connections=len(self._sessions)
                    )
                    await self._disconnect_existing_session(client_id)

                # Accept the WebSocket connection
                await websocket.accept()

                # Create new session
                session = ClientSession(
                    client_id=client_id, websocket=websocket)
                self._sessions[client_id] = session

                # Send session initialized message
                await self._send_session_initialized(session)

                ws_logger.log_connection(
                    client_id, "connected",
                    active_connections=len(self._sessions),
                    session_created_at=session.connected_at.isoformat()
                )
                return True

            except Exception as e:
                ws_logger.log_error(
                    client_id, "connection_failed",
                    error_type=type(e).__name__,
                    error_message=str(e)
                )
                try:
                    await websocket.close(code=1011, reason="Server error")
                except:
                    pass
                return False

    async def _disconnect_existing_session(self, client_id: str):
        """Safely disconnect existing session"""
        if client_id in self._sessions:
            try:
                session = self._sessions[client_id]
                await session.websocket.close(code=1001, reason="New connection")
            except:
                pass
            finally:
                self._sessions.pop(client_id, None)
                self._processing_clients.discard(client_id)

    async def _send_session_initialized(self, session: ClientSession):
        """Send session initialized message"""
        try:
            message = SessionInitializedMessage(
                client_id=session.client_id,
                data={
                    "session_id": session.client_id,
                    "available_steps": ["upload", "theme", "content", "generate"],
                    "current_step": "idle",
                    "message": f"Welcome! Session initialized for client {session.client_id}"
                }
            )
            await self._send_message_to_session(session, message)
        except Exception as e:
            logger.error(f"Error sending session initialized message: {e}")

    async def disconnect_client(self, client_id: str, reason: str = "Disconnected"):
        """Disconnect a client with cleanup"""
        async with self._connection_lock:
            session = self._sessions.get(client_id)
            if session:
                try:
                    await session.websocket.close(code=1000, reason=reason)
                except:
                    pass
                finally:
                    self._sessions.pop(client_id, None)
                    self._processing_clients.discard(client_id)
                    logger.info(f"Client {client_id} disconnected: {reason}")

    async def send_message(self, client_id: str, message: ServerMessage) -> bool:
        """Send a message to a specific client with error handling"""
        session = self._sessions.get(client_id)
        if not session:
            logger.warning(
                f"Attempted to send message to non-existent client {client_id}")
            return False

        return await self._send_message_to_session(session, message)

    async def _send_message_to_session(self, session: ClientSession, message: ServerMessage) -> bool:
        """Send a message to a session with error handling"""
        try:
            # Ensure message has correct client_id
            message.client_id = session.client_id
            message.timestamp = datetime.now()

            # Convert to JSON
            message_json = message.json()

            # Send via WebSocket
            await session.websocket.send_text(message_json)
            session.update_activity()

            logger.debug(
                f"Message sent to {session.client_id}: {message.type}")
            return True

        except WebSocketDisconnect:
            logger.info(
                f"Client {session.client_id} disconnected during message send")
            await self.disconnect_client(session.client_id, "Client disconnected")
            return False
        except Exception as e:
            logger.error(f"Error sending message to {session.client_id}: {e}")
            return False

    async def broadcast_message(self, message: ServerMessage, exclude_client: Optional[str] = None):
        """Broadcast a message to all connected clients"""
        disconnected_clients = []

        for client_id, session in self._sessions.items():
            if client_id != exclude_client:
                success = await self._send_message_to_session(session, message)
                if not success:
                    disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            await self.disconnect_client(client_id, "Send failed")

    async def handle_client_message(self, client_id: str, message_data: str):
        """Handle incoming client message with proper validation"""
        session = self._sessions.get(client_id)
        if not session:
            ws_logger.log_error(client_id, "message_from_nonexistent_client")
            return

        try:
            # Parse message
            message_dict = json.loads(message_data)
            message_type = MessageType(message_dict.get("type"))
            message_id = message_dict.get("id", "unknown")

            # Log incoming message
            ws_logger.log_message(
                client_id, message_type.value, message_id, "received",
                data_size=len(message_data)
            )

            # Update session activity
            session.update_activity()

            # Handle ping separately
            if message_type == MessageType.PING:
                await self._handle_ping(session, message_dict)
                return

            # Send acknowledgment for non-ping messages
            await self._send_acknowledgment(session, message_dict)

            # Handle specific message types
            handler = self._message_handlers.get(message_type)
            if handler:
                with logger.timer(f"handle_{message_type.value}", client_id=client_id, message_id=message_id):
                    await handler(session, message_dict)
            else:
                logger.warning(f"No handler for message type {message_type}")
                await self._send_error(session, "HANDLER_NOT_FOUND", f"No handler for message type {message_type}")

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from client {client_id}: {e}")
            await self._send_error(session, "INVALID_JSON", "Invalid JSON format")
        except ValueError as e:
            logger.error(f"Invalid message type from client {client_id}: {e}")
            await self._send_error(session, "INVALID_MESSAGE_TYPE", "Invalid message type")
        except Exception as e:
            logger.error(
                f"Error handling message from client {client_id}: {e}")
            await self._send_error(session, "PROCESSING_ERROR", "Error processing message")

    async def _handle_ping(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Handle ping message"""
        pong_message = PongMessage(
            client_id=session.client_id,
            request_id=message_dict.get("id")
        )
        await self._send_message_to_session(session, pong_message)

    async def _send_acknowledgment(self, session: ClientSession, message_dict: Dict[str, Any]):
        """Send acknowledgment for received message"""
        try:
            ack_message = AcknowledgeMessage(
                client_id=session.client_id,
                request_id=message_dict.get("id"),
                data={
                    "acknowledged_message_id": message_dict.get("id", ""),
                    "acknowledged_type": message_dict.get("type", ""),
                    "processing_started": True
                }
            )
            await self._send_message_to_session(session, ack_message)
        except Exception as e:
            logger.error(f"Error sending acknowledgment: {e}")

    async def _send_error(self, session: ClientSession, error_code: str, error_message: str, details: Optional[str] = None):
        """Send error message to client"""
        try:
            error_msg = ErrorResponseMessage(
                client_id=session.client_id,
                data={
                    "error_code": error_code,
                    "error_message": error_message,
                    "details": details,
                    "retry_possible": error_code not in ["INVALID_JSON", "INVALID_MESSAGE_TYPE"]
                }
            )
            await self._send_message_to_session(session, error_msg)
        except Exception as e:
            logger.error(f"Error sending error message: {e}")

    def register_message_handler(self, message_type: MessageType, handler: Callable):
        """Register a message handler for a specific message type"""
        self._message_handlers[message_type] = handler
        logger.info(f"Registered handler for message type {message_type}")

    def get_client_session(self, client_id: str) -> Optional[ClientSession]:
        """Get client session by ID"""
        return self._sessions.get(client_id)

    def is_client_processing(self, client_id: str) -> bool:
        """Check if client is currently processing"""
        return client_id in self._processing_clients

    async def set_client_processing(self, client_id: str, processing: bool):
        """Set client processing status"""
        session = self._sessions.get(client_id)
        if session:
            session.processing = processing
            if processing:
                self._processing_clients.add(client_id)
            else:
                self._processing_clients.discard(client_id)

    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            "total_connections": len(self._sessions),
            "max_connections": self.max_connections,
            "processing_clients": len(self._processing_clients),
            "client_sessions": {
                client_id: {
                    "connected_at": session.connected_at.isoformat(),
                    "last_activity": session.last_activity.isoformat(),
                    "current_step": session.current_step,
                    "status": session.status.value,
                    "processing": session.processing
                }
                for client_id, session in self._sessions.items()
            }
        }

    def validate_step_prerequisites(self, client_id: str, target_step: str) -> Dict[str, Any]:
        """Validate that previous steps are completed before proceeding"""
        session = self._sessions.get(client_id)
        if not session:
            return {"valid": False, "error": "Client session not found", "error_code": "SESSION_NOT_FOUND"}

        # Step requirements (matching old system)
        step_requirements = {
            "step_2_theme": ["step_1_upload", "step_1b_slide_description"],
            "step_3_research": ["step_1_upload", "step_1b_slide_description"],
            "step_4_content": ["step_1_upload", "step_1b_slide_description"],
            "step_5_preview": ["step_1_upload", "step_1b_slide_description"]
        }

        if target_step in step_requirements:
            for required_step in step_requirements[target_step]:
                step_data = session.get_step_data(required_step)
                if not step_data.get("completed", False):
                    return {
                        "valid": False,
                        "error": f"Step {required_step} must be completed before {target_step}",
                        "error_code": "STEP_PREREQUISITE_NOT_MET",
                        "missing_step": required_step
                    }

        return {"valid": True}

    def get_step_guidance(self, client_id: str) -> Dict[str, Any]:
        """Provide guidance on what steps users can take next"""
        session = self._sessions.get(client_id)
        if not session:
            return {"available_actions": [], "guidance": "Session not found"}

        available_actions = []
        guidance = ""

        # Check what steps are available (matching old system)
        if session.step_1_upload["completed"]:
            available_actions.append("slide_description")

            if not session.step_1b_slide_description["completed"]:
                guidance = "Please provide a slide description to continue. This helps us understand what you want to create."
            elif not session.step_2_theme["completed"]:
                available_actions.extend(
                    ["theme_selection", "research_request", "content_planning", "slide_generation"])
                guidance = "You can choose a theme or continue with the default. All other steps are available."
            elif not session.step_3_research["completed"]:
                available_actions.extend(
                    ["theme_selection", "research_request", "content_planning", "slide_generation"])
                guidance = "Research is optional. You can skip it and go directly to content planning or slide generation."
            elif not session.step_4_content["completed"]:
                available_actions.extend(
                    ["theme_selection", "research_request", "content_planning", "slide_generation"])
                guidance = "You can plan your content or go directly to slide generation."
            else:
                available_actions.extend(
                    ["theme_selection", "research_request", "content_planning", "slide_generation"])
                guidance = "All steps completed! You can generate and preview your slides."
        else:
            available_actions.append("file_upload")
            guidance = "Please start by uploading a document."

        return {
            "available_actions": available_actions,
            "guidance": guidance,
            "current_progress": session.overall_progress
        }

    async def shutdown(self):
        """Shutdown the WebSocket manager"""
        logger.info("Shutting down WebSocket manager...")

        # Cancel cleanup task
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()

        # Disconnect all clients
        disconnect_tasks = []
        for client_id in list(self._sessions.keys()):
            disconnect_tasks.append(
                self.disconnect_client(client_id, "Server shutdown"))

        if disconnect_tasks:
            await asyncio.gather(*disconnect_tasks, return_exceptions=True)

        logger.info("WebSocket manager shutdown complete")


# Global instance
websocket_manager = ImprovedWebSocketManager()
