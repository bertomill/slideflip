#!/usr/bin/env python3
"""
Knowledge Graph Message Handlers
Contains handlers for knowledge graph related WebSocket messages
"""

import asyncio
import logging
from fastapi import WebSocket
from src.models.message_models import ServerMessage
from src.services.kg_task_manager import KnowledgeGraphTaskManager
from src.services.kg_processing import perform_final_clustering, get_current_timestamp

logger = logging.getLogger(__name__)

async def handle_kg_status_request(
    websocket: WebSocket, 
    client_id: str, 
    kg_task_manager: KnowledgeGraphTaskManager
):
    """Handle knowledge graph status request from client"""
    try:
        logger.info(f"Received KG status request for client {client_id}")
        
        # Get processing status from task manager
        processing_status = await kg_task_manager.get_processing_status(client_id)
        
        # Get graph statistics from KG service if available
        graph_statistics = {}
        try:
            kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
            graph_statistics = kg_service.get_graph_statistics()
            
            # Add efficiency and completeness information
            efficiency_status = kg_service.get_processing_efficiency_status()
            
            # Try to get uploaded files for completeness check
            try:
                from src.services.file_service import FileService
                file_service = FileService()
                uploaded_files = await file_service.get_client_files(client_id)
                completeness_status = kg_service.get_processing_completeness_status(uploaded_files)
            except Exception as e:
                logger.warning(f"Could not get completeness status: {e}")
                completeness_status = {"error": "Could not retrieve completeness status"}
            
        except Exception as e:
            logger.warning(f"Could not get graph statistics for client {client_id}: {e}")
            graph_statistics = {"error": "Could not retrieve graph statistics"}
            efficiency_status = {"error": "Could not retrieve efficiency status"}
            completeness_status = {"error": "Could not retrieve completeness status"}
        
        # Send status response
        status_message = ServerMessage(
            type="kg_status_response",
            data={
                "processing_status": processing_status,
                "graph_statistics": graph_statistics,
                "efficiency_status": efficiency_status,
                "completeness_status": completeness_status
            }
        )
        
        await asyncio.wait_for(
            websocket.send_text(status_message.model_dump_json()),
            timeout=10.0
        )
        
        logger.info(f"Sent KG status response to client {client_id}")
        
    except Exception as e:
        logger.error(f"Error handling KG status request: {e}")
        try:
            error_message = ServerMessage(
                type="kg_status_error",
                data={"error": "Failed to get KG status", "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending KG status error: {send_error}")
            raise

async def handle_force_clustering_request(
    websocket: WebSocket, 
    client_id: str, 
    kg_task_manager: KnowledgeGraphTaskManager
):
    """Handle force clustering request from client"""
    try:
        logger.info(f"Received force clustering request for client {client_id}")
        
        # Wait for any pending tasks to complete
        await kg_task_manager.wait_for_client_tasks(client_id)
        
        # Get or create KG service
        kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
        
        # Perform final clustering
        await perform_final_clustering(client_id, kg_service, kg_task_manager)
        
        # Mark clustering as completed
        await kg_task_manager.mark_clustering_completed(client_id)
        
        # Send success message
        success_message = ServerMessage(
            type="force_clustering_success",
            data={
                "message": "Knowledge graph clustering completed successfully",
                "timestamp": get_current_timestamp()
            }
        )
        
        await asyncio.wait_for(
            websocket.send_text(success_message.model_dump_json()),
            timeout=10.0
        )
        
        logger.info(f"Force clustering completed for client {client_id}")
        
    except Exception as e:
        logger.error(f"Error handling force clustering request: {e}")
        try:
            error_message = ServerMessage(
                type="force_clustering_error",
                data={"error": "Failed to force clustering", "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending force clustering error: {send_error}")
            raise

async def handle_clear_kg_request(
    websocket: WebSocket, 
    client_id: str, 
    kg_task_manager: KnowledgeGraphTaskManager
):
    """Handle knowledge graph clear request from client"""
    try:
        logger.info(f"Received KG clear request for client {client_id}")
        
        # Wait for any pending tasks to complete
        await kg_task_manager.wait_for_client_tasks(client_id)
        
        # Get or create KG service
        kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
        
        # Clear the knowledge graph
        kg_service.clear_graph()
        
        # Clear all task manager state for this client
        await kg_task_manager.clear_client_state(client_id)
        
        # Send success message
        success_message = ServerMessage(
            type="kg_clear_success",
            data={
                "message": "Knowledge graph cleared successfully",
                "timestamp": get_current_timestamp()
            }
        )
        
        await asyncio.wait_for(
            websocket.send_text(success_message.model_dump_json()),
            timeout=10.0
        )
        
        logger.info(f"Knowledge graph cleared for client {client_id}")
        
    except Exception as e:
        logger.error(f"Error handling KG clear request: {e}")
        try:
            error_message = ServerMessage(
                type="kg_clear_error",
                data={"error": "Failed to clear knowledge graph", "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending KG clear error: {send_error}")
            raise

async def handle_force_reprocessing_request(
    websocket: WebSocket, 
    client_id: str, 
    kg_task_manager: KnowledgeGraphTaskManager
):
    """Handle force reprocessing request from client"""
    try:
        logger.info(f"Received force reprocessing request for client {client_id}")
        
        # Wait for any pending tasks to complete
        await kg_task_manager.wait_for_client_tasks(client_id)
        
        # Force reprocessing
        await kg_task_manager.force_reprocessing(client_id)
        
        # Send success message
        success_message = ServerMessage(
            type="force_reprocessing_success",
            data={
                "message": "Force reprocessing enabled successfully",
                "timestamp": get_current_timestamp()
            }
        )
        
        await asyncio.wait_for(
            websocket.send_text(success_message.model_dump_json()),
            timeout=10.0
        )
        
        logger.info(f"Force reprocessing enabled for client {client_id}")
        
    except Exception as e:
        logger.error(f"Error handling force reprocessing request: {e}")
        try:
            error_message = ServerMessage(
                type="force_reprocessing_error",
                data={"error": "Failed to enable force reprocessing", "details": str(e)}
            )
            await asyncio.wait_for(
                websocket.send_text(error_message.model_dump_json()),
                timeout=10.0
            )
        except Exception as send_error:
            logger.error(f"Error sending force reprocessing error: {send_error}")
            raise
