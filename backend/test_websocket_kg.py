#!/usr/bin/env python3
"""
Test script to debug websocket knowledge graph generation
"""

import asyncio
import logging
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.services.knowledge_graph_service import KnowledgeGraphService
from src.services.kg_task_manager import KnowledgeGraphTaskManager
from src.services.kg_processing import process_file_for_knowledge_graph, perform_final_clustering
from src.services.file_service import FileService, FileInfo

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_kg_flow():
    """Test the websocket knowledge graph flow"""
    try:
        logger.info("Testing websocket knowledge graph flow...")
        
        # Create task manager and knowledge graph service
        kg_task_manager = KnowledgeGraphTaskManager()
        client_id = "test_client_websocket"
        
        # Get or create knowledge graph service
        kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
        logger.info(f"Knowledge graph service created for client {client_id}")
        
        # Create a test file
        test_content = """
        This is a test document about artificial intelligence and machine learning.
        AI has become increasingly important in modern technology.
        Machine learning algorithms can process large amounts of data.
        Deep learning is a subset of machine learning.
        Neural networks are the foundation of deep learning.
        """
        
        file_info = FileInfo(
            filename="test_document.txt",
            file_path="/tmp/test_document.txt",
            file_size=len(test_content),
            file_type="text/plain",
            upload_time="2024-01-01T00:00:00"
        )
        
        logger.info(f"Processing file: {file_info.filename}")
        logger.info(f"Content length: {len(test_content)} characters")
        
        # Process the file for knowledge graph
        await process_file_for_knowledge_graph(
            kg_service, file_info, test_content, client_id, kg_task_manager
        )
        
        logger.info("File processing completed")
        logger.info(f"File graphs: {len(kg_service.file_graphs)}")
        logger.info(f"File graph keys: {list(kg_service.file_graphs.keys())}")
        
        # Check if clustering is needed
        clustering_needed = await kg_task_manager.is_clustering_needed(client_id)
        logger.info(f"Clustering needed: {clustering_needed}")
        
        # Check pending tasks
        pending_count = await kg_task_manager.get_pending_tasks_count(client_id)
        logger.info(f"Pending tasks: {pending_count}")
        
        # Perform clustering if needed
        if clustering_needed and pending_count == 0:
            logger.info("Performing final clustering...")
            await perform_final_clustering(client_id, kg_service, kg_task_manager)
            
            # Check final status
            logger.info(f"Final graph: {len(kg_service.graph.nodes) if kg_service.graph else 0} nodes")
            logger.info(f"Node embeddings: {len(kg_service.node_embeddings) if kg_service.node_embeddings else 0}")
            logger.info(f"Edge embeddings: {len(kg_service.edge_embeddings) if kg_service.edge_embeddings else 0}")
        
        logger.info("Test completed successfully!")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    asyncio.run(test_websocket_kg_flow())
