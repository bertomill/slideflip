"""
Root router for SlideFlip Backend
Contains endpoints without /api prefix
"""

from fastapi import APIRouter
import logging

from src.core.websocket_manager import WebSocketManager

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services
websocket_manager = WebSocketManager()

# Create router (no prefix)
router = APIRouter(tags=["root"])

@router.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "SlideFlip Backend is running", "status": "healthy"}

@router.get("/health")
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
