#!/usr/bin/env python3
"""
Knowledge Graph Task Manager
Manages knowledge graph processing tasks across clients
"""

import asyncio
import logging
from typing import Dict
from src.services.knowledge_graph_service import KnowledgeGraphService

logger = logging.getLogger(__name__)

class KnowledgeGraphTaskManager:
    """Manages knowledge graph processing tasks across clients"""
    
    def __init__(self):
        self.client_tasks: Dict[str, Dict[str, asyncio.Task]] = {}  # client_id -> {filename -> task}
        self.client_kg_services: Dict[str, KnowledgeGraphService] = {}  # client_id -> KG service
        self.client_processed_files: Dict[str, set] = {}  # client_id -> set of processed filenames
        self.client_pending_clustering: Dict[str, bool] = {}  # client_id -> needs clustering flag
        self._lock = asyncio.Lock()
    
    async def get_or_create_kg_service(self, client_id: str) -> KnowledgeGraphService:
        """Get existing KG service or create new one for client"""
        if client_id not in self.client_kg_services:
            self.client_kg_services[client_id] = KnowledgeGraphService(client_id)
            self.client_processed_files[client_id] = set()
            self.client_pending_clustering[client_id] = False
        return self.client_kg_services[client_id]
    
    async def is_file_processed(self, client_id: str, filename: str) -> bool:
        """Check if a file has already been processed for this client"""
        async with self._lock:
            return filename in self.client_processed_files.get(client_id, set())
    
    async def mark_file_processed(self, client_id: str, filename: str):
        """Mark a file as processed for this client"""
        async with self._lock:
            if client_id not in self.client_processed_files:
                self.client_processed_files[client_id] = set()
            self.client_processed_files[client_id].add(filename)
    
    async def add_processing_task(self, client_id: str, filename: str, task: asyncio.Task):
        """Add a processing task for tracking"""
        async with self._lock:
            if client_id not in self.client_tasks:
                self.client_tasks[client_id] = {}
            self.client_tasks[client_id][filename] = task
    
    async def remove_processing_task(self, client_id: str, filename: str):
        """Remove a completed processing task"""
        async with self._lock:
            if client_id in self.client_tasks and filename in self.client_tasks[client_id]:
                del self.client_tasks[client_id][filename]
    
    async def mark_clustering_needed(self, client_id: str):
        """Mark that clustering is needed for this client"""
        async with self._lock:
            self.client_pending_clustering[client_id] = True
    
    async def is_clustering_needed(self, client_id: str) -> bool:
        """Check if clustering is needed for this client"""
        async with self._lock:
            return self.client_pending_clustering.get(client_id, False)
    
    async def can_skip_processing(self, client_id: str) -> bool:
        """Check if file processing can be skipped due to existing clustered graph"""
        try:
            if client_id not in self.client_kg_services:
                return False
            
            kg_service = self.client_kg_services[client_id]
            return kg_service.clustered_graph_exists()
            
        except Exception as e:
            logger.error(f"Error checking if processing can be skipped: {e}")
            return False
    
    async def load_existing_graphs_if_available(self, client_id: str) -> bool:
        """Load existing graphs if available, returns True if graphs were loaded"""
        try:
            if client_id not in self.client_kg_services:
                return False
            
            kg_service = self.client_kg_services[client_id]
            return await kg_service.load_existing_clustered_graph()
            
        except Exception as e:
            logger.error(f"Error loading existing graphs: {e}")
            return False
    
    async def check_if_new_processing_needed(self, client_id: str) -> dict:
        """Check if new file processing is needed when client reconnects"""
        try:
            if client_id not in self.client_kg_services:
                return {"needs_processing": False, "reason": "No KG service found"}
            
            kg_service = self.client_kg_services[client_id]
            
            # Check if clustered graph exists
            if not kg_service.clustered_graph_exists():
                return {"needs_processing": True, "reason": "No clustered graph found"}
            
            # Check if we have file graphs
            if len(kg_service.file_graphs) == 0:
                return {"needs_processing": True, "reason": "No file graphs found"}
            
            # Check if clustering is pending
            if await self.is_clustering_needed(client_id):
                return {"needs_processing": True, "reason": "Clustering pending"}
            
            return {"needs_processing": False, "reason": "All processing complete"}
            
        except Exception as e:
            logger.error(f"Error checking if new processing needed: {e}")
            return {"needs_processing": True, "reason": f"Error: {str(e)}"}
    
    async def force_reprocessing(self, client_id: str):
        """Force reprocessing by clearing existing graphs and processed files"""
        try:
            async with self._lock:
                if client_id in self.client_kg_services:
                    kg_service = self.client_kg_services[client_id]
                    kg_service.clear_graph()
                
                # Clear processed files to allow reprocessing
                if client_id in self.client_processed_files:
                    self.client_processed_files[client_id].clear()
                
                # Reset clustering flag
                if client_id in self.client_pending_clustering:
                    self.client_pending_clustering[client_id] = False
                
                logger.info(f"Force reprocessing enabled for client {client_id}")
                
        except Exception as e:
            logger.error(f"Error forcing reprocessing for client {client_id}: {e}")
    
    async def mark_clustering_completed(self, client_id: str):
        """Mark that clustering has been completed for this client"""
        async with self._lock:
            self.client_pending_clustering[client_id] = False
    
    async def get_pending_tasks_count(self, client_id: str) -> int:
        """Get count of pending tasks for a client"""
        async with self._lock:
            return len(self.client_tasks.get(client_id, {}))
    
    async def wait_for_client_tasks(self, client_id: str):
        """Wait for all pending tasks for a client to complete"""
        async with self._lock:
            tasks = list(self.client_tasks.get(client_id, {}).values())
        
        if tasks:
            logger.info(f"Waiting for {len(tasks)} pending tasks for client {client_id}")
            await asyncio.gather(*tasks, return_exceptions=True)
            logger.info(f"All tasks completed for client {client_id}")
    
    async def check_file_content_similarity(self, client_id: str, filename: str, content_hash: str) -> bool:
        """Check if a file with similar content has already been processed"""
        # This could be enhanced to use content hashing or similarity detection
        # For now, we'll use filename matching as a simple approach
        return await self.is_file_processed(client_id, filename)
    
    async def get_processing_status(self, client_id: str) -> dict:
        """Get the current processing status for a client"""
        async with self._lock:
            pending_tasks = len(self.client_tasks.get(client_id, {}))
            processed_files = len(self.client_processed_files.get(client_id, set()))
            clustering_needed = self.client_pending_clustering.get(client_id, False)
            
            return {
                "pending_tasks": pending_tasks,
                "processed_files": processed_files,
                "clustering_needed": clustering_needed,
                "has_kg_service": client_id in self.client_kg_services
            }
    
    async def clear_client_state(self, client_id: str):
        """Clear all state for a specific client"""
        async with self._lock:
            # Cancel any pending tasks
            if client_id in self.client_tasks:
                for task in self.client_tasks[client_id].values():
                    if not task.done():
                        task.cancel()
                del self.client_tasks[client_id]
            
            # Clear processed files
            if client_id in self.client_processed_files:
                del self.client_processed_files[client_id]
            
            # Clear clustering flag
            if client_id in self.client_pending_clustering:
                del self.client_pending_clustering[client_id]
            
            # Clear KG service
            if client_id in self.client_kg_services:
                del self.client_kg_services[client_id]
            
            logger.info(f"Cleared all state for client {client_id}")
