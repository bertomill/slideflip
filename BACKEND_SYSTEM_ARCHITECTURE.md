# Backend System Architecture & Design

## Overview

This document provides a comprehensive understanding of the Slideo backend system architecture, current implementation, and a proposed scalable architecture for future development.

## Current System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket Client  │  HTTP Client  │  Authentication (Supabase) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                          │
├─────────────────────────────────────────────────────────────────┤
│        FastAPI Application (main.py)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   HTTP Routes   │  │ WebSocket Route │  │  CORS & Middleware│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Connection Management                         │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket Manager (improved_websocket_manager.py)             │
│  ├── Connection Pool (Max 50)                                  │
│  ├── Session Management                                        │
│  ├── Message Routing                                           │
│  └── Cleanup & Health Monitoring                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Message Processing Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  Message Handlers (improved_websocket.py)                      │
│  ├── File Upload Handler                                       │
│  ├── Theme Selection Handler                                   │
│  ├── Content Planning Handler                                  │
│  ├── Slide Generation Handler                                  │
│  └── Research Request Handler                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  Services (/src/services/)                                     │
│  ├── FileService          ├── LLMService                      │
│  ├── SlideService         ├── DocumentParser                 │
│  ├── KnowledgeGraphService ├── ResearchService               │
│  └── ThemeService         └── AgenticResearchService         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Data & Storage Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  File Storage              │  Knowledge Graphs                │
│  ├── uploads/              │  ├── kg/                         │
│  ├── output/               │  ├── NetworkX Graphs            │
│  └── temp/                 │  └── Graph Clustering           │
│                            │                                  │
│  External APIs             │  AI Services                     │
│  ├── Tavily (Research)     │  ├── OpenAI GPT-4               │
│  ├── Firecrawl             │  └── LangGraph Workflows        │
│  └── Supabase Auth         │                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Current WebSocket Implementation

### Message Flow Architecture

```
Frontend                     Backend
   │                           │
   ├──── File Upload ────────▶ │ ──▶ FileHandler ──▶ FileService
   │                           │     │
   │ ◀──── Progress ─────────── │ ◀───┘
   │                           │
   ├──── Theme Select ───────▶ │ ──▶ ThemeHandler ──▶ ThemeService
   │                           │     │
   │ ◀──── Acknowledge ──────── │ ◀───┘
   │                           │
   ├──── Content Plan ───────▶ │ ──▶ ContentHandler ──▶ LLMService
   │                           │     │                    │
   │                           │     │ ◀──── AI Response ─┘
   │ ◀──── Plan Response ───── │ ◀───┘
   │                           │
   ├──── Generate Slide ─────▶ │ ──▶ SlideHandler ──▶ SlideService
   │                           │     │                  │
   │                           │     │ ──▶ LLMService ──┘
   │                           │     │     │
   │                           │     │ ◀───┘
   │ ◀──── Slide Complete ──── │ ◀───┘
   │                           │
```

### Session Management

```python
@dataclass
class ClientSession:
    client_id: str
    websocket: WebSocket
    connected_at: datetime
    last_activity: datetime
    current_step: str
    status: ProcessingStatus
    processing: bool
    session_data: Dict[str, Any]
    message_queue: asyncio.Queue
```

**Key Features:**
- **Session Isolation**: Each client has isolated data and processing state
- **Activity Tracking**: Automatic cleanup of stale connections (30-min timeout)
- **Message Acknowledgment**: Request/response correlation with unique IDs
- **Progress Tracking**: Real-time progress updates for long-running operations
- **Error Recovery**: Comprehensive error handling with retry mechanisms

## Detailed Component Analysis

### 1. WebSocket Message Models (`/src/models/websocket_messages.py`)

**Current Implementation:**
- Pydantic-based message validation
- Type-safe message definitions
- Request/response correlation
- Enum-based message types

**Key Models:**
```python
class BaseWebSocketMessage(BaseModel):
    id: str = Field(default_factory=uuid4)
    type: MessageType
    timestamp: datetime
    client_id: str
    request_id: Optional[str] = None

# Client Messages
class FileUploadMessage(ClientMessage)
class ThemeSelectionMessage(ClientMessage)  
class ContentPlanningMessage(ClientMessage)
class SlideGenerationMessage(ClientMessage)

# Server Messages  
class ProgressUpdateMessage(ServerMessage)
class SlideCompleteMessage(ServerMessage)
class ErrorResponseMessage(ServerMessage)
```

### 2. Connection Management (`/src/core/improved_websocket_manager.py`)

**Responsibilities:**
- WebSocket lifecycle management
- Connection pooling (max 50 concurrent)
- Session state persistence
- Message routing and acknowledgment
- Background cleanup tasks

**Key Methods:**
```python
class ImprovedWebSocketManager:
    async def connect_client(websocket, client_id) -> bool
    async def disconnect_client(client_id, reason) -> None
    async def send_message(client_id, message) -> bool
    async def handle_client_message(client_id, data) -> None
    def register_message_handler(type, handler) -> None
```

### 3. Service Layer Architecture

#### File Processing Pipeline
```
File Upload → Validation → Storage → Content Extraction → Knowledge Graph (Optional)
     │            │           │            │                       │
     ▼            ▼           ▼            ▼                       ▼
FileService → FileHandler → uploads/ → DocumentParser → KnowledgeGraphService
```

#### Content Generation Pipeline  
```
Content Request → Document Analysis → AI Processing → Content Plan → Slide HTML
      │              │                    │              │           │
      ▼              ▼                    ▼              ▼           ▼
ContentHandler → LLMService → OpenAI GPT-4 → PromptManager → SlideService
```

### 4. Prompt Management System (`/src/core/prompt_manager.py`)

**Architecture:**
- YAML-based prompt templates
- Jinja2 template rendering
- Variable validation
- Usage metrics tracking

**Template Structure:**
```yaml
# /src/prompts/slide_generation/content_planning.yaml
name: "content_planning"
description: "Generate content plan from documents"
variables:
  required: ["documents", "user_description"]
  optional: ["research_data", "theme_preference"]
template: |
  Based on the uploaded documents: {{ documents }}
  User description: {{ user_description }}
  Create a structured content plan for slides...
```

### 5. LangGraph Integration (Agentic Workflows)

**Current Implementation:**
```python
class SlideGenerationWorkflow:
    def __init__(self):
        self.graph = StateGraph(SlideState)
        
    async def content_planner(state: SlideState) -> SlideState
    async def file_processor(state: SlideState) -> SlideState  
    async def research_integrator(state: SlideState) -> SlideState
    async def slide_generator(state: SlideState) -> SlideState
```

**Workflow State:**
```python
class SlideState(TypedDict):
    client_id: str
    documents: List[Dict]
    content_plan: str
    research_data: Optional[str]
    theme_config: Dict
    generated_slide: Optional[str]
    errors: List[str]
```

## Problems with Current Architecture

### 1. **Scalability Issues**
- Single-process application
- In-memory session storage
- No horizontal scaling support
- Resource bottlenecks with concurrent users

### 2. **Service Coupling**
- Services directly import each other
- Shared state dictionaries
- Circular dependencies
- Difficult to test in isolation

### 3. **Error Handling**
- Inconsistent error formats
- Poor error propagation
- Limited retry mechanisms
- No circuit breaker patterns

### 4. **Resource Management**
- No connection pooling for external APIs
- Memory leaks in long-running processes
- No request rate limiting
- Uncontrolled resource consumption

### 5. **Monitoring & Observability**
- Limited logging
- No metrics collection
- No distributed tracing
- Poor debugging capabilities

## Proposed Improved Architecture

### High-Level Scalable Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Load Balancer                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway                                 │
├─────────────────────────────────────────────────────────────────┤
│  Rate Limiting │ Authentication │ Request Routing │ CORS       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  WebSocket      │  │   HTTP API      │  │   Background    │
│  Service        │  │   Service       │  │   Workers       │
│                 │  │                 │  │                 │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ Connection  │ │  │ │ REST        │ │  │ │ File        │ │
│ │ Manager     │ │  │ │ Endpoints   │ │  │ │ Processing  │ │
│ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │
│                 │  │                 │  │                 │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ Message     │ │  │ │ GraphQL     │ │  │ │ AI          │ │
│ │ Bus         │ │  │ │ Interface   │ │  │ │ Processing  │ │
│ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Message Queue & Event Bus                    │
├─────────────────────────────────────────────────────────────────┤
│  Redis Pub/Sub │ RabbitMQ │ Event Streaming │ Task Queues    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                        │
├─────────────────────────────────────────────────────────────────┤
│                    Domain Services                             │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │   Document      │ │    Content      │ │     Slide       │   │
│ │   Service       │ │    Service      │ │    Service      │   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                               │
│                   LangGraph Workflows                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │  Research       │ │   Generation    │ │   Quality       │   │
│ │  Workflow       │ │   Workflow      │ │   Workflow      │   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Data & Integration Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  Database Layer           │  External Services                 │
│  ├── PostgreSQL           │  ├── OpenAI API                   │
│  ├── Redis Cache          │  ├── Tavily Research              │
│  └── Vector DB            │  ├── Supabase Auth                │
│                           │  └── File Storage (S3)            │
│                           │                                   │
│  Monitoring & Observability                                   │
│  ├── Prometheus Metrics   │  ├── Distributed Tracing         │
│  ├── Structured Logging   │  └── Health Checks               │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Directory Structure

```
backend/
├── main.py                     # Application entry point
├── config/
│   ├── settings.py            # Configuration management
│   ├── database.py            # Database connections
│   └── redis.py               # Redis configuration
│
├── api/
│   ├── __init__.py
│   ├── websocket/
│   │   ├── __init__.py
│   │   ├── connection_manager.py
│   │   ├── message_router.py
│   │   └── handlers/
│   │       ├── document_handler.py
│   │       ├── content_handler.py
│   │       └── slide_handler.py
│   │
│   ├── http/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── documents.py
│   │   │   ├── slides.py
│   │   │   └── health.py
│   │   └── middleware/
│   │       ├── auth.py
│   │       ├── rate_limit.py
│   │       └── cors.py
│   │
│   └── graphql/
│       ├── __init__.py
│       ├── schema.py
│       └── resolvers/
│
├── domain/
│   ├── __init__.py
│   ├── entities/
│   │   ├── document.py
│   │   ├── slide.py
│   │   └── user_session.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── document_service.py
│   │   ├── content_service.py
│   │   ├── slide_service.py
│   │   └── research_service.py
│   │
│   └── workflows/
│       ├── __init__.py
│       ├── document_processing.py
│       ├── content_generation.py
│       └── slide_creation.py
│
├── infrastructure/
│   ├── __init__.py
│   ├── database/
│   │   ├── __init__.py
│   │   ├── repositories/
│   │   ├── migrations/
│   │   └── models/
│   │
│   ├── external/
│   │   ├── __init__.py
│   │   ├── openai_client.py
│   │   ├── research_client.py
│   │   └── storage_client.py
│   │
│   ├── messaging/
│   │   ├── __init__.py
│   │   ├── event_bus.py
│   │   ├── publishers.py
│   │   └── subscribers.py
│   │
│   └── monitoring/
│       ├── __init__.py
│       ├── metrics.py
│       ├── logging.py
│       └── tracing.py
│
├── workers/
│   ├── __init__.py
│   ├── document_processor.py
│   ├── ai_content_generator.py
│   └── slide_renderer.py
│
└── tests/
    ├── unit/
    ├── integration/
    └── performance/
```

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
1. **Database Integration**
   - Add PostgreSQL for persistent storage
   - Redis for session management and caching
   - Database migrations system

2. **Message Queue System**
   - Implement Redis Pub/Sub for internal messaging
   - Event-driven architecture patterns
   - Background task processing

### Phase 2: Service Refactoring (Weeks 3-4)
1. **Domain-Driven Design**
   - Extract business logic into domain services
   - Implement repository pattern
   - Add dependency injection

2. **API Restructuring**
   - Separate WebSocket and HTTP concerns
   - Add GraphQL interface
   - Implement proper middleware stack

### Phase 3: Scalability (Weeks 5-6)
1. **Horizontal Scaling**
   - Load balancer configuration
   - Stateless service design
   - Shared session storage

2. **Performance Optimization**
   - Connection pooling
   - Request caching
   - Resource optimization

### Phase 4: Observability (Weeks 7-8)
1. **Monitoring Stack**
   - Prometheus metrics
   - Structured logging
   - Health checks

2. **Testing & Quality**
   - Comprehensive test suite
   - Performance testing
   - Load testing

This architecture provides:
- **Scalability**: Horizontal scaling capabilities
- **Maintainability**: Clean separation of concerns
- **Observability**: Comprehensive monitoring
- **Reliability**: Error handling and recovery
- **Extensibility**: Easy to add new features
- **Industry Standards**: Following best practices