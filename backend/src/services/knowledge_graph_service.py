"""
Knowledge Graph Service for building and managing knowledge graphs from uploaded files
"""

import logging
import networkx as nx
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, as_completed
import json
import os
import asyncio
from collections import defaultdict
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import openai
import tiktoken  # Add this import
from datetime import datetime

from src.models.message_models import FileInfo
from src.core.config import Settings
from src.services.llm_service import LLMService

logger = logging.getLogger(__name__)

class KnowledgeGraphService:
    """Service for building and managing knowledge graphs from document content"""
    
    def __init__(self, client_id: str):
        self.graph = nx.DiGraph()
        self.file_graphs = {}  # Maps file_id to NetworkX graph
        self.file_graph_data = {}  # Maps file_id to graph data
        self.settings = Settings()
        self.client_id = client_id
        self.llm_service = LLMService()
        
        # Initialize tiktoken tokenizer for chunking
        try:
            self.tokenizer = tiktoken.encoding_for_model("gpt-4o")
            self.chunk_size = 200  # tokens
            self.chunk_overlap = 20  # tokens (10% overlap)
        except Exception as e:
            logger.warning(f"Failed to load tiktoken tokenizer: {e}. Using fallback chunking.")
            self.tokenizer = None
            self.chunk_size = 1000  # characters
            self.chunk_overlap = 100  # characters
        # Create output directories
        self._create_output_directories()
        # Embedding storage
        self.node_embeddings: Dict[str, np.ndarray] = {}
        self.edge_embeddings: Dict[Tuple[str, str], np.ndarray] = {}
        self.openai_client: Optional[openai.OpenAI] = None
        
        # Initialize OpenAI client
        self._initialize_openai_client()
    
    def _create_output_directories(self):
        """Create necessary output directories"""
        base_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id
        directories = ["graph_data", "graphs", "clustered_graphs"]
        
        for dir_name in directories:
            dir_path = base_dir / dir_name
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created directory: {dir_path}")
    
    async def build_knowledge_graph_from_files(self, files: List[FileInfo], contents: Dict[str, str]) -> nx.DiGraph:
        """
        Build knowledge graph from uploaded files and their extracted content
        
        Args:
            files: List of FileInfo objects for uploaded files
            contents: Dictionary mapping file paths to extracted content
            
        Returns:
            NetworkX DiGraph representing the clustered knowledge graph
        """
        logger.info(f"Building knowledge graph from {len(files)} files")
        
        # Process each file to extract knowledge graph data
        for file_info in files:
            try:
                content = contents.get(file_info.file_path, "")
                if content:
                    await self._process_file_for_knowledge_graph(file_info, content)
                else:
                    logger.warning(f"No content found for file: {file_info.filename}")
            except Exception as e:
                logger.error(f"Error processing file {file_info.filename}: {e}")
        
        # Cluster all graphs into one
        if self.file_graphs:
            self.graph = await self._cluster_networkx_graphs(list(self.file_graphs.values()))
            logger.info(f"Successfully clustered {len(self.file_graphs)} graphs into one")
            
            # Save the clustered graph
            await self._save_clustered_graph()
        else:
            logger.warning("No graphs were generated successfully")
        
        return self.graph
    
    async def _process_file_for_knowledge_graph(self, file_info: FileInfo, content: str):
        """Process a single file to extract knowledge graph data with parallel chunk processing"""
        logger.info(f"Processing file for knowledge graph: {file_info.filename}")
        
        # Chunk the content using tokenizer
        content_chunks = self._chunk_content_with_tokenizer(content)
        logger.info(f"Chunked content into {len(content_chunks)} chunks")
        
        # Process chunks in parallel
        all_chunk_data = await self._process_chunks_in_parallel(
            content_chunks, file_info.filename, file_info.file_path
        )
        # Merge graph data from all chunks
        merged_graph_data = self._merge_graph_data_with_weights(all_chunk_data)
        
        # Save graph data to JSON file
        graph_data_file = await self._save_graph_data_to_json(file_info.filename, merged_graph_data)
        
        # Generate NetworkX graph from merged data
        graph = self._generate_networkx_graph_from_graph_data(merged_graph_data, file_info.filename, file_info.file_path)
        
        # Save the graph to file
        graph_file = self._get_graph_file_path(file_info.filename)
        self._save_graph(graph, graph_file)
        
        # Store in memory
        self.file_graph_data[file_info.filename] = merged_graph_data
        self.file_graphs[file_info.filename] = graph
        
        logger.info(f"Generated knowledge graph for file {file_info.filename}")
    
    def _chunk_content_with_tokenizer(self, content: str) -> List[str]:
        """Chunk content using tiktoken tokenizer with overlap"""
        if self.tokenizer is None:
            # Fallback to character-based chunking
            return self._chunk_content_fallback(content)
        
        # Tokenize the content
        tokens = self.tokenizer.encode(content)
        
        if len(tokens) <= self.chunk_size:
            return [content]
        
        chunks = []
        start = 0
        
        while start < len(tokens):
            end = min(start + self.chunk_size, len(tokens))
            
            # Extract tokens for this chunk
            chunk_tokens = tokens[start:end]
            
            # Decode tokens back to text
            chunk_text = self.tokenizer.decode(chunk_tokens)
            
            # Clean up chunk boundaries
            chunk_text = self._clean_chunk_boundaries(chunk_text)
            
            if chunk_text.strip():
                chunks.append(chunk_text)
            
            # Move to next chunk with overlap
            start = end - self.chunk_overlap
            if start >= len(tokens):
                break
        
        return chunks

    def _chunk_content_fallback(self, content: str) -> List[str]:
        """Fallback chunking method using character-based approach"""
        if len(content) <= self.chunk_size:
            return [content]
        
        chunks = []
        start = 0
        
        while start < len(content):
            end = min(start + self.chunk_size, len(content))
            
            # Try to break at sentence boundary
            if end < len(content):
                # Look for sentence endings
                for i in range(end, max(start + self.chunk_size - 100, start), -1):
                    if content[i] in '.!?':
                        end = i + 1
                        break
            
            chunk = content[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move to next chunk with overlap
            start = end - self.chunk_overlap
            if start >= len(content):
                break
        
        return chunks

    def _clean_chunk_boundaries(self, text: str) -> str:
        """Clean up chunk boundaries to avoid cutting words or sentences"""
        # Remove leading/trailing whitespace
        text = text.strip()
        
        # Try to start with a complete word
        if text and not text[0].isalnum():
            # Find first alphanumeric character
            for i, char in enumerate(text):
                if char.isalnum():
                    text = text[i:]
                    break
        
        # Try to end with a complete sentence
        if text and not text[-1] in '.!?':
            # Find last sentence ending
            for i in range(len(text) - 1, -1, -1):
                if text[i] in '.!?':
                    text = text[:i + 1]
                    break
        
        return text

    async def _process_chunks_in_parallel(self, chunks: List[str], filename: str, file_path: str) -> List[Dict[str, Any]]:
        """Process chunks in parallel using asyncio.gather"""
        logger.info(f"Processing {len(chunks)} chunks in parallel for {filename}")
        
        # Create tasks for parallel processing
        tasks = []
        for i, chunk in enumerate(chunks):
            task = self.llm_service.extract_knowledge_graph_from_chunk(
                chunk, i, filename, file_path
            )
            tasks.append(task)
        
        # Process all chunks concurrently
        chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out any failed extractions
        valid_results = []
        for i, result in enumerate(chunk_results):
            if isinstance(result, Exception):
                logger.error(f"Chunk {i} extraction failed: {result}")
                # Generate fallback data for failed chunks
                fallback_data = self.llm_service._generate_fallback_knowledge_graph_data(
                    chunks[i], i, filename, file_path
                )
                valid_results.append(fallback_data)
            else:
                valid_results.append(result)
        
        logger.info(f"Successfully processed {len(valid_results)} chunks for {filename}")
        return valid_results

    def _chunk_content(self, content: str) -> List[str]:
        """Legacy chunking method - kept for backward compatibility"""
        return self._chunk_content_with_tokenizer(content)
    
    def _merge_graph_data_with_weights(self, all_chunk_data: List[dict]) -> dict:
        """
        Merge graph data from multiple chunks into a clustered structure optimized for NetworkX
        
        Args:
            all_chunk_data: List of graph data dictionaries from chunks
            Each chunk contains: entities, relationships, facts, and metadata
            
        Returns:
            Clustered graph data dictionary with entities as the central structure
            Each entity contains its connections, relationships, facts, and metadata
        """
        # Track entity frequency and create unified entity mapping
        entity_frequency = defaultdict(int)
        entity_mapping = {}  # Maps entity names to unified IDs
        entity_data = {}  # Stores complete entity information
        
        # First pass: collect all entities and count frequency
        for chunk_data in all_chunk_data:
            if "entities" in chunk_data:
                for entity in chunk_data["entities"]:
                    entity_name = entity.get("name", "").strip()
                    if entity_name:
                        entity_frequency[entity_name.lower()] += 1
        
        # Second pass: merge entities and collect all their data
        for chunk_data in all_chunk_data:
            if "entities" in chunk_data:
                for entity in chunk_data["entities"]:
                    entity_name = entity.get("name", "").strip()
                    if not entity_name:
                        continue
                    
                    chunk_index = chunk_data.get("chunk_index", 0)
                    filename = chunk_data.get("filename", "")
                    file_path = chunk_data.get("file_path", "")
                    chunk_content = entity.get("chunk_content", "")
                    extraction_timestamp = entity.get("extraction_timestamp", "")
                    
                    if entity_name.lower() in entity_mapping:
                        # Entity exists, merge metadata
                        unified_id = entity_mapping[entity_name.lower()]
                        existing_entity = entity_data[unified_id]
                        
                        # Merge chunk information
                        if chunk_index not in existing_entity["chunks"]:
                            existing_entity["chunks"].append(chunk_index)
                        existing_entity["chunk_content"].append(chunk_content)
                        existing_entity["filename"].append(filename)
                        existing_entity["file_path"].append(file_path)
                        existing_entity["extraction_timestamp"].append(extraction_timestamp)
                        
                        # Merge other fields if they're different
                        if entity.get("type") and entity.get("type") not in existing_entity["type"]:
                            existing_entity["type"].append(entity.get("type"))
                        if entity.get("description") and entity.get("description") not in existing_entity["description"]:
                            existing_entity["description"].append(entity.get("description"))
                    else:
                        # New entity, create unified ID
                        unified_id = f"entity_{len(entity_data)}"
                        entity_mapping[entity_name.lower()] = unified_id
                        
                        # Initialize entity data structure
                        entity_data[unified_id] = {
                            "id": unified_id,
                            "name": entity_name,
                            "type": [entity.get("type", "")] if entity.get("type") else [],
                            "description": [entity.get("description", "")] if entity.get("description") else [],
                            "frequency": entity_frequency[entity_name.lower()],
                            "chunks": [chunk_index],
                            "chunk_content": [chunk_content],
                            "filename": [filename],
                            "file_path": [file_path],
                            "extraction_timestamp": [extraction_timestamp],
                            "connections": [],  # Will store relationship data
                            "facts": [],  # Will store facts related to this entity
                            "metadata": {}  # Will store additional metadata
                        }
        
        # Process relationships and connect entities
        for chunk_data in all_chunk_data:
            if "relationships" in chunk_data:
                for rel in chunk_data["relationships"]:
                    source = rel.get("source", "").strip()
                    target = rel.get("target", "").strip()
                    rel_type = rel.get("type", "").strip()
                    
                    if not all([source, target, rel_type]):
                        continue
                    
                    # Find the unified IDs for source and target entities
                    source_id = None
                    target_id = None
                    
                    for entity_id, entity_info in entity_data.items():
                        if entity_info["name"].lower() == source.lower():
                            source_id = entity_id
                        if entity_info["name"].lower() == target.lower():
                            target_id = entity_id
                    
                    if source_id and target_id:
                        # Add connection to source entity
                        connection = {
                            "target_entity": target_id,
                            "target_name": target,
                            "relationship_type": rel_type,
                            "chunks": [chunk_data.get("chunk_index", 0)],
                            "chunk_content": [rel.get("chunk_content", "")],
                            "filename": [chunk_data.get("filename", "")],
                            "file_path": [chunk_data.get("file_path", "")],
                            "extraction_timestamp": [rel.get("extraction_timestamp", "")]
                        }
                        
                        # Check if this connection already exists
                        existing_connection = None
                        for conn in entity_data[source_id]["connections"]:
                            if (conn["target_entity"] == target_id and 
                                conn["relationship_type"] == rel_type):
                                existing_connection = conn
                                break
                        
                        if existing_connection:
                            # Merge with existing connection
                            if chunk_data.get("chunk_index") not in existing_connection["chunks"]:
                                existing_connection["chunks"].append(chunk_data.get("chunk_index", 0))
                            existing_connection["chunk_content"].append(rel.get("chunk_content", ""))
                            existing_connection["filename"].append(chunk_data.get("filename", ""))
                            existing_connection["file_path"].append(chunk_data.get("file_path", ""))
                            existing_connection["extraction_timestamp"].append(rel.get("extraction_timestamp", ""))
                        else:
                            entity_data[source_id]["connections"].append(connection)
        
        # Process facts and associate them with entities
        for chunk_data in all_chunk_data:
            if "facts" in chunk_data:
                for fact in chunk_data["facts"]:
                    fact_text = fact.get("text", "").strip()
                    if not fact_text:
                        continue
                    
                    chunk_index = chunk_data.get("chunk_index", 0)
                    filename = chunk_data.get("filename", "")
                    file_path = chunk_data.get("file_path", "")
                    chunk_content = fact.get("chunk_content", "")
                    extraction_timestamp = fact.get("extraction_timestamp", "")
                    
                    fact_data = {
                        "text": fact_text,
                        "chunks": [chunk_index],
                        "chunk_content": [chunk_content],
                        "filename": [filename],
                        "file_path": [file_path],
                        "extraction_timestamp": [extraction_timestamp]
                    }
                    
                    # Associate fact with entities mentioned in it
                    for entity_id, entity_info in entity_data.items():
                        if entity_info["name"].lower() in fact_text.lower():
                            # Check if this fact already exists for this entity
                            fact_exists = False
                            for existing_fact in entity_info["facts"]:
                                if existing_fact["text"].lower() == fact_text.lower():
                                    # Merge with existing fact
                                    if chunk_index not in existing_fact["chunks"]:
                                        existing_fact["chunks"].append(chunk_index)
                                    existing_fact["chunk_content"].append(chunk_content)
                                    existing_fact["filename"].append(filename)
                                    existing_fact["file_path"].append(file_path)
                                    existing_fact["extraction_timestamp"].append(extraction_timestamp)
                                    fact_exists = True
                                    break
                            
                            if not fact_exists:
                                entity_info["facts"].append(fact_data)
        
        # Calculate weights for connections based on frequency and confidence
        for entity_id, entity_info in entity_data.items():
            for connection in entity_info["connections"]:
                target_entity = entity_data[connection["target_entity"]]
                source_freq = entity_info["frequency"]
                target_freq = target_entity["frequency"]
                rel_freq = len(connection["chunks"])
                
                connection["weight"] = self._calculate_connection_weight(
                    source_freq, target_freq, rel_freq, connection.get("confidence", 0.5)
                )
        
        # Filter to keep only the most important entities and connections
        # Sort entities by importance score (frequency + total connections + total facts)
        entity_importance = []
        for entity_id, entity_info in entity_data.items():
            importance_score = (
                entity_info["frequency"] * 2 +  # Frequency has highest weight
                len(entity_info["connections"]) * 1.5 +  # Connections are important
                len(entity_info["facts"]) * 1.0  # Facts add value
            )
            entity_importance.append((entity_id, importance_score, entity_info))
        
        # Sort by importance score (descending) and take top 200 entities
        entity_importance.sort(key=lambda x: x[1], reverse=True)
        top_entities = entity_importance[:200]
        
        # Create filtered entity data
        filtered_entity_data = {}
        for entity_id, _, entity_info in top_entities:
            filtered_entity_data[entity_id] = entity_info
        
        # Now filter connections to keep only those between top entities
        # and limit total connections to 400
        all_connections = []
        for entity_id, entity_info in filtered_entity_data.items():
            for connection in entity_info["connections"]:
                target_id = connection["target_entity"]
                if target_id in filtered_entity_data:  # Only keep connections to top entities
                    connection_score = (
                        connection["weight"] * 2 +  # Connection weight
                        len(connection["chunks"]) * 1.5 +  # Frequency of relationship
                        (entity_info["frequency"] + filtered_entity_data[target_id]["frequency"]) * 0.5  # Combined entity frequency
                    )
                    all_connections.append((entity_id, connection, connection_score))
        
        # Sort connections by score and take top 400
        all_connections.sort(key=lambda x: x[2], reverse=True)
        top_connections = all_connections[:400]
        
        # Rebuild entity data with filtered connections
        final_entity_data = {}
        for entity_id, entity_info in filtered_entity_data.items():
            # Get only the connections that made it to top 400
            entity_connections = []
            for conn_entity_id, connection, _ in top_connections:
                if conn_entity_id == entity_id:
                    entity_connections.append(connection)
            
            # Create final entity with filtered connections
            final_entity = entity_info.copy()
            final_entity["connections"] = entity_connections
            final_entity_data[entity_id] = final_entity
        
        # Convert to final structure
        clustered_data = {
            "entities": list(final_entity_data.values()),
            "total_entities": len(final_entity_data),
            "total_connections": sum(len(entity["connections"]) for entity in final_entity_data.values()),
            "total_facts": sum(len(entity["facts"]) for entity in final_entity_data.values()),
            "metadata": {
                "chunk_count": len(all_chunk_data),
                "extraction_timestamp": datetime.now().isoformat(),
                "filtering_applied": True,
                "original_entities": len(entity_data),
                "original_connections": sum(len(entity["connections"]) for entity in entity_data.values()),
                "entity_limit": 200,
                "connection_limit": 400
            }
        }
        
        logger.info(f"Merged graph data from {len(all_chunk_data)} chunks")
        logger.info(f"  Original entities: {len(entity_data)} -> Filtered to: {clustered_data['total_entities']}")
        logger.info(f"  Original connections: {sum(len(entity['connections']) for entity in entity_data.values())} -> Filtered to: {clustered_data['total_connections']}")
        logger.info(f"  Total facts: {clustered_data['total_facts']}")
        logger.info(f"  Filtering limits: 200 entities, 400 connections")
        
        return clustered_data
    
    def _calculate_connection_weight(self, source_freq: int, target_freq: int, rel_freq: int, confidence: float = None) -> float:
        """Calculate normalized weight for entity connections"""
        # Weight based on entity frequency, relationship frequency, and confidence
        base_weight = (source_freq + target_freq) / 2.0
        rel_weight = rel_freq
        conf_weight = confidence if confidence is not None else 0.5
        
        # Normalize to 0-1 range
        normalized_weight = min(1.0, (base_weight + rel_weight + conf_weight) / 15.0)
        return round(normalized_weight, 3)
    
    def convert_clustered_to_legacy_format(self, clustered_data: dict) -> dict:
        """
        Convert clustered data structure back to legacy format for backward compatibility
        
        Args:
            clustered_data: The new clustered data structure
            
        Returns:
            Legacy format data structure with separate entities, relationships, and facts lists
        """
        legacy_data = {
            "entities": [],
            "relationships": [],
            "facts": [],
            "metadata": clustered_data.get("metadata", {})
        }
        
        # Convert entities
        for entity in clustered_data.get("entities", []):
            legacy_entity = {
                "id": entity["id"],
                "name": entity["name"],
                "type": " ||| ".join(entity.get("type", [])) if entity.get("type") else "",
                "description": " ||| ".join(entity.get("description", [])) if entity.get("description") else "",
                "confidence": entity.get("confidence", 0.0),
                "frequency": entity.get("frequency", 1),
                "chunks": entity.get("chunks", []),
                "chunk_content": " ||| ".join(entity.get("chunk_content", [])),
                "filename": " ||| ".join(entity.get("filename", [])),
                "file_path": " ||| ".join(entity.get("file_path", [])),
                "extraction_timestamp": " ||| ".join(entity.get("extraction_timestamp", []))
            }
            legacy_data["entities"].append(legacy_entity)
        
        # Convert connections to relationships
        for entity in clustered_data.get("entities", []):
            for connection in entity.get("connections", []):
                legacy_relationship = {
                    "source": entity["name"],
                    "target": connection["target_name"],
                    "type": connection["relationship_type"],
                    "key": f"{entity['name']}::{connection['relationship_type']}::{connection['target_name']}",
                    "confidence": connection.get("confidence", 0.0),
                    "frequency": len(connection.get("chunks", [])),
                    "chunks": connection.get("chunks", []),
                    "chunk_content": " ||| ".join(connection.get("chunk_content", [])),
                    "filename": " ||| ".join(connection.get("filename", [])),
                    "file_path": " ||| ".join(connection.get("file_path", [])),
                    "extraction_timestamp": " ||| ".join(connection.get("extraction_timestamp", [])),
                    "weight": connection.get("weight", 1.0)
                }
                legacy_data["relationships"].append(legacy_relationship)
        
        # Convert facts
        for entity in clustered_data.get("entities", []):
            for fact in entity.get("facts", []):
                legacy_fact = {
                    "text": fact["text"],
                    "key": fact["text"].lower(),
                    "confidence": fact.get("confidence", 0.0),
                    "frequency": len(fact.get("chunks", [])),
                    "chunks": fact.get("chunks", []),
                    "chunk_content": " ||| ".join(fact.get("chunk_content", [])),
                    "filename": " ||| ".join(fact.get("filename", [])),
                    "file_path": " ||| ".join(fact.get("file_path", [])),
                    "extraction_timestamp": " ||| ".join(fact.get("extraction_timestamp", []))
                }
                legacy_data["facts"].append(legacy_fact)
        
        return legacy_data
    
    def get_clustered_data_summary(self, clustered_data: dict) -> dict:
        """
        Get a summary of the clustered data structure
        
        Args:
            clustered_data: The clustered data structure
            
        Returns:
            Summary dictionary with key statistics and insights
        """
        entities = clustered_data.get("entities", [])
        
        # Entity type distribution
        type_distribution = {}
        for entity in entities:
            for entity_type in entity.get("type", ["unknown"]):
                type_distribution[entity_type] = type_distribution.get(entity_type, 0) + 1
        
        # Connection type distribution
        connection_type_distribution = {}
        total_connections = 0
        for entity in entities:
            for connection in entity.get("connections", []):
                rel_type = connection.get("relationship_type", "unknown")
                connection_type_distribution[rel_type] = connection_type_distribution.get(rel_type, 0) + 1
                total_connections += 1
        
        # Entity connectivity analysis
        connectivity_stats = []
        for entity in entities:
            connections = len(entity.get("connections", []))
            facts = len(entity.get("facts", []))
            connectivity_stats.append({
                "entity_name": entity["name"],
                "connections": connections,
                "facts": facts,
                "frequency": entity.get("frequency", 1)
            })
        
        # Sort by connectivity
        connectivity_stats.sort(key=lambda x: x["connections"], reverse=True)
        
        summary = {
            "total_entities": len(entities),
            "total_connections": total_connections,
            "total_facts": sum(len(entity.get("facts", [])) for entity in entities),
            "entity_type_distribution": type_distribution,
            "connection_type_distribution": connection_type_distribution,
            "most_connected_entities": connectivity_stats[:10],  # Top 10
            "entity_frequency_stats": {
                "min": min((entity.get("frequency", 1) for entity in entities), default=1),
                "max": max((entity.get("frequency", 1) for entity in entities), default=1),
                "avg": sum(entity.get("frequency", 1) for entity in entities) / len(entities) if entities else 0
            }
        }
        
        # Add filtering information if available
        if clustered_data.get("metadata", {}).get("filtering_applied"):
            summary["filtering_info"] = {
                "filtering_applied": True,
                "original_entities": clustered_data["metadata"].get("original_entities", 0),
                "original_connections": clustered_data["metadata"].get("original_connections", 0),
                "entity_limit": clustered_data["metadata"].get("entity_limit", 200),
                "connection_limit": clustered_data["metadata"].get("connection_limit", 400),
                "entities_filtered": clustered_data["metadata"].get("original_entities", 0) - len(entities),
                "connections_filtered": clustered_data["metadata"].get("original_connections", 0) - total_connections
            }
        
        return summary
    
    def test_filtering_logic(self, sample_chunk_data: List[dict]) -> dict:
        """
        Test the filtering logic with sample data to demonstrate entity and connection limits
        
        Args:
            sample_chunk_data: Sample chunk data to test with
            
        Returns:
            Dictionary showing filtering results and statistics
        """
        # Create a large sample dataset to test filtering
        large_chunk_data = []
        
        # Generate 500 entities across multiple chunks
        for chunk_idx in range(10):
            chunk_entities = []
            chunk_relationships = []
            chunk_facts = []
            
            # Add 50 entities per chunk
            for entity_idx in range(50):
                entity_id = f"entity_{chunk_idx}_{entity_idx}"
                entity_name = f"Entity_{chunk_idx}_{entity_idx}"
                
                # Vary frequency and importance
                frequency = (chunk_idx + 1) * (entity_idx + 1) % 10 + 1
                
                chunk_entities.append({
                    "id": entity_id,
                    "name": entity_name,
                    "type": f"type_{entity_idx % 5}",
                    "description": f"Description for {entity_name}",
                    "chunk_content": f"Content mentioning {entity_name}",
                    "chunk_index": chunk_idx,
                    "filename": f"chunk_{chunk_idx}.txt",
                    "file_path": f"/path/to/chunk_{chunk_idx}.txt",
                    "extraction_timestamp": "2024-01-01T10:00:00"
                })
                
                # Add some relationships
                if entity_idx > 0:
                    chunk_relationships.append({
                        "source": entity_name,
                        "target": f"Entity_{chunk_idx}_{entity_idx-1}",
                        "type": "related_to",
                        "chunk_content": f"Relationship between {entity_name} and Entity_{chunk_idx}_{entity_idx-1}",
                        "chunk_index": chunk_idx,
                        "filename": f"chunk_{chunk_idx}.txt",
                        "file_path": f"/path/to/chunk_{chunk_idx}.txt",
                        "extraction_timestamp": "2024-01-01T10:00:00"
                    })
                
                # Add some facts
                chunk_facts.append({
                    "text": f"Fact about {entity_name}",
                    "chunk_content": f"Content with fact about {entity_name}",
                    "chunk_index": chunk_idx,
                    "filename": f"chunk_{chunk_idx}.txt",
                    "file_path": f"/path/to/chunk_{chunk_idx}.txt",
                    "extraction_timestamp": "2024-01-01T10:00:00"
                })
            
            large_chunk_data.append({
                "entities": chunk_entities,
                "relationships": chunk_relationships,
                "facts": chunk_facts,
                "chunk_index": chunk_idx,
                "filename": f"chunk_{chunk_idx}.txt",
                "file_path": f"/path/to/chunk_{chunk_idx}.txt"
            })
        
        # Process with filtering
        filtered_data = self._merge_graph_data_with_weights(large_chunk_data)
        
        # Get summary
        summary = self.get_clustered_data_summary(filtered_data)
        
        return {
            "test_results": {
                "input_chunks": len(large_chunk_data),
                "input_entities": sum(len(chunk.get("entities", [])) for chunk in large_chunk_data),
                "input_relationships": sum(len(chunk.get("relationships", [])) for chunk in large_chunk_data),
                "input_facts": sum(len(chunk.get("facts", [])) for chunk in large_chunk_data)
            },
            "filtered_results": {
                "output_entities": filtered_data["total_entities"],
                "output_connections": filtered_data["total_connections"],
                "output_facts": filtered_data["total_facts"]
            },
            "filtering_summary": summary,
            "limits_applied": {
                "entity_limit": 200,
                "connection_limit": 400
            }
        }
    
    async def _save_graph_data_to_json(self, filename: str, graph_data: dict) -> str:
        """Save graph data to a JSON file"""
        try:
            output_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "graph_data"
            output_dir.mkdir(parents=True, exist_ok=True)
            
            safe_filename = self._sanitize_filename(filename)
            json_filename = f"{safe_filename}_graph_data.json"
            json_path = output_dir / json_filename
            
            with open(json_path, 'w', encoding='utf-8') as save:
                json.dump(graph_data, save, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved graph data to: {json_path}")
            return str(json_path)
            
        except Exception as e:
            logger.error(f"Error saving graph data to JSON: {e}")
            return ""
    
    def _generate_networkx_graph_from_graph_data(self, graph_data: dict, filename: str, file_path: str) -> nx.DiGraph:
        """Generate a NetworkX graph from clustered graph data with metadata"""
        graph = nx.DiGraph()
        
        # Add entities as nodes with metadata
        if "entities" in graph_data:
            for entity_data in graph_data["entities"]:
                node_id = entity_data["id"]
                
                # Prepare node attributes
                node_attrs = {
                    "name": entity_data["name"],
                    "type": entity_data.get("type", ["unknown"])[0] if entity_data.get("type") else "unknown",
                    "description": entity_data.get("description", [""])[0] if entity_data.get("description") else "",
                    "frequency": entity_data.get("frequency", 1),
                    "chunks": entity_data.get("chunks", []),
                    "filename": filename,
                    "file_path": file_path,
                    "node_type": "entity",
                    "total_connections": len(entity_data.get("connections", [])),
                    "total_facts": len(entity_data.get("facts", []))
                }
                
                # Add all types and descriptions as lists
                if entity_data.get("type"):
                    node_attrs["all_types"] = entity_data["type"]
                if entity_data.get("description"):
                    node_attrs["all_descriptions"] = entity_data["description"]
                
                graph.add_node(node_id, **node_attrs)
        
        # Add connections as edges with metadata
        if "entities" in graph_data:
            for entity_data in graph_data["entities"]:
                source_id = entity_data["id"]
                
                for connection in entity_data.get("connections", []):
                    target_id = connection["target_entity"]
                    
                    if source_id in graph.nodes and target_id in graph.nodes:
                        edge_attrs = {
                            "relationship_type": connection.get("relationship_type", "related"),
                            "weight": connection.get("weight", 1.0),
                            "confidence": connection.get("confidence", 0.0),
                            "chunks": connection.get("chunks", []),
                            "filename": filename,
                            "file_path": file_path,
                            "edge_type": "entity_connection",
                            "target_name": connection.get("target_name", "")
                        }
                        
                        graph.add_edge(source_id, target_id, **edge_attrs)
        
        # Add facts as special nodes connected to entities
        if "entities" in graph_data:
            for entity_data in graph_data["entities"]:
                entity_id = entity_data["id"]
                
                for fact in entity_data.get("facts", []):
                    fact_id = f"fact_{hash(fact['text'])}"
                    
                    # Check if fact node already exists
                    if fact_id not in graph.nodes:
                        fact_attrs = {
                            "content": fact["text"],
                            "confidence": fact.get("confidence", 0.0),
                            "chunks": fact.get("chunks", []),
                            "filename": filename,
                            "file_path": file_path,
                            "node_type": "fact"
                        }
                        graph.add_node(fact_id, **fact_attrs)
                    
                    # Connect fact to entity
                    graph.add_edge(fact_id, entity_id,
                                 relationship_type="mentions",
                                 weight=0.3,
                                 confidence=fact.get("confidence", 0.0),
                                 chunks=fact.get("chunks", []),
                                 filename=filename,
                                 file_path=file_path,
                                 edge_type="fact_entity")
        
        logger.info(f"Generated NetworkX graph with {len(graph.nodes)} nodes and {len(graph.edges)} edges")
        return graph
    
    def _get_graph_file_path(self, filename: str) -> str:
        """Get the file path for saving the graph"""
        output_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "graphs"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        safe_filename = self._sanitize_filename(filename)
        graph_filename = f"{safe_filename}_graph.gml"
        return str(output_dir / graph_filename)
    
    def _save_graph(self, graph: nx.DiGraph, file_path: str):
        """Save the knowledge graph to a file"""
        try:
            nx.write_gml(graph, file_path)
            logger.info(f"Saved graph to: {file_path}")
        except Exception as e:
            logger.error(f"Error saving graph to {file_path}: {e}")
    
    async def _cluster_networkx_graphs(self, graphs: List[nx.DiGraph]) -> nx.DiGraph:
        """Cluster knowledge graphs using entity similarity and graph structure"""
        if not graphs:
            return nx.DiGraph()
        
        if len(graphs) == 1:
            return graphs[0]
        
        logger.info(f"Clustering {len(graphs)} graphs...")
        
        # Extract entity names and descriptions for similarity calculation
        all_entities = []
        entity_to_graph = {}
        
        for i, graph in enumerate(graphs):
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "entity":
                    entity_name = attrs.get("name", "")
                    entity_desc = attrs.get("description", "")
                    if entity_name:
                        all_entities.append(f"{entity_name} {entity_desc}".strip())
                        entity_to_graph[node] = i
        
        if not all_entities:
            logger.warning("No entities found for clustering, using simple union")
            return self._simple_union_graphs(graphs)
        
        # Use TF-IDF and cosine similarity for entity clustering
        try:
            vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
            entity_vectors = vectorizer.fit_transform(all_entities)
            
            # Calculate similarity matrix
            similarity_matrix = cosine_similarity(entity_vectors)
            
            # Use DBSCAN for clustering
            clustering = DBSCAN(eps=0.3, min_samples=2).fit(similarity_matrix)
            cluster_labels = clustering.labels_
            
            logger.info(f"Entity clustering: {len(set(cluster_labels))} clusters found")
            
            # Create clustered graph
            clustered_graph = self._create_clustered_graph(graphs, entity_to_graph, cluster_labels)
            
            return clustered_graph
            
        except Exception as e:
            logger.error(f"Error in advanced clustering: {e}, falling back to simple union")
            return self._simple_union_graphs(graphs)
    
    def _create_clustered_graph(self, graphs: List[nx.DiGraph], entity_to_graph: dict, cluster_labels: List[int]) -> nx.DiGraph:
        """Create a clustered graph based on entity similarity with complete metadata preservation"""
        clustered_graph = nx.DiGraph()
        
        # Group entities by cluster
        cluster_entities = defaultdict(list)
        for i, label in enumerate(cluster_labels):
            if label >= 0:  # Skip noise points
                cluster_entities[label].append(i)
        
        # Create unified entities for each cluster with merged metadata
        entity_mapping = {}  # Maps all entity IDs to their unified ID
        unified_entities = {}  # Stores unified entity data
        
        for cluster_id, entity_indices in cluster_entities.items():
            # Get all entity names in this cluster
            cluster_entity_names = [list(entity_to_graph.keys())[i] for i in entity_indices]
            
            # Find the best representative entity using new importance scoring
            best_entity = None
            best_score = -1
            
            for entity_name in cluster_entity_names:
                # Find which graph contains this entity
                graph_idx = entity_to_graph[entity_name]
                graph = graphs[graph_idx]
                
                if entity_name in graph.nodes:
                    attrs = graph.nodes[entity_name]
                    # Use new importance scoring: frequency + connections + facts
                    frequency = attrs.get('frequency', 1)
                    connections = attrs.get('total_connections', 0)
                    facts = attrs.get('total_facts', 0)
                    score = (frequency * 2) + (connections * 1.5) + (facts * 1.0)
                    
                    if score > best_score:
                        best_score = score
                        best_entity = entity_name
            
            if best_entity is None:
                continue
                
            # Create unified entity ID
            unified_id = f"clustered_entity_{cluster_id}"
            
            # Get the best entity's attributes as base
            best_graph_idx = entity_to_graph[best_entity]
            best_graph = graphs[best_graph_idx]
            base_attrs = dict(best_graph.nodes[best_entity])
            
            # Merge metadata from all entities in the cluster
            merged_attrs = self._merge_cluster_entity_attributes(
                cluster_entity_names, graphs, entity_to_graph, base_attrs
            )
            
            # Add unified entity to clustered graph
            clustered_graph.add_node(unified_id, **merged_attrs)
            
            # Store unified entity data
            unified_entities[unified_id] = merged_attrs
            
            # Map all entities in this cluster to the unified ID
            for entity_name in cluster_entity_names:
                entity_mapping[entity_name] = unified_id
        
        # Add all non-entity nodes (facts, etc.) from all graphs
        for graph in graphs:
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") != "entity":
                    # For non-entity nodes, add them directly (they don't get clustered)
                    if node not in clustered_graph.nodes:
                        clustered_graph.add_node(node, **attrs)
        
        # Add all edges from all graphs with proper mapping
        for graph in graphs:
            for source, target, attrs in graph.edges(data=True):
                # Map source and target to unified entities if they exist
                new_source = entity_mapping.get(source, source)
                new_target = entity_mapping.get(target, target)
                
                # Create edge with all metadata preserved
                edge_attrs = dict(attrs)
                
                # Add clustering information to edge metadata
                if new_source != source or new_target != target:
                    edge_attrs['clustered'] = True
                    edge_attrs['original_source'] = source
                    edge_attrs['original_target'] = target
                    edge_attrs['cluster_source'] = new_source
                    edge_attrs['cluster_target'] = new_target
                
                # Add the edge to the clustered graph
                clustered_graph.add_edge(new_source, new_target, **edge_attrs)
        
        logger.info(f"Created clustered graph with {len(clustered_graph.nodes)} nodes and {len(clustered_graph.edges)} edges")
        logger.info(f"Clustered {len(entity_mapping)} entities into {len(unified_entities)} unified entities")
        
        # Generate embeddings for the clustered graph
        if self.openai_client:
            logger.info("Generating embeddings for clustered graph...")
            # Temporarily set the graph to generate embeddings
            temp_graph = self.graph
            self.graph = clustered_graph
            
            # Generate embeddings
            embedding_result = self.generate_graph_embeddings()
            if embedding_result.get("success"):
                logger.info(f"Generated embeddings: {embedding_result['node_embeddings_count']} nodes, {embedding_result['edge_embeddings_count']} edges")
            else:
                logger.warning(f"Failed to generate embeddings: {embedding_result.get('error', 'Unknown error')}")
            
            # Restore the original graph
            self.graph = temp_graph
        
        return clustered_graph
    
    def _merge_cluster_entity_attributes(self, cluster_entity_names: List[str], graphs: List[nx.DiGraph], 
                                       entity_to_graph: dict, base_attrs: dict) -> dict:
        """Merge attributes from all entities in a cluster"""
        merged_attrs = dict(base_attrs)
        
        # Initialize merged collections
        all_chunks = set(base_attrs.get('chunks', []))
        all_filenames = set([base_attrs.get('filename', '')])
        all_file_paths = set([base_attrs.get('file_path', '')])
        all_types = set([base_attrs.get('type', '')])
        all_descriptions = set([base_attrs.get('description', '')])
        total_frequency = base_attrs.get('frequency', 1)
        entity_count = 1
        
        # Collect metadata from all entities in the cluster
        for entity_name in cluster_entity_names:
            graph_idx = entity_to_graph[entity_name]
            graph = graphs[graph_idx]
            
            if entity_name in graph.nodes:
                attrs = graph.nodes[entity_name]
                
                # Merge chunks
                if 'chunks' in attrs:
                    all_chunks.update(attrs['chunks'])
                
                # Merge filenames and file paths
                if 'filename' in attrs:
                    all_filenames.add(attrs['filename'])
                if 'file_path' in attrs:
                    all_file_paths.add(attrs['file_path'])
                
                # Merge types and descriptions
                if 'type' in attrs and attrs['type']:
                    all_types.add(attrs['type'])
                if 'description' in attrs and attrs['description']:
                    all_descriptions.add(attrs['description'])
                
                # Accumulate frequency
                total_frequency += attrs.get('frequency', 1)
                entity_count += 1
        
        # Update merged attributes
        merged_attrs['chunks'] = sorted(list(all_chunks))
        merged_attrs['filename'] = ' ||| '.join(sorted(all_filenames)) if all_filenames else ''
        merged_attrs['file_path'] = ' ||| '.join(sorted(all_file_paths)) if all_file_paths else ''
        merged_attrs['type'] = ' ||| '.join(sorted(all_types)) if all_types else 'unknown'
        merged_attrs['description'] = ' ||| '.join(sorted(all_descriptions)) if all_descriptions else ''
        merged_attrs['frequency'] = total_frequency
        merged_attrs['cluster_size'] = entity_count
        merged_attrs['clustered'] = True
        merged_attrs['cluster_entities'] = cluster_entity_names
        
        return merged_attrs
    
    def _simple_union_graphs(self, graphs: List[nx.DiGraph]) -> nx.DiGraph:
        """Simple union of all graphs when clustering fails, preserving all metadata"""
        clustered_graph = nx.DiGraph()
        
        # Add all nodes from all graphs with their metadata
        for graph in graphs:
            for node, attrs in graph.nodes(data=True):
                if node not in clustered_graph.nodes:
                    # Add node with all its metadata
                    clustered_graph.add_node(node, **attrs)
                else:
                    # Node already exists, merge metadata if needed
                    existing_attrs = dict(clustered_graph.nodes[node])
                    merged_attrs = self._merge_duplicate_node_attributes(existing_attrs, attrs)
                    clustered_graph.nodes[node].update(merged_attrs)
        
        # Add all edges from all graphs with their metadata
        for graph in graphs:
            for source, target, attrs in graph.edges(data=True):
                if not clustered_graph.has_edge(source, target):
                    # Add edge with all its metadata
                    clustered_graph.add_edge(source, target, **attrs)
                else:
                    # Edge already exists, merge metadata if needed
                    existing_attrs = dict(clustered_graph.edges[source, target])
                    merged_attrs = self._merge_duplicate_edge_attributes(existing_attrs, attrs)
                    clustered_graph.edges[source, target].update(merged_attrs)
        
        logger.info(f"Simple union created graph with {len(clustered_graph.nodes)} nodes and {len(clustered_graph.edges)} edges")
        return clustered_graph
    
    def _merge_duplicate_node_attributes(self, existing_attrs: dict, new_attrs: dict) -> dict:
        """Merge attributes when a node appears in multiple graphs"""
        merged = dict(existing_attrs)
        
        # Merge chunks
        existing_chunks = set(existing_attrs.get('chunks', []))
        new_chunks = set(new_attrs.get('chunks', []))
        merged['chunks'] = sorted(list(existing_chunks | new_chunks))
        
        # Merge filenames and file paths
        existing_filenames = set(existing_attrs.get('filename', '').split(' ||| ') if existing_attrs.get('filename') else [])
        new_filenames = set([new_attrs.get('filename', '')] if new_attrs.get('filename') else [])
        merged['filename'] = ' ||| '.join(sorted(existing_filenames | new_filenames)) if (existing_filenames | new_filenames) else ''
        
        existing_file_paths = set(existing_attrs.get('file_path', '').split(' ||| ') if existing_attrs.get('file_path') else [])
        new_file_paths = set([new_attrs.get('file_path', '')] if new_attrs.get('file_path') else [])
        merged['file_path'] = ' ||| '.join(sorted(existing_file_paths | new_file_paths)) if (existing_file_paths | new_file_paths) else ''
        
        # Accumulate frequency
        existing_freq = existing_attrs.get('frequency', 1)
        new_freq = new_attrs.get('frequency', 1)
        merged['frequency'] = existing_freq + new_freq
        
        # Mark as merged
        merged['merged'] = True
        merged['merge_count'] = existing_attrs.get('merge_count', 1) + 1
        
        return merged
    
    def _merge_duplicate_edge_attributes(self, existing_attrs: dict, new_attrs: dict) -> dict:
        """Merge attributes when an edge appears in multiple graphs"""
        merged = dict(existing_attrs)
        
        # Merge chunks - handle both old chunk_index and new chunks format
        existing_chunks = set()
        new_chunks = set()
        
        # Handle existing chunks
        if 'chunks' in existing_attrs:
            existing_chunks = set(existing_attrs['chunks'])
        elif 'chunk_index' in existing_attrs:
            existing_chunks = set(existing_attrs['chunk_index'])
        
        # Handle new chunks
        if 'chunks' in new_attrs:
            new_chunks = set(new_attrs['chunks'])
        elif 'chunk_index' in new_attrs:
            new_chunks = set(new_attrs['chunk_index'])
        
        merged['chunks'] = sorted(list(existing_chunks | new_chunks))
        
        # Merge filenames and file paths
        existing_filenames = set(existing_attrs.get('filename', '').split(' ||| ') if existing_attrs.get('filename') else [])
        new_filenames = set([new_attrs.get('filename', '')] if new_attrs.get('filename') else [])
        merged['filename'] = ' ||| '.join(sorted(existing_filenames | new_filenames)) if (existing_filenames | new_filenames) else ''
        
        existing_file_paths = set(existing_attrs.get('file_path', '').split(' ||| ') if existing_attrs.get('file_path') else [])
        new_file_paths = set([new_attrs.get('file_path', '')] if new_attrs.get('file_path') else [])
        merged['file_path'] = ' ||| '.join(sorted(existing_file_paths | new_file_paths)) if (existing_file_paths | new_file_paths) else ''
        
        # Handle weight if present
        if 'weight' in existing_attrs and 'weight' in new_attrs:
            existing_weight = existing_attrs.get('weight', 1.0)
            new_weight = new_attrs.get('weight', 1.0)
            merged['weight'] = round((existing_weight + new_weight) / 2, 3)  # Average weight
        
        # Mark as merged
        merged['merged'] = True
        merged['merge_count'] = existing_attrs.get('merge_count', 1) + 1
        
        return merged
    
    async def _save_clustered_graph(self):
        """Save the clustered graph to file"""
        try:
            output_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "clustered_graphs"
            output_dir.mkdir(parents=True, exist_ok=True)
            
            graph_filename = f"clustered_graph_{self.client_id}.gml"
            graph_path = output_dir / graph_filename
            
            nx.write_gml(self.graph, str(graph_path))
            logger.info(f"Saved clustered graph to: {graph_path}")
            
            # Also save embeddings if they exist
            if self.node_embeddings or self.edge_embeddings:
                embeddings_path = await self.save_embeddings()
                if embeddings_path:
                    logger.info(f"Saved embeddings to: {embeddings_path}")
                else:
                    logger.warning("Failed to save embeddings")
            else:
                logger.info("No embeddings to save")
            
        except Exception as e:
            logger.error(f"Error saving clustered graph: {e}")
    
    def clustered_graph_exists(self) -> bool:
        """Check if a clustered graph already exists for this client"""
        try:
            output_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "clustered_graphs"
            graph_filename = f"clustered_graph_{self.client_id}.gml"
            graph_path = output_dir / graph_filename
            
            return graph_path.exists()
        except Exception as e:
            logger.error(f"Error checking if clustered graph exists: {e}")
            return False
    
    async def load_existing_clustered_graph(self) -> bool:
        """Load an existing clustered graph if it exists"""
        try:
            output_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "clustered_graphs"
            graph_filename = f"clustered_graph_{self.client_id}.gml"
            graph_path = output_dir / graph_filename
            
            if not graph_path.exists():
                logger.info(f"No existing clustered graph found for client {self.client_id}")
                return False
            
            # Load the existing clustered graph
            self.graph = nx.read_gml(str(graph_path))
            logger.info(f"Loaded existing clustered graph for client {self.client_id}: {len(self.graph.nodes)} nodes, {len(self.graph.edges)} edges")
            
            # Also try to load individual file graphs if they exist
            await self._load_existing_file_graphs()
            
            # Try to load embeddings if they exist
            if self.embeddings_exist():
                embeddings_loaded = await self.load_embeddings()
                if embeddings_loaded:
                    logger.info(f"Loaded embeddings for client {self.client_id}")
                else:
                    logger.warning(f"Failed to load embeddings for client {self.client_id}")
            else:
                logger.info(f"No embeddings found for client {self.client_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error loading existing clustered graph: {e}")
            return False
    
    async def _load_existing_file_graphs(self):
        """Load existing individual file graphs if they exist"""
        try:
            graphs_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "graphs"
            graph_data_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "graph_data"
            
            if not graphs_dir.exists() or not graph_data_dir.exists():
                return
            
            # Find all graph files
            graph_files = list(graphs_dir.glob("*_graph.gml"))
            
            for graph_file in graph_files:
                try:
                    # Extract filename from graph file name
                    filename = graph_file.stem.replace("_graph", "")
                    
                    # Load the graph
                    graph = nx.read_gml(str(graph_file))
                    self.file_graphs[filename] = graph
                    
                    # Try to load corresponding graph data
                    graph_data_file = graph_data_dir / f"{filename}_graph_data.json"
                    if graph_data_file.exists():
                        import json
                        with open(graph_data_file, 'r', encoding='utf-8') as f:
                            graph_data = json.load(f)
                        self.file_graph_data[filename] = graph_data
                    
                    logger.info(f"Loaded existing file graph for {filename}")
                    
                except Exception as e:
                    logger.warning(f"Error loading file graph {graph_file}: {e}")
                    continue
            
            logger.info(f"Loaded {len(self.file_graphs)} existing file graphs")
            
        except Exception as e:
            logger.error(f"Error loading existing file graphs: {e}")
    
    def get_graph_statistics(self) -> Dict[str, Any]:
        """Get comprehensive statistics about the knowledge graph"""
        try:
            if not self.graph:
                return {"error": "No graph available"}
            
            # Basic graph statistics
            stats = {
                "total_nodes": len(self.graph.nodes),
                "total_edges": len(self.graph.edges),
                "file_graphs_count": len(self.file_graphs),
                "file_graph_data_count": len(self.file_graph_data)
            }
            
            # Node type breakdown
            node_types = {}
            for node, attrs in self.graph.nodes(data=True):
                node_type = attrs.get("node_type", "unknown")
                if node_type not in node_types:
                    node_types[node_type] = 0
                node_types[node_type] += 1
            stats["node_types"] = node_types
            
            # Edge type breakdown
            edge_types = {}
            for source, target, attrs in self.graph.edges(data=True):
                edge_type = attrs.get("edge_type", "unknown")
                if edge_type not in edge_types:
                    edge_types[edge_type] = 0
                edge_types[edge_type] += 1
            stats["edge_types"] = edge_types
            
            # Clustering statistics
            clustering_stats = self._get_clustering_statistics()
            stats["clustering"] = clustering_stats
            
            # Entity statistics
            entity_stats = self._get_entity_statistics()
            stats["entities"] = entity_stats
            
            # Relationship statistics
            relationship_stats = self._get_relationship_statistics()
            stats["relationships"] = relationship_stats
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting graph statistics: {e}")
            return {"error": str(e)}
    
    def _get_clustering_statistics(self) -> Dict[str, Any]:
        """Get detailed clustering statistics"""
        try:
            clustered_entities = 0
            clustered_edges = 0
            cluster_sizes = []
            merged_nodes = 0
            merged_edges = 0
            
            # Count clustered entities
            for node, attrs in self.graph.nodes(data=True):
                if attrs.get("clustered"):
                    clustered_entities += 1
                    cluster_size = attrs.get("cluster_size", 1)
                    cluster_sizes.append(cluster_size)
                if attrs.get("merged"):
                    merged_nodes += 1
            
            # Count clustered edges
            for source, target, attrs in self.graph.edges(data=True):
                if attrs.get("clustered"):
                    clustered_edges += 1
                if attrs.get("merged"):
                    merged_edges += 1
            
            return {
                "clustered_entities": clustered_entities,
                "clustered_edges": clustered_edges,
                "merged_nodes": merged_nodes,
                "merged_edges": merged_edges,
                "cluster_sizes": {
                    "min": min(cluster_sizes) if cluster_sizes else 0,
                    "max": max(cluster_sizes) if cluster_sizes else 0,
                    "average": round(sum(cluster_sizes) / len(cluster_sizes), 2) if cluster_sizes else 0,
                    "distribution": self._get_cluster_size_distribution(cluster_sizes)
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting clustering statistics: {e}")
            return {"error": str(e)}
    
    def _get_cluster_size_distribution(self, cluster_sizes: List[int]) -> Dict[str, int]:
        """Get distribution of cluster sizes"""
        try:
            distribution = {"small": 0, "medium": 0, "large": 0}
            
            for size in cluster_sizes:
                if size <= 2:
                    distribution["small"] += 1
                elif size <= 5:
                    distribution["medium"] += 1
                else:
                    distribution["large"] += 1
            
            return distribution
            
        except Exception as e:
            logger.error(f"Error getting cluster size distribution: {e}")
            return {"error": str(e)}
    
    def _get_entity_statistics(self) -> Dict[str, Any]:
        """Get detailed entity statistics"""
        try:
            entity_count = 0
            total_frequency = 0
            entity_types = {}
            source_files = set()
            
            for node, attrs in self.graph.nodes(data=True):
                if attrs.get("node_type") == "entity":
                    entity_count += 1
                    total_frequency += attrs.get("frequency", 1)
                    
                    # Entity types
                    entity_type = attrs.get("type", "unknown")
                    if entity_type not in entity_types:
                        entity_types[entity_type] = 0
                    entity_types[entity_type] += 1
                    
                    # Source files
                    if attrs.get("filename"):
                        source_files.update(attrs["filename"].split(" ||| "))
            
            return {
                "count": entity_count,
                "average_frequency": round(total_frequency / entity_count, 2) if entity_count > 0 else 0,
                "types": entity_types,
                "source_files": len(source_files)
            }
            
        except Exception as e:
            logger.error(f"Error getting entity statistics: {e}")
            return {"error": str(e)}
    
    def _get_relationship_statistics(self) -> Dict[str, Any]:
        """Get detailed relationship statistics"""
        try:
            relationship_count = 0
            total_weight = 0
            relationship_types = {}
            source_files = set()
            
            for source, target, attrs in self.graph.edges(data=True):
                if attrs.get("edge_type") in ["entity_connection", "relationship"]:
                    relationship_count += 1
                    total_weight += attrs.get("weight", 1.0)
                    
                    # Relationship types
                    rel_type = attrs.get("relationship_type", "unknown")
                    if rel_type not in relationship_types:
                        relationship_types[rel_type] = 0
                    relationship_types[rel_type] += 1
                    
                    # Source files
                    if attrs.get("filename"):
                        source_files.update(attrs["filename"].split(" ||| "))
            
            return {
                "count": relationship_count,
                "average_weight": round(total_weight / relationship_count, 3) if relationship_count > 0 else 0,
                "types": relationship_types,
                "source_files": len(source_files)
            }
            
        except Exception as e:
            logger.error(f"Error getting relationship statistics: {e}")
            return {"error": str(e)}
    
    def clear_graph(self):
        """Clear the current knowledge graph"""
        self.graph.clear()
        self.file_graphs.clear()
        self.file_graph_data.clear()
        logger.info("Knowledge graph cleared")
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        unsafe_chars = ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
        safe_filename = filename
        for char in unsafe_chars:
            safe_filename = safe_filename.replace(char, '_')
        
        if len(safe_filename) > 100:
            name, ext = os.path.splitext(safe_filename)
            safe_filename = name[:100-len(ext)] + ext
        
        return safe_filename
    
    def _get_current_timestamp(self) -> str:
        """Get current timestamp as string"""
        return datetime.now().isoformat()

    def get_processing_efficiency_status(self) -> dict:
        """Get information about processing efficiency and existing graphs"""
        return {
            "clustered_graph_exists": self.clustered_graph_exists(),
            "file_graphs_loaded": len(self.file_graphs),
            "file_graph_data_loaded": len(self.file_graph_data),
            "main_graph_nodes": len(self.graph.nodes),
            "main_graph_edges": len(self.graph.edges),
            "can_skip_processing": self.clustered_graph_exists() and len(self.file_graphs) > 0
        }
    
    def get_processing_completeness_status(self, uploaded_files: list) -> dict:
        """Check if all uploaded files have been processed for knowledge graph"""
        try:
            processed_filenames = set(self.file_graphs.keys())
            uploaded_filenames = {file.filename for file in uploaded_files}
            
            missing_files = uploaded_filenames - processed_filenames
            extra_files = processed_filenames - uploaded_filenames
            
            return {
                "total_uploaded": len(uploaded_filenames),
                "total_processed": len(processed_filenames),
                "missing_files": list(missing_files),
                "extra_files": list(extra_files),
                "is_complete": len(missing_files) == 0,
                "completion_percentage": (len(processed_filenames) / len(uploaded_filenames) * 100) if uploaded_filenames else 0
            }
        except Exception as e:
            logger.error(f"Error checking processing completeness: {e}")
            return {
                "error": str(e),
                "is_complete": False,
                "completion_percentage": 0
            }

    def _initialize_openai_client(self):
        """Initialize the OpenAI client for generating embeddings"""
        try:
            if self.settings.OPENAI_API_KEY:
                self.openai_client = openai.OpenAI(api_key=self.settings.OPENAI_API_KEY)
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning("No OpenAI API key found. Embedding features will be disabled.")
                self.openai_client = None
        except Exception as e:
            logger.warning(f"Could not initialize OpenAI client: {e}")
            logger.info("Embedding features will be disabled")
            self.openai_client = None
    
    def _generate_node_embedding(self, node_id: str, node_attrs: dict) -> Optional[np.ndarray]:
        """Generate embedding for a node using OpenAI API"""
        if not self.openai_client:
            return None
        
        try:
            # Create text representation of the node
            text_parts = []
            
            # Add node type
            node_type = node_attrs.get('node_type', 'unknown')
            text_parts.append(f"Type: {node_type}")
            
            # Add name if available
            if 'name' in node_attrs:
                text_parts.append(f"Name: {node_attrs['name']}")
            
            # Add description if available
            if 'description' in node_attrs:
                text_parts.append(f"Description: {node_attrs['description']}")
            
            # Combine all text parts
            node_text = " | ".join(text_parts)
            
            # Generate embedding using OpenAI API
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=node_text
            )
            
            # Extract embedding from response
            embedding = np.array(response.data[0].embedding)
            return embedding
            
        except Exception as e:
            logger.warning(f"Error generating embedding for node {node_id}: {e}")
            return None
    
    def _generate_edge_embedding(self, source: str, target: str, edge_attrs: dict) -> Optional[np.ndarray]:
        """Generate embedding for an edge using OpenAI API"""
        if not self.openai_client:
            return None
        
        try:
            # Create text representation of the edge
            text_parts = []
            
            # Add edge type
            edge_type = edge_attrs.get('edge_type', 'relationship')
            text_parts.append(f"Edge Type: {edge_type}")
            
            # Add relationship type if available
            if 'relationship_type' in edge_attrs:
                text_parts.append(f"Relationship: {edge_attrs['relationship_type']}")
            
            # Combine all text parts
            edge_text = " | ".join(text_parts)
            
            # Generate embedding using OpenAI API
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=edge_text
            )
            
            # Extract embedding from response
            embedding = np.array(response.data[0].embedding)
            return embedding
            
        except Exception as e:
            logger.warning(f"Error generating embedding for edge ({source}, {target}): {e}")
            return None
    
    def generate_graph_embeddings(self) -> Dict[str, Any]:
        """Generate embeddings for all nodes and edges in the current graph"""
        if not self.graph or not self.openai_client:
            logger.warning("No graph available or OpenAI client not initialized")
            return {"error": "No graph available or OpenAI client not initialized"}
        
        try:
            logger.info("Generating embeddings for graph nodes and edges...")
            
            # Clear existing embeddings
            self.node_embeddings.clear()
            self.edge_embeddings.clear()
            
            # Generate node embeddings
            for node_id, node_attrs in self.graph.nodes(data=True):
                embedding = self._generate_node_embedding(node_id, node_attrs)
                if embedding is not None:
                    self.node_embeddings[node_id] = embedding
            
            # Generate edge embeddings
            for source, target, edge_attrs in self.graph.edges(data=True):
                embedding = self._generate_edge_embedding(source, target, edge_attrs)
                if embedding is not None:
                    self.edge_embeddings[(source, target)] = embedding
            
            logger.info(f"Generated embeddings for {len(self.node_embeddings)} nodes and {len(self.edge_embeddings)} edges")
            
            return {
                "success": True,
                "node_embeddings_count": len(self.node_embeddings),
                "edge_embeddings_count": len(self.edge_embeddings),
                "total_nodes": len(self.graph.nodes),
                "total_edges": len(self.graph.edges)
            }
            
        except Exception as e:
            logger.error(f"Error generating graph embeddings: {e}")
            return {"error": str(e)}
    
    def get_node_embedding(self, node_id: str) -> Optional[np.ndarray]:
        """Get embedding for a specific node"""
        return self.node_embeddings.get(node_id)
    
    def get_edge_embedding(self, source: str, target: str) -> Optional[np.ndarray]:
        """Get embedding for a specific edge"""
        return self.edge_embeddings.get((source, target))
    
    def get_similar_nodes(self, node_id: str, top_k: int = 5) -> List[Tuple[str, float]]:
        """Find nodes similar to the given node based on embedding similarity"""
        if not self.openai_client or node_id not in self.node_embeddings:
            return []
        
        try:
            query_embedding = self.node_embeddings[node_id]
            similarities = []
            
            for other_node, other_embedding in self.node_embeddings.items():
                if other_node != node_id:
                    similarity = cosine_similarity(
                        query_embedding.reshape(1, -1), 
                        other_embedding.reshape(1, -1)
                    )[0][0]
                    similarities.append((other_node, similarity))
            
            # Sort by similarity (descending) and return top_k
            similarities.sort(key=lambda x: x[1], reverse=True)
            return similarities[:top_k]
            
        except Exception as e:
            logger.error(f"Error finding similar nodes for {node_id}: {e}")
            return []
    
    def get_similar_edges(self, source: str, target: str, top_k: int = 5) -> List[Tuple[Tuple[str, str], float]]:
        """Find edges similar to the given edge based on embedding similarity"""
        if not self.openai_client or (source, target) not in self.edge_embeddings:
            return []
        
        try:
            query_embedding = self.edge_embeddings[(source, target)]
            similarities = []
            
            for other_edge, other_embedding in self.edge_embeddings.items():
                if other_edge != (source, target):
                    similarity = cosine_similarity(
                        query_embedding.reshape(1, -1), 
                        other_embedding.reshape(1, -1)
                    )[0][0]
                    similarities.append((other_edge, similarity))
            
            # Sort by similarity (descending) and return top_k
            similarities.sort(key=lambda x: x[1], reverse=True)
            return similarities[:top_k]
            
        except Exception as e:
            logger.error(f"Error finding similar edges for ({source}, {target}): {e}")
            return []
    
    def _embeddings_to_json_serializable(self) -> Dict[str, Any]:
        """Convert embeddings to JSON-serializable format"""
        serializable_embeddings = {
            "node_embeddings": {},
            "edge_embeddings": {},
            "metadata": {
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": None,
                "total_nodes": len(self.node_embeddings),
                "total_edges": len(self.edge_embeddings),
                "generated_at": self._get_current_timestamp()
            }
        }
        
        # Convert node embeddings
        for node_id, embedding in self.node_embeddings.items():
            if embedding is not None:
                serializable_embeddings["node_embeddings"][node_id] = embedding.tolist()
                if serializable_embeddings["metadata"]["embedding_dimension"] is None:
                    serializable_embeddings["metadata"]["embedding_dimension"] = len(embedding)
        
        # Convert edge embeddings
        for edge_key, embedding in self.edge_embeddings.items():
            if embedding is not None:
                # Convert tuple key to string for JSON serialization
                edge_str = f"{edge_key[0]}__{edge_key[1]}"
                serializable_embeddings["edge_embeddings"][edge_str] = embedding.tolist()
                if serializable_embeddings["metadata"]["embedding_dimension"] is None:
                    serializable_embeddings["metadata"]["embedding_dimension"] = len(embedding)
        
        return serializable_embeddings
    
    def _embeddings_from_json_serializable(self, embeddings_data: Dict[str, Any]) -> bool:
        """Load embeddings from JSON-serializable format"""
        try:
            # Clear existing embeddings
            self.node_embeddings.clear()
            self.edge_embeddings.clear()
            
            # Load node embeddings
            if "node_embeddings" in embeddings_data:
                for node_id, embedding_list in embeddings_data["node_embeddings"].items():
                    self.node_embeddings[node_id] = np.array(embedding_list)
            
            # Load edge embeddings
            if "edge_embeddings" in embeddings_data:
                for edge_str, embedding_list in embeddings_data["edge_embeddings"].items():
                    # Convert string key back to tuple
                    if "__" in edge_str:
                        source, target = edge_str.split("__", 1)
                        edge_key = (source, target)
                        self.edge_embeddings[edge_key] = np.array(embedding_list)
            
            logger.info(f"Loaded embeddings for {len(self.node_embeddings)} nodes and {len(self.edge_embeddings)} edges")
            return True
            
        except Exception as e:
            logger.error(f"Error loading embeddings from JSON: {e}")
            return False
    
    async def save_embeddings(self) -> str:
        """Save embeddings to a JSON file"""
        try:
            if not self.node_embeddings and not self.edge_embeddings:
                logger.warning("No embeddings to save")
                return ""
            
            output_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "embeddings"
            output_dir.mkdir(parents=True, exist_ok=True)
            
            embeddings_filename = f"embeddings_{self.client_id}.json"
            embeddings_path = output_dir / embeddings_filename
            
            # Convert embeddings to JSON-serializable format
            serializable_embeddings = self._embeddings_to_json_serializable()
            
            with open(embeddings_path, 'w', encoding='utf-8') as f:
                json.dump(serializable_embeddings, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved embeddings to: {embeddings_path}")
            return str(embeddings_path)
            
        except Exception as e:
            logger.error(f"Error saving embeddings: {e}")
            return ""
    
    async def load_embeddings(self) -> bool:
        """Load embeddings from JSON file"""
        try:
            embeddings_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "embeddings"
            embeddings_filename = f"embeddings_{self.client_id}.json"
            embeddings_path = embeddings_dir / embeddings_filename
            
            if not embeddings_path.exists():
                logger.info(f"No embeddings file found for client {self.client_id}")
                return False
            
            with open(embeddings_path, 'r', encoding='utf-8') as f:
                embeddings_data = json.load(f)
            
            # Load embeddings from the data
            success = self._embeddings_from_json_serializable(embeddings_data)
            
            if success:
                logger.info(f"Successfully loaded embeddings for client {self.client_id}")
                return True
            else:
                logger.error(f"Failed to load embeddings for client {self.client_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error loading embeddings: {e}")
            return False
    
    def embeddings_exist(self) -> bool:
        """Check if embeddings exist for this client"""
        try:
            embeddings_dir = Path(self.settings.KNOWLEDGE_GRAPH_BASE_DIR) / self.client_id / "embeddings"
            embeddings_filename = f"embeddings_{self.client_id}.json"
            embeddings_path = embeddings_dir / embeddings_filename
            
            return embeddings_path.exists()
        except Exception as e:
            logger.error(f"Error checking if embeddings exist: {e}")
            return False
    
    def merge_embeddings_with_graph(self, graph: nx.DiGraph) -> nx.DiGraph:
        """Merge embeddings with a graph by adding embedding data as node/edge attributes"""
        if not self.node_embeddings and not self.edge_embeddings:
            logger.warning("No embeddings available to merge")
            return graph
        
        try:
            # Create a copy of the graph to avoid modifying the original
            merged_graph = graph.copy()
            
            # Add embedding information to nodes
            for node_id in merged_graph.nodes():
                if node_id in self.node_embeddings:
                    embedding = self.node_embeddings[node_id]
                    merged_graph.nodes[node_id]['has_embedding'] = True
                    merged_graph.nodes[node_id]['embedding_dimension'] = len(embedding)
                    # Note: We don't store the actual embedding in the graph as it's too large
                    # The embedding can be accessed via get_node_embedding() method
                else:
                    merged_graph.nodes[node_id]['has_embedding'] = False
            
            # Add embedding information to edges
            for source, target in merged_graph.edges():
                edge_key = (source, target)
                if edge_key in self.edge_embeddings:
                    embedding = self.edge_embeddings[edge_key]
                    merged_graph.edges[source, target]['has_embedding'] = True
                    merged_graph.edges[source, target]['embedding_dimension'] = len(embedding)
                else:
                    merged_graph.edges[source, target]['has_embedding'] = False
            
            logger.info(f"Merged embedding information with graph: {len(merged_graph.nodes)} nodes, {len(merged_graph.edges)} edges")
            return merged_graph
            
        except Exception as e:
            logger.error(f"Error merging embeddings with graph: {e}")
            return graph
    
    def get_embedding_statistics(self) -> Dict[str, Any]:
        """Get statistics about the current embeddings"""
        try:
            stats = {
                "embedding_model_available": self.openai_client is not None,
                "embedding_model": "text-embedding-3-small" if self.openai_client else "none",
                "node_embeddings_count": len(self.node_embeddings),
                "edge_embeddings_count": len(self.edge_embeddings),
                "total_nodes_in_graph": len(self.graph.nodes) if self.graph else 0,
                "total_edges_in_graph": len(self.graph.edges) if self.graph else 0,
                "embedding_coverage": {
                    "nodes": f"{(len(self.node_embeddings) / len(self.graph.nodes) * 100):.1f}%" if self.graph and self.graph.nodes else "0%",
                    "edges": f"{(len(self.edge_embeddings) / len(self.graph.edges) * 100):.1f}%" if self.graph and self.graph.edges else "0%"
                }
            }
            
            # Add embedding dimension information if available
            if self.node_embeddings:
                sample_embedding = next(iter(self.node_embeddings.values()))
                if sample_embedding is not None:
                    stats["embedding_dimension"] = len(sample_embedding)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting embedding statistics: {e}")
            return {"error": str(e)}
    
    def clear_embeddings(self):
        """Clear all stored embeddings"""
        self.node_embeddings.clear()
        self.edge_embeddings.clear()
        logger.info("Cleared all embeddings")
    
    async def regenerate_embeddings(self) -> Dict[str, Any]:
        """Regenerate embeddings for the current graph"""
        if not self.graph:
            return {"error": "No graph available"}
        
        try:
            logger.info("Regenerating embeddings for current graph...")
            result = self.generate_graph_embeddings()
            
            if result.get("success"):
                # Save the new embeddings
                save_result = await self.save_embeddings()
                if save_result:
                    result["embeddings_saved"] = True
                    result["embeddings_path"] = save_result
                else:
                    result["embeddings_saved"] = False
                    result["warning"] = "Failed to save embeddings"
            
            return result
            
        except Exception as e:
            logger.error(f"Error regenerating embeddings: {e}")
            return {"error": str(e)}