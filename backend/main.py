#!/usr/bin/env python3
"""
Main entry point for the SlideFlip Backend
Handles WebSocket connections and file processing for slide generation
"""

from src.routers.improved_websocket import websocket_endpoint as improved_websocket_endpoint
from src.routers.monitoring import router as monitoring_router
from src.routers.debug import router as debug_router, init_debug_endpoints
from src.routers.api import router as api_router
from src.routers.root import router as root_router
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Dict, List
import json
import os
from pathlib import Path

# Import our custom modules
from src.core.config import Settings
from src.core.logger import setup_logging, get_logger
from src.core.improved_websocket_manager import websocket_manager
from src.core.service_registry import get_service_registry, get_or_create_service
from src.services.file_service import FileService
from src.services.slide_service import SlideService
from src.services.llm_service import LLMService

# Conditional knowledge graph imports based on SKIP_KNOWLEDGE_GRAPH setting
settings = Settings()
if not settings.SKIP_KNOWLEDGE_GRAPH:
    from src.services.kg_task_manager import KnowledgeGraphTaskManager
    from src.services.kg_processing import perform_final_clustering
else:
    # Create dummy classes when knowledge graph is disabled
    class KnowledgeGraphTaskManager:
        def __init__(self):
            self.client_tasks = {}
            self.client_kg_services = {}

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

        async def mark_clustering_completed(self, client_id: str):
            pass

        async def wait_for_client_tasks(self, client_id: str):
            pass

        async def get_pending_tasks_count(self, client_id: str) -> int:
            return 0

        async def is_file_processed(self, client_id: str, filename: str) -> bool:
            return True

        async def check_file_content_similarity(self, client_id: str, filename: str, content_hash: str) -> bool:
            return True

        async def clear_client_state(self, client_id: str):
            pass

    def perform_final_clustering(*args, **kwargs):
        return {"success": False, "reason": "Knowledge graph disabled"}

# Import routers
# Import improved WebSocket implementation

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Setup logging first
setup_logging(
    level=os.getenv("LOG_LEVEL", "INFO"),
    log_file="logs/slideo-backend.log",
    enable_console=True,
    structured=True
)

logger = get_logger("main")

# Initialize services using service registry to prevent multiple initializations
service_registry = get_service_registry()

# Initialize core services
file_service = get_or_create_service("file_service", FileService)
slide_service = get_or_create_service("slide_service", SlideService)
llm_service = get_or_create_service("llm_service", LLMService)

# Global task manager for knowledge graph processing (conditional)
kg_task_manager = KnowledgeGraphTaskManager()

# Get the improved WebSocket manager (global instance)
# websocket_manager is imported from improved_websocket_manager

# Initialize service orchestrator
# service_orchestrator = get_service_orchestrator() # This line is removed as per the new_code

# Background task for cleaning up stale connections


async def cleanup_stale_connections():
    """Periodically clean up stale WebSocket connections"""
    while True:
        try:
            await asyncio.sleep(30)  # Run every 30 seconds instead of 60
            # The improved websocket manager handles cleanup internally
            # Just log connection statistics
            stats = websocket_manager.get_connection_stats()
            if stats["total_connections"] > 0:
                logger.info(f"Connection stats: {stats}")
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting SlideFlip Backend...")

    # Create necessary directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)

    # Initialize core AI services
    # Note: Core AI services initialization has been removed as per the new code
    # The services are now initialized through the service registry pattern

    # Initialize debug endpoints with required services
    init_debug_endpoints(file_service, websocket_manager,
                         kg_task_manager, slide_service)

    # Initialize other routers with websocket manager
    from src.routers.root import init_root_endpoints
    from src.routers.api import init_api_endpoints

    init_root_endpoints(websocket_manager)
    init_api_endpoints(websocket_manager)

    # Initialize the improved websocket manager
    await websocket_manager.initialize()

    # Start background cleanup task
    cleanup_task = asyncio.create_task(cleanup_stale_connections())

    logger.info("Backend started successfully")
    yield

    # Graceful shutdown - wait for all knowledge graph tasks to complete
    logger.info("Waiting for knowledge graph tasks to complete...")
    try:
        # Only run KG cleanup if KG is not disabled
        if not settings.SKIP_KNOWLEDGE_GRAPH:
            # Wait for all client tasks to complete
            for client_id in list(kg_task_manager.client_tasks.keys()):
                await kg_task_manager.wait_for_client_tasks(client_id)
                logger.info(f"Completed all tasks for client {client_id}")

            # Perform final clustering for any clients that need it
            for client_id in list(kg_task_manager.client_kg_services.keys()):
                if await kg_task_manager.is_clustering_needed(client_id):
                    logger.info(
                        f"Performing final clustering for client {client_id}")
                    kg_service = kg_task_manager.client_kg_services[client_id]
                    await perform_final_clustering(client_id, kg_service, kg_task_manager)
                    await kg_task_manager.mark_clustering_completed(client_id)

        logger.info("All knowledge graph tasks completed")
    except Exception as e:
        logger.error(f"Error during graceful shutdown: {e}")

    # Shutdown WebSocket manager
    try:
        await websocket_manager.shutdown()
    except Exception as e:
        logger.error(f"Error shutting down WebSocket manager: {e}")

    # Cancel cleanup task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    logger.info("Shutting down SlideFlip Backend...")

# Create FastAPI app
app = FastAPI(
    title="SlideFlip Backend",
    description="Backend API for SlideFlip presentation generator",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(root_router)
app.include_router(api_router)
app.include_router(debug_router)
app.include_router(monitoring_router)

# WebSocket endpoints


@app.websocket("/ws/{client_id}")
async def websocket_endpoint_route(websocket: WebSocket, client_id: str):
    """Primary WebSocket endpoint with improved error handling and type safety"""
    await improved_websocket_endpoint(websocket, client_id)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
