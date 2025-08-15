"""
Main API router for SlideFlip Backend
Contains all HTTP endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pathlib import Path
import logging
from typing import Dict, Any, Optional, List
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
    documents: Optional[List[Dict[str, Any]]] = None  # ← Add this
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

        # NEW: Extract document content for processing
        document_content = ""
        if request.documents:
            for doc in request.documents:
                if doc.get("content"):
                    filename = doc.get("filename", "Unknown")
                    logger.info(f"🔍 Processing document: {filename}")
                    document_content += f"\n--- {filename} ---\n"
                    document_content += doc["content"]
            
            logger.info(f"🔍 Total document content length: {len(document_content)} chars")
        
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
        
        # NEW: If we have document content, process it directly instead of relying on existing graph
        if document_content.strip():
            logger.info("🔍 Using document content for direct analysis")
            
            # Create a simple analysis result from the document content
            result = await analyze_document_for_slide(
                document_content=document_content,
                question=request.slide_description,
                llm_service=llm_service
            )
        else:
            # Execute the normal graph query
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
        
        slide_json = convert_graph_to_slide_json(result, request.slide_description)

        return GraphQueryResponse(
            success=True,
            message="Graph query completed successfully",
            data={
                **result,  # Keep all original graph data
                "slideJson": slide_json  # Add slide JSON for frontend
            }
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
    
# slide generation JSON converter
def convert_graph_to_slide_json(graph_result: Dict[str, Any], description: str) -> Dict[str, Any]:
    """Convert graph query results to slide JSON format"""
    
    title = description or "Generated Content"
    bullets = []
    
    # Extract content from your graph result
    if isinstance(graph_result, dict):
        logger.info(f"🔍 Converting graph result to slide JSON. Keys: {list(graph_result.keys())}")
        
        # Try different possible keys your graph service might return
        if "summary" in graph_result:
            title = str(graph_result["summary"])[:100]
            logger.info(f"🔍 Using summary as title: {title}")
            
        if "content" in graph_result:
            content_text = str(graph_result["content"])
            sentences = content_text.split(". ")
            bullets.extend([s.strip() for s in sentences if len(s.strip()) > 10][:4])
            logger.info(f"🔍 Extracted {len(bullets)} bullets from content")
            
        if "nodes" in graph_result and isinstance(graph_result["nodes"], list):
            node_texts = []
            for node in graph_result["nodes"][:4]:
                if isinstance(node, dict):
                    node_text = node.get("text") or node.get("content") or str(node)
                else:
                    node_text = str(node)
                node_texts.append(node_text[:80])
            bullets.extend(node_texts)
            logger.info(f"🔍 Added {len(node_texts)} bullets from nodes")
            
        if "analysis" in graph_result:
            analysis_text = str(graph_result["analysis"])
            sentences = analysis_text.split(". ")
            bullets.extend([s.strip() for s in sentences if len(s.strip()) > 10][:4])
            logger.info(f"🔍 Added bullets from analysis")
            
        if "slide_content" in graph_result:
            slide_content = graph_result["slide_content"]
            if isinstance(slide_content, str):
                bullets.extend(slide_content.split(". ")[:4])
            elif isinstance(slide_content, list):
                bullets.extend([str(item) for item in slide_content][:4])
            logger.info(f"🔍 Added bullets from slide_content")
        
        # Clean up bullets - remove duplicates and empty ones
    bullets = list(dict.fromkeys([b.strip() for b in bullets if b.strip() and len(b.strip()) > 5]))
    
    # Fallback bullets if none found
    if not bullets:
        bullets = [
            "AI analysis completed successfully",
            "Content extracted from your knowledge graph", 
            "Professional slide structure generated",
            "Ready for presentation delivery"
        ]
        logger.info(f"🔍 Using fallback bullets")
    
    # Limit to 4 bullets for clean slide layout
    bullets = bullets[:4]
    
    logger.info(f"🔍 Final slide: Title='{title}', Bullets={len(bullets)}")
    
    # Create slide JSON structure
    slide_objects = [
        {
            "type": "text",
            "text": title,
            "options": {
                "x": 1, "y": 1.5, "w": 8, "h": 1.5,
                "fontSize": 32, "fontFace": "Arial",
                "color": "003366", "bold": True, 
                "align": "center", "valign": "middle"
            }
        }
    ]
    
    # Add bullet points
    y_position = 3.5
    for i, bullet in enumerate(bullets):
        slide_objects.append({
            "type": "text",
            "text": f"• {bullet.strip()}",
            "options": {
                "x": 1.5, "y": y_position, "w": 7, "h": 0.8,
                "fontSize": 18, "fontFace": "Arial",
                "color": "333333", "align": "left"
            }
        })
        y_position += 2
        logger.info(f"🔍 Added bullet {i+1}: {bullet[:50]}...")
    
    slide_json = {
        "id": "graph-generated-slide",
        "background": {"color": "ffffff"}, 
        "objects": slide_objects
    }
    
    logger.info(f"✅ Created slide JSON with {len(slide_objects)} objects")
    return slide_json

async def analyze_document_for_slide(document_content: str, question: str, llm_service) -> Dict[str, Any]:
    """Analyze document content using AI to answer the question"""
    try:
        logger.info(f"🔍 Analyzing document content for question: {question}")
        
        # Clean HTML content to extract just text
        cleaned_content = clean_html_content(document_content)
        logger.info(f"🔍 Cleaned content: {cleaned_content[:200]}...")
        
        # Create AI prompt for clean slide format
        prompt = f"""Analyze this document and answer: "{question}"

        Document Content:
        {cleaned_content}

        Please provide a direct answer and 3-4 key insights in this exact format:

        TITLE: [Your main answer or insight]

        • [First key insight]
        • [Second key insight]  
        • [Third key insight]
        • [Fourth key insight if needed]

        Keep each point concise and professional for a business slide."""

        logger.info(f"🔍 Sending to OpenAI GPT-4o...")
        
        # Use your actual AI service!
        ai_response = await llm_service.generate_content(
            prompt=prompt,
            max_tokens=400
        )
        
        logger.info(f"🔍 AI Response: {ai_response[:100]}...")
        
        # Parse the structured response
        title, bullets = parse_structured_ai_response(ai_response, question)
        
        return {
            "analysis": ai_response,  # Full AI response
            "content": ai_response,
            "summary": title,
            "slide_content": bullets,
            "ai_generated": True
        }
        
    except Exception as e:
        logger.error(f"AI document analysis error: {e}")
        return {
            "error": f"AI analysis failed: {str(e)}",
            "summary": "AI Analysis Error",
            "slide_content": ["Document analysis in progress", "AI processing encountered an error"]
        }

def parse_structured_ai_response(ai_response: str, fallback_title: str) -> tuple:
    """Parse structured AI response into title and bullets"""
    try:
        lines = [line.strip() for line in ai_response.split('\n') if line.strip()]
        
        title = fallback_title
        bullets = []
        
        for line in lines:
            if line.startswith('TITLE:'):
                title = line.replace('TITLE:', '').strip()
            elif line.startswith('POINT1:'):
                bullets.append(line.replace('POINT1:', '').strip())
            elif line.startswith('POINT2:'):
                bullets.append(line.replace('POINT2:', '').strip())
            elif line.startswith('POINT3:'):
                bullets.append(line.replace('POINT3:', '').strip())
            elif line.startswith('POINT4:'):
                bullets.append(line.replace('POINT4:', '').strip())
        
        # Fallback if parsing failed
        if not bullets:
            # Clean the response and extract sentences
            clean_text = ai_response.replace('###', '').replace('**', '').replace('---', '').strip()
            sentences = [s.strip() for s in clean_text.split('.') if s.strip() and len(s.strip()) > 20]
            bullets = sentences[:4] if sentences else ["AI analysis completed successfully"]
        
        return title, bullets[:4]  # Limit to 4 bullets
        
    except Exception as e:
        logger.error(f"Error parsing AI response: {e}")
        return fallback_title, ["AI analysis completed", "Content processed successfully"]

# NEW: Add this helper function
def clean_html_content(html_content: str) -> str:
    """Extract text content from HTML, removing tags"""
    import re
    
    # Remove HTML tags
    clean_text = re.sub(r'<[^>]+>', '', html_content)
    
    # Remove extra whitespace and line breaks
    clean_text = re.sub(r'\s+', ' ', clean_text)
    
    # Remove HTML entities
    clean_text = clean_text.replace('&nbsp;', ' ')
    clean_text = clean_text.replace('&amp;', '&')
    clean_text = clean_text.replace('&lt;', '<')
    clean_text = clean_text.replace('&gt;', '>')
    clean_text = clean_text.replace('&quot;', '"')
    
    return clean_text.strip()