# SlideFlip Backend

A Python-based backend service for the SlideFlip presentation generator with WebSocket communication, AI integration, and advanced file processing capabilities.

## 🚀 Overview

The SlideFlip backend is a FastAPI application that provides:
- **Real-time WebSocket Communication**: Bidirectional communication with frontend
- **AI-Powered Content Processing**: LLM integration for slide generation
- **Multi-format File Support**: PDF, DOCX, TXT, MD file processing
- **Advanced Slide Generation**: Professional presentation creation
- **Content Storage & Management**: Structured data storage and retrieval
- **HTML Feature Processing**: Rich content extraction and processing

## ✨ Features

### Core Features
- **WebSocket Communication**: Real-time bidirectional communication with frontend
- **File Upload & Processing**: Handle multiple file types with validation
- **AI-Powered Slide Generation**: LLM integration for intelligent content processing
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
├── README.md              # This file
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
│   │   └── slide_service.py      # Slide generation logic
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── file_handler.py       # File operation handlers
│   │   └── slide_handler.py      # Slide operation handlers
│   └── utils/
│       ├── __init__.py
│       └── helpers.py            # Utility functions
├── tests/                 # Test files
│   ├── test_backend.py
│   ├── test_content_storage.py
│   ├── test_html_parsing.py
│   ├── test_llm_integration.py
│   ├── test_slide_generation.py
│   └── ...
├── docs/                  # Documentation
│   ├── FRONTEND_INTEGRATION.md
│   ├── LLM_INTEGRATION_README.md
│   ├── CONTENT_STORAGE_README.md
│   ├── SLIDE_GENERATION_README.md
│   ├── HTML_FEATURES_README.md
│   └── IMPLEMENTATION_SUMMARY.md
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

4. **Ping**:
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

4. **Processing Complete**:
   ```json
   {
     "type": "processing_complete",
     "data": {
       "status": "completed",
       "slide_data": {
         "title": "Quarterly Sales Results",
         "content": "Generated content...",
         "theme": "professional",
         "layout": "standard",
         "elements": [...]
       },
       "message": "Slide generation completed successfully"
     }
   }
   ```

## 🤖 AI Integration

### LLM Service
The backend integrates with Large Language Models for intelligent content processing:

#### Features
- **Content Analysis**: Extract key topics and themes
- **Slide Generation**: Create professional slide content
- **Content Summarization**: Generate concise summaries
- **Topic Extraction**: Identify main topics and subtopics
- **Structure Recommendations**: Suggest optimal slide layouts

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
4. **Structure Generation**: Slide structure creation
5. **Content Generation**: AI-powered slide content generation
6. **Formatting**: Theme application and formatting

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

### Test Files
- `test_backend.py`: Core backend functionality
- `test_content_storage.py`: Storage system testing
- `test_html_parsing.py`: HTML processing testing
- `test_llm_integration.py`: AI integration testing
- `test_slide_generation.py`: Slide generation testing

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

### Performance Monitoring
- **Health Checks**: Regular health monitoring
- **Connection Statistics**: WebSocket connection metrics
- **Processing Metrics**: File processing performance
- **Error Tracking**: Error rate monitoring

## 🐛 Error Handling

### Error Categories
- **File Errors**: Upload and processing errors
- **Connection Errors**: WebSocket connection issues
- **Processing Errors**: Slide generation failures
- **Validation Errors**: Input validation failures

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

## 📚 Additional Documentation

For detailed information on specific features, see the documentation in the `docs/` folder:

- **[Frontend Integration](./docs/FRONTEND_INTEGRATION.md)**: Frontend-backend integration guide
- **[LLM Integration](./docs/LLM_INTEGRATION_README.md)**: AI integration details
- **[Content Storage](./docs/CONTENT_STORAGE_README.md)**: Storage system documentation
- **[Slide Generation](./docs/SLIDE_GENERATION_README.md)**: Slide generation process
- **[HTML Features](./docs/HTML_FEATURES_README.md)**: HTML processing capabilities
- **[Implementation Summary](./docs/IMPLEMENTATION_SUMMARY.md)**: Overall implementation overview

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

- **Documentation**: Check the docs folder
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Email**: Contact the development team

---

**Made with ❤️ by the SlideFlip Team** 