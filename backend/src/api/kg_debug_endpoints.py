#!/usr/bin/env python3
"""
Knowledge Graph Debug API Endpoints
Contains debug endpoints for knowledge graph monitoring and management
"""

import logging
from fastapi import APIRouter, HTTPException
from src.services.kg_task_manager import KnowledgeGraphTaskManager
from src.services.file_service import FileService
from src.services.slide_service import SlideService

logger = logging.getLogger(__name__)

# Create router for knowledge graph debug endpoints
kg_debug_router = APIRouter(prefix="/debug", tags=["knowledge-graph-debug"])

# Initialize services (these will be injected from main.py)
kg_task_manager: KnowledgeGraphTaskManager = None
file_service: FileService = None
slide_service: SlideService = None

def init_kg_debug_endpoints(
    task_manager: KnowledgeGraphTaskManager,
    file_svc: FileService,
    slide_svc: SlideService
):
    """Initialize the debug endpoints with required services"""
    global kg_task_manager, file_service, slide_service
    kg_task_manager = task_manager
    file_service = file_svc
    slide_service = slide_svc

@kg_debug_router.get("/kg-overview")
async def debug_kg_overview():
    """Debug endpoint to show overview of all knowledge graph processing"""
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

@kg_debug_router.get("/client-folders")
async def debug_client_folders():
    """Debug endpoint to list client folders and their contents"""
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

@kg_debug_router.get("/kg-status/{client_id}")
async def debug_kg_status(client_id: str):
    """Debug endpoint to show knowledge graph processing status for a specific client"""
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

@kg_debug_router.post("/force-clustering/{client_id}")
async def force_clustering(client_id: str):
    """Force clustering for a specific client (useful for testing)"""
    try:
        # Check if client has KG service
        if client_id not in kg_task_manager.client_kg_services:
            raise HTTPException(status_code=404, detail=f"No knowledge graph service found for client {client_id}")
        
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

@kg_debug_router.post("/clear-kg/{client_id}")
async def clear_knowledge_graph(client_id: str):
    """Clear knowledge graph for a specific client (useful for testing)"""
    try:
        # Check if client has KG service
        if client_id not in kg_task_manager.client_kg_services:
            raise HTTPException(status_code=404, detail=f"No knowledge graph service found for client {client_id}")
        
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
