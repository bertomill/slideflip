"""
Enhanced Graph Query Service for intelligent search and retrieval from knowledge graphs
Integrates directly with KnowledgeGraphService and LLMService for optimal performance
"""

import logging
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
import networkx as nx
from sklearn.metrics.pairwise import cosine_similarity
import json
import re
from datetime import datetime

logger = logging.getLogger(__name__)

class GraphQueryService:
    """
    Enhanced service for querying knowledge graphs using LLMs for concept extraction
    and embeddings for semantic search. Integrates directly with KnowledgeGraphService
    and LLMService for optimal performance.
    """
    
    def __init__(self, knowledge_graph_service=None, llm_service=None):
        self.kg_service = knowledge_graph_service
        self.llm_service = llm_service
        self.query_cache = {}  # Cache for query results
        
        if not self.kg_service:
            logger.warning("KnowledgeGraphService not provided. Some features may be limited.")
        if not self.llm_service:
            logger.warning("LLMService not provided. Some features may be limited.")
    
    def _validate_graph_structure(self, graph: nx.DiGraph) -> Dict[str, Any]:
        """
        Validate the graph structure and provide debugging information about available attributes
        
        Args:
            graph: Knowledge graph to validate
            
        Returns:
            Dictionary containing validation results and attribute information
        """
        try:
            validation_result = {
                "valid": True,
                "errors": [],
                "warnings": [],
                "attribute_summary": {},
                "node_count": len(graph.nodes),
                "edge_count": len(graph.edges)
            }
            
            # Check node attributes
            node_attributes = defaultdict(set)
            for node, attrs in graph.nodes(data=True):
                for attr_name in attrs.keys():
                    node_attributes[attr_name].add(type(attrs[attr_name]).__name__)
            
            validation_result["attribute_summary"]["nodes"] = dict(node_attributes)
            
            # Check edge attributes
            edge_attributes = defaultdict(set)
            for source, target, attrs in graph.edges(data=True):
                for attr_name in attrs.keys():
                    edge_attributes[attr_name].add(type(attrs[attr_name]).__name__)
            
            validation_result["attribute_summary"]["edges"] = dict(edge_attributes)
            
            # Validate required attributes
            required_node_attrs = {"node_type", "name"}
            required_edge_attrs = {"edge_type"}
            
            # Check for missing required node attributes
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "entity":
                    if "name" not in attrs:
                        validation_result["errors"].append(f"Entity node {node} missing 'name' attribute")
                        validation_result["valid"] = False
                
                if attrs.get("node_type") == "fact":
                    if "content" not in attrs:
                        validation_result["warnings"].append(f"Fact node {node} missing 'content' attribute")
            
            # Check for missing required edge attributes
            for source, target, attrs in graph.edges(data=True):
                if "edge_type" not in attrs:
                    validation_result["warnings"].append(f"Edge ({source}, {target}) missing 'edge_type' attribute")
            
            # Check for clustering and merging attributes
            clustered_nodes = sum(1 for _, attrs in graph.nodes(data=True) if attrs.get("clustered"))
            merged_nodes = sum(1 for _, attrs in graph.nodes(data=True) if attrs.get("merged"))
            clustered_edges = sum(1 for _, _, attrs in graph.edges(data=True) if attrs.get("clustered"))
            merged_edges = sum(1 for _, _, attrs in graph.edges(data=True) if attrs.get("merged"))
            
            validation_result["clustering_info"] = {
                "clustered_nodes": clustered_nodes,
                "merged_nodes": merged_nodes,
                "clustered_edges": clustered_edges,
                "merged_edges": merged_edges
            }
            
            return validation_result
            
        except Exception as e:
            return {
                "valid": False,
                "errors": [f"Validation failed: {str(e)}"],
                "warnings": [],
                "attribute_summary": {},
                "node_count": 0,
                "edge_count": 0
            }
    
    async def query_graph_for_slide_content(
        self, 
        slide_description: str,
        top_k: int = 10,
        similarity_threshold: float = 0.3,
        include_embeddings: bool = False,
        max_tokens: int = 2000,
        validate_graph: bool = True
    ) -> Dict[str, Any]:
        """
        Query the knowledge graph using LLMs for concept extraction and embeddings for semantic search
        
        Args:
            slide_description: User's description of what they want in the slide
            top_k: Maximum number of results to return for each category
            similarity_threshold: Minimum similarity score for inclusion
            include_embeddings: Whether to include embedding data in response
            max_tokens: Maximum tokens for LLM responses
            validate_graph: Whether to validate graph structure before querying
            
        Returns:
            Dictionary containing top-k relevant results for each category
        """
        try:
            logger.info(f"Querying graph for slide: {slide_description[:100]}...")
            
            if not self.kg_service:
                return {"error": "KnowledgeGraphService not available"}
            
            # Get graph and embeddings from knowledge graph service
            graph = self.kg_service.graph
            if not graph or len(graph.nodes) == 0:
                return {"error": "No knowledge graph available"}
            
            # Validate graph structure if requested
            if validate_graph:
                validation_result = self._validate_graph_structure(graph)
                if not validation_result["valid"]:
                    logger.warning(f"Graph validation failed: {validation_result['errors']}")
                    # Continue with warnings instead of failing completely
                else:
                    logger.info("Graph structure validation passed")
                
                # Add validation info to response for debugging
                validation_info = {
                    "validation_passed": validation_result["valid"],
                    "warnings": validation_result["warnings"],
                    "clustering_info": validation_result.get("clustering_info", {}),
                    "attribute_summary": validation_result.get("attribute_summary", {})
                }
            
            # Use LLM to extract key concepts and analyze the slide description
            llm_analysis = await self._analyze_slide_description_with_llm(slide_description, max_tokens)
            logger.info(f"LLM analysis completed: {llm_analysis.get('key_concepts', [])}")
            
            # Find top-k relevant entities using embeddings and LLM analysis
            relevant_entities = await self._find_top_k_entities(
                graph, slide_description, llm_analysis, top_k, similarity_threshold
            )
            
            # Find top-k relevant facts based on entities and embeddings
            relevant_facts = await self._find_top_k_facts(
                graph, slide_description, relevant_entities, top_k, similarity_threshold
            )
            
            # Find top-k relevant chunks based on entities and facts
            relevant_chunks = await self._find_top_k_chunks(
                graph, relevant_entities, relevant_facts, top_k
            )
            
            # Find top-k relevant relationships between selected entities
            relevant_relationships = await self._find_top_k_relationships(
                graph, relevant_entities, top_k
            )
            
            # Generate high-level insights using LLM
            high_level_insights = await self._generate_high_level_insights_with_llm(
                slide_description, relevant_entities, relevant_facts, relevant_relationships, max_tokens
            )
            
            # Create structured response with top-k results
            query_result = {
                "slide_description": slide_description,
                "llm_analysis": llm_analysis,
                "results": {
                    "entities": relevant_entities[:top_k],
                    "facts": relevant_facts[:top_k],
                    "chunks": relevant_chunks[:top_k],
                    "relationships": relevant_relationships[:top_k]
                },
                "high_level_insights": high_level_insights,
            }
            
            # Add validation info if available
            if validate_graph and 'validation_info' in locals():
                query_result["graph_validation"] = validation_info
            
            logger.info(f"Query completed successfully. Found {len(relevant_entities)} entities, "
                       f"{len(relevant_facts)} facts, {len(relevant_chunks)} chunks")
            
            return query_result
            
        except Exception as e:
            logger.error(f"Error querying graph: {e}")
            return {"error": str(e)}
    
    async def _analyze_slide_description_with_llm(self, slide_description: str, max_tokens: int) -> Dict[str, Any]:
        """
        Use LLM to analyze slide description and extract key concepts
        
        Args:
            slide_description: User's description of the slide
            max_tokens: Maximum tokens for LLM response
            
        Returns:
            LLM analysis results
        """
        if not self.llm_service:
            # Fallback to basic concept extraction
            return self._extract_key_concepts_fallback(slide_description)
        
        try:
            # Create focused prompt for LLM analysis
            prompt = f"""
            Analyze this slide description and extract key information in exactly this JSON format:
            
            Slide Description: "{slide_description}"
            
            Return ONLY a JSON object with these exact fields:
            {{
                "key_concepts": ["list of 5-8 most important concepts"],
                "main_topics": ["list of 3-5 main topics"],
                "focus_areas": ["list of 3-5 specific focus areas"],
                "content_types": ["entities", "facts", "relationships"],
                "target_audience": "brief description of target audience",
                "complexity_level": "simple|moderate|complex",
                "slide_purpose": "brief description of what the slide should accomplish"
            }}
            
            Keep the response concise and focused. Do not include any text outside the JSON.
            """
            
            # Get LLM response
            response = await self.llm_service.generate_content(prompt, max_tokens=max_tokens)
            
            # Try to parse JSON response
            try:
                llm_analysis = json.loads(response)
                logger.info("Successfully parsed LLM analysis")
                return llm_analysis
            except json.JSONDecodeError:
                # Fallback if LLM doesn't return valid JSON
                logger.warning("LLM response not in JSON format, using fallback")
                return self._extract_key_concepts_fallback(slide_description)
                
        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}, using fallback")
            return self._extract_key_concepts_fallback(slide_description)
    
    def _extract_key_concepts_fallback(self, slide_description: str) -> Dict[str, Any]:
        """
        Fallback concept extraction when LLM is not available
        
        Args:
            slide_description: User's description
            
        Returns:
            Basic concept analysis
        """
        # Extract potential entity names (capitalized words)
        entity_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'
        potential_entities = re.findall(entity_pattern, slide_description)
        
        # Extract key terms
        words = re.findall(r'\b[a-zA-Z]+\b', slide_description.lower())
        word_freq = defaultdict(int)
        for word in words:
            if len(word) > 3:
                word_freq[word] += 1
        
        frequent_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:8]
        key_terms = [word for word, freq in frequent_words if freq > 1]
        
        # Filter common words
        common_words = {'the', 'and', 'with', 'for', 'this', 'that', 'will', 'can', 'should', 'must', 'about', 'show', 'create', 'need'}
        key_terms = [term for term in key_terms if term.lower() not in common_words]
        
        return {
            "key_concepts": list(set(potential_entities + key_terms))[:8],
            "main_topics": potential_entities[:5],
            "focus_areas": key_terms[:5],
            "content_types": ["entities", "facts", "relationships"],
            "target_audience": "general",
            "complexity_level": "moderate",
            "slide_purpose": "present information from the knowledge graph"
        }
    
    async def _find_top_k_entities(
        self, 
        graph: nx.DiGraph, 
        slide_description: str, 
        llm_analysis: Dict[str, Any],
        top_k: int,
        similarity_threshold: float
    ) -> List[Dict[str, Any]]:
        """
        Find top-k relevant entities using embeddings and LLM analysis
        
        Args:
            graph: Knowledge graph
            slide_description: User's slide description
            llm_analysis: LLM analysis results
            top_k: Maximum entities to return
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of top-k relevant entities with relevance scores
        """
        entity_scores = defaultdict(float)
        key_concepts = llm_analysis.get("key_concepts", [])
        
        # Strategy 1: Direct name matching with LLM concepts
        for node, attrs in graph.nodes(data=True):
            if attrs.get("node_type") == "entity":
                entity_name = attrs.get("name", "").lower()
                
                # Check for exact matches with LLM-extracted concepts
                for concept in key_concepts:
                    concept_lower = concept.lower()
                    if concept_lower in entity_name or entity_name in concept_lower:
                        entity_scores[node] += 3.0  # High score for LLM-identified matches
                    elif any(word in entity_name for word in concept_lower.split()):
                        entity_scores[node] += 2.0  # Medium score for partial matches
        
        # Strategy 2: Embedding similarity for semantic search
        if self.kg_service.node_embeddings:
            entity_scores = await self._apply_embedding_similarity(
                graph, slide_description, entity_scores, similarity_threshold
            )
        
        # Strategy 3: Entity importance (frequency, connections, facts)
        for node, attrs in graph.nodes(data=True):
            if attrs.get("node_type") == "entity":
                frequency = attrs.get("frequency", 1)
                
                # Calculate connections by counting edges where this entity is source or target
                connections = 0
                facts = 0
                
                # Count outgoing and incoming edges
                connections += graph.out_degree(node)
                connections += graph.in_degree(node)
                
                # Count facts that mention this entity
                for fact_node, fact_attrs in graph.nodes(data=True):
                    if fact_attrs.get("node_type") == "fact":
                        fact_text = fact_attrs.get("content", "").lower()
                        if attrs.get("name", "").lower() in fact_text:
                            facts += 1
                
                # Normalize importance score
                importance_score = (frequency * 0.3) + (connections * 0.4) + (facts * 0.3)
                entity_scores[node] += importance_score * 0.3  # Lower weight for importance
        
        # Sort entities by score and return top-k results
        sorted_entities = sorted(entity_scores.items(), key=lambda x: x[1], reverse=True)
        
        relevant_entities = []
        for node, score in sorted_entities[:top_k * 2]:  # Get more candidates for filtering
            if score > similarity_threshold:
                attrs = graph.nodes[node]
                
                # Get all types and descriptions if available
                all_types = attrs.get("all_types", [attrs.get("type", "")])
                all_descriptions = attrs.get("all_descriptions", [attrs.get("description", "")])
                
                # Calculate actual connections and facts
                connections = graph.out_degree(node) + graph.in_degree(node)
                facts = 0
                for fact_node, fact_attrs in graph.nodes(data=True):
                    if fact_attrs.get("node_type") == "fact":
                        fact_text = fact_attrs.get("content", "").lower()
                        if attrs.get("name", "").lower() in fact_text:
                            facts += 1
                
                relevant_entities.append({
                    "node_id": node,
                    "name": attrs.get("name", ""),
                    "type": attrs.get("type", ""),
                    "description": attrs.get("description", ""),
                    "relevance_score": round(score, 3),
                    "frequency": attrs.get("frequency", 1),
                    "connections": connections,
                    "facts": facts,
                    "chunks": attrs.get("chunks", []),
                    "all_types": all_types,
                    "all_descriptions": all_descriptions,
                    "clustered": attrs.get("clustered", False),
                    "cluster_size": attrs.get("cluster_size", 1),
                    "merged": attrs.get("merged", False),
                    "merge_count": attrs.get("merge_count", 1),
                    "metadata": {
                        "filename": attrs.get("filename", ""),
                        "file_path": attrs.get("file_path", ""),
                        "confidence": attrs.get("confidence", 0.0)
                    }
                })
        
        # Return top-k results
        return relevant_entities[:top_k]
    
    async def _find_top_k_facts(
        self, 
        graph: nx.DiGraph, 
        slide_description: str,
        relevant_entities: List[Dict[str, Any]],
        top_k: int,
        similarity_threshold: float
    ) -> List[Dict[str, Any]]:
        """
        Find top-k relevant facts using embeddings and entity associations
        
        Args:
            graph: Knowledge graph
            slide_description: User's slide description
            relevant_entities: List of relevant entities
            top_k: Maximum facts to return
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of top-k relevant facts with relevance scores
        """
        fact_scores = defaultdict(float)
        entity_names = [entity["name"].lower() for entity in relevant_entities]
        
        # Strategy 1: Facts directly connected to relevant entities
        for entity in relevant_entities:
            entity_id = entity["node_id"]
            
            # Find facts that mention this entity
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "fact":
                    fact_text = attrs.get("content", "").lower()
                    if entity["name"].lower() in fact_text:
                        fact_scores[node] += 2.5  # High score for direct entity mentions
        
        # Strategy 2: Embedding similarity for facts
        if self.kg_service.node_embeddings:
            fact_scores = await self._apply_fact_embedding_similarity(
                graph, slide_description, fact_scores, similarity_threshold
            )
        
        # Strategy 3: Fact importance (frequency across chunks)
        for node, attrs in graph.nodes(data=True):
            if attrs.get("node_type") == "fact":
                chunks = attrs.get("chunks", [])
                frequency = len(chunks) if chunks else 1
                fact_scores[node] += frequency * 0.2
        
        # Sort facts by score and return top-k results
        sorted_facts = sorted(fact_scores.items(), key=lambda x: x[1], reverse=True)
        
        relevant_facts = []
        for node, score in sorted_facts[:top_k * 2]:  # Get more candidates for filtering
            if score > similarity_threshold:
                attrs = graph.nodes[node]
                
                # Get all available metadata
                all_chunks = attrs.get("chunks", [])
                all_filenames = attrs.get("filename", "")
                all_file_paths = attrs.get("file_path", "")
                
                relevant_facts.append({
                    "node_id": node,
                    "content": attrs.get("content", ""),
                    "relevance_score": round(score, 3),
                    "chunks": all_chunks,
                    "frequency": len(all_chunks) if all_chunks else 1,
                    "confidence": attrs.get("confidence", 0.0),
                    "clustered": attrs.get("clustered", False),
                    "merged": attrs.get("merged", False),
                    "merge_count": attrs.get("merge_count", 1),
                    "metadata": {
                        "filename": all_filenames,
                        "file_path": all_file_paths,
                        "extraction_timestamp": attrs.get("extraction_timestamp", "")
                    }
                })
        
        # Return top-k results
        return relevant_facts[:top_k]
    
    async def _apply_embedding_similarity(
        self, 
        graph: nx.DiGraph, 
        slide_description: str, 
        entity_scores: Dict[str, float],
        similarity_threshold: float
    ) -> Dict[str, float]:
        """
        Apply embedding similarity for entity search using knowledge graph service
        
        Args:
            graph: Knowledge graph
            slide_description: User's slide description
            entity_scores: Current entity scores
            similarity_threshold: Minimum similarity score
            
        Returns:
            Updated entity scores with embedding similarity
        """
        try:
            if not self.kg_service.node_embeddings:
                logger.debug("No node embeddings available for entity similarity calculation")
                return entity_scores
            
            # Generate embedding for slide description using knowledge graph service
            slide_embedding = await self._generate_text_embedding(slide_description)
            if slide_embedding is None:
                logger.debug("Failed to generate slide description embedding")
                return entity_scores
            
            logger.debug(f"Slide embedding shape: {slide_embedding.shape if hasattr(slide_embedding, 'shape') else 'unknown'}")
            
            # Calculate similarity with entity embeddings
            similarity_count = 0
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "entity":
                    node_embedding = self.kg_service.node_embeddings.get(node)
                    if node_embedding is not None:
                        try:
                            # Validate embeddings before similarity calculation
                            if not isinstance(slide_embedding, np.ndarray):
                                logger.debug(f"Slide embedding is not numpy array: {type(slide_embedding)}")
                                continue
                            if not isinstance(node_embedding, np.ndarray):
                                logger.debug(f"Node embedding is not numpy array: {type(node_embedding)}")
                                continue
                            
                            # Calculate cosine similarity
                            similarity = self._cosine_similarity(slide_embedding, node_embedding)
                            
                            if similarity > similarity_threshold:
                                entity_scores[node] += similarity * 2.0  # High weight for embedding similarity
                                similarity_count += 1
                        except Exception as sim_e:
                            logger.debug(f"Similarity calculation failed for node {node}: {sim_e}")
                            continue
            
            logger.debug(f"Successfully calculated similarity for {similarity_count} entities")
                            
        except Exception as e:
            logger.warning(f"Embedding similarity calculation failed: {e}")
            logger.debug(f"Exception details: {type(e).__name__}: {str(e)}")
        
        return entity_scores
    
    async def _apply_fact_embedding_similarity(
        self, 
        graph: nx.DiGraph, 
        slide_description: str, 
        fact_scores: Dict[str, float],
        similarity_threshold: float
    ) -> Dict[str, float]:
        """
        Apply embedding similarity for fact search using knowledge graph service
        
        Args:
            graph: Knowledge graph
            slide_description: User's slide description
            fact_scores: Current fact scores
            similarity_threshold: Minimum similarity score
            
        Returns:
            Updated fact scores with embedding similarity
        """
        try:
            if not self.kg_service.node_embeddings:
                logger.debug("No node embeddings available for fact similarity calculation")
                return fact_scores
            
            # Generate embedding for slide description
            slide_embedding = await self._generate_text_embedding(slide_description)
            if slide_embedding is None:
                logger.debug("Failed to generate slide description embedding for facts")
                return fact_scores
            
            logger.debug(f"Slide embedding shape for facts: {slide_embedding.shape if hasattr(slide_embedding, 'shape') else 'unknown'}")
            
            # Calculate similarity with fact embeddings
            similarity_count = 0
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "fact":
                    node_embedding = self.kg_service.node_embeddings.get(node)
                    if node_embedding is not None:
                        try:
                            # Validate embeddings before similarity calculation
                            if not isinstance(slide_embedding, np.ndarray):
                                logger.debug(f"Slide embedding is not numpy array: {type(slide_embedding)}")
                                continue
                            if not isinstance(node_embedding, np.ndarray):
                                logger.debug(f"Node embedding is not numpy array: {type(node_embedding)}")
                                continue
                            
                            # Calculate cosine similarity
                            similarity = self._cosine_similarity(slide_embedding, node_embedding)
                            
                            if similarity > similarity_threshold:
                                fact_scores[node] += similarity * 1.5  # Medium weight for fact similarity
                                similarity_count += 1
                        except Exception as sim_e:
                            logger.debug(f"Fact similarity calculation failed for node {node}: {sim_e}")
                            continue
            
            logger.debug(f"Successfully calculated similarity for {similarity_count} facts")
                            
        except Exception as e:
            logger.warning(f"Fact embedding similarity calculation failed: {e}")
            logger.debug(f"Exception details: {type(e).__name__}: {str(e)}")
        
        return fact_scores
    
    async def _generate_text_embedding(self, text: str) -> Optional[np.ndarray]:
        """
        Generate embedding for text using knowledge graph service
        
        Args:
            text: Text to embed
            
        Returns:
            Text embedding as numpy array
        """
        try:
            if not text or not text.strip():
                logger.warning("Empty or invalid text provided for embedding")
                return None
                
            if self.kg_service and hasattr(self.kg_service, '_generate_text_embedding'):
                embedding = await self.kg_service._generate_text_embedding(text)
                if embedding is not None:
                    # Ensure it's a numpy array
                    if not isinstance(embedding, np.ndarray):
                        embedding = np.array(embedding)
                    logger.debug(f"Generated embedding via KG service, shape: {embedding.shape}")
                    return embedding
                else:
                    logger.warning("KG service returned None embedding")
                    return None
                    
            elif self.kg_service and self.kg_service.openai_client:
                # Use OpenAI client directly if available
                response = self.kg_service.openai_client.embeddings.create(
                    input=text,
                    model="text-embedding-3-small"
                )
                embedding = np.array(response.data[0].embedding)
                logger.debug(f"Generated embedding via OpenAI, shape: {embedding.shape}")
                return embedding
            else:
                logger.warning("No embedding generation method available")
                return None
                
        except Exception as e:
            logger.warning(f"Text embedding generation failed: {e}")
            logger.debug(f"Exception details: {type(e).__name__}: {str(e)}")
            return None
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score
        """
        try:
            # Log input types for debugging
            logger.debug(f"Cosine similarity input types: vec1={type(vec1)}, vec2={type(vec2)}")
            
            # Ensure vectors are 1D and convert to numpy arrays if needed
            if not isinstance(vec1, np.ndarray):
                vec1 = np.array(vec1)
                logger.debug(f"Converted vec1 to numpy array, shape: {vec1.shape}")
            if not isinstance(vec2, np.ndarray):
                vec2 = np.array(vec2)
                logger.debug(f"Converted vec2 to numpy array, shape: {vec2.shape}")
                
            vec1 = vec1.flatten()
            vec2 = vec2.flatten()
            
            # Check for zero vectors using np.all() to avoid boolean array issues
            if np.all(vec1 == 0) or np.all(vec2 == 0):
                logger.debug("Zero vector detected, returning 0.0")
                return 0.0
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            # Avoid division by zero
            if norm1 == 0.0 or norm2 == 0.0:
                logger.debug("Zero norm detected, returning 0.0")
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            
            # Ensure the result is a valid float
            if np.isnan(similarity) or np.isinf(similarity):
                logger.debug(f"Invalid similarity value: {similarity}")
                return 0.0
                
            logger.debug(f"Cosine similarity calculated successfully: {similarity}")
            return float(similarity)
            
        except Exception as e:
            logger.warning(f"Cosine similarity calculation failed: {e}")
            logger.debug(f"Exception details: {type(e).__name__}: {str(e)}")
            return 0.0
    
    async def _find_top_k_chunks(
        self, 
        graph: nx.DiGraph,
        relevant_entities: List[Dict[str, Any]],
        relevant_facts: List[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """
        Find top-k relevant chunks based on entities and facts
        
        Args:
            graph: Knowledge graph
            relevant_entities: List of relevant entities
            relevant_facts: List of relevant facts
            top_k: Maximum chunks to return
            
        Returns:
            List of top-k relevant chunks with metadata
        """
        chunk_scores = defaultdict(float)
        
        # Collect all chunk indices from relevant entities and facts
        all_chunks = set()
        for entity in relevant_entities:
            all_chunks.update(entity.get("chunks", []))
        for fact in relevant_facts:
            all_chunks.update(fact.get("chunks", []))
        
        # Score chunks based on how many relevant entities/facts they contain
        for chunk_idx in all_chunks:
            score = 0
            chunk_entities = 0
            chunk_facts = 0
            
            # Count entities in this chunk
            for entity in relevant_entities:
                if chunk_idx in entity.get("chunks", []):
                    chunk_entities += 1
                    score += 1.0
            
            # Count facts in this chunk
            for fact in relevant_facts:
                if chunk_idx in fact.get("chunks", []):
                    chunk_facts += 1
                    score += 0.5
            
            # Bonus for chunks with multiple relevant items
            if chunk_entities > 1:
                score += 0.5
            if chunk_facts > 1:
                score += 0.3
            
            chunk_scores[chunk_idx] = score
        
        # Sort chunks by score and return top-k results
        sorted_chunks = sorted(chunk_scores.items(), key=lambda x: x[1], reverse=True)
        
        relevant_chunks = []
        for chunk_idx, score in sorted_chunks[:top_k]:
            if score > 0:
                # Find chunk content from entities or facts
                chunk_content = self._get_chunk_content(graph, chunk_idx, relevant_entities, relevant_facts)
                relevant_chunks.append({
                    "chunk_index": chunk_idx,
                    "relevance_score": round(score, 3),
                    "content": chunk_content,
                    "entities_in_chunk": len([e for e in relevant_entities if chunk_idx in e.get("chunks", [])]),
                    "facts_in_chunk": len([f for f in relevant_facts if chunk_idx in f.get("chunks", [])]),
                    "metadata": self._get_chunk_metadata(graph, chunk_idx, relevant_entities, relevant_facts)
                })
        
        return relevant_chunks
    
    async def _find_top_k_relationships(
        self, 
        graph: nx.DiGraph,
        relevant_entities: List[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """
        Find top-k relevant relationships between selected entities
        
        Args:
            graph: Knowledge graph
            relevant_entities: List of relevant entities
            top_k: Maximum relationships to return
            
        Returns:
            List of top-k relevant relationships
        """
        relevant_relationships = []
        entity_ids = [entity["node_id"] for entity in relevant_entities]
        
        # Find edges between relevant entities
        for source_id in entity_ids:
            for target_id in entity_ids:
                if source_id != target_id and graph.has_edge(source_id, target_id):
                    edge_attrs = graph.edges[source_id, target_id]
                    
                    # Check for entity connections (both edge types are valid)
                    edge_type = edge_attrs.get("edge_type", "")
                    if edge_type in ["entity_connection", "relationship"]:
                        source_name = graph.nodes[source_id].get("name", "")
                        target_name = graph.nodes[target_id].get("name", "")
                        
                        # Get relationship type from the correct attribute
                        relationship_type = edge_attrs.get("relationship_type", "related")
                        
                        relevant_relationships.append({
                            "source": source_name,
                            "target": target_name,
                            "source_id": source_id,
                            "target_id": target_id,
                            "relationship_type": relationship_type,
                            "weight": edge_attrs.get("weight", 1.0),
                            "confidence": edge_attrs.get("confidence", 0.0),
                            "chunks": edge_attrs.get("chunks", []),
                            "clustered": edge_attrs.get("clustered", False),
                            "merged": edge_attrs.get("merged", False),
                            "merge_count": edge_attrs.get("merge_count", 1),
                            "metadata": {
                                "filename": edge_attrs.get("filename", ""),
                                "file_path": edge_attrs.get("file_path", ""),
                                "source_name": edge_attrs.get("source_name", ""),
                                "target_name": edge_attrs.get("target_name", "")
                            }
                        })
        
        # Sort by weight and return top-k
        sorted_relationships = sorted(relevant_relationships, key=lambda x: x["weight"], reverse=True)
        return sorted_relationships[:top_k]
    
    async def _generate_high_level_insights_with_llm(
        self,
        slide_description: str,
        relevant_entities: List[Dict[str, Any]],
        relevant_facts: List[Dict[str, Any]],
        relevant_relationships: List[Dict[str, Any]],
        max_tokens: int
    ) -> Dict[str, Any]:
        """
        Generate high-level insights using LLM analysis
        
        Args:
            slide_description: User's slide description
            relevant_entities: List of relevant entities
            relevant_facts: List of relevant facts
            relevant_relationships: List of relevant relationships
            max_tokens: Maximum tokens for LLM response
            
        Returns:
            Dictionary containing high-level insights
        """
        if not self.llm_service:
            logger.warning("LLM service not available, using fallback insights generation")
            return self._generate_high_level_insights_fallback(
                relevant_entities, relevant_facts, relevant_relationships
            )
        
        # Validate input data
        if not relevant_entities and not relevant_facts and not relevant_relationships:
            logger.warning("No relevant data provided for insights generation, using fallback")
            return self._generate_high_level_insights_fallback(
                relevant_entities, relevant_facts, relevant_relationships
            )
        
        try:
            # Create focused prompt for LLM insights generation
            entities_summary = ", ".join([f"{e['name']} ({e.get('type', 'unknown')})" for e in relevant_entities[:5]])
            facts_summary = "; ".join([f.get("content", f.get("text", ""))[:100] for f in relevant_facts[:3]])
            relationships_summary = ", ".join([f"{r.get('source_name', r.get('source', ''))} --{r.get('type', r.get('relationship_type', ''))}--> {r.get('target_name', r.get('target', ''))}" for r in relevant_relationships[:3]])
            
            system_prompt = """You are an expert AI assistant that generates high-level insights for presentation slides. 
            CRITICAL: You MUST return ONLY valid JSON format - no explanations, no markdown, no additional text, no code blocks.
            The response must start with { and end with }.
            Ensure the JSON is properly formatted and parseable by a JSON parser."""
            
            user_prompt = f"""
            Based on this slide description and the relevant content found, generate high-level insights in exactly this JSON format:
            
            Slide Description: "{slide_description}"
            
            Relevant Entities: {entities_summary}
            Relevant Facts: {facts_summary}
            Relevant Relationships: {relationships_summary}
            
            Return ONLY a JSON object with these exact fields:
            {{
                "main_themes": ["list of 3-5 main themes identified"],
                "key_relationships": ["list of 3-5 key relationship types"],
                "central_entities": ["list of 3-5 most important entities"],
                "supporting_evidence": ["list of 3-5 key supporting facts"],
                "content_summary": "brief summary of the content (max 100 words)",
                "slide_structure_suggestions": ["list of 3-5 suggestions for slide organization"],
                "audience_focus": "what the audience should focus on (max 50 words)"
            }}
            
            CRITICAL: Return ONLY the JSON object. Do not include any text outside the JSON.
            Do not wrap in code blocks, do not add explanations, do not add markdown formatting.
            The response must be parseable JSON starting with {{ and ending with }}.
            """
            
            # Get LLM response with explicit system prompt for JSON output
            response = await self.llm_service.generate_content(user_prompt, max_tokens=max_tokens, system_prompt=system_prompt)
            
            # Log the response for debugging
            logger.debug(f"LLM response length: {len(response) if response else 0}")
            if response:
                logger.debug(f"LLM response preview: {response[:300]}...")
                # Also log the full response for debugging JSON issues
                logger.debug(f"Full LLM response: {response}")
            else:
                logger.warning("LLM service returned empty response")
                return self._generate_high_level_insights_fallback(
                    relevant_entities, relevant_facts, relevant_relationships
                )
            
            # Try to parse JSON response
            try:
                # Clean the response to extract JSON
                cleaned_response = response.strip()
                
                # Remove markdown code blocks if present
                if cleaned_response.startswith("```json"):
                    cleaned_response = cleaned_response[7:]
                elif cleaned_response.startswith("```"):
                    cleaned_response = cleaned_response[3:]
                
                if cleaned_response.endswith("```"):
                    cleaned_response = cleaned_response[:-3]
                
                cleaned_response = cleaned_response.strip()
                
                # Try to parse the cleaned JSON
                llm_insights = json.loads(cleaned_response)
                logger.info("Successfully generated LLM insights")
                return llm_insights
                
            except json.JSONDecodeError as e:
                # Log the raw response for debugging
                logger.warning(f"LLM insights not in JSON format: {e}")
                logger.warning(f"Raw response: {response[:200]}...")
                
                # Try to extract JSON using regex as fallback
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    try:
                        extracted_json = json_match.group(0)
                        llm_insights = json.loads(extracted_json)
                        logger.info("Successfully extracted JSON using regex fallback")
                        return llm_insights
                    except json.JSONDecodeError:
                        logger.warning("Regex JSON extraction also failed")
                
                # Use fallback if all JSON parsing attempts fail
                logger.warning("Using fallback insights generation")
                return self._generate_high_level_insights_fallback(
                    relevant_entities, relevant_facts, relevant_relationships
                )
                
        except Exception as e:
            logger.warning(f"LLM insights generation failed: {e}, using fallback")
            logger.debug(f"Exception details: {type(e).__name__}: {str(e)}")
            return self._generate_high_level_insights_fallback(
                relevant_entities, relevant_facts, relevant_relationships
            )
    
    def _generate_high_level_insights_fallback(
        self,
        relevant_entities: List[Dict[str, Any]],
        relevant_facts: List[Dict[str, Any]],
        relevant_relationships: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Fallback insights generation when LLM is not available
        
        Args:
            relevant_entities: List of relevant entities
            relevant_facts: List of relevant facts
            relevant_relationships: List of relevant relationships
            
        Returns:
            Basic insights dictionary
        """
        insights = {
            "main_themes": [],
            "key_relationships": [],
            "central_entities": [],
            "supporting_evidence": [],
            "content_summary": "",
            "slide_structure_suggestions": ["Use entities as main points", "Include key facts as support"],
            "audience_focus": "Focus on the main entities and their relationships"
        }
        
        # Identify main themes based on entity types
        entity_types = defaultdict(int)
        for entity in relevant_entities:
            entity_type = entity.get("type", "unknown")
            entity_types[entity_type] += 1
        
        main_types = sorted(entity_types.items(), key=lambda x: x[1], reverse=True)[:3]
        insights["main_themes"] = [f"{entity_type} ({count} entities)" for entity_type, count in main_types]
        
        # Identify central entities (highest relevance and connections)
        central_entities = sorted(
            relevant_entities, 
            key=lambda x: (x.get("relevance_score", 0), x.get("connections", 0)), 
            reverse=True
        )[:5]
        insights["central_entities"] = [entity.get("name", "Unknown") for entity in central_entities]
        
        # Identify key relationships
        relationship_types = defaultdict(int)
        for rel in relevant_relationships:
            rel_type = rel.get("relationship_type", rel.get("type", "unknown"))
            relationship_types[rel_type] += 1
        
        key_rels = sorted(relationship_types.items(), key=lambda x: x[1], reverse=True)[:3]
        insights["key_relationships"] = [f"{rel_type} ({count} instances)" for rel_type, count in key_rels]
        
        # Generate content summary
        if relevant_facts:
            fact_texts = []
            for fact in relevant_facts[:3]:
                content = fact.get("content", fact.get("text", ""))
                if content:
                    fact_texts.append(content)
            
            if fact_texts:
                insights["content_summary"] = " ".join(fact_texts)[:200] + "..."
            else:
                insights["content_summary"] = "Content summary not available"
        
        return insights
    
    def _get_chunk_content(
        self, 
        graph: nx.DiGraph, 
        chunk_idx: int,
        relevant_entities: List[Dict[str, Any]],
        relevant_facts: List[Dict[str, Any]]
    ) -> str:
        """
        Get chunk content from the knowledge graph service's file graph data
        
        Args:
            graph: Knowledge graph
            chunk_idx: Chunk index
            relevant_entities: List of relevant entities
            relevant_facts: List of relevant facts
            
        Returns:
            Chunk content as string
        """
        # First, try to get chunk content using the knowledge graph service's dedicated method
        if self.kg_service and hasattr(self.kg_service, 'get_chunk_content'):
            chunk_content = self.kg_service.get_chunk_content(chunk_idx)
            if chunk_content:
                return chunk_content
        
        # If the dedicated method didn't work, try to get chunk content from the knowledge graph service's file graph data
        if self.kg_service and hasattr(self.kg_service, 'file_graph_data'):
            for filename, graph_data in self.kg_service.file_graph_data.items():
                if "entities" in graph_data:
                    for entity_id, entity_info in graph_data["entities"].items():
                        if chunk_idx in entity_info.get("chunks", []):
                            # Get chunk content from the entity's chunk_content list
                            chunk_contents = entity_info.get("chunk_content", [])
                            if chunk_contents and len(chunk_contents) > 0:
                                # Find the content for this specific chunk index
                                for i, content in enumerate(chunk_contents):
                                    if i < len(entity_info.get("chunks", [])) and entity_info["chunks"][i] == chunk_idx:
                                        if content and content.strip():
                                            return content.strip()
                
                # Also check facts for chunk content
                if "facts" in graph_data:
                    for fact in graph_data["facts"]:
                        if chunk_idx in fact.get("chunks", []):
                            chunk_contents = fact.get("chunk_content", [])
                            if chunk_contents and len(chunk_contents) > 0:
                                # Find the content for this specific chunk index
                                for i, content in enumerate(chunk_contents):
                                    if i < len(fact.get("chunks", [])) and fact["chunks"][i] == chunk_idx:
                                        if content and content.strip():
                                            return content.strip()
        
        # Fallback: try to reconstruct chunk content from entities and facts
        chunk_texts = []
        
        # Collect text from entities in this chunk
        for entity in relevant_entities:
            if chunk_idx in entity.get("chunks", []):
                if "name" in entity:
                    chunk_texts.append(f"Entity: {entity['name']}")
                if "description" in entity and entity["description"]:
                    chunk_texts.append(f"Description: {entity['description']}")
        
        # Collect text from facts in this chunk
        for fact in relevant_facts:
            if chunk_idx in fact.get("chunks", []):
                if "content" in fact and fact["content"]:
                    chunk_texts.append(f"Fact: {fact['content']}")
        
        # If we found some content, return it
        if chunk_texts:
            return " | ".join(chunk_texts)
        
        # Final fallback: return chunk index as string
        return f"Chunk {chunk_idx} - Content not available"
    
    def _get_chunk_metadata(
        self, 
        graph: nx.DiGraph, 
        chunk_idx: int,
        relevant_entities: List[Dict[str, Any]],
        relevant_facts: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Get metadata for a specific chunk
        
        Args:
            graph: Knowledge graph
            chunk_idx: Chunk index
            relevant_entities: List of relevant entities
            relevant_facts: List of relevant facts
            
        Returns:
            Chunk metadata dictionary
        """
        metadata = {
            "filename": "",
            "file_path": "",
            "extraction_timestamp": "",
            "chunk_content": ""
        }
        
        # Try to get metadata from entities
        for entity in relevant_entities:
            if chunk_idx in entity.get("chunks", []):
                if "metadata" in entity:
                    metadata.update(entity["metadata"])
                # Also check for direct attributes
                if "filename" in entity:
                    metadata["filename"] = entity["filename"]
                if "file_path" in entity:
                    metadata["file_path"] = entity["file_path"]
                break
        
        # Try to get metadata from facts
        for fact in relevant_facts:
            if chunk_idx in fact.get("chunks", []):
                if "metadata" in fact:
                    metadata.update(fact["metadata"])
                # Also check for direct attributes
                if "filename" in fact:
                    metadata["filename"] = fact["filename"]
                if "file_path" in fact:
                    metadata["file_path"] = fact["file_path"]
                break
        
        return metadata
    
    def _get_current_timestamp(self) -> str:
        """Get current timestamp as string"""
        return datetime.now().isoformat()
    
    def _calculate_entity_statistics(self, graph: nx.DiGraph) -> Dict[str, Any]:
        """
        Calculate entity statistics that align with the actual graph structure
        
        Args:
            graph: Knowledge graph
            
        Returns:
            Dictionary containing entity statistics
        """
        try:
            entity_count = 0
            total_frequency = 0
            entity_types = defaultdict(int)
            source_files = set()
            clustered_entities = 0
            merged_entities = 0
            
            for node, attrs in graph.nodes(data=True):
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
                    
                    # Clustering and merging info
                    if attrs.get("clustered"):
                        clustered_entities += 1
                    if attrs.get("merged"):
                        merged_entities += 1
            
            return {
                "count": entity_count,
                "average_frequency": round(total_frequency / entity_count, 2) if entity_count > 0 else 0,
                "types": dict(entity_types),
                "source_files": len(source_files),
                "clustered_entities": clustered_entities,
                "merged_entities": merged_entities
            }
            
        except Exception as e:
            logger.error(f"Error calculating entity statistics: {e}")
            return {"error": str(e)}
    
    def _calculate_relationship_statistics(self, graph: nx.DiGraph) -> Dict[str, Any]:
        """
        Calculate relationship statistics that align with the actual graph structure
        
        Args:
            graph: Knowledge graph
            
        Returns:
            Dictionary containing relationship statistics
        """
        try:
            relationship_count = 0
            total_weight = 0
            relationship_types = defaultdict(int)
            source_files = set()
            clustered_edges = 0
            merged_edges = 0
            
            for source, target, attrs in graph.edges(data=True):
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
                    
                    # Clustering and merging info
                    if attrs.get("clustered"):
                        clustered_edges += 1
                    if attrs.get("merged"):
                        merged_edges += 1
            
            return {
                "count": relationship_count,
                "average_weight": round(total_weight / relationship_count, 3) if relationship_count > 0 else 0,
                "types": dict(relationship_types),
                "source_files": len(source_files),
                "clustered_edges": clustered_edges,
                "merged_edges": merged_edges
            }
            
        except Exception as e:
            logger.error(f"Error calculating relationship statistics: {e}")
            return {"error": str(e)}

    async def get_graph_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the knowledge graph
        
        Returns:
            Dictionary containing graph statistics
        """
        if not self.kg_service:
            return {"error": "KnowledgeGraphService not available"}
        
        try:
            graph = self.kg_service.graph
            if not graph:
                return {"error": "No knowledge graph available"}
            
            stats = {
                "total_nodes": len(graph.nodes),
                "total_edges": len(graph.edges),
                "node_types": defaultdict(int),
                "edge_types": defaultdict(int),
                "embeddings": {
                    "nodes_with_embeddings": len(self.kg_service.node_embeddings) if self.kg_service.node_embeddings else 0,
                    "edges_with_embeddings": len(self.kg_service.edge_embeddings) if self.kg_service.edge_embeddings else 0
                },
                "timestamp": self._get_current_timestamp()
            }
            
            # Count node types
            for node, attrs in graph.nodes(data=True):
                node_type = attrs.get("node_type", "unknown")
                stats["node_types"][node_type] += 1
            
            # Count edge types
            for source, target, attrs in graph.edges(data=True):
                edge_type = attrs.get("edge_type", "unknown")
                stats["edge_types"][edge_type] += 1
            
            # Get detailed entity and relationship statistics
            entity_stats = self._calculate_entity_statistics(graph)
            relationship_stats = self._calculate_relationship_statistics(graph)
            
            stats["entities"] = entity_stats
            stats["relationships"] = relationship_stats
            
            # Convert defaultdict to regular dict for JSON serialization
            stats["node_types"] = dict(stats["node_types"])
            stats["edge_types"] = dict(stats["edge_types"])
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting graph statistics: {e}")
            return {"error": str(e)}

    def _validate_graph_structure(self, graph: nx.DiGraph) -> Dict[str, Any]:
        """
        Validate the graph structure and provide debugging information about available attributes
        
        Args:
            graph: Knowledge graph to validate
            
        Returns:
            Dictionary containing validation results and attribute information
        """
        try:
            validation_result = {
                "valid": True,
                "errors": [],
                "warnings": [],
                "attribute_summary": {},
                "node_count": len(graph.nodes),
                "edge_count": len(graph.edges)
            }
            
            # Check node attributes
            node_attributes = defaultdict(set)
            for node, attrs in graph.nodes(data=True):
                for attr_name in attrs.keys():
                    node_attributes[attr_name].add(type(attrs[attr_name]).__name__)
            
            validation_result["attribute_summary"]["nodes"] = dict(node_attributes)
            
            # Check edge attributes
            edge_attributes = defaultdict(set)
            for source, target, attrs in graph.edges(data=True):
                for attr_name in attrs.keys():
                    edge_attributes[attr_name].add(type(attrs[attr_name]).__name__)
            
            validation_result["attribute_summary"]["edges"] = dict(edge_attributes)
            
            # Validate required attributes
            required_node_attrs = {"node_type", "name"}
            required_edge_attrs = {"edge_type"}
            
            # Check for missing required node attributes
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "entity":
                    if "name" not in attrs:
                        validation_result["errors"].append(f"Entity node {node} missing 'name' attribute")
                        validation_result["valid"] = False
                
                if attrs.get("node_type") == "fact":
                    if "content" not in attrs:
                        validation_result["warnings"].append(f"Fact node {node} missing 'content' attribute")
            
            # Check for missing required edge attributes
            for source, target, attrs in graph.edges(data=True):
                if "edge_type" not in attrs:
                    validation_result["warnings"].append(f"Edge ({source}, {target}) missing 'edge_type' attribute")
            
            # Check for clustering and merging attributes
            clustered_nodes = sum(1 for _, attrs in graph.nodes(data=True) if attrs.get("clustered"))
            merged_nodes = sum(1 for _, attrs in graph.nodes(data=True) if attrs.get("merged"))
            clustered_edges = sum(1 for _, _, attrs in graph.edges(data=True) if attrs.get("clustered"))
            merged_edges = sum(1 for _, _, attrs in graph.edges(data=True) if attrs.get("merged"))
            
            validation_result["clustering_info"] = {
                "clustered_nodes": clustered_nodes,
                "merged_nodes": merged_nodes,
                "clustered_edges": clustered_edges,
                "merged_edges": merged_edges
            }
            
            return validation_result
            
        except Exception as e:
            return {
                "valid": False,
                "errors": [f"Validation failed: {str(e)}"],
                "warnings": [],
                "attribute_summary": {},
                "node_count": 0,
                "edge_count": 0
            }
