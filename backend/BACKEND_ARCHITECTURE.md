# SlideFlip Backend Architecture Documentation

## Overview

The SlideFlip Backend is a FastAPI-based service that provides AI-powered slide generation capabilities. It uses WebSocket connections for real-time communication, OpenAI's GPT models for content generation, and a modular service architecture for maintainability.

## Project Structure

```
slideflip/backend/
├── main.py                          # Main application entry point
├── start.py                         # Startup script with dependency checks
├── setup_env.py                     # Environment setup utility
├── pyproject.toml                   # Project configuration and dependencies
├── requirements.txt                 # Python dependencies
├── src/                            # Source code directory
│   ├── core/                       # Core system components
│   ├── services/                   # Business logic services
│   ├── routers/                    # API endpoints and WebSocket handlers
│   ├── models/                     # Data models and schemas
│   ├── agents/                     # AI agent implementations
│   ├── workflows/                  # LangGraph workflow definitions
│   ├── handlers/                   # Request handlers
│   ├── prompts/                    # Prompt templates
│   └── utils/                      # Utility functions
├── uploads/                        # File upload storage
├── temp/                           # Temporary processing files
├── output/                         # Generated slide outputs
├── kg/                             # Knowledge graph storage
└── logs/                           # Application logs
```

## Core Files

### 1. main.py

**Purpose**: Main application entry point and FastAPI app configuration
**Status**: Active - Primary entry point

**Critical Functions**:

- `lifespan()`: Application lifecycle management
- `cleanup_stale_connections()`: WebSocket connection cleanup
- `websocket_endpoint_route()`: WebSocket endpoint handler

**Input/Output**:

- **Input**: WebSocket connections, HTTP requests
- **Output**: FastAPI application with configured routers and middleware

**Key Features**:

- Conditional knowledge graph imports based on `SKIP_KNOWLEDGE_GRAPH` setting
- Service registry initialization
- CORS middleware configuration
- Graceful shutdown handling

### 2. start.py

**Purpose**: Development startup script with dependency validation
**Status**: Active - Development utility

**Critical Functions**:

- `check_dependencies()`: Validates required packages
- `create_directories()`: Sets up necessary folders
- `start_backend()`: Launches the server

**Input/Output**:

- **Input**: None (script execution)
- **Output**: Server startup or error messages

### 3. setup_env.py

**Purpose**: Environment configuration setup utility
**Status**: Active - Development utility

**Critical Functions**:

- `setup_env_file()`: Creates/updates .env.local file
- `check_env_setup()`: Validates environment configuration

**Input/Output**:

- **Input**: User input for API keys
- **Output**: .env.local file with configuration

## Core System Components (src/core/)

### 1. config.py

**Purpose**: Application configuration and settings management
**Status**: Active - Core configuration

**Critical Functions**:

- `Settings` class: Centralized configuration management

**Key Settings**:

- Server configuration (HOST, PORT, DEBUG)
- File storage paths and limits
- WebSocket configuration
- OpenAI API settings
- Knowledge graph toggle (`SKIP_KNOWLEDGE_GRAPH`)

### 2. service_registry.py

**Purpose**: Singleton service management to prevent multiple initializations
**Status**: Active - Core service management

**Critical Functions**:

- `get_or_create_service()`: Service instantiation with singleton pattern
- `register_service()`: Service registration
- `get_service()`: Service retrieval

**Input/Output**:

- **Input**: Service name, service class, constructor arguments
- **Output**: Service instance (singleton)

### 3. improved_websocket_manager.py

**Purpose**: WebSocket connection management with improved error handling
**Status**: Active - Primary WebSocket manager

**Critical Functions**:

- `connect()`: Client connection handling
- `disconnect()`: Client disconnection
- `send_message()`: Message broadcasting
- `get_connection_stats()`: Connection statistics

**Input/Output**:

- **Input**: WebSocket connections, client IDs, messages
- **Output**: Connection management, message broadcasting

### 4. websocket_manager.py

**Purpose**: Legacy WebSocket manager (DEPRECATED)
**Status**: DEPRECATED - Replaced by improved_websocket_manager.py

**Note**: This file is kept for reference but should not be used in new code.

### 5. service_orchestrator.py

**Purpose**: Service coordination and workflow orchestration
**Status**: Active - Service coordination

**Critical Functions**:

- `orchestrate_slide_generation()`: Main workflow orchestration
- `handle_file_upload()`: File processing coordination
- `handle_content_planning()`: Content planning coordination

## Services (src/services/)

### 1. file_service.py

**Purpose**: File upload, storage, and text extraction
**Status**: Active - Core file management

**Critical Functions**:

- `save_file()`: File upload and storage
- `extract_text_from_file()`: Text extraction from various formats
- `get_client_files()`: Client-specific file retrieval
- `cleanup_client_files()`: File cleanup

**Input/Output**:

- **Input**: Filename, content (base64), file type, client ID
- **Output**: FileInfo object with metadata

**Supported Formats**: PDF, DOCX, TXT, MD, HTML

### 2. slide_service.py

**Purpose**: Slide generation orchestration and content management
**Status**: Active - Core slide generation

**Critical Functions**:

- `generate_slides()`: Main slide generation workflow
- `store_slide_description()`: User description storage
- `store_parsed_document_content()`: Document content storage
- `generate_slide_html()`: HTML slide generation

**Input/Output**:

- **Input**: Client ID, description, theme, uploaded files
- **Output**: Generated slides (HTML), processing results

### 3. llm_service.py

**Purpose**: OpenAI GPT integration for content generation
**Status**: Active - Primary AI service

**Critical Functions**:

- `generate_content_plan()`: Content planning with AI
- `generate_enhanced_content()`: Enhanced content generation
- `generate_standard_content()`: Standard content generation

**Input/Output**:

- **Input**: Description, research data, theme, uploaded files
- **Output**: Content plan, generated content, metadata

### 4. enhanced_llm_service.py

**Purpose**: Enhanced LLM service with additional capabilities
**Status**: Active - Enhanced AI features

**Critical Functions**:

- `generate_with_research()`: Research-enhanced content generation
- `generate_with_theme_integration()`: Theme-aware content generation

### 5. llm_service_backup.py

**Purpose**: Backup of previous LLM service implementation
**Status**: DEPRECATED - Backup file, not for production use

**Note**: This is a backup of the previous implementation and should not be used.

### 6. llm_service_v2_backup.py

**Purpose**: Backup of version 2 LLM service
**Status**: DEPRECATED - Backup file, not for production use

**Note**: This is a backup of version 2 implementation and should not be used.

### 7. knowledge_graph_service.py

**Purpose**: Knowledge graph construction and management
**Status**: Conditional - Based on SKIP_KNOWLEDGE_GRAPH setting

**Critical Functions**:

- `build_knowledge_graph()`: Graph construction from documents
- `query_graph()`: Graph querying capabilities
- `update_graph()`: Graph updates

**Input/Output**:

- **Input**: Document content, client ID
- **Output**: Knowledge graph, query results

### 8. theme_service.py

**Purpose**: Slide theme management and styling
**Status**: Active - Theme management

**Critical Functions**:

- `get_theme()`: Theme retrieval
- `apply_theme()`: Theme application to slides
- `get_available_themes()`: Available theme listing

**Input/Output**:

- **Input**: Theme name, slide content
- **Output**: Styled slides, theme information

### 9. ppt_service.py

**Purpose**: PowerPoint file generation and manipulation
**Status**: Active - PowerPoint support

**Critical Functions**:

- `create_presentation()`: PowerPoint creation
- `add_slide()`: Slide addition
- `save_presentation()`: File saving

**Input/Output**:

- **Input**: Slide content, theme information
- **Output**: PowerPoint file (.pptx)

## Routers (src/routers/)

### 1. improved_websocket.py

**Purpose**: Primary WebSocket message handling with service integration
**Status**: Active - Primary WebSocket router

**Critical Functions**:

- `handle_file_upload()`: File upload message handling
- `handle_content_planning()`: Content planning message handling
- `handle_slide_generation()`: Slide generation message handling

**Input/Output**:

- **Input**: WebSocket messages, client sessions
- **Output**: Processing results, progress updates

### 2. websocket.py

**Purpose**: Legacy WebSocket router (DEPRECATED)
**Status**: DEPRECATED - Replaced by improved_websocket.py

**Note**: This file contains the old implementation and should not be used.

### 3. api.py

**Purpose**: REST API endpoints for file and slide operations
**Status**: Active - REST API

**Critical Functions**:

- `upload_file()`: File upload endpoint
- `generate_slides()`: Slide generation endpoint
- `get_slide_status()`: Status retrieval endpoint

**Input/Output**:

- **Input**: HTTP requests, file uploads
- **Output**: JSON responses, file downloads

### 4. debug.py

**Purpose**: Debug endpoints for development and troubleshooting
**Status**: Active - Development tool

**Critical Functions**:

- `debug_client_folders()`: Client folder inspection
- `debug_processing_status()`: Processing status inspection
- `debug_service_status()`: Service status inspection

### 5. monitoring.py

**Purpose**: System monitoring and health checks
**Status**: Active - Monitoring

**Critical Functions**:

- `health_check()`: System health verification
- `get_metrics()`: Performance metrics retrieval
- `cleanup_old_data()`: Data cleanup

### 6. root.py

**Purpose**: Root endpoint and basic routing
**Status**: Active - Basic routing

## Models (src/models/)

### 1. websocket_messages.py

**Purpose**: WebSocket message schemas and validation
**Status**: Active - Message definitions

**Critical Models**:

- `ClientMessage`: Base message structure
- `FileUploadMessage`: File upload message
- `SlideGenerationMessage`: Slide generation message
- `ProcessingStatus`: Processing status enumeration

### 2. message_models.py

**Purpose**: Data models for application entities
**Status**: Active - Data models

**Critical Models**:

- `FileInfo`: File metadata structure
- `SlideData`: Slide content structure
- `ProcessingResult`: Processing result structure

## Agents (src/agents/)

### 1. content_creator_agent.py

**Purpose**: AI agent for content creation using LangGraph workflows
**Status**: Active - AI content generation

**Critical Functions**:

- `create_content()`: Content creation with workflows
- `_create_fallback_content()`: Fallback content generation

**Input/Output**:

- **Input**: Uploaded content, user description, theme info
- **Output**: Generated content, metadata

### 2. web_research_agent.py

**Purpose**: Web research capabilities for content enhancement
**Status**: Active - Research functionality

**Critical Functions**:

- `research_topic()`: Topic research
- `_should_trigger_deep_research()`: Research depth decision

### 3. base_agent.py

**Purpose**: Base agent class with common functionality
**Status**: Active - Base class

## Workflows (src/workflows/)

### 1. slide_generation_workflow.py

**Purpose**: LangGraph workflow for slide generation
**Status**: Active - Workflow orchestration

**Critical Functions**:

- `create_workflow()`: Workflow construction
- `content_planner()`: Content planning node
- `slide_generator()`: Slide generation node

**Input/Output**:

- **Input**: Workflow state with all parameters
- **Output**: Generated slides, processing metadata

### 2. content_creation_workflow.py

**Purpose**: LangGraph workflow for content creation
**Status**: Active - Content workflow

**Critical Functions**:

- `create_content()`: Content creation workflow
- `content_analyzer()`: Content analysis node
- `content_generator()`: Content generation node

### 3. research_workflow.py

**Purpose**: Research workflow for content enhancement
**Status**: Active - Research workflow

## Deprecated Components

### 1. Legacy WebSocket Manager

- **File**: `src/core/websocket_manager.py`
- **Replacement**: `src/core/improved_websocket_manager.py`
- **Reason**: Improved error handling and service integration

### 2. Legacy WebSocket Router

- **File**: `src/routers/websocket.py`
- **Replacement**: `src/routers/improved_websocket.py`
- **Reason**: Better message handling and service integration

### 3. Backup LLM Services

- **Files**:
  - `src/services/llm_service_backup.py`
  - `src/services/llm_service_v2_backup.py`
- **Replacement**: `src/services/llm_service.py`
- **Reason**: Current implementation with improved error handling

## Critical Functions Summary

### File Processing

- `FileService.save_file()`: Handles file uploads and storage
- `FileService.extract_text_from_file()`: Extracts text from various file formats
- `FileService.get_client_files()`: Retrieves client-specific files

### Content Generation

- `LLMService.generate_content_plan()`: Creates content plans using AI
- `SlideService.generate_slides()`: Orchestrates slide generation workflow
- `ContentCreatorAgent.create_content()`: AI agent for content creation

### WebSocket Communication

- `ImprovedWebSocketManager.connect()`: Manages client connections
- `ImprovedWebSocketManager.send_message()`: Broadcasts messages to clients
- `WebSocketMessageHandler.handle_file_upload()`: Processes file upload messages

### Workflow Orchestration

- `SlideGenerationWorkflow.create_workflow()`: Constructs slide generation workflow
- `ServiceOrchestrator.orchestrate_slide_generation()`: Coordinates service interactions

## Configuration Requirements

### Environment Variables

- `OPENAI_API_KEY`: Required for AI content generation
- `TAVILY_API_KEY`: Optional for research features
- `FIRECRAWL_API_KEY`: Optional for web crawling
- `SKIP_KNOWLEDGE_GRAPH`: Toggle for knowledge graph features

### Dependencies

- Python 3.12+
- FastAPI with WebSocket support
- OpenAI Python client
- LangGraph for workflows
- Various file processing libraries (pdfminer, python-docx, etc.)

## Development Notes

### Service Registry Pattern

The backend uses a service registry pattern to ensure singleton services and prevent multiple initializations. This is particularly important for expensive services like LLM clients.

### Conditional Knowledge Graph

Knowledge graph functionality can be disabled using the `SKIP_KNOWLEDGE_GRAPH` setting, which creates dummy classes when disabled.

### WebSocket Management

The improved WebSocket manager provides better error handling, connection management, and service integration compared to the legacy implementation.

### LangGraph Integration

Workflows use LangGraph for structured AI agent behavior, providing better state management and error handling than direct API calls.

## Testing and Debugging

### Debug Endpoints

- `/debug/client-folders`: Inspect client file organization
- `/debug/processing-status`: Check processing status
- `/debug/service-status`: Verify service health

### Monitoring

- `/health`: System health check
- `/metrics`: Performance metrics
- `/status`: Overall system status

## Performance Considerations

- File size limit: 50MB per file
- Concurrent processes: 4 simultaneous requests
- Processing timeout: 10 minutes
- WebSocket ping interval: 30 seconds
- Connection timeout: 60 seconds

## Security Notes

- CORS configured for localhost:3000
- File upload validation for allowed types
- Client-specific file isolation
- JWT support (configured but not fully implemented)
