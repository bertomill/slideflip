"""
Root router for SlideFlip Backend
Contains endpoints without /api prefix
"""

from fastapi import APIRouter
import logging

# Note: websocket_manager will be injected from main.py via init_debug_endpoints
# from src.core.improved_websocket_manager import websocket_manager

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services (these will be injected from main.py)
websocket_manager = None

# Create router (no prefix)
router = APIRouter(tags=["root"])


def init_root_endpoints(ws_manager):
    """Initialize the root endpoints with required services"""
    global websocket_manager
    websocket_manager = ws_manager


@router.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "SlideFlip Backend is running", "status": "healthy"}


@router.get("/health")
async def health_check():
    """Detailed health check"""
    if not websocket_manager:
        return {
            "status": "healthy",
            "version": "1.0.0",
            "services": {
                "file_service": "running",
                "slide_service": "running",
                "websocket_manager": "not_initialized"
            }
        }

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
