#!/usr/bin/env python3
"""
Knowledge Graph Processing Functions
Contains functions for processing files and performing clustering operations
"""

import asyncio
import logging
from src.services.knowledge_graph_service import KnowledgeGraphService
from src.services.kg_task_manager import KnowledgeGraphTaskManager

logger = logging.getLogger(__name__)

async def process_file_for_knowledge_graph(
    kg_service: KnowledgeGraphService, 
    file_info, 
    content: str, 
    client_id: str,
    kg_task_manager: KnowledgeGraphTaskManager
):
    """Process a file for knowledge graph extraction in the background"""
    try:
        logger.info(f"Processing file {file_info.filename} for knowledge graph extraction")
        
        # Process the file for knowledge graph
        await kg_service._process_file_for_knowledge_graph(file_info, content)
        
        # Mark file as processed
        await kg_task_manager.mark_file_processed(client_id, file_info.filename)
        
        # Remove task from tracking
        await kg_task_manager.remove_processing_task(client_id, file_info.filename)
        
        logger.info(f"Completed knowledge graph extraction for file {file_info.filename}")
        
        # Check if we need to perform clustering
        if await kg_task_manager.is_clustering_needed(client_id):
            # Wait a bit to see if more files are being processed
            await asyncio.sleep(2)
            
            # Check if there are still pending tasks
            pending_count = await kg_task_manager.get_pending_tasks_count(client_id)
            
            if pending_count == 0:
                logger.info(f"No pending tasks for client {client_id}, performing clustering")
                
                # Perform clustering of all graphs
                await perform_final_clustering(client_id, kg_service, kg_task_manager)
                
                # Mark clustering as completed
                await kg_task_manager.mark_clustering_completed(client_id)
                
                logger.info(f"Clustering completed for client {client_id}")
            else:
                logger.info(f"Still {pending_count} pending tasks for client {client_id}, clustering will wait")
        
    except Exception as e:
        logger.error(f"Error in knowledge graph extraction for file {file_info.filename}: {e}")
        
        # Remove task from tracking even on error
        await kg_task_manager.remove_processing_task(client_id, file_info.filename)
        
        # Still mark file as processed to avoid infinite retries
        await kg_task_manager.mark_file_processed(client_id, file_info.filename)

async def perform_final_clustering(
    client_id: str, 
    kg_service: KnowledgeGraphService,
    kg_task_manager: KnowledgeGraphTaskManager
):
    """Perform final clustering of all knowledge graphs for a client"""
    try:
        logger.info(f"Performing final clustering for client {client_id}")
        
        # Get all file graphs from the service
        file_graphs = list(kg_service.file_graphs.values())
        
        if not file_graphs:
            logger.warning(f"No file graphs found for client {client_id}")
            return
        
        if len(file_graphs) == 1:
            logger.info(f"Only one graph for client {client_id}, no clustering needed")
            # Still save the single graph as clustered graph
            kg_service.graph = file_graphs[0]
            await kg_service._save_clustered_graph()
            return
        
        # Perform clustering of multiple graphs
        logger.info(f"Clustering {len(file_graphs)} graphs for client {client_id}")
        clustered_graph = await kg_service._cluster_networkx_graphs(file_graphs)
        
        # Update the main graph
        kg_service.graph = clustered_graph
        
        # Save the clustered graph
        await kg_service._save_clustered_graph()
        
        logger.info(f"Final clustering completed for client {client_id}: {len(clustered_graph.nodes)} nodes, {len(clustered_graph.edges)} edges")
        
    except Exception as e:
        logger.error(f"Error in final clustering for client {client_id}: {e}")

def get_current_timestamp() -> str:
    """Get current timestamp as string"""
    from datetime import datetime
    return datetime.now().isoformat()
