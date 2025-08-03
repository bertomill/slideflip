"""
WebSocket connection manager for handling multiple client connections
"""

import asyncio
import logging
from typing import Dict, Set
from fastapi import WebSocket
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages WebSocket connections for multiple clients"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.client_data: Dict[str, dict] = {}
        self.connection_times: Dict[str, datetime] = {}
        self.connecting_clients: Set[str] = set()  # Track clients that are currently connecting
        self.max_connections = 50  # Limit total connections to prevent resource exhaustion
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Connect a new client"""
        try:
            # Check if we've reached the connection limit
            if len(self.active_connections) >= self.max_connections:
                logger.warning(f"Connection limit reached ({self.max_connections}), rejecting connection for {client_id}")
                await websocket.close(code=1013)  # Try again later
                return
            
            # Check if client is already connecting
            if client_id in self.connecting_clients:
                logger.warning(f"Client {client_id} is already in the process of connecting")
                await websocket.close(code=1000)  # Normal closure
                return
            
            # Check if client is already connected
            if client_id in self.active_connections:
                logger.warning(f"Client {client_id} is already connected, disconnecting existing connection")
                self.disconnect(client_id)
                # Add a small delay to prevent rapid reconnection
                await asyncio.sleep(0.2)
            
            # Mark client as connecting
            self.connecting_clients.add(client_id)
            
            # Accept the WebSocket connection
            await websocket.accept()
            
            # Validate the connection is still open after accept
            if websocket.client_state.value > 2:  # WebSocket is closed
                logger.warning(f"WebSocket connection closed immediately after accept for client {client_id}")
                self.connecting_clients.discard(client_id)
                return
            
            self.active_connections[client_id] = websocket
            self.client_data[client_id] = {
                "files": [],
                "description": "",
                "processing_status": "idle"
            }
            self.connection_times[client_id] = datetime.now()
            
            # Remove from connecting set
            self.connecting_clients.discard(client_id)
            
            logger.info(f"Client {client_id} connected (total connections: {len(self.active_connections)})")
            
            # Send welcome message with error handling
            try:
                welcome_message = {
                    "type": "connection_established",
                    "data": {
                        "client_id": client_id,
                        "message": "Connected to SlideFlip Backend",
                        "timestamp": datetime.now().isoformat()
                    }
                }
                await websocket.send_text(json.dumps(welcome_message))
                logger.info(f"Welcome message sent to client {client_id}")
            except Exception as e:
                logger.error(f"Failed to send welcome message to client {client_id}: {e}")
                # Don't raise here, just log the error
                
        except Exception as e:
            logger.error(f"Error during client connection: {e}")
            # Clean up if connection fails
            self._cleanup_client(client_id)
            self.connecting_clients.discard(client_id)
            raise
    
    def _cleanup_client(self, client_id: str):
        """Clean up client data"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.client_data:
            del self.client_data[client_id]
        if client_id in self.connection_times:
            del self.connection_times[client_id]
    
    def disconnect(self, client_id: str):
        """Disconnect a client"""
        self._cleanup_client(client_id)
        logger.info(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: dict, client_id: str):
        """Send a message to a specific client"""
        if client_id not in self.active_connections:
            logger.warning(f"Client {client_id} not found in active connections")
            return False
            
        websocket = self.active_connections[client_id]
        try:
            # Check if WebSocket is still open
            if websocket.client_state.value > 2:  # WebSocket is closed
                logger.warning(f"WebSocket for client {client_id} is closed, removing from active connections")
                self.disconnect(client_id)
                return False
                
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
        """Send a message to all connected clients"""
        disconnected_clients = []
        
        for client_id, websocket in list(self.active_connections.items()):
            try:
                # Check if WebSocket is still open
                if websocket.client_state.value > 2:  # WebSocket is closed
                    logger.warning(f"WebSocket for client {client_id} is closed during broadcast")
                    disconnected_clients.append(client_id)
                    continue
                    
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
        """Get stored data for a specific client"""
        return self.client_data.get(client_id, {})
    
    def update_client_data(self, client_id: str, data: dict):
        """Update stored data for a specific client"""
        if client_id in self.client_data:
            self.client_data[client_id].update(data)
        else:
            self.client_data[client_id] = data
    
    def get_connected_clients(self) -> Set[str]:
        """Get list of connected client IDs"""
        return set(self.active_connections.keys())
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
    
    async def ping_all_clients(self):
        """Send ping to all connected clients"""
        ping_message = {
            "type": "ping",
            "data": {
                "timestamp": datetime.now().isoformat()
            }
        }
        await self.broadcast(ping_message)
    
    async def cleanup_stale_connections(self):
        """Clean up stale connections that haven't responded to pings"""
        stale_clients = []
        current_time = datetime.now()
        
        for client_id, connection_time in self.connection_times.items():
            # If connection is older than 2 minutes without activity, mark as stale
            if (current_time - connection_time).total_seconds() > 120:
                stale_clients.append(client_id)
        
        for client_id in stale_clients:
            logger.warning(f"Cleaning up stale connection for client {client_id}")
            self.disconnect(client_id)
    
    async def send_heartbeat(self, client_id: str):
        """Send a heartbeat to a specific client to check if it's still alive"""
        try:
            heartbeat_message = {
                "type": "heartbeat",
                "data": {
                    "timestamp": datetime.now().isoformat()
                }
            }
            success = await self.send_personal_message(heartbeat_message, client_id)
            if not success:
                logger.warning(f"Failed to send heartbeat to client {client_id}, marking as stale")
                self.disconnect(client_id)
        except Exception as e:
            logger.error(f"Error sending heartbeat to client {client_id}: {e}")
            self.disconnect(client_id)
    
    def get_connection_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": len(self.active_connections),
            "connecting_clients": len(self.connecting_clients),
            "max_connections": self.max_connections,
            "available_slots": self.max_connections - len(self.active_connections)
        }
    
    def get_connection_info(self, client_id: str) -> dict:
        """Get connection information for a client"""
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
        """Get information about all connections"""
        return {
            "total_connections": self.get_connection_count(),
            "clients": {
                client_id: self.get_connection_info(client_id)
                for client_id in self.active_connections.keys()
            }
        } 