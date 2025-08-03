# SlideFlip Backend

A Python-based backend service for the SlideFlip presentation generator with WebSocket communication.

## Features

- **WebSocket Communication**: Real-time bidirectional communication with frontend
- **File Upload & Processing**: Handle multiple file types (PDF, DOCX, TXT, MD)
- **Slide Generation**: Process uploaded files and descriptions to generate slides
- **Structured Architecture**: Clean separation of concerns with services and handlers
- **Async Processing**: Non-blocking file and slide processing
- **Client Management**: Track multiple client connections and their data

## Project Structure

```
backend/
├── main.py                 # Main application entry point
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
│   │   └── slide_service.py      # Slide generation logic
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── file_handler.py       # File operation handlers
│   │   └── slide_handler.py      # Slide operation handlers
│   └── utils/
│       ├── __init__.py
│       └── helpers.py            # Utility functions
└── tests/                 # Test files (to be implemented)
```

## Installation

1. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Running the Backend

### Development Mode
```bash
python main.py
```

### Production Mode
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The backend will be available at:
- **HTTP API**: http://localhost:8000
- **WebSocket**: ws://localhost:8000/ws/{client_id}
- **API Documentation**: http://localhost:8000/docs

## WebSocket Communication

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

## API Endpoints

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health information

## Configuration

The backend uses a `Settings` class for configuration. Key settings include:

- **Server**: Host, port, debug mode
- **File Storage**: Upload directory, max file size, allowed file types
- **WebSocket**: Ping intervals, timeouts
- **Processing**: Max processing time, concurrent processes
- **Security**: Secret key, token expiration

## File Processing

### Supported File Types
- PDF documents
- Word documents (DOCX)
- Text files (TXT)
- Markdown files (MD)
- PowerPoint files (PPTX)

### File Size Limits
- Maximum file size: 50MB per file
- Total upload limit: Configurable per client

## Error Handling

The backend includes comprehensive error handling:

- **File Validation**: Size, type, and content validation
- **Connection Management**: Automatic cleanup of disconnected clients
- **Processing Errors**: Graceful handling of slide generation failures
- **Message Validation**: Pydantic models ensure message integrity

## Development

### Adding New Features

1. **New Message Types**: Add models to `src/models/message_models.py`
2. **New Services**: Create service classes in `src/services/`
3. **New Handlers**: Create handler classes in `src/handlers/`
4. **New Endpoints**: Add routes to `main.py`

### Testing

Run tests (when implemented):
```bash
pytest tests/
```

### Logging

The backend uses structured logging with different levels:
- `INFO`: General application flow
- `ERROR`: Error conditions
- `DEBUG`: Detailed debugging information

## Deployment

### Docker (Recommended)
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `DEBUG`: Debug mode (default: True)
- `SECRET_KEY`: Secret key for security
- `UPLOAD_DIR`: File upload directory
- `MAX_FILE_SIZE`: Maximum file size in bytes

## Security Considerations

- File type validation
- File size limits
- Filename sanitization
- Client data isolation
- Error message sanitization

## Performance

- Async file processing
- Connection pooling
- Memory-efficient file handling
- Configurable concurrent processing

## Monitoring

The backend provides several monitoring endpoints:
- Health checks
- Connection statistics
- Storage statistics
- Processing statistics 