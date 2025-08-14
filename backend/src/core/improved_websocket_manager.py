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
    current_step: str = "idle"
    status: ProcessingStatus = ProcessingStatus.IDLE
    processing: bool = False
    session_data: Dict[str, Any] = field(default_factory=dict)
    message_queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=100))
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.now()
    
    def is_stale(self, timeout_minutes: int = 30) -> bool:
        """Check if session is stale based on last activity"""
        return (datetime.now() - self.last_activity) > timedelta(minutes=timeout_minutes)


class ImprovedWebSocketManager:
    """Enhanced WebSocket manager with better connection handling"""
    
    def __init__(self, max_connections: int = 50):
        self.max_connections = max_connections
        self._sessions: Dict[str, ClientSession] = {}
        self._connection_lock = asyncio.Lock()
        self._processing_clients: Set[str] = set()
        self._message_handlers: Dict[MessageType, Callable] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        
        # Start cleanup task
        self._start_cleanup_task()
    
    def _start_cleanup_task(self):
        """Start background cleanup task"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_stale_connections())
    
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
                    logger.info(f"Cleaning up stale connection for client {client_id}")
                    await self.disconnect_client(client_id, "Connection timeout")
                    
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
    
    async def connect_client(self, websocket: WebSocket, client_id: str) -> bool:
        """Connect a new client with proper error handling"""
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
                session = ClientSession(client_id=client_id, websocket=websocket)
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
            logger.warning(f"Attempted to send message to non-existent client {client_id}")
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
            
            logger.debug(f"Message sent to {session.client_id}: {message.type}")
            return True
            
        except WebSocketDisconnect:
            logger.info(f"Client {session.client_id} disconnected during message send")
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
            logger.error(f"Error handling message from client {client_id}: {e}")
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
    
    async def shutdown(self):
        """Shutdown the WebSocket manager"""
        logger.info("Shutting down WebSocket manager...")
        
        # Cancel cleanup task
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
        
        # Disconnect all clients
        disconnect_tasks = []
        for client_id in list(self._sessions.keys()):
            disconnect_tasks.append(self.disconnect_client(client_id, "Server shutdown"))
        
        if disconnect_tasks:
            await asyncio.gather(*disconnect_tasks, return_exceptions=True)
        
        logger.info("WebSocket manager shutdown complete")


# Global instance
websocket_manager = ImprovedWebSocketManager()