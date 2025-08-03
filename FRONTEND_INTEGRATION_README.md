# Frontend Integration with Backend

This document explains how the frontend has been integrated with the Python backend using WebSocket communication.

## Overview

The frontend now communicates with the backend through WebSocket connections for:
- File uploads
- Slide descriptions
- Slide processing
- Real-time status updates

## New Components

### 1. WebSocket Hook (`hooks/use-backend-websocket.ts`)
A custom React hook that manages WebSocket connections to the backend.

**Features:**
- Automatic connection management
- Reconnection logic with exponential backoff
- Message handling and error management
- File upload with base64 encoding
- Slide description sending
- Slide processing requests

**Usage:**
```typescript
const { 
  isConnected, 
  connectionStatus, 
  sendFileUpload, 
  sendSlideDescription,
  sendProcessSlide 
} = useBackendWebSocket({
  clientId: 'unique-client-id',
  onMessage: (message) => {
    // Handle incoming messages
  }
});
```

### 2. Backend Types (`types/backend.ts`)
TypeScript definitions for all backend communication.

**Key Types:**
- `WebSocketMessage` - Base message structure
- `BackendFileInfo` - File upload response
- `BackendSlideData` - Generated slide data
- `ProcessingStatus` - Processing status enum
- Various message types for client-server communication

### 3. Backend Service (`services/backend-service.ts`)
A service class for handling backend communication with promise-based APIs.

**Features:**
- Promise-based file upload
- Promise-based description sending
- Promise-based slide processing
- Message handler management
- Connection state management

### 4. Backend Status Component (`components/backend-status.tsx`)
A UI component that displays backend connection status.

**Features:**
- Real-time connection status
- Visual indicators (icons and colors)
- Message log display
- Ping functionality for testing

## Updated Components

### Upload Step (`components/builder/upload-step.tsx`)
The upload step has been enhanced with backend integration:

**New Features:**
- Real-time file upload to backend
- Connection status display
- Upload status feedback
- Automatic description sending to backend
- Error handling for failed uploads

**Changes:**
- Added WebSocket connection status indicator
- File uploads now send to both local state and backend
- Description changes are automatically sent to backend
- Added upload status messages
- Enhanced error handling

## Testing

### Test Page (`app/test-backend/page.tsx`)
A dedicated test page for verifying backend communication.

**Features:**
- Connection status display
- File upload testing
- Description sending testing
- Slide processing testing
- Message log display
- Ping functionality

**Access:** Navigate to `/test-backend` to test the backend integration.

## Integration Points

### 1. Builder Page (`app/builder/page.tsx`)
- Added backend status component for testing
- Each step can now access backend services
- Real-time status updates

### 2. Upload Step
- Files are uploaded to both frontend state and backend
- Descriptions are automatically sent to backend
- Connection status is displayed to users

## Backend Communication Flow

### File Upload Flow:
1. User selects/drops files
2. Files are added to local state
3. Files are encoded as base64
4. Files are sent to backend via WebSocket
5. Backend responds with success/error
6. UI updates with status

### Description Flow:
1. User types description
2. Description is debounced (1 second)
3. Description is sent to backend
4. Backend stores description for processing
5. UI shows confirmation

### Processing Flow:
1. User requests slide processing
2. Processing request sent to backend
3. Backend processes files and description
4. Real-time status updates sent to frontend
5. Final result sent when complete

## Error Handling

### Connection Errors:
- Automatic reconnection with exponential backoff
- Visual indicators for connection status
- Graceful degradation when backend is unavailable

### Upload Errors:
- File validation on frontend
- Backend validation and error responses
- User-friendly error messages
- Retry mechanisms

### Processing Errors:
- Real-time error reporting
- Detailed error messages from backend
- Fallback options for failed processing

## Configuration

### Backend URL:
The WebSocket URL is currently hardcoded to `ws://localhost:8000/ws/{clientId}`. For production, this should be configurable via environment variables.

### Client ID Generation:
Each client gets a unique ID based on timestamp: `client_${Date.now()}`. This ensures multiple browser tabs don't conflict.

## Development

### Starting the Backend:
```bash
cd backend
source venv/bin/activate
python main.py
```

### Starting the Frontend:
```bash
npm run dev
```

### Testing the Integration:
1. Start both backend and frontend
2. Navigate to `/test-backend` to test WebSocket communication
3. Navigate to `/builder` to test the full integration
4. Check browser console for WebSocket messages

## Production Considerations

### Security:
- Use WSS (secure WebSocket) in production
- Implement authentication for WebSocket connections
- Validate file types and sizes on both frontend and backend

### Performance:
- Implement file chunking for large files
- Add progress indicators for uploads
- Optimize base64 encoding/decoding

### Reliability:
- Add connection pooling
- Implement message queuing for offline scenarios
- Add retry mechanisms for failed operations

## Troubleshooting

### Common Issues:

1. **Backend not connecting:**
   - Check if backend is running on port 8000
   - Verify WebSocket endpoint is accessible
   - Check browser console for connection errors

2. **File uploads failing:**
   - Check file size limits
   - Verify file type is supported
   - Check backend logs for errors

3. **Messages not received:**
   - Verify WebSocket connection is open
   - Check message format matches backend expectations
   - Review browser console for parsing errors

### Debug Tools:
- Browser WebSocket inspector
- Backend logs
- Test page at `/test-backend`
- Browser console for message logging 