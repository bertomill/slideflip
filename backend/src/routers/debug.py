"""
Debug router for SlideFlip Backend
Contains debug and development endpoints
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import logging

from src.services.file_service import FileService
from src.core.websocket_manager import WebSocketManager

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services
file_service = FileService()
websocket_manager = WebSocketManager()

# Create router
router = APIRouter(prefix="/debug", tags=["debug"])

@router.get("/connections")
async def debug_connections():
    """Debug endpoint to show current WebSocket connections"""
    stats = websocket_manager.get_connection_stats()
    connections = websocket_manager.get_all_connection_info()
    return {
        "stats": stats,
        "connections": connections
    }

@router.get("/check-file/{file_path:path}")
async def check_file_exists(file_path: str):
    """Debug endpoint to check if a file exists"""
    try:
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
