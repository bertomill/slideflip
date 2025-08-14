# Slideo Backend

A Python FastAPI backend service for AI-powered presentation generation with real-time WebSocket communication, knowledge graph processing, and multi-format document parsing.

## Architecture Overview

This backend provides a **FastAPI-based web service** with **WebSocket support** for real-time communication with the Next.js frontend. It handles document processing, AI-powered content generation, and slide creation workflows.

### Tech Stack
- **Framework**: FastAPI with Uvicorn ASGI server
- **Language**: Python 3.12+ with async/await patterns
- **Package Manager**: `uv` (modern Python package management)
- **WebSocket**: Native FastAPI WebSocket support
- **AI Integration**: OpenAI GPT models with structured prompts
- **Document Processing**: Multi-format support (PDF, DOCX, TXT, MD)
- **Knowledge Graphs**: NetworkX with optional clustering
- **Templates**: YAML-based prompts with Jinja2 rendering

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── start.py               # Alternative startup script with environment detection
├── requirements.txt        # Python dependencies
├── pyproject.toml         # uv project configuration
├── .env                   # Environment configuration

src/                       # Main source code
├── core/                  # Core system components
│   ├── config.py          # Settings and configuration
│   ├── websocket_manager.py # WebSocket connection management
│   ├── prompt_manager.py   # YAML prompt template system
│   ├── initialization.py   # Service initialization and validation
│   └── monitoring.py      # Performance and usage tracking

├── agents/                # AI agent implementations
│   ├── base_agent.py      # Base agent class with LangGraph integration
│   ├── content_creator_agent.py # Enhanced content generation
│   └── web_research_agent.py    # Web research capabilities

├── handlers/              # WebSocket message handlers
│   ├── file_handler.py    # File upload and processing
│   ├── slide_handler.py   # Slide generation workflows
│   └── kg_message_handlers.py # Knowledge graph operations

├── models/                # Pydantic data models
│   └── message_models.py  # WebSocket message types and validation

├── prompts/               # YAML-based prompt templates
│   ├── slide_generation/  # Slide generation prompts
│   ├── research_agents/   # Research and web search prompts
│   └── color_palette/     # Color scheme generation

├── routers/               # FastAPI route handlers
│   ├── websocket.py       # Main WebSocket endpoint
│   ├── api.py            # HTTP API endpoints
│   ├── debug.py          # Development and debugging endpoints
│   └── monitoring.py     # Health checks and metrics

├── services/              # Business logic services
│   ├── file_service.py       # File processing and storage
│   ├── document_parser.py    # Document text extraction
│   ├── llm_service.py        # OpenAI integration and content generation
│   ├── slide_service.py      # Slide creation and HTML generation
│   ├── knowledge_graph_service.py # Graph-based document analysis
│   ├── kg_task_manager.py    # Background knowledge graph processing
│   ├── agentic_research_service.py # LangGraph-based research workflows
│   └── theme_service.py      # Theme and styling management

├── workflows/             # LangGraph workflow definitions
│   ├── slide_generation_workflow.py # Main slide generation pipeline
│   └── research_workflow.py         # Research integration workflow

└── utils/                 # Utility functions and helpers

uploads/                   # Client file storage (created at runtime)
├── client_{client_id}/    # Per-client upload folders
└── ...

kg/                        # Knowledge graph data storage
├── client_{client_id}/    # Per-client graph data
│   ├── graphs/           # NetworkX .gml files
│   ├── graph_data/       # JSON graph data
│   └── clustered_graphs/ # Processed graph clusters
└── ...

tests/                     # Test suite
├── test_comprehensive_suite.py # Main test suite
├── test_phase1.py            # Core functionality tests
├── test_phase2_integration.py # WebSocket integration tests
└── test-backend.sh          # Backend test script
```

## Key Features & Implementation

### 1. WebSocket Communication (`/src/routers/websocket.py`)

**Endpoint**: `ws://localhost:8000/ws/{client_id}`

**5-Step Workflow State Machine**:
```python
class WorkflowState(Enum):
    IDLE = "idle"
    UPLOADING = "uploading"
    THEME_SELECTING = "theme_selecting"
    CONTENT_PLANNING = "content_planning"
    SLIDE_GENERATING = "slide_generating"
    COMPLETED = "completed"
    ERROR = "error"
```

**Message Processing**:
- **Connection Management**: Up to 50 concurrent connections
- **State Validation**: Prevents concurrent operations per client
- **Progress Updates**: Real-time progress notifications
- **Error Handling**: Structured error codes and messages

**Supported Message Types**:
```python
# Inbound (Frontend → Backend)
- file_upload          # Document upload and processing
- theme_selection      # Theme and styling configuration
- content_planning     # Content structure generation
- slide_generation     # Final slide creation
- research_request     # Web research integration

# Outbound (Backend → Frontend)
- progress_update      # Processing progress
- slide_generation_complete # Generated slide data
- content_plan_response    # AI-generated content plan
- error               # Error notifications
```

### 2. File Processing Pipeline (`/src/services/`)

**File Service** (`file_service.py`):
- **Multi-format Support**: PDF, DOCX, TXT, MD, PPTX, HTML
- **Base64 Decoding**: WebSocket-compatible file transmission
- **Client Isolation**: Per-client upload directories
- **Content Extraction**: Text and metadata extraction

**Document Parser** (`document_parser.py`):
- **PDF Processing**: `pdfminer.six` for robust text extraction
- **DOCX Processing**: `python-docx` for Word documents
- **Fallback Mechanisms**: Multiple extraction strategies
- **LangChain Integration**: Advanced document chunking and processing

**Upload Flow**:
1. WebSocket receives base64-encoded file
2. File validation and type detection
3. Content extraction (text, images, metadata)
4. Optional knowledge graph generation
5. Progress updates sent to frontend

### 3. AI Integration & Content Generation (`/src/services/llm_service.py`)

**OpenAI Integration**:
```python
class LLMService:
    # GPT-4 primary, GPT-4o-mini fallback
    async def generate_content_from_files(client_id: str) -> ContentPlan
    async def generate_slide_html(content_plan: dict, theme: dict) -> str
    # Robust JSON parsing with fallback methods
    # Token usage tracking and monitoring
```

**Prompt Management System** (`/src/core/prompt_manager.py`):
- **YAML Templates**: Structured prompts with variable validation
- **Jinja2 Rendering**: Dynamic prompt generation
- **Template Categories**: slide_generation, research_agents, color_palette
- **Usage Metrics**: Token counting and success rate tracking

**Content-First Architecture**:
- All content generated from uploaded files, not themes
- Themes only affect visual styling, not content structure
- Research integration enhances existing content

### 4. Knowledge Graph Processing (Optional)

**Knowledge Graph Service** (`/src/services/knowledge_graph_service.py`):
- **NetworkX Graphs**: Entity and relationship extraction
- **DBSCAN Clustering**: Graph node clustering for content organization
- **Background Processing**: Async task management
- **Development Flag**: `SKIP_KNOWLEDGE_GRAPH=True` for faster development

**Graph Storage**:
- **Client Isolation**: Per-client graph directories
- **File Formats**: NetworkX .gml files + JSON data
- **Clustering Results**: Processed graph clusters for content organization

### 5. Research Integration (`/src/services/agentic_research_service.py`)

**LangGraph Workflows**:
- **Web Research Agent**: Tavily API integration for web search
- **Search Query Optimization**: AI-powered query enhancement
- **Research Synthesis**: Combines web research with document content

**Research APIs**:
- **Tavily**: Primary web search API
- **Firecrawl**: Web scraping capabilities
- **Optional Integration**: Research enhances but doesn't replace document content

## Development Commands

### Using `uv` (Recommended)

```bash
# Setup
uv venv                    # Create virtual environment
uv sync                    # Install dependencies from pyproject.toml

# Development
uv run python main.py      # Start backend server
uv run python start.py     # Alternative startup with environment detection

# Testing
uv run python -m pytest tests/                    # Run full test suite
uv run python -m pytest tests/test_phase1.py     # Run specific test file
uv run python test_content_creator_agent.py      # Test specific agent

# Scripts
./test-backend.sh          # Backend test script (uses uv run)
```

### Traditional Python (Alternative)

```bash
# Setup
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Development
python main.py
python start.py

# Testing
python -m pytest tests/
```

### Full Application Startup

```bash
# From project root - starts both frontend and backend
./start-app-robust.sh
```

## Environment Configuration

### Required Environment Variables (`backend/.env`)

```bash
# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=True

# Security
SECRET_KEY=your_secret_key_here

# File Processing
UPLOAD_DIR=uploads
MAX_FILE_SIZE=52428800  # 50MB limit

# AI Integration (Required)
OPENAI_API_KEY=your_openai_api_key

# Optional Services
TAVILY_API_KEY=your_tavily_key  # For web research
FIRECRAWL_API_KEY=your_firecrawl_key

# Development Settings
SKIP_KNOWLEDGE_GRAPH=True  # Skip KG processing for faster development
LOG_LEVEL=INFO
```

## API Endpoints

### WebSocket
- **`WS /ws/{client_id}`**: Main WebSocket endpoint for real-time communication

### HTTP API
- **`GET /`**: Root endpoint with service information
- **`GET /health`**: Health check endpoint
- **`GET /docs`**: Interactive API documentation (Swagger UI)
- **`GET /debug/*`**: Development and debugging endpoints
- **`POST /api/*`**: Various API endpoints for specific operations

### Development Endpoints
- **`GET /debug/clients`**: List active WebSocket connections
- **`GET /debug/kg-status/{client_id}`**: Knowledge graph processing status
- **`POST /debug/force-clustering/{client_id}`**: Force knowledge graph clustering

## Testing

### Test Structure

```bash
tests/
├── test_comprehensive_suite.py     # Main test suite with all functionality
├── test_phase1.py                  # Core service tests
├── test_phase2_integration.py      # WebSocket integration tests
├── test_phase3_performance.py      # Performance and load testing
└── test-backend.sh                 # Shell script for backend testing
```

### Running Tests

```bash
# Full test suite
uv run python -m pytest tests/

# Specific test categories
uv run python -m pytest tests/test_phase1.py          # Core functionality
uv run python -m pytest tests/test_phase2_integration.py # WebSocket tests

# Backend test script (includes server startup)
cd backend && ./test-backend.sh

# Agent-specific testing
uv run python test_content_creator_agent.py
```

### Test Coverage

- **Unit Tests**: Individual service and component testing
- **Integration Tests**: WebSocket message flow testing
- **Performance Tests**: Concurrent client testing
- **End-to-End Tests**: Complete workflow validation

## Deployment

### Development

```bash
# Using uv (recommended)
cd backend
uv run python main.py

# Traditional method
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Production

```bash
# Using uv
uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Docker (if needed)
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Architecture Patterns

### Design Principles

1. **Content-First**: All slide content generated from uploaded documents
2. **Theme-as-Styling**: Themes only affect visual presentation, not content
3. **Service Separation**: Clear boundaries between file processing, AI generation, and output
4. **Async-First**: Async/await throughout for better performance
5. **Graceful Fallbacks**: Multiple fallback mechanisms for reliability

### Key Architectural Decisions

**WebSocket State Machine**: Prevents concurrent operations and ensures workflow integrity

**Content vs Theme Separation**: Content generated from files, themes only affect styling

**Optional Knowledge Graph**: Can be disabled for faster development cycles

**Prompt Template System**: YAML-based templates with Jinja2 for maintainable AI prompts

**Service Layer Architecture**: Clear separation of concerns with dependency injection

## Performance & Monitoring

### Performance Features
- **Async Processing**: Non-blocking file and AI operations
- **Connection Pooling**: Efficient WebSocket connection management
- **Memory Management**: Streaming file processing for large documents
- **Background Tasks**: Knowledge graph processing doesn't block main workflow

### Monitoring
- **Health Checks**: `/health` endpoint for service monitoring
- **Connection Statistics**: Active WebSocket connection tracking
- **AI Usage Metrics**: Token usage and cost tracking
- **Performance Metrics**: Processing time measurement

## Troubleshooting

### Common Issues

**AI Service Errors**:
- Check `OPENAI_API_KEY` is set and valid
- Verify API quota and rate limits
- Check network connectivity to OpenAI API

**File Processing Issues**:
- Ensure upload directory exists and is writable
- Check file size limits (50MB default)
- Verify file format is supported

**WebSocket Connection Issues**:
- Check firewall settings for WebSocket connections
- Verify frontend WebSocket URL configuration
- Monitor connection health with heartbeat system

**Knowledge Graph Processing**:
- Set `SKIP_KNOWLEDGE_GRAPH=True` for development
- Check background task processing status
- Verify NetworkX and scikit-learn dependencies

### Development Tips

**Fast Development**: Set `SKIP_KNOWLEDGE_GRAPH=True` to skip graph processing

**Debugging**: Use `/debug/*` endpoints to inspect service state

**Testing**: Use `./test-backend.sh` for comprehensive backend testing

**Logging**: Set `LOG_LEVEL=DEBUG` for detailed logging output