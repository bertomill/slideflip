"""
Debug router for SlideFlip Backend
Contains debug and development endpoints, including knowledge graph debugging
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import logging
from typing import Dict, Any, Optional

from src.services.file_service import FileService
# Note: websocket_manager will be injected from main.py via init_debug_endpoints
# from src.core.improved_websocket_manager import websocket_manager
from src.services.slide_service import SlideService

# Conditional knowledge graph imports based on SKIP_KNOWLEDGE_GRAPH setting
from src.core.config import Settings
settings = Settings()

if not settings.SKIP_KNOWLEDGE_GRAPH:
    from src.services.kg_task_manager import KnowledgeGraphTaskManager
else:
    # Create dummy class when knowledge graph is disabled
    class KnowledgeGraphTaskManager:
        def __init__(self):
            pass

        async def get_or_create_kg_service(self, client_id: str):
            return None

        async def is_clustering_needed(self, client_id: str) -> bool:
            return False

        async def load_existing_graphs_if_available(self, client_id: str) -> bool:
            return False

        async def mark_file_processed(self, client_id: str, filename: str):
            pass

        async def add_processing_task(self, client_id: str, filename: str, task):
            pass

        async def remove_processing_task(self, client_id: str, filename: str):
            pass

        async def mark_clustering_needed(self, client_id: str):
            pass

        async def can_skip_processing(self, client_id: str) -> bool:
            return False

        async def check_if_new_processing_needed(self, client_id: str) -> dict:
            return {"needs_processing": False, "reason": "Knowledge graph disabled"}

        async def cleanup_client_tasks(self, client_id: str):
            pass

        async def get_processing_status(self, client_id: str) -> dict:
            return {"status": "disabled", "reason": "Knowledge graph disabled"}

        async def force_clustering(self, client_id: str) -> dict:
            return {"success": False, "reason": "Knowledge graph disabled"}

        async def force_reprocessing(self, client_id: str) -> dict:
            return {"success": False, "reason": "Knowledge graph disabled"}

        async def get_kg_status(self, client_id: str) -> dict:
            return {"status": "disabled", "reason": "Knowledge graph disabled"}

        async def clear_kg(self, client_id: str) -> dict:
            return {"success": False, "reason": "Knowledge graph disabled"}

        async def wait_for_client_tasks(self, client_id: str):
            pass

        async def mark_clustering_completed(self, client_id: str):
            pass

        @property
        def client_kg_services(self):
            return {}

        @property
        def client_tasks(self):
            return {}

        @property
        def client_processed_files(self):
            return {}

        @property
        def client_pending_clustering(self):
            return {}

        @property
        def _lock(self):
            import asyncio
            return asyncio.Lock()

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services (these will be injected from main.py)
file_service: FileService = None
websocket_manager = None  # Will be injected from main.py
kg_task_manager: KnowledgeGraphTaskManager = None
slide_service: SlideService = None

# Create router
router = APIRouter(prefix="/debug", tags=["debug"])


def init_debug_endpoints(
    file_svc: FileService,
    ws_manager,
    kg_task_mgr: KnowledgeGraphTaskManager,
    slide_svc: SlideService
):
    """Initialize the debug endpoints with required services"""
    global file_service, websocket_manager, kg_task_manager, slide_service
    file_service = file_svc
    websocket_manager = ws_manager
    kg_task_manager = kg_task_mgr
    slide_service = slide_svc


@router.get("/connections")
async def debug_connections():
    """Debug endpoint to show current WebSocket connections"""
    if not websocket_manager:
        raise HTTPException(
            status_code=500, detail="WebSocket manager not initialized")

    stats = websocket_manager.get_connection_stats()
    connections = websocket_manager.get_all_connection_info()
    return {
        "stats": stats,
        "connections": connections
    }


@router.get("/check-file/{file_path:path}")
async def check_file_exists(file_path: str):
    """Debug endpoint to check if a file exists"""
    if not file_service:
        raise HTTPException(
            status_code=500, detail="File service not initialized")

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

# Knowledge Graph Debug Endpoints - Only available when KG is enabled
if not settings.SKIP_KNOWLEDGE_GRAPH:

    @router.get("/kg-overview")
    async def debug_kg_overview():
        """Debug endpoint to show overview of all knowledge graph processing"""
        if not kg_task_manager:
            raise HTTPException(
                status_code=500, detail="Knowledge graph task manager not initialized")

        try:
            overview = {
                "total_clients": len(kg_task_manager.client_kg_services),
                "clients": {}
            }

            for client_id in kg_task_manager.client_kg_services:
                kg_status = await kg_task_manager.get_processing_status(client_id)
                kg_service = kg_task_manager.client_kg_services[client_id]
                kg_stats = kg_service.get_graph_statistics()

                overview["clients"][client_id] = {
                    "processing_status": kg_status,
                    "graph_statistics": kg_stats
                }

            return overview
        except Exception as e:
            logger.error(f"Error in debug_kg_overview: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/client-folders")
    # Changed from file_service, kg_task_manager, slide_service to file_service: FileService, slide_service: SlideService, kg_task_manager: KnowledgeGraphTaskManager as per new_code
    async def debug_client_folders(file_service: FileService, slide_service: SlideService, kg_task_manager: KnowledgeGraphTaskManager):
        """Debug endpoint to list client folders and their contents"""
        if not file_service or not kg_task_manager or not slide_service:
            raise HTTPException(
                status_code=500, detail="Required services not initialized")

        try:
            client_folders = file_service.list_client_folders()
            folder_details = []

            for client_id in client_folders:
                folder_path = file_service.get_client_folder_path(client_id)
                folder_size = file_service.get_client_folder_size(client_id)
                files = await file_service.get_client_files(client_id)

                # Get content statistics
                content_stats = await slide_service.get_client_content_stats(client_id)

                # Get knowledge graph processing status
                kg_status = await kg_task_manager.get_processing_status(client_id)

                folder_details.append({
                    "client_id": client_id,
                    "folder_path": str(folder_path),
                    "folder_size": folder_size,
                    "file_count": len(files),
                    "files": [f.model_dump() for f in files],
                    "content_stats": content_stats,
                    "kg_processing_status": kg_status
                })

            return {
                "total_clients": len(client_folders),
                "client_folders": folder_details
            }
        except Exception as e:
            logger.error(f"Error in debug_client_folders: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/kg-status/{client_id}")
    # Changed from kg_task_manager to kg_task_manager: KnowledgeGraphTaskManager as per new_code
    async def debug_kg_status(kg_task_manager: KnowledgeGraphTaskManager, client_id: str):
        """Debug endpoint to show knowledge graph processing status for a specific client"""
        if not kg_task_manager:
            raise HTTPException(
                status_code=500, detail="Knowledge graph task manager not initialized")

        try:
            kg_status = await kg_task_manager.get_processing_status(client_id)

            # Get additional details if KG service exists
            kg_details = {}
            if client_id in kg_task_manager.client_kg_services:
                kg_service = kg_task_manager.client_kg_services[client_id]
                kg_details = kg_service.get_graph_statistics()

            return {
                "client_id": client_id,
                "processing_status": kg_status,
                "graph_statistics": kg_details
            }
        except Exception as e:
            logger.error(f"Error in debug_kg_status: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/force-clustering/{client_id}")
    # Changed from kg_task_manager to kg_task_manager: KnowledgeGraphTaskManager as per new_code
    async def force_clustering(kg_task_manager: KnowledgeGraphTaskManager, client_id: str):
        """Force clustering for a specific client (useful for testing)"""
        if not kg_task_manager:
            raise HTTPException(
                status_code=500, detail="Knowledge graph task manager not initialized")

        try:
            # Check if client has KG service
            if client_id not in kg_task_manager.client_kg_services:
                raise HTTPException(
                    status_code=404, detail=f"No knowledge graph service found for client {client_id}")

            # Wait for any pending tasks to complete
            await kg_task_manager.wait_for_client_tasks(client_id)

            # Get the KG service
            kg_service = kg_task_manager.client_kg_services[client_id]

            # Import here to avoid circular imports
            from src.services.kg_processing import perform_final_clustering

            # Perform clustering
            await perform_final_clustering(client_id, kg_service, kg_task_manager)

            # Mark clustering as completed
            await kg_task_manager.mark_clustering_completed(client_id)

            return {
                "client_id": client_id,
                "status": "clustering_completed",
                "message": "Forced clustering completed successfully"
            }
        except Exception as e:
            logger.error(f"Error in force_clustering: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/clear-kg/{client_id}")
    # Changed from kg_task_manager to kg_task_manager: KnowledgeGraphTaskManager as per new_code
    async def clear_knowledge_graph(kg_task_manager: KnowledgeGraphTaskManager, client_id: str):
        """Clear knowledge graph for a specific client (useful for testing)"""
        if not kg_task_manager:
            raise HTTPException(
                status_code=500, detail="Knowledge graph task manager not initialized")

        try:
            # Check if client has KG service
            if client_id not in kg_task_manager.client_kg_services:
                raise HTTPException(
                    status_code=404, detail=f"No knowledge graph service found for client {client_id}")

            # Wait for any pending tasks to complete
            await kg_task_manager.wait_for_client_tasks(client_id)

            # Get the KG service and clear it
            kg_service = kg_task_manager.client_kg_services[client_id]
            kg_service.clear_graph()

            # Reset the client's processing state
            async with kg_task_manager._lock:
                kg_task_manager.client_processed_files[client_id] = set()
                kg_task_manager.client_pending_clustering[client_id] = False

            return {
                "client_id": client_id,
                "status": "cleared",
                "message": "Knowledge graph cleared successfully"
            }
        except Exception as e:
            logger.error(f"Error in clear_knowledge_graph: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/force-reprocessing/{client_id}")
    # Changed from kg_task_manager to kg_task_manager: KnowledgeGraphTaskManager as per new_code
    async def force_reprocessing(kg_task_manager: KnowledgeGraphTaskManager, client_id: str):
        """Force reprocessing for a specific client (useful for testing)"""
        if not kg_task_manager:
            raise HTTPException(
                status_code=500, detail="Knowledge graph task manager not initialized")

        try:
            # Check if client has KG service
            if client_id not in kg_task_manager.client_kg_services:
                raise HTTPException(
                    status_code=404, detail=f"No knowledge graph service found for client {client_id}")

            # Wait for any pending tasks to complete
            await kg_task_manager.wait_for_client_tasks(client_id)

            # Reset the client's processing state
            async with kg_task_manager._lock:
                kg_task_manager.client_processed_files[client_id] = set()
                kg_task_manager.client_pending_clustering[client_id] = False

            return {
                "client_id": client_id,
                "status": "reprocessing_ready",
                "message": "Client ready for reprocessing"
            }
        except Exception as e:
            logger.error(f"Error in force_reprocessing: {e}")
            raise HTTPException(status_code=500, detail=str(e))

else:
    # When KG is disabled, provide informative endpoints
    @router.get("/kg-overview")
    async def debug_kg_overview_disabled():
        """Knowledge graph is disabled"""
        return {"message": "Knowledge graph debugging is disabled", "reason": "SKIP_KNOWLEDGE_GRAPH is enabled"}

    @router.get("/kg-status/{client_id}")
    async def debug_kg_status_disabled(client_id: str):
        """Knowledge graph is disabled"""
        return {"message": "Knowledge graph debugging is disabled", "reason": "SKIP_KNOWLEDGE_GRAPH is enabled"}

    @router.post("/force-clustering/{client_id}")
    async def force_clustering_disabled(client_id: str):
        """Knowledge graph is disabled"""
        return {"message": "Knowledge graph debugging is disabled", "reason": "SKIP_KNOWLEDGE_GRAPH is enabled"}

    @router.post("/clear-kg/{client_id}")
    async def clear_knowledge_graph_disabled(client_id: str):
        """Knowledge graph is disabled"""
        return {"message": "Knowledge graph debugging is disabled", "reason": "SKIP_KNOWLEDGE_GRAPH is enabled"}

    @router.post("/force-reprocessing/{client_id}")
    async def force_reprocessing_disabled(client_id: str):
        """Knowledge graph is disabled"""
        return {"message": "Knowledge graph debugging is disabled", "reason": "SKIP_KNOWLEDGE_GRAPH is enabled"}

    @router.get("/client-folders")
    async def debug_client_folders_disabled():
        """Client folders endpoint without KG integration when KG is disabled"""
        if not file_service or not slide_service:
            raise HTTPException(
                status_code=500, detail="Required services not initialized")

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
                    "content_stats": content_stats,
                    "kg_processing_status": {"status": "disabled", "reason": "Knowledge graph disabled"}
                })

            return {
                "total_clients": len(client_folders),
                "client_folders": folder_details
            }
        except Exception as e:
            logger.error(f"Error in debug_client_folders: {e}")
            raise HTTPException(status_code=500, detail=str(e))
