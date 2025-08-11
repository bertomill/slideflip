# SlideFlip Backend

A Python-based backend service for the SlideFlip presentation generator with WebSocket communication, AI integration, knowledge graph processing, and advanced file processing capabilities.

## 🚀 Overview

The SlideFlip backend is a FastAPI application that provides:
- **Real-time WebSocket Communication**: Bidirectional communication with frontend
- **AI-Powered Content Processing**: LLM integration for slide generation
- **Knowledge Graph Processing**: Advanced document analysis and entity extraction
- **Multi-format File Support**: PDF, DOCX, TXT, MD file processing
- **Advanced Slide Generation**: Professional presentation creation
- **Content Storage & Management**: Structured data storage and retrieval
- **HTML Feature Processing**: Rich content extraction and processing

## ✨ Features

### Core Features
- **WebSocket Communication**: Real-time bidirectional communication with frontend
- **File Upload & Processing**: Handle multiple file types with validation
- **AI-Powered Slide Generation**: LLM integration for intelligent content processing
- **Knowledge Graph Generation**: Extract entities, relationships, and facts from documents
- **Content Storage**: Structured storage with metadata management
- **HTML Processing**: Advanced HTML parsing and feature extraction
- **Image Extraction**: Automatic image extraction from documents
- **Theme Customization**: Professional slide themes and layouts

### Technical Features
- **Async Processing**: Non-blocking file and slide processing
- **Client Management**: Track multiple client connections and their data
- **Error Handling**: Comprehensive error handling and recovery
- **Security**: File validation, size limits, and sanitization
- **Performance**: Optimized for high-throughput processing
- **Monitoring**: Health checks and performance metrics

## 🏗️ Project Structure

```
backend/
├── main.py                 # Main application entry point
├── start.py               # Alternative startup script
├── requirements.txt        # Python dependencies
├── README.md              # This comprehensive documentation
├── src/
│   ├── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py      # Application settings
│   │   └── websocket_manager.py  # WebSocket connection management
│   ├── models/
│   │   ├── __init__.py
│   │   └── message_models.py     # Pydantic models for messages
│   ├── services/
│   │   ├── __init__.py
│   │   ├── file_service.py       # File handling operations
│   │   ├── llm_service.py        # LLM integration service
│   │   ├── ppt_service.py        # PowerPoint generation
│   │   ├── slide_service.py      # Slide generation logic
│   │   ├── knowledge_graph_service.py  # Knowledge graph processing
│   │   └── kg_task_manager.py    # Knowledge graph task management
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── file_handler.py       # File operation handlers
│   │   ├── slide_handler.py      # Slide operation handlers
│   │   └── kg_message_handlers.py # Knowledge graph message handlers
│   └── utils/
│       ├── __init__.py
│       └── helpers.py            # Utility functions
├── tests/                 # Test files
├── kg/                    # Knowledge graph data storage
├── output/                # Generated output files
├── temp/                  # Temporary files
└── uploads/               # Uploaded files storage
```

## 🛠️ Installation

### Prerequisites
- Python 3.11+
- pip or conda
- Virtual environment (recommended)

### 1. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Up Environment Variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Run the Backend
```bash
# Development mode
python main.py

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🔌 API Endpoints

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health information

### WebSocket
- `WS /ws/{client_id}` - WebSocket connection endpoint

### Knowledge Graph API
- `POST /api/embeddings/generate` - Generate embeddings for a graph
- `POST /api/embeddings/load` - Load existing embeddings
- `GET /api/embeddings/stats/{client_id}` - Get embedding statistics
- `POST /api/embeddings/similarity` - Find similar nodes/edges
- `POST /api/embeddings/regenerate` - Regenerate embeddings
- `DELETE /api/embeddings/{client_id}` - Clear embeddings from memory

## 📡 WebSocket Communication

### Connection
Connect to the WebSocket endpoint with a unique client ID:
```
ws://localhost:8000/ws/{client_id}
```

### Message Types

#### Client to Server Messages

1. **File Upload**:
   ```json
   {
     "type": "file_upload",
     "data": {
       "filename": "document.pdf",
       "content": "base64_encoded_content",
       "file_type": "application/pdf",
       "file_size": 1024000
     }
   }
   ```

2. **Slide Description**:
   ```json
   {
     "type": "slide_description",
     "data": {
       "description": "Create a professional slide about quarterly sales results"
     }
   }
   ```

3. **Process Slide**:
   ```json
   {
     "type": "process_slide",
     "data": {
       "options": {
         "theme": "professional",
         "layout": "standard"
       }
     }
   }
   ```

4. **Knowledge Graph Operations**:
   ```json
   {
     "type": "kg_status",
     "data": {}
   }
   ```

5. **Ping**:
   ```json
   {
     "type": "ping",
     "data": {}
   }
   ```

#### Server to Client Messages

1. **Connection Established**:
   ```json
   {
     "type": "connection_established",
     "data": {
       "client_id": "uuid",
       "message": "Connected to SlideFlip Backend",
       "timestamp": "2024-01-01T12:00:00"
     }
   }
   ```

2. **File Upload Success**:
   ```json
   {
     "type": "file_upload_success",
     "data": {
       "filename": "document.pdf",
       "file_path": "/uploads/20240101_120000_abc123_document.pdf",
       "file_size": 1024000,
       "file_type": "application/pdf"
     }
   }
   ```

3. **Processing Status**:
   ```json
   {
     "type": "processing_status",
     "data": {
       "status": "analyzing",
       "message": "Analyzing uploaded files...",
       "progress": 0.5
     }
   }
   ```

4. **Knowledge Graph Status**:
   ```json
   {
     "type": "kg_status_response",
     "data": {
       "processing_status": {
         "pending_tasks": 0,
         "processed_files": 3,
         "clustering_needed": false
       },
       "graph_statistics": {
         "total_nodes": 150,
         "total_edges": 300,
         "entity_nodes": 100,
         "fact_nodes": 50
       },
       "efficiency_status": {
         "clustered_graph_exists": true,
         "can_skip_processing": true,
         "file_graphs_loaded": 3
       }
     }
   }
   ```

## 🧠 Knowledge Graph System

### Overview
The knowledge graph system efficiently processes multiple files and creates a unified, clustered knowledge graph with intelligent caching and processing optimization.

### Core Architecture

#### File Processing Flow
```
File Upload → Check if already processed → Check if clustered graph exists → Process or Skip
```

- **Individual File Processing**: Each file is processed independently to extract entities, relationships, and facts
- **Graph Generation**: Individual NetworkX graphs are created for each file
- **Clustering**: All individual graphs are clustered into a unified knowledge graph
- **Persistence**: Both individual and clustered graphs are saved to disk

#### Processing Optimization
- **Skip Processing When Possible**: Files already processed or clustered graphs existing
- **File Deduplication**: Files tracked by filename to avoid reprocessing
- **Smart Reconnection**: Existing graphs loaded automatically when clients reconnect

### Storage Structure
```
kg/
├── {client_id}/
│   ├── graph_data/           # JSON files with extracted knowledge
│   ├── graphs/               # Individual NetworkX graphs (.gml)
│   ├── clustered_graphs/     # Final clustered graphs (.gml)
│   └── embeddings/           # Graph embeddings (.json)
```

### Key Components

#### KnowledgeGraphService
- **Main Service**: Handles individual file processing and graph generation
- **Chunking**: Breaks large files into manageable chunks for LLM processing
- **Parallel Processing**: Processes chunks concurrently for better performance
- **Graph Merging**: Combines chunk results with weighted relationships

#### KnowledgeGraphTaskManager
- **Task Coordination**: Manages processing tasks across multiple files
- **Client Isolation**: Each client has isolated processing state
- **Progress Tracking**: Monitors file processing and clustering status
- **Efficiency Checks**: Determines when processing can be skipped

### Knowledge Graph Processing
- **Chunk Processing**: Uses LLM service to extract knowledge from text chunks
- **Entity Clustering**: Groups similar entities across files using TF-IDF and DBSCAN
- **Relationship Weighting**: Calculates relationship importance based on entity frequency
- **Graph Clustering**: Combines multiple file graphs into a unified structure

## 🤖 AI Integration

### LLM Service
The backend integrates with Large Language Models for intelligent content processing:

#### Features
- **Content Analysis**: Extract key topics and themes
- **Slide Generation**: Create professional slide content
- **Content Summarization**: Generate concise summaries
- **Topic Extraction**: Identify main topics and subtopics
- **Structure Recommendations**: Suggest optimal slide layouts
- **Knowledge Extraction**: Extract entities, relationships, and facts from documents

#### Configuration
```python
# LLM service configuration
LLM_PROVIDER = "openai"  # or "anthropic", "local"
LLM_MODEL = "gpt-4"      # Model selection
LLM_TEMPERATURE = 0.7    # Creativity level
LLM_MAX_TOKENS = 2000    # Response length
```

#### Usage Examples
```python
from src.services.llm_service import LLMService

llm_service = LLMService()

# Generate slide description
description = await llm_service.generate_description(content)

# Analyze content structure
analysis = await llm_service.analyze_content(files)

# Generate slide content
slides = await llm_service.generate_slides(description, theme)

# Extract knowledge from text
knowledge = await llm_service.extract_knowledge(text_chunk)
```

## 📁 File Processing

### Supported File Types
- **PDF Documents**: Text and image extraction
- **Word Documents (DOCX)**: Full content parsing
- **Text Files (TXT)**: Plain text processing
- **Markdown Files (MD)**: Structured content parsing
- **PowerPoint Files (PPTX)**: Slide content extraction

### File Processing Pipeline
1. **Upload Validation**: File type, size, and content validation
2. **Content Extraction**: Text and image extraction from files
3. **Content Analysis**: AI-powered content analysis
4. **Knowledge Extraction**: Entity and relationship extraction
5. **Structure Generation**: Slide structure creation
6. **Content Generation**: AI-powered slide content generation
7. **Formatting**: Theme application and formatting

### File Size Limits
- **Maximum file size**: 50MB per file
- **Total upload limit**: Configurable per client
- **Processing timeout**: Configurable processing limits

## 🎨 Slide Generation

### Slide Types
- **Title Slides**: Professional title pages
- **Content Slides**: Text and image slides
- **Summary Slides**: Key points and conclusions
- **Chart Slides**: Data visualization slides
- **Image Slides**: Image-focused presentations

### Theme System
- **Professional**: Corporate and business themes
- **Creative**: Artistic and design-focused themes
- **Academic**: Educational and research themes
- **Technical**: Technical and engineering themes

### Layout Options
- **Standard**: Traditional slide layouts
- **Modern**: Contemporary design layouts
- **Minimal**: Clean and simple layouts
- **Creative**: Artistic and unique layouts

## 🔍 Knowledge Graph Embeddings

### Overview
Embeddings are numerical representations of text that capture semantic meaning, enabling similarity search and semantic analysis of knowledge graph elements.

### Features
- **Automatic Embedding Generation**: Embeddings generated automatically when creating clustered graphs
- **Persistent Storage**: Embeddings saved separately in JSON format
- **Memory Efficient**: Stored separately from graph to avoid memory issues
- **Similarity Search**: Built-in methods to find similar nodes and edges
- **Flexible Integration**: Easy to merge embedding information with graphs when needed

### Dependencies
```bash
pip install sentence-transformers==2.2.2
```

### How It Works

#### Embedding Model
- Uses `all-MiniLM-L6-v2` model from Sentence Transformers
- Provides 384-dimensional embeddings
- Lightweight and fast with good semantic understanding

#### Text Representation
**Nodes**: Combines node type, name, description, content, and category information
**Edges**: Combines relationship type, edge type, weight, confidence, and node names

#### Storage Strategy
- Embeddings stored separately from graph for memory efficiency
- JSON serialization for efficient storage and retrieval
- On-demand loading to optimize memory usage

### Usage Examples

#### Basic Usage
```python
from services.knowledge_graph_service import KnowledgeGraphService

# Initialize the service
kg_service = KnowledgeGraphService("your_client_id")

# Generate embeddings for the current graph
result = kg_service.generate_graph_embeddings()

# Save embeddings to disk
embeddings_path = await kg_service.save_embeddings()

# Load embeddings from disk
loaded = await kg_service.load_embeddings()
```

#### Similarity Search
```python
# Find nodes similar to a specific node
similar_nodes = kg_service.get_similar_nodes("node_id", top_k=5)

# Find edges similar to a specific edge
similar_edges = kg_service.get_similar_edges("source", "target", top_k=5)
```

### Performance Characteristics
- **Memory Usage**: Model ~90MB, embeddings ~1.5KB per element
- **Generation Speed**: 1-5ms per node, 1-3ms per edge
- **Storage Size**: ~450KB for typical graph (100 nodes + 200 edges)

## 💾 Content Storage

### Storage System
- **File-based Storage**: Local file system storage
- **Metadata Management**: Structured metadata storage
- **Content Indexing**: Searchable content indexing
- **Version Control**: Content version management

### Data Structure
```json
{
  "client_id": "uuid",
  "session_data": {
    "uploaded_files": [...],
    "processed_content": {...},
    "generated_slides": [...],
    "metadata": {...}
  },
  "timestamp": "2024-01-01T12:00:00"
}
```

## 🔧 Configuration

### Environment Variables
```env
# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=True
SECRET_KEY=your_secret_key

# File Processing
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=pdf,docx,txt,md,pptx

# WebSocket Configuration
PING_INTERVAL=30
PING_TIMEOUT=10

# Processing Configuration
MAX_PROCESSING_TIME=300
CONCURRENT_PROCESSES=4

# LLM Configuration
LLM_PROVIDER=openai
LLM_API_KEY=your_api_key
LLM_MODEL=gpt-4
LLM_TEMPERATURE=0.7

# Knowledge Graph Configuration
KNOWLEDGE_GRAPH_BASE_DIR=./kg
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

### Settings Class
The backend uses a `Settings` class for configuration management:

```python
from src.core.config import Settings

settings = Settings()
print(f"Server running on {settings.HOST}:{settings.PORT}")
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_slide_generation.py

# Run with coverage
python -m pytest --cov=src tests/
```

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **WebSocket Tests**: Real-time communication testing
- **File Processing Tests**: File upload and processing testing
- **LLM Tests**: AI integration testing
- **Knowledge Graph Tests**: Graph processing and embedding testing

### Test Files
- `test_backend.py`: Core backend functionality
- `test_content_storage.py`: Storage system testing
- `test_html_parsing.py`: HTML processing testing
- `test_llm_integration.py`: AI integration testing
- `test_slide_generation.py`: Slide generation testing
- `test_kg.py`: Knowledge graph functionality testing

## 🚀 Deployment

### Docker Deployment
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Setup
```bash
# Build Docker image
docker build -t slideflip-backend .

# Run container
docker run -p 8000:8000 slideflip-backend
```

### Production Considerations
- **Load Balancing**: Multiple backend instances
- **Database**: Consider persistent storage
- **Caching**: Redis for session management
- **Monitoring**: Application performance monitoring
- **Logging**: Structured logging with rotation

## 🔒 Security

### Security Features
- **File Validation**: Type, size, and content validation
- **Filename Sanitization**: Prevent path traversal attacks
- **Client Isolation**: Separate data per client
- **Error Sanitization**: Safe error message handling
- **Rate Limiting**: Request rate limiting
- **CORS Configuration**: Cross-origin resource sharing

### Best Practices
- **Environment Variables**: Secure configuration management
- **Input Validation**: All inputs validated and sanitized
- **Error Handling**: Graceful error handling without information leakage
- **Logging**: Secure logging without sensitive data exposure

## 📊 Performance

### Optimization Features
- **Async Processing**: Non-blocking file processing
- **Connection Pooling**: Efficient WebSocket management
- **Memory Management**: Efficient memory usage
- **Caching**: Intelligent caching strategies
- **Concurrent Processing**: Multi-process file handling
- **Smart Processing**: Skip unnecessary processing when possible

### Performance Monitoring
- **Health Checks**: Regular health monitoring
- **Connection Statistics**: WebSocket connection metrics
- **Processing Metrics**: File processing performance
- **Error Tracking**: Error rate monitoring
- **Knowledge Graph Metrics**: Graph processing and embedding statistics

## 🐛 Error Handling

### Error Categories
- **File Errors**: Upload and processing errors
- **Connection Errors**: WebSocket connection issues
- **Processing Errors**: Slide generation failures
- **Validation Errors**: Input validation failures
- **Knowledge Graph Errors**: Graph processing and embedding failures

### Error Response Format
```json
{
  "error": {
    "type": "file_upload_error",
    "message": "File size exceeds limit",
    "details": {
      "max_size": 52428800,
      "actual_size": 60000000
    },
    "timestamp": "2024-01-01T12:00:00"
  }
}
```

## 🔄 Development

### Adding New Features

1. **New Message Types**: Add models to `src/models/message_models.py`
2. **New Services**: Create service classes in `src/services/`
3. **New Handlers**: Create handler classes in `src/handlers/`
4. **New Endpoints**: Add routes to `main.py`

### Code Style
- **Type Hints**: Required for all functions
- **Docstrings**: Comprehensive documentation
- **Error Handling**: Proper exception handling
- **Testing**: Unit tests for new features

### Development Workflow
1. Create feature branch
2. Implement feature with tests
3. Run test suite
4. Update documentation
5. Submit pull request

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

### Development Guidelines
- Follow Python PEP 8 style guide
- Add comprehensive tests
- Update documentation
- Ensure backward compatibility
- Test with multiple file types

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

- **Documentation**: Check this README and code comments
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Email**: Contact the development team

---

**Made with ❤️ by the SlideFlip Team** 