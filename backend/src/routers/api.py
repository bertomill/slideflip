"""
Main API router for SlideFlip Backend
Contains all HTTP endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pathlib import Path
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel

from src.services.file_service import FileService
from src.services.knowledge_graph_service import KnowledgeGraphService
from src.core.websocket_manager import WebSocketManager

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services
file_service = FileService()
websocket_manager = WebSocketManager()

# Create router
router = APIRouter(prefix="/api", tags=["api"])

# Pydantic models for embedding API
class EmbeddingRequest(BaseModel):
    client_id: str

class EmbeddingResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class SimilarityRequest(BaseModel):
    client_id: str
    node_id: Optional[str] = None
    source: Optional[str] = None
    target: Optional[str] = None
    top_k: int = 5

# Dependency to get KnowledgeGraphService instance
def get_kg_service(client_id: str) -> KnowledgeGraphService:
    return KnowledgeGraphService(client_id)

@router.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "SlideFlip Backend is running", "status": "healthy"}

@router.get("/health")
async def health_check():
    """Detailed health check"""
    stats = websocket_manager.get_connection_stats()
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "file_service": "running",
            "slide_service": "running",
            "websocket_manager": "running"
        },
        "websocket_stats": stats
    }

@router.get("/debug/connections")
async def debug_connections():
    """Debug endpoint to show current WebSocket connections"""
    stats = websocket_manager.get_connection_stats()
    connections = websocket_manager.get_all_connection_info()
    return {
        "stats": stats,
        "connections": connections
    }

@router.get("/download/{file_path:path}")
async def download_file(file_path: str):
    """Download endpoint for generated PPT files"""
    try:
        logger.info(f"Download request for file path: {file_path}")
        
        # Use the shared service method to resolve file path
        resolved_file, filename = file_service.get_downloadable_file(file_path)
        
        # Get file info for logging
        file_size = resolved_file.stat().st_size
        logger.info(f"Serving file: {resolved_file} (size: {file_size} bytes)")
        
        # Return file as downloadable response
        return FileResponse(
            path=str(resolved_file),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
        
    except ValueError as e:
        logger.error(f"Invalid file path {file_path}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        logger.error(f"File not found: {file_path}")
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.error(f"Error serving file {file_path}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/debug/check-file/{file_path:path}")
async def check_file_exists(file_path: str):
    """Debug endpoint to check if a file exists"""
    try:
        logger.info(f"Checking file existence for: {file_path}")
        
        # Use the shared service method to check file existence
        file_info = file_service.check_file_exists(file_path)
        
        return file_info
        
    except Exception as e:
        logger.error(f"Error checking file {file_path}: {e}")
        return {"exists": False, "error": str(e)}

# Embedding API endpoints
@router.post("/embeddings/generate", response_model=EmbeddingResponse)
async def generate_embeddings(request: EmbeddingRequest):
    """Generate embeddings for a knowledge graph"""
    try:
        logger.info(f"Generating embeddings for client: {request.client_id}")
        
        kg_service = get_kg_service(request.client_id)
        
        # Check if graph exists
        if not kg_service.graph:
            return EmbeddingResponse(
                success=False,
                message="No knowledge graph available for this client"
            )
        
        # Generate embeddings
        result = kg_service.generate_graph_embeddings()
        
        if result.get("success"):
            # Save embeddings
            embeddings_path = await kg_service.save_embeddings()
            
            return EmbeddingResponse(
                success=True,
                message="Embeddings generated and saved successfully",
                data={
                    "node_embeddings_count": result["node_embeddings_count"],
                    "edge_embeddings_count": result["edge_embeddings_count"],
                    "embeddings_path": embeddings_path
                }
            )
        else:
            return EmbeddingResponse(
                success=False,
                message=f"Failed to generate embeddings: {result.get('error', 'Unknown error')}"
            )
            
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return EmbeddingResponse(
            success=False,
            message=f"Internal server error: {str(e)}"
        )

@router.post("/embeddings/load", response_model=EmbeddingResponse)
async def load_embeddings(request: EmbeddingRequest):
    """Load embeddings for a knowledge graph"""
    try:
        logger.info(f"Loading embeddings for client: {request.client_id}")
        
        kg_service = get_kg_service(request.client_id)
        
        # Check if embeddings exist
        if not kg_service.embeddings_exist():
            return EmbeddingResponse(
                success=False,
                message="No embeddings found for this client"
            )
        
        # Load embeddings
        success = await kg_service.load_embeddings()
        
        if success:
            stats = kg_service.get_embedding_statistics()
            return EmbeddingResponse(
                success=True,
                message="Embeddings loaded successfully",
                data=stats
            )
        else:
            return EmbeddingResponse(
                success=False,
                message="Failed to load embeddings"
            )
            
    except Exception as e:
        logger.error(f"Error loading embeddings: {e}")
        return EmbeddingResponse(
            success=False,
            message=f"Internal server error: {str(e)}"
        )

@router.get("/embeddings/stats/{client_id}")
async def get_embedding_stats(client_id: str):
    """Get embedding statistics for a client"""
    try:
        logger.info(f"Getting embedding stats for client: {client_id}")
        
        kg_service = get_kg_service(client_id)
        stats = kg_service.get_embedding_statistics()
        
        return {
            "success": True,
            "client_id": client_id,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting embedding stats: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/embeddings/similarity", response_model=EmbeddingResponse)
async def find_similar_nodes_edges(request: SimilarityRequest):
    """Find similar nodes or edges based on embeddings"""
    try:
        logger.info(f"Finding similar elements for client: {request.client_id}")
        
        kg_service = get_kg_service(request.client_id)
        
        # Check if embeddings are loaded
        if not kg_service.node_embeddings and not kg_service.edge_embeddings:
            return EmbeddingResponse(
                success=False,
                message="No embeddings loaded for this client"
            )
        
        result = {}
        
        # Find similar nodes if node_id is provided
        if request.node_id:
            similar_nodes = kg_service.get_similar_nodes(request.node_id, request.top_k)
            result["similar_nodes"] = [
                {"node_id": node_id, "similarity": float(similarity)}
                for node_id, similarity in similar_nodes
            ]
        
        # Find similar edges if source and target are provided
        if request.source and request.target:
            similar_edges = kg_service.get_similar_edges(request.source, request.target, request.top_k)
            result["similar_edges"] = [
                {"source": edge_key[0], "target": edge_key[1], "similarity": float(similarity)}
                for edge_key, similarity in similar_edges
            ]
        
        if not result:
            return EmbeddingResponse(
                success=False,
                message="Please provide either node_id or both source and target"
            )
        
        return EmbeddingResponse(
            success=True,
            message="Similarity search completed successfully",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Error finding similar elements: {e}")
        return EmbeddingResponse(
            success=False,
            message=f"Internal server error: {str(e)}"
        )

@router.post("/embeddings/regenerate", response_model=EmbeddingResponse)
async def regenerate_embeddings(request: EmbeddingRequest):
    """Regenerate embeddings for a knowledge graph"""
    try:
        logger.info(f"Regenerating embeddings for client: {request.client_id}")
        
        kg_service = get_kg_service(request.client_id)
        
        # Check if graph exists
        if not kg_service.graph:
            return EmbeddingResponse(
                success=False,
                message="No knowledge graph available for this client"
            )
        
        # Regenerate embeddings
        result = await kg_service.regenerate_embeddings()
        
        if result.get("success"):
            return EmbeddingResponse(
                success=True,
                message="Embeddings regenerated and saved successfully",
                data=result
            )
        else:
            return EmbeddingResponse(
                success=False,
                message=f"Failed to regenerate embeddings: {result.get('error', 'Unknown error')}"
            )
            
    except Exception as e:
        logger.error(f"Error regenerating embeddings: {e}")
        return EmbeddingResponse(
            success=False,
            message=f"Internal server error: {str(e)}"
        )

@router.delete("/embeddings/{client_id}")
async def clear_embeddings(client_id: str):
    """Clear embeddings for a client from memory"""
    try:
        logger.info(f"Clearing embeddings for client: {client_id}")
        
        kg_service = get_kg_service(client_id)
        kg_service.clear_embeddings()
        
        return {
            "success": True,
            "message": f"Embeddings cleared for client {client_id}"
        }
        
    except Exception as e:
        logger.error(f"Error clearing embeddings: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# Enhanced Graph Query Service endpoints
class GraphQueryRequest(BaseModel):
    client_id: str
    slide_description: str
    top_k: int = 10
    similarity_threshold: float = 0.3
    include_embeddings: bool = False
    max_tokens: int = 2000

class GraphQueryResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@router.post("/graph-query", response_model=GraphQueryResponse)
async def query_knowledge_graph(request: GraphQueryRequest):
    """Query the knowledge graph using the enhanced GraphQueryService"""
    try:
        logger.info(f"Graph query request for client: {request.client_id}")
        logger.info(f"Query: {request.slide_description[:100]}...")
        
        # Get knowledge graph service
        kg_service = get_kg_service(request.client_id)
        
        # Initialize LLM service
        from src.services.llm_service import LLMService
        llm_service = LLMService()
        
        # Initialize enhanced graph query service
        from src.services.graph_query_service import GraphQueryService
        query_service = GraphQueryService(
            knowledge_graph_service=kg_service,
            llm_service=llm_service
        )
        
        # Execute the query
        result = await query_service.query_graph_for_slide_content(
            slide_description=request.slide_description,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
            include_embeddings=request.include_embeddings,
            max_tokens=request.max_tokens
        )
        
        if "error" in result:
            return GraphQueryResponse(
                success=False,
                message=f"Query failed: {result['error']}"
            )
        
        return GraphQueryResponse(
            success=True,
            message="Graph query completed successfully",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Error in graph query: {e}")
        return GraphQueryResponse(
            success=False,
            message=f"Internal server error: {str(e)}"
        )

@router.get("/graph-query/stats/{client_id}")
async def get_graph_statistics(client_id: str):
    """Get statistics about the knowledge graph"""
    try:
        logger.info(f"Getting graph statistics for client: {client_id}")
        
        # Get knowledge graph service
        kg_service = get_kg_service(client_id)
        
        # Initialize enhanced graph query service
        from src.services.graph_query_service import GraphQueryService
        query_service = GraphQueryService(
            knowledge_graph_service=kg_service,
            llm_service=None  # No LLM needed for statistics
        )
        
        # Get statistics
        stats = await query_service.get_graph_statistics()
        
        if "error" in stats:
            return {
                "success": False,
                "error": stats["error"]
            }
        
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting graph statistics: {e}")
        return {
            "success": False,
            "error": str(e)
        }
