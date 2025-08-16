interface WebSocketMessage {
  type: string;
  data: any;
}

interface WebSocketCallbacks {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private clientId: string | null = null;
  private isConnecting = false;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private hasConnected = false;
  private callbacks: WebSocketCallbacks = {};
  private messageQueue: WebSocketMessage[] = [];

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(clientId: string, callbacks: WebSocketCallbacks = {}): Promise<boolean> {
    return new Promise((resolve) => {
      // If already connected with the same client ID, just return
      if (this.socket?.readyState === WebSocket.OPEN && this.clientId === clientId) {
        this.callbacks = { ...this.callbacks, ...callbacks };
        resolve(true);
        return;
      }

      // If connecting, wait
      if (this.isConnecting) {
        resolve(false);
        return;
      }

      // If connected with different client ID, disconnect first
      if (this.socket && this.clientId !== clientId) {
        this.disconnect();
      }

      this.clientId = clientId;
      this.callbacks = { ...this.callbacks, ...callbacks };
      this.isConnecting = true;
      this.connectionStatus = 'connecting';

      const backendWsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000';
      const wsUrl = `${backendWsUrl}/ws/${clientId}`;
      
      try {
        const ws = new WebSocket(wsUrl);
        
        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            console.warn('WebSocket connection timeout');
            ws.close();
          }
        }, 300000); // 5 minutes (300 seconds) - increased from 10 seconds
        
        ws.onopen = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          
          this.socket = ws;
          this.isConnecting = false;
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
          this.hasConnected = true;
          
          // Send queued messages
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
              this.sendMessage(message);
            }
          }
          
          this.callbacks.onOpen?.();
          console.log('Connected to Slideo Backend');
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('🔍 WebSocket message received:', message);
            console.log('🔍 Message type:', message.type);
            console.log('🔍 Message data keys:', message.data ? Object.keys(message.data) : 'No data');
            
            // Handle heartbeat messages
            if (message.type === 'heartbeat') {
              ws.send(JSON.stringify({
                type: 'heartbeat_response',
                data: {
                  timestamp: new Date().toISOString()
                }
              }));
            }
            
            console.log('🔍 Forwarding message to frontend callbacks');
            this.callbacks.onMessage?.(message);
            console.log('🔍 Message forwarded successfully');
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          
          console.error('WebSocket error:', error);
          this.connectionStatus = 'error';
          this.isConnecting = false;
          this.callbacks.onError?.(error);
          resolve(false);
        };

        ws.onclose = (event) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          
          this.socket = null;
          this.isConnecting = false;
          this.connectionStatus = 'disconnected';
          console.log('Disconnected from Slideo Backend', event.code, event.reason);
          this.callbacks.onClose?.();

          // Only attempt to reconnect if not manually closed and we've successfully connected before
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts && this.hasConnected) {
            this.reconnectAttempts++;
            const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts), 30000);
            
            console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            this.reconnectTimeout = setTimeout(() => {
              if (!this.isConnecting && this.clientId) {
                console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                this.connect(this.clientId, this.callbacks);
              }
            }, delay);
          }
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.connectionStatus = 'error';
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.hasConnected = false;
    this.clientId = null;
    this.messageQueue = [];
    
    if (this.socket) {
      this.socket.close(1000);
      this.socket = null;
    }
  }

  sendMessage(message: WebSocketMessage): boolean {
    console.log('🔍 sendMessage called with:', message);
    console.log('🔍 Socket exists:', !!this.socket);
    console.log('🔍 Socket ready state:', this.socket?.readyState);
    console.log('🔍 WebSocket.OPEN:', WebSocket.OPEN);
    
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const messageJson = JSON.stringify(message);
        console.log('🔍 Sending message JSON:', messageJson);
        this.socket.send(messageJson);
        console.log('🔍 Message sent successfully');
        return true;
      } catch (error) {
        console.error('🔍 Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.log('🔍 WebSocket not ready, queueing message');
      // Queue message if not connected
      this.messageQueue.push(message);
      return false;
    }
  }

  sendFileUpload(file: File): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        
        // Convert ArrayBuffer to base64 more efficiently
        const uint8Array = new Uint8Array(content);
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Content = btoa(binary);
        
        // Set up one-time handlers for this upload
        const originalOnMessage = this.callbacks.onMessage;
        const originalOnError = this.callbacks.onError;
        
        // Set up timeout
        const timeout = setTimeout(() => {
          // Restore original callbacks
          this.callbacks.onMessage = originalOnMessage;
          this.callbacks.onError = originalOnError;
          reject(new Error('File upload timeout - no response from server'));
        }, 600000); // 10 minutes (600 seconds) - increased from 60 seconds
        
        const successHandler = (message: WebSocketMessage) => {
          console.log('File upload handler received message:', message);
          if (message.type === 'file_upload_success') {
            clearTimeout(timeout);
            // Restore original callbacks
            this.callbacks.onMessage = originalOnMessage;
            this.callbacks.onError = originalOnError;
            console.log('File upload successful');
            // Pass the success message to the original handler too
            originalOnMessage?.(message);
            resolve(true);
          } else if (message.type === 'file_upload_error') {
            clearTimeout(timeout);
            // Restore original callbacks
            this.callbacks.onMessage = originalOnMessage;
            this.callbacks.onError = originalOnError;
            console.error('File upload error:', message.data.error);
            // Pass the error message to the original handler too
            originalOnMessage?.(message);
            reject(new Error(message.data.error || 'File upload failed'));
          } else {
            // Pass through to original handler
            originalOnMessage?.(message);
          }
        };
        
        const errorHandler = (error: Event) => {
          clearTimeout(timeout);
          // Restore original callbacks
          this.callbacks.onMessage = originalOnMessage;
          this.callbacks.onError = originalOnError;
          reject(new Error('WebSocket error during file upload'));
        };
        
        // Set up temporary handlers
        this.callbacks.onMessage = successHandler;
        this.callbacks.onError = errorHandler;
        
        // Send the file upload message
        const messageData = {
          type: 'file_upload',
          data: {
            filename: file.name,
            content: base64Content,
            file_type: file.type,
            file_size: file.size
          }
        };
        
        console.log('🔍 Sending file upload message:', {
          type: messageData.type,
          filename: messageData.data.filename,
          file_type: messageData.data.file_type,
          file_size: messageData.data.file_size
        });
        
        const success = this.sendMessage(messageData);
        
        if (!success) {
          clearTimeout(timeout);
          // Restore original callbacks
          this.callbacks.onMessage = originalOnMessage;
          this.callbacks.onError = originalOnError;
          reject(new Error('Failed to send file upload message'));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  sendSlideDescription(description: string): boolean {
    return this.sendMessage({
      type: 'slide_description',
      data: {
        description
      }
    });
  }

  sendGenerateSlide(description: string, theme: string = "default", wantsResearch: boolean = false): boolean {
    return this.sendMessage({
      type: 'generate_slide',
      data: {
        description,
        theme,
        wants_research: wantsResearch
      }
    });
  }

  sendGenerateSlideRequest(
    description: string,
    theme: string = "Professional",
    researchData?: string,
    contentPlan?: string,
    userFeedback?: string,
    documents?: Array<{ filename: string; success?: boolean; content?: string }>,
    model?: string,
    slideCount?: number
  ): boolean {
    const message = {
      type: 'generate_slide',
      data: {
        description,
        theme,
        wants_research: false, // This will be determined by whether researchData is provided
        researchData,
        contentPlan,
        userFeedback,
        documents,
        model,
        slideCount: slideCount || 5
      }
    };
    
    console.log('🔍 Sending generate slide websocket message:', message);
    console.log('🔍 WebSocket connection status:', this.connectionStatus);
    console.log('🔍 WebSocket ready state:', this.socket?.readyState);
    
    const success = this.sendMessage(message);
    console.log('🔍 Message send result:', success);
    
    return success;
  }

  sendThemeSelection(themeData: any): boolean {
    return this.sendMessage({
      type: 'theme_selection',
      data: themeData
    });
  }

  sendProcessSlide(options?: any): boolean {
    return this.sendMessage({
      type: 'process_slide',
      data: {
        options: options || {}
      }
    });
  }

  ping(): boolean {
    return this.sendMessage({
      type: 'ping',
      data: {}
    });
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'error' {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getClientId(): string | null {
    return this.clientId;
  }
}

export const websocketService = WebSocketService.getInstance(); 