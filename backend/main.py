#!/usr/bin/env python3
"""
Main entry point for the SlideFlip Backend
Handles WebSocket connections and file processing for slide generation
"""

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
from src.core.websocket_manager import WebSocketManager
from src.services.file_service import FileService
from src.services.slide_service import SlideService
from src.services.kg_task_manager import KnowledgeGraphTaskManager
from src.services.kg_processing import perform_final_clustering

# Import routers
from src.routers.root import router as root_router
from src.routers.api import router as api_router
from src.routers.debug import router as debug_router, init_debug_endpoints
from src.routers.monitoring import router as monitoring_router
from src.routers.websocket import websocket_endpoint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global settings
settings = Settings()

# Initialize services
file_service = FileService()
slide_service = SlideService()

# Global task manager for knowledge graph processing
kg_task_manager = KnowledgeGraphTaskManager()

# WebSocket connection manager
websocket_manager = WebSocketManager()

# Background task for cleaning up stale connections


async def cleanup_stale_connections():
    """Periodically clean up stale WebSocket connections"""
    while True:
        try:
            await asyncio.sleep(30)  # Run every 30 seconds instead of 60
            await websocket_manager.cleanup_stale_connections()

            # Log connection statistics
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
    try:
        from src.core.initialization import initialize_core_services, validate_system_requirements

        # Validate system requirements first
        validation_results = validate_system_requirements()
        if validation_results["status"] == "failed":
            logger.error(
                f"System validation failed: {validation_results['errors']}")
        elif validation_results["status"] == "warning":
            logger.warning(
                f"System validation warnings: {validation_results['warnings']}")
        else:
            logger.info("System validation passed")

        # Initialize core services
        init_status = initialize_core_services()
        if init_status["status"] == "success":
            logger.info("Core AI services initialized successfully")
        else:
            logger.warning(
                f"Core services initialization: {init_status['status']}")
            if init_status["errors"]:
                logger.error(f"Initialization errors: {init_status['errors']}")
    except Exception as e:
        logger.error(f"Failed to initialize core AI services: {e}")

    # Initialize debug endpoints with required services
    init_debug_endpoints(file_service, websocket_manager,
                         kg_task_manager, slide_service)

    # Start background cleanup task
    cleanup_task = asyncio.create_task(cleanup_stale_connections())

    logger.info("Backend started successfully")
    yield

    # Graceful shutdown - wait for all knowledge graph tasks to complete
    logger.info("Waiting for knowledge graph tasks to complete...")
    try:
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

# WebSocket endpoint


@app.websocket("/ws/{client_id}")
async def websocket_endpoint_route(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time communication with frontend"""
    await websocket_endpoint(websocket, client_id)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
