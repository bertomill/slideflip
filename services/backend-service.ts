import { 
  WebSocketMessage, 
  BackendFileInfo, 
  BackendSlideData, 
  BackendProcessingResult,
  SlideProcessingOptions,
  ServerMessageTypes
} from '@/types/backend';

export class BackendService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectionPromise: Promise<void> | null = null;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:8000/ws/${this.clientId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to SlideFlip Backend');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Disconnected from SlideFlip Backend');
        this.ws = null;
        this.connectionPromise = null;
      };
    });

    return this.connectionPromise;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;
  }

  private handleMessage(message: WebSocketMessage) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }
  }

  private sendMessage(message: WebSocketMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // File upload methods
  async uploadFile(file: File): Promise<BackendFileInfo> {
    return new Promise((resolve, reject) => {
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

        // Set up one-time handler for this upload
        const successHandler = (data: BackendFileInfo) => {
          this.messageHandlers.delete('file_upload_success');
          this.messageHandlers.delete('file_upload_error');
          resolve(data);
        };

        const errorHandler = (data: { error: string; details?: string }) => {
          this.messageHandlers.delete('file_upload_success');
          this.messageHandlers.delete('file_upload_error');
          reject(new Error(data.error));
        };

        this.messageHandlers.set('file_upload_success', successHandler);
        this.messageHandlers.set('file_upload_error', errorHandler);

        if (!this.sendMessage(message)) {
          reject(new Error('WebSocket not connected'));
        }
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  // Slide description methods
  async sendDescription(description: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const message = {
        type: 'slide_description',
        data: { description }
      };

      const successHandler = () => {
        this.messageHandlers.delete('slide_description_success');
        this.messageHandlers.delete('slide_description_error');
        resolve();
      };

      const errorHandler = (data: { error: string; details?: string }) => {
        this.messageHandlers.delete('slide_description_success');
        this.messageHandlers.delete('slide_description_error');
        reject(new Error(data.error));
      };

      this.messageHandlers.set('slide_description_success', successHandler);
      this.messageHandlers.set('slide_description_error', errorHandler);

      if (!this.sendMessage(message)) {
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  // Slide processing methods
  async processSlide(options?: SlideProcessingOptions): Promise<BackendProcessingResult> {
    return new Promise((resolve, reject) => {
      const message = {
        type: 'process_slide',
        data: { options: options || {} }
      };

      const completeHandler = (data: BackendProcessingResult) => {
        this.messageHandlers.delete('processing_complete');
        this.messageHandlers.delete('processing_error');
        resolve(data);
      };

      const errorHandler = (data: { error: string; details?: string }) => {
        this.messageHandlers.delete('processing_complete');
        this.messageHandlers.delete('processing_error');
        reject(new Error(data.error));
      };

      this.messageHandlers.set('processing_complete', completeHandler);
      this.messageHandlers.set('processing_error', errorHandler);

      if (!this.sendMessage(message)) {
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  // Status monitoring
  onProcessingStatus(callback: (status: ServerMessageTypes) => void) {
    this.messageHandlers.set('processing_status', callback);
  }

  onConnectionEstablished(callback: (data: any) => void) {
    this.messageHandlers.set('connection_established', callback);
  }

  // Ping method
  ping(): boolean {
    return this.sendMessage({
      type: 'ping',
      data: {}
    });
  }

  // Utility methods
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): number {
    return this.ws?.readyState || WebSocket.CLOSED;
  }
} 