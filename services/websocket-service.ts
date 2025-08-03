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

      const wsUrl = `ws://localhost:8000/ws/${clientId}`;
      
      try {
        const ws = new WebSocket(wsUrl);
        
        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            console.warn('WebSocket connection timeout');
            ws.close();
          }
        }, 10000);
        
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
          console.log('Connected to SlideFlip Backend');
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle heartbeat messages
            if (message.type === 'heartbeat') {
              ws.send(JSON.stringify({
                type: 'heartbeat_response',
                data: {
                  timestamp: new Date().toISOString()
                }
              }));
            }
            
            this.callbacks.onMessage?.(message);
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
          console.log('Disconnected from SlideFlip Backend', event.code, event.reason);
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
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
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
        }, 30000); // 30 second timeout
        
        const successHandler = (message: WebSocketMessage) => {
          console.log('File upload handler received message:', message);
          if (message.type === 'file_upload_success') {
            clearTimeout(timeout);
            // Restore original callbacks
            this.callbacks.onMessage = originalOnMessage;
            this.callbacks.onError = originalOnError;
            console.log('File upload successful');
            resolve(true);
          } else if (message.type === 'file_upload_error') {
            clearTimeout(timeout);
            // Restore original callbacks
            this.callbacks.onMessage = originalOnMessage;
            this.callbacks.onError = originalOnError;
            console.error('File upload error:', message.data.error);
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
        const success = this.sendMessage({
          type: 'file_upload',
          data: {
            filename: file.name,
            content: base64Content,
            file_type: file.type,
            file_size: file.size
          }
        });
        
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