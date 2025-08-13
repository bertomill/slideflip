"""
WebSocket connection manager for handling multiple client connections

IMPORTANT FOR FRONTEND DEVELOPERS:
- This module manages real-time WebSocket connections between frontend and backend
- Each client gets a unique client_id for session tracking across all 5 steps
- WebSocket endpoint: ws://HOST:PORT/ws/{client_id} (see config.py for HOST/PORT)
- Maximum 50 concurrent connections supported
- All messages use JSON format with "type" and "data" fields
- Connection automatically sends welcome and session initialization messages
- Implements heartbeat/ping system to detect stale connections
- Session data persists for: upload, theme, research, content, preview steps
"""

import asyncio
import logging
from typing import Dict, Set
from fastapi import WebSocket
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages WebSocket connections for multiple clients
    
    FRONTEND INTEGRATION NOTES:
    - Use this for real-time progress updates during slide generation
    - Each step (@builder/ components) should send/receive messages through WebSocket
    - Client sessions are tracked with step completion status and progress
    - Automatic cleanup prevents memory leaks from abandoned connections
    """

    def __init__(self):
        # Core connection tracking - Frontend connects here
        self.active_connections: Dict[str, WebSocket] = {}  # client_id -> WebSocket
        self.client_data: Dict[str, dict] = {}              # Session data for each client
        self.connection_times: Dict[str, datetime] = {}     # Connection timestamps
        
        # Connection management - Prevents race conditions during connect/disconnect
        self.connecting_clients: Set[str] = set()           # Clients currently connecting
        self.max_connections = 50                           # Limit to prevent resource exhaustion

    async def connect(self, websocket: WebSocket, client_id: str):
        """
        Connect a new client and initialize their session
        
        FRONTEND USAGE:
        - Call this when user opens the app or refreshes page
        - client_id should be unique per session (recommend UUID)
        - Automatically sends welcome and session_initialized messages
        - Sets up tracking for all 5 builder steps
        """
        try:
            # Enforce connection limits to prevent server overload
            if len(self.active_connections) >= self.max_connections:
                logger.warning(
                    f"Connection limit reached ({self.max_connections}), rejecting connection for {client_id}")
                await websocket.close(code=1013)  # Try again later
                return

            # Prevent duplicate connections during handshake
            if client_id in self.connecting_clients:
                logger.warning(
                    f"Client {client_id} is already in the process of connecting")
                await websocket.close(code=1000)  # Normal closure
                return

            # Handle reconnection - disconnect existing session first
            if client_id in self.active_connections:
                logger.warning(
                    f"Client {client_id} is already connected, disconnecting existing connection")
                self.disconnect(client_id)
                # Small delay prevents rapid reconnection issues
                await asyncio.sleep(0.2)

            # Mark as connecting to prevent race conditions
            self.connecting_clients.add(client_id)

            # Accept the WebSocket connection
            await websocket.accept()

            # Validate connection is still open after handshake
            if websocket.client_state.value > 2:  # WebSocket is closed
                logger.warning(
                    f"WebSocket connection closed immediately after accept for client {client_id}")
                self.connecting_clients.discard(client_id)
                return

            # Store active connection and initialize tracking
            self.active_connections[client_id] = websocket
            self.client_data[client_id] = {
                "files": [],
                "description": "",
                "processing_status": "idle"
            }
            self.connection_times[client_id] = datetime.now()

            # Initialize session data for all builder steps
            await self._initialize_client_session(client_id)

            # Connection established - remove from connecting set
            self.connecting_clients.discard(client_id)

            logger.info(
                f"Client {client_id} connected (total connections: {len(self.active_connections)})")

            # Send welcome message - Frontend should listen for this
            try:
                welcome_message = {
                    "type": "connection_established",
                    "data": {
                        "client_id": client_id,
                        "message": "Connected to Slideo Backend",
                        "timestamp": datetime.now().isoformat()
                    }
                }
                await websocket.send_text(json.dumps(welcome_message))
                logger.info(f"Welcome message sent to client {client_id}")

                # Send session initialization - Frontend should update UI based on this
                session_message = {
                    "type": "session_initialized",
                    "data": {
                        "session_id": client_id,
                        "current_step": "step_1_upload",
                        "overall_progress": 0,
                        "available_steps": ["step_1_upload", "step_2_theme", "step_3_research", "step_4_content", "step_5_preview"],
                        "message": "Session initialized successfully"
                    }
                }
                await websocket.send_text(json.dumps(session_message))
                logger.info(
                    f"Session initialization message sent to client {client_id}")

            except Exception as e:
                logger.error(
                    f"Failed to send welcome message to client {client_id}: {e}")
                # Don't raise here, just log the error

        except Exception as e:
            logger.error(f"Error during client connection: {e}")
            # Clean up if connection fails
            self._cleanup_client(client_id)
            self.connecting_clients.discard(client_id)
            raise

    def _cleanup_client(self, client_id: str):
        """
        Clean up client data when disconnecting
        
        FRONTEND NOTE: This happens automatically, no action needed
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.client_data:
            del self.client_data[client_id]
        if client_id in self.connection_times:
            del self.connection_times[client_id]

    async def _initialize_client_session(self, client_id: str):
        """
        Initialize client session with enhanced data tracking for all builder steps
        
        FRONTEND DEVELOPERS:
        - Each step (@builder/upload, @builder/theme, etc.) gets its own data section
        - Track completion status and step-specific data here
        - Use this structure to persist user progress across page refreshes
        """
        try:
            # Initialize session data structure for all 5 builder steps
            self.client_data[client_id] = {
                "session_id": client_id,
                # Step 1: Upload component data
                "step_1_upload": {"completed": False, "data": {}},
                # Step 2: Theme selection component data  
                "step_2_theme": {"completed": False, "data": {}},
                # Step 3: Research component data
                "step_3_research": {"completed": False, "data": {}},
                # Step 4: Content generation component data
                "step_4_content": {"completed": False, "data": {}},
                # Step 5: Preview and download component data
                "step_5_preview": {"completed": False, "data": {}},
                # Progress tracking for frontend progress bars
                "current_step": "step_1_upload",
                "overall_progress": 0,
                # Session metadata
                "session_start_time": datetime.now().isoformat(),
                "last_activity": datetime.now().isoformat(),
                # Backward compatibility with existing frontend code
                "files": [],
                "description": "",
                "processing_status": "idle"
            }

            logger.info(f"Session initialized for client {client_id}")

        except Exception as e:
            logger.error(
                f"Error initializing session for client {client_id}: {e}")

    def disconnect(self, client_id: str):
        """
        Disconnect a client and cleanup resources
        
        FRONTEND USAGE: This is called automatically when connection is lost
        """
        self._cleanup_client(client_id)
        logger.info(f"Client {client_id} disconnected")

    async def send_personal_message(self, message: dict, client_id: str):
        """
        Send a message to a specific client
        
        FRONTEND DEVELOPERS:
        - Use this for step-specific updates (upload progress, theme applied, etc.)
        - Message format: {"type": "message_type", "data": {...}}
        - Returns True if sent successfully, False if client disconnected
        - Automatically handles connection cleanup on failures
        
        Example message types:
        - "upload_progress": File upload progress updates
        - "theme_applied": Theme selection confirmation
        - "research_complete": Research step completion
        - "content_generated": Content generation results
        - "preview_ready": Preview is ready for display
        """
        if client_id not in self.active_connections:
            logger.warning(
                f"Client {client_id} not found in active connections")
            return False

        websocket = self.active_connections[client_id]
        try:
            # Check if WebSocket is still open before sending
            if websocket.client_state.value > 2:  # WebSocket is closed
                logger.warning(
                    f"WebSocket for client {client_id} is closed, removing from active connections")
                self.disconnect(client_id)
                return False

            # Send message with timeout to prevent hanging
            await asyncio.wait_for(
                websocket.send_text(json.dumps(message)),
                timeout=10.0
            )
            return True
        except asyncio.TimeoutError:
            logger.error(f"Timeout sending message to client {client_id}")
            self.disconnect(client_id)
            return False
        except Exception as e:
            logger.error(f"Error sending message to client {client_id}: {e}")
            self.disconnect(client_id)
            return False

    async def broadcast(self, message: dict):
        """
        Send a message to all connected clients
        
        FRONTEND USAGE:
        - Use for system-wide announcements
        - Server maintenance notifications
        - Global status updates
        - Automatically cleans up failed connections
        """
        disconnected_clients = []

        # Send to all active connections
        for client_id, websocket in list(self.active_connections.items()):
            try:
                # Check if WebSocket is still open
                if websocket.client_state.value > 2:  # WebSocket is closed
                    logger.warning(
                        f"WebSocket for client {client_id} is closed during broadcast")
                    disconnected_clients.append(client_id)
                    continue

                # Send with timeout
                await asyncio.wait_for(
                    websocket.send_text(json.dumps(message)),
                    timeout=10.0
                )
            except asyncio.TimeoutError:
                logger.error(f"Timeout broadcasting to client {client_id}")
                disconnected_clients.append(client_id)
            except Exception as e:
                logger.error(f"Error broadcasting to client {client_id}: {e}")
                disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    def get_client_data(self, client_id: str) -> dict:
        """
        Get stored data for a specific client
        
        FRONTEND USAGE:
        - Access user's session data across all steps
        - Check completion status of each builder step
        - Restore user progress after page refresh
        """
        return self.client_data.get(client_id, {})

    def update_client_data(self, client_id: str, data: dict):
        """
        Update stored data for a specific client
        
        FRONTEND USAGE:
        - Save progress from each builder step
        - Update completion status when step is finished
        - Store user selections (theme, content preferences, etc.)
        
        Example usage:
        update_client_data(client_id, {
            "step_1_upload": {"completed": True, "data": {"files": [...]}},
            "current_step": "step_2_theme",
            "overall_progress": 20
        })
        """
        if client_id in self.client_data:
            self.client_data[client_id].update(data)
        else:
            self.client_data[client_id] = data

    def get_connected_clients(self) -> Set[str]:
        """
        Get list of connected client IDs
        
        FRONTEND USAGE: For admin/monitoring purposes
        """
        return set(self.active_connections.keys())

    def get_connection_count(self) -> int:
        """
        Get number of active connections
        
        FRONTEND USAGE: Display connection status or implement rate limiting
        """
        return len(self.active_connections)

    async def ping_all_clients(self):
        """
        Send ping to all connected clients to check if they're still alive
        
        FRONTEND DEVELOPERS:
        - Your WebSocket client should respond to ping messages
        - This helps detect and cleanup stale connections
        - Automatic - no frontend action required
        """
        ping_message = {
            "type": "ping",
            "data": {
                "timestamp": datetime.now().isoformat()
            }
        }
        await self.broadcast(ping_message)

    async def cleanup_stale_connections(self):
        """
        Clean up stale connections that haven't responded to pings
        
        FRONTEND NOTE: This runs automatically in the background
        """
        stale_clients = []
        current_time = datetime.now()

        # Find connections older than 2 minutes without activity
        for client_id, connection_time in self.connection_times.items():
            if (current_time - connection_time).total_seconds() > 120:
                stale_clients.append(client_id)

        # Clean up stale connections
        for client_id in stale_clients:
            logger.warning(
                f"Cleaning up stale connection for client {client_id}")
            self.disconnect(client_id)

    async def send_heartbeat(self, client_id: str):
        """
        Send a heartbeat to a specific client to check if it's still alive
        
        FRONTEND USAGE: Your client should respond to heartbeat messages
        """
        try:
            heartbeat_message = {
                "type": "heartbeat",
                "data": {
                    "timestamp": datetime.now().isoformat()
                }
            }
            success = await self.send_personal_message(heartbeat_message, client_id)
            if not success:
                logger.warning(
                    f"Failed to send heartbeat to client {client_id}, marking as stale")
                self.disconnect(client_id)
        except Exception as e:
            logger.error(f"Error sending heartbeat to client {client_id}: {e}")
            self.disconnect(client_id)

    def get_connection_stats(self) -> dict:
        """
        Get connection statistics
        
        FRONTEND USAGE:
        - Display server capacity to users
        - Implement connection retry logic based on available slots
        - Show system status in admin dashboard
        """
        return {
            "total_connections": len(self.active_connections),
            "connecting_clients": len(self.connecting_clients),
            "max_connections": self.max_connections,
            "available_slots": self.max_connections - len(self.active_connections)
        }

    def get_connection_info(self, client_id: str) -> dict:
        """
        Get connection information for a specific client
        
        FRONTEND USAGE:
        - Debug connection issues
        - Display session duration to user
        - Monitor user progress across steps
        """
        if client_id not in self.active_connections:
            return {}

        connection_time = self.connection_times.get(client_id)
        return {
            "client_id": client_id,
            "connected_at": connection_time.isoformat() if connection_time else None,
            "connection_duration": (datetime.now() - connection_time).total_seconds() if connection_time else 0,
            "data": self.get_client_data(client_id)
        }

    def get_all_connection_info(self) -> dict:
        """
        Get information about all connections
        
        FRONTEND USAGE: Admin/monitoring dashboard to see all active sessions
        """
        return {
            "total_connections": self.get_connection_count(),
            "clients": {
                client_id: self.get_connection_info(client_id)
                for client_id in self.active_connections.keys()
            }
        }
