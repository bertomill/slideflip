#!/usr/bin/env python3
"""
Test script to debug websocket knowledge graph generation with multiple files
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

async def test_websocket_kg_multi_flow():
    """Test the websocket knowledge graph flow with multiple files"""
    try:
        logger.info("Testing websocket knowledge graph flow with multiple files...")
        
        # Create task manager and knowledge graph service
        kg_task_manager = KnowledgeGraphTaskManager()
        client_id = "test_client_websocket_multi"
        
        # Get or create knowledge graph service
        kg_service = await kg_task_manager.get_or_create_kg_service(client_id)
        logger.info(f"Knowledge graph service created for client {client_id}")
        
        # Create multiple test files
        test_files = [
            {
                "filename": "ai_document.txt",
                "content": """
                Artificial intelligence is transforming industries worldwide.
                Machine learning algorithms enable computers to learn from data.
                Deep learning uses neural networks for complex pattern recognition.
                Natural language processing helps computers understand human language.
                Computer vision allows machines to interpret visual information.
                """
            },
            {
                "filename": "ml_document.txt", 
                "content": """
                Machine learning is a subset of artificial intelligence.
                Supervised learning uses labeled training data.
                Unsupervised learning finds patterns in unlabeled data.
                Reinforcement learning learns through trial and error.
                Neural networks are inspired by biological brain structures.
                """
            },
            {
                "filename": "tech_document.txt",
                "content": """
                Technology is advancing at an exponential rate.
                Cloud computing provides scalable infrastructure.
                Big data analytics reveals valuable insights.
                Internet of Things connects devices worldwide.
                Blockchain technology ensures secure transactions.
                """
            }
        ]
        
        # Process each file
        for i, file_data in enumerate(test_files):
            logger.info(f"Processing file {i+1}/{len(test_files)}: {file_data['filename']}")
            
            file_info = FileInfo(
                filename=file_data['filename'],
                file_path=f"/tmp/{file_data['filename']}",
                file_size=len(file_data['content']),
                file_type="text/plain",
                upload_time="2024-01-01T00:00:00"
            )
            
            # Process the file for knowledge graph
            await process_file_for_knowledge_graph(
                kg_service, file_info, file_data['content'], client_id, kg_task_manager
            )
            
            logger.info(f"Completed processing {file_data['filename']}")
        
        logger.info("All files processed")
        logger.info(f"File graphs: {len(kg_service.file_graphs)}")
        logger.info(f"File graph keys: {list(kg_service.file_graphs.keys())}")
        
        # Mark that clustering is needed (simulate websocket behavior)
        await kg_task_manager.mark_clustering_needed(client_id)
        logger.info("Marked clustering as needed")
        
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
        else:
            logger.info("Clustering not needed or pending tasks exist")
        
        logger.info("Test completed successfully!")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    asyncio.run(test_websocket_kg_multi_flow())
