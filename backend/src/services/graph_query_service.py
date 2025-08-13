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
    
    async def query_graph_for_slide_content(
        self, 
        slide_description: str,
        top_k: int = 10,
        similarity_threshold: float = 0.3,
        include_embeddings: bool = False,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """
        Query the knowledge graph using LLMs for concept extraction and embeddings for semantic search
        
        Args:
            slide_description: User's description of what they want in the slide
            top_k: Maximum number of results to return for each category
            similarity_threshold: Minimum similarity score for inclusion
            include_embeddings: Whether to include embedding data in response
            max_tokens: Maximum tokens for LLM responses
            
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
                "metadata": {
                    "total_entities_found": len(relevant_entities),
                    "total_facts_found": len(relevant_facts),
                    "total_chunks_found": len(relevant_chunks),
                    "total_relationships_found": len(relevant_relationships),
                    "top_k": top_k,
                    "similarity_threshold": similarity_threshold,
                    "embeddings_used": self.kg_service.node_embeddings is not None,
                    "llm_used": self.llm_service is not None,
                    "query_timestamp": self._get_current_timestamp(),
                    "graph_stats": {
                        "total_nodes": len(graph.nodes),
                        "total_edges": len(graph.edges),
                        "nodes_with_embeddings": len(self.kg_service.node_embeddings) if self.kg_service.node_embeddings else 0
                    }
                }
            }
            
            # Include embeddings if requested and available
            if include_embeddings and self.kg_service.node_embeddings:
                query_result["embeddings"] = {
                    "node_embeddings_count": len(self.kg_service.node_embeddings),
                    "edge_embeddings_count": len(self.kg_service.edge_embeddings) if self.kg_service.edge_embeddings else 0
                }
            
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
                connections = attrs.get("total_connections", 0)
                facts = attrs.get("total_facts", 0)
                
                # Normalize importance score
                importance_score = (frequency * 0.3) + (connections * 0.4) + (facts * 0.3)
                entity_scores[node] += importance_score * 0.3  # Lower weight for importance
        
        # Sort entities by score and return top-k results
        sorted_entities = sorted(entity_scores.items(), key=lambda x: x[1], reverse=True)
        
        relevant_entities = []
        for node, score in sorted_entities[:top_k * 2]:  # Get more candidates for filtering
            if score > similarity_threshold:
                attrs = graph.nodes[node]
                relevant_entities.append({
                    "node_id": node,
                    "name": attrs.get("name", ""),
                    "type": attrs.get("type", ""),
                    "description": attrs.get("description", ""),
                    "relevance_score": round(score, 3),
                    "frequency": attrs.get("frequency", 1),
                    "connections": attrs.get("total_connections", 0),
                    "facts": attrs.get("total_facts", 0),
                    "chunks": attrs.get("chunks", []),
                    "metadata": {
                        "filename": attrs.get("filename", ""),
                        "file_path": attrs.get("file_path", "")
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
                relevant_facts.append({
                    "node_id": node,
                    "content": attrs.get("content", ""),
                    "relevance_score": round(score, 3),
                    "chunks": attrs.get("chunks", []),
                    "metadata": {
                        "filename": attrs.get("filename", ""),
                        "file_path": attrs.get("file_path", "")
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
                return entity_scores
            
            # Generate embedding for slide description using knowledge graph service
            slide_embedding = await self._generate_text_embedding(slide_description)
            if not slide_embedding:
                return entity_scores
            
            # Calculate similarity with entity embeddings
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "entity":
                    node_embedding = self.kg_service.node_embeddings.get(node)
                    if node_embedding is not None:
                        # Calculate cosine similarity
                        similarity = self._cosine_similarity(slide_embedding, node_embedding)
                        
                        if similarity > similarity_threshold:
                            entity_scores[node] += similarity * 2.0  # High weight for embedding similarity
                            
        except Exception as e:
            logger.warning(f"Embedding similarity calculation failed: {e}")
        
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
                return fact_scores
            
            # Generate embedding for slide description
            slide_embedding = await self._generate_text_embedding(slide_description)
            if not slide_embedding:
                return fact_scores
            
            # Calculate similarity with fact embeddings
            for node, attrs in graph.nodes(data=True):
                if attrs.get("node_type") == "fact":
                    node_embedding = self.kg_service.node_embeddings.get(node)
                    if node_embedding is not None:
                        # Calculate cosine similarity
                        similarity = self._cosine_similarity(slide_embedding, node_embedding)
                        
                        if similarity > similarity_threshold:
                            fact_scores[node] += similarity * 1.5  # Medium weight for fact similarity
                            
        except Exception as e:
            logger.warning(f"Fact embedding similarity calculation failed: {e}")
        
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
            if self.kg_service and hasattr(self.kg_service, '_generate_text_embedding'):
                return await self.kg_service._generate_text_embedding(text)
            elif self.kg_service and self.kg_service.openai_client:
                # Use OpenAI client directly if available
                response = self.kg_service.openai_client.embeddings.create(
                    input=text,
                    model="text-embedding-3-small"
                )
                return np.array(response.data[0].embedding)
            else:
                logger.warning("No embedding generation method available")
                return None
        except Exception as e:
            logger.warning(f"Text embedding generation failed: {e}")
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
            # Ensure vectors are 1D
            vec1 = vec1.flatten()
            vec2 = vec2.flatten()
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return float(similarity)
            
        except Exception as e:
            logger.warning(f"Cosine similarity calculation failed: {e}")
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
                    
                    # Only include entity connections, not fact connections
                    if edge_attrs.get("edge_type") == "entity_connection":
                        source_name = graph.nodes[source_id].get("name", "")
                        target_name = graph.nodes[target_id].get("name", "")
                        
                        relevant_relationships.append({
                            "source": source_name,
                            "target": target_name,
                            "source_id": source_id,
                            "target_id": target_id,
                            "relationship_type": edge_attrs.get("relationship_type", "related"),
                            "weight": edge_attrs.get("weight", 1.0),
                            "chunks": edge_attrs.get("chunks", []),
                            "metadata": {
                                "filename": edge_attrs.get("filename", ""),
                                "file_path": edge_attrs.get("file_path", "")
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
            # Fallback to basic insights generation
            return self._generate_high_level_insights_fallback(
                relevant_entities, relevant_facts, relevant_relationships
            )
        
        try:
            # Create focused prompt for LLM insights generation
            entities_summary = ", ".join([f"{e['name']} ({e['type']})" for e in relevant_entities[:5]])
            facts_summary = "; ".join([f["content"][:100] for f in relevant_facts[:3]])
            relationships_summary = ", ".join([f"{r['source']} --{r['relationship_type']}--> {r['target']}" for r in relevant_relationships[:3]])
            
            prompt = f"""
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
            
            Keep the response concise and focused. Do not include any text outside the JSON.
            """
            
            # Get LLM response
            response = await self.llm_service.generate_content(prompt, max_tokens=max_tokens)
            
            # Try to parse JSON response
            try:
                llm_insights = json.loads(response)
                logger.info("Successfully generated LLM insights")
                return llm_insights
            except json.JSONDecodeError:
                # Fallback if LLM doesn't return valid JSON
                logger.warning("LLM insights not in JSON format, using fallback")
                return self._generate_high_level_insights_fallback(
                    relevant_entities, relevant_facts, relevant_relationships
                )
                
        except Exception as e:
            logger.warning(f"LLM insights generation failed: {e}, using fallback")
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
            key=lambda x: (x["relevance_score"], x["connections"]), 
            reverse=True
        )[:5]
        insights["central_entities"] = [entity["name"] for entity in central_entities]
        
        # Identify key relationships
        relationship_types = defaultdict(int)
        for rel in relevant_relationships:
            rel_type = rel.get("relationship_type", "unknown")
            relationship_types[rel_type] += 1
        
        key_rels = sorted(relationship_types.items(), key=lambda x: x[1], reverse=True)[:3]
        insights["key_relationships"] = [f"{rel_type} ({count} instances)" for rel_type, count in key_rels]
        
        # Generate content summary
        if relevant_facts:
            fact_texts = [fact["content"] for fact in relevant_facts[:3]]
            insights["content_summary"] = " ".join(fact_texts)[:200] + "..."
        
        return insights
    
    def _get_chunk_content(
        self, 
        graph: nx.DiGraph, 
        chunk_idx: int,
        relevant_entities: List[Dict[str, Any]],
        relevant_facts: List[Dict[str, Any]]
    ) -> str:
        """
        Get chunk content from entities or facts
        
        Args:
            graph: Knowledge graph
            chunk_idx: Chunk index
            relevant_entities: List of relevant entities
            relevant_facts: List of relevant facts
            
        Returns:
            Chunk content as string
        """
        # Try to get content from entities first
        for entity in relevant_entities:
            if chunk_idx in entity.get("chunks", []):
                # Look for chunk_content in entity metadata
                if "metadata" in entity and "chunk_content" in entity["metadata"]:
                    return entity["metadata"]["chunk_content"]
        
        # Try to get content from facts
        for fact in relevant_facts:
            if chunk_idx in fact.get("chunks", []):
                # Look for chunk_content in fact metadata
                if "metadata" in fact and "chunk_content" in fact["metadata"]:
                    return fact["metadata"]["chunk_content"]
        
        # Fallback: return chunk index as string
        return f"Chunk {chunk_idx}"
    
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
            "extraction_timestamp": ""
        }
        
        # Try to get metadata from entities
        for entity in relevant_entities:
            if chunk_idx in entity.get("chunks", []):
                if "metadata" in entity:
                    metadata.update(entity["metadata"])
                break
        
        # Try to get metadata from facts
        for fact in relevant_facts:
            if chunk_idx in fact.get("chunks", []):
                if "metadata" in fact:
                    metadata.update(fact["metadata"])
                break
        
        return metadata
    
    def _get_current_timestamp(self) -> str:
        """Get current timestamp as string"""
        return datetime.now().isoformat()
    
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
            
            # Convert defaultdict to regular dict for JSON serialization
            stats["node_types"] = dict(stats["node_types"])
            stats["edge_types"] = dict(stats["edge_types"])
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting graph statistics: {e}")
            return {"error": str(e)}
