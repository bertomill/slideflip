# Frontend Integration Guide

This guide explains how to integrate the existing Next.js frontend with the new Python backend.

## Overview

The backend provides WebSocket-based communication for:
- File uploads
- Slide descriptions
- Slide processing
- Real-time status updates

## Backend Setup

1. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Start the backend**:
   ```bash
   python start.py
   # or
   python main.py
   ```

3. **Verify it's running**:
   - HTTP API: http://localhost:8000
   - WebSocket: ws://localhost:8000/ws/{client_id}
   - API Docs: http://localhost:8000/docs

## Frontend Integration

### 1. Create WebSocket Hook

Create a new hook for WebSocket communication:

```typescript
// hooks/use-backend-websocket.ts
import { useState, useEffect, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

interface UseBackendWebSocketProps {
  clientId: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

export function useBackendWebSocket({
  clientId,
  onMessage,
  onError,
  onClose
}: UseBackendWebSocketProps) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${clientId}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to backend');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
        onMessage?.(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from backend');
      onClose?.();
    };

    setSocket(ws);
  }, [clientId, onMessage, onError, onClose]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
  }, [socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }, [socket]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    sendMessage
  };
}
```

### 2. Update Upload Step Component

Modify the upload step to use WebSocket communication:

```typescript
// components/builder/upload-step.tsx
import { useBackendWebSocket } from '@/hooks/use-backend-websocket';
import { useEffect, useState } from 'react';

export function UploadStep({ slideData, updateSlideData, onNext }: UploadStepProps) {
  const [clientId] = useState(() => `client_${Date.now()}`);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  
  const { isConnected, sendMessage, lastMessage } = useBackendWebSocket({
    clientId,
    onMessage: (message) => {
      switch (message.type) {
        case 'file_upload_success':
          setUploadStatus('File uploaded successfully');
          break;
        case 'file_upload_error':
          setUploadStatus(`Upload error: ${message.data.error}`);
          break;
        case 'slide_description_success':
          setUploadStatus('Description saved');
          break;
      }
    }
  });

  useEffect(() => {
    // Connect to backend when component mounts
    if (!isConnected) {
      // The hook will handle connection
    }
  }, [isConnected]);

  const handleFileUpload = async (files: File[]) => {
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(content)));
        
        sendMessage({
          type: 'file_upload',
          data: {
            filename: file.name,
            content: base64Content,
            file_type: file.type,
            file_size: file.size
          }
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDescriptionSubmit = () => {
    sendMessage({
      type: 'slide_description',
      data: {
        description: slideData.description
      }
    });
  };

  // ... rest of component
}
```

### 3. Update Slide Data Types

Add backend-specific types:

```typescript
// types/backend.ts
export interface BackendFileInfo {
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  upload_time: string;
}

export interface BackendSlideData {
  title: string;
  content: string;
  theme: string;
  layout: string;
  elements: Array<{
    type: string;
    content: string;
    position: { x: number; y: number };
    style: Record<string, string>;
  }>;
}

export interface BackendProcessingResult {
  status: 'idle' | 'started' | 'analyzing' | 'processing' | 'completed' | 'error';
  slide_data?: BackendSlideData;
  error_message?: string;
  processing_time: number;
}
```

### 4. Create Backend Service

Create a service to handle backend communication:

```typescript
// services/backend-service.ts
import { BackendFileInfo, BackendSlideData, BackendProcessingResult } from '@/types/backend';

export class BackendService {
  private ws: WebSocket | null = null;
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:8000/ws/${this.clientId}`);
      
      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async uploadFile(file: File): Promise<BackendFileInfo> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(content)));
        
        const message = {
          type: 'file_upload',
          data: {
            filename: file.name,
            content: base64Content,
            file_type: file.type,
            file_size: file.size
          }
        };

        this.ws!.send(JSON.stringify(message));
        
        // Handle response
        const handleMessage = (event: MessageEvent) => {
          const response = JSON.parse(event.data);
          if (response.type === 'file_upload_success') {
            this.ws!.removeEventListener('message', handleMessage);
            resolve(response.data);
          } else if (response.type === 'file_upload_error') {
            this.ws!.removeEventListener('message', handleMessage);
            reject(new Error(response.data.error));
          }
        };
        
        this.ws.addEventListener('message', handleMessage);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  async sendDescription(description: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const message = {
        type: 'slide_description',
        data: { description }
      };

      this.ws.send(JSON.stringify(message));
      
      const handleMessage = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.type === 'slide_description_success') {
          this.ws!.removeEventListener('message', handleMessage);
          resolve();
        } else if (response.type === 'slide_description_error') {
          this.ws!.removeEventListener('message', handleMessage);
          reject(new Error(response.data.error));
        }
      };
      
      this.ws.addEventListener('message', handleMessage);
    });
  }

  async processSlide(options?: any): Promise<BackendProcessingResult> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const message = {
        type: 'process_slide',
        data: { options: options || {} }
      };

      this.ws.send(JSON.stringify(message));
      
      const handleMessage = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.type === 'processing_complete') {
          this.ws!.removeEventListener('message', handleMessage);
          resolve(response.data);
        } else if (response.type === 'processing_error') {
          this.ws!.removeEventListener('message', handleMessage);
          reject(new Error(response.data.error));
        }
      };
      
      this.ws.addEventListener('message', handleMessage);
    });
  }
}
```

### 5. Update Builder Page

Modify the main builder page to use the backend service:

```typescript
// app/builder/page.tsx
import { BackendService } from '@/services/backend-service';

export default function SlideBuilder() {
  const [backendService, setBackendService] = useState<BackendService | null>(null);
  
  useEffect(() => {
    const clientId = `client_${Date.now()}`;
    const service = new BackendService(clientId);
    service.connect().then(() => {
      setBackendService(service);
    });
    
    return () => {
      service.disconnect();
    };
  }, []);

  // Pass backendService to child components
  // ...
}
```

## Testing the Integration

1. **Start the backend**:
   ```bash
   cd backend
   python start.py
   ```

2. **Start the frontend**:
   ```bash
   npm run dev
   ```

3. **Test the integration**:
   - Open the builder page
   - Upload a file
   - Enter a description
   - Check the browser console for WebSocket messages

## Error Handling

Add proper error handling for WebSocket communication:

```typescript
const handleWebSocketError = (error: Event) => {
  console.error('WebSocket error:', error);
  // Show user-friendly error message
  setError('Connection to backend failed. Please try again.');
};

const handleWebSocketClose = () => {
  console.log('WebSocket connection closed');
  // Attempt to reconnect or show reconnection UI
  setShowReconnectButton(true);
};
```

## Production Considerations

1. **Environment Variables**: Use environment variables for backend URL
2. **SSL/TLS**: Use secure WebSocket connections in production
3. **Reconnection Logic**: Implement automatic reconnection
4. **Error Boundaries**: Add React error boundaries for WebSocket errors
5. **Loading States**: Show loading states during WebSocket operations

## Migration Steps

1. Create the WebSocket hook
2. Update the upload step component
3. Add backend service
4. Update types and interfaces
5. Test the integration
6. Add error handling
7. Deploy and test in production 