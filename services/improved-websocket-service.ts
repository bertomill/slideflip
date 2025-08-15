/**
 * Improved WebSocket Service with better error handling and type safety
 */

import { v4 as uuidv4 } from 'uuid';
import { createWebSocketLogger, createServiceLogger, LogLevel } from '@/lib/logger';

// Message types matching backend
export enum MessageType {
  // Client -> Server
  FILE_UPLOAD = 'file_upload',
  THEME_SELECTION = 'theme_selection',
  CONTENT_PLANNING = 'content_planning',
  SLIDE_GENERATION = 'slide_generation',
  RESEARCH_REQUEST = 'research_request',
  STATUS_REQUEST = 'status_request',
  PING = 'ping',
  
  // Server -> Client
  PROGRESS_UPDATE = 'progress_update',
  SLIDE_COMPLETE = 'slide_complete',
  CONTENT_PLAN_RESPONSE = 'content_plan_response',
  ERROR_RESPONSE = 'error_response',
  STATUS_RESPONSE = 'status_response',
  PONG = 'pong',
  ACKNOWLEDGE = 'acknowledge',
  SESSION_INITIALIZED = 'session_initialized'
}

export enum ProcessingStatus {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  PLANNING = 'planning',
  RESEARCHING = 'researching',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// Message interfaces
export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: string;
  client_id: string;
  request_id?: string;
}

export interface ClientMessage extends BaseMessage {
  data: any;
}

export interface ServerMessage extends BaseMessage {
  status: ProcessingStatus;
  data: any;
}

export interface ProgressUpdate {
  step: string;
  progress: number;
  message: string;
  step_data?: any;
}

export interface SlideComplete {
  slide_html: string;
  slide_name: string;
  metadata: any;
  generation_time: number;
}

export interface ContentPlanResponse {
  content_plan: string;
  suggestions: string[];
  estimated_slide_count: number;
}

export interface ErrorResponse {
  error_code: string;
  error_message: string;
  details?: string;
  retry_possible: boolean;
}

// Event callback types
export type MessageCallback = (message: ServerMessage) => void;
export type ProgressCallback = (progress: ProgressUpdate) => void;
export type ErrorCallback = (error: ErrorResponse) => void;
export type ConnectionCallback = (connected: boolean) => void;

export interface WebSocketCallbacks {
  onMessage?: MessageCallback;
  onProgress?: ProgressCallback;
  onSlideComplete?: (slide: SlideComplete) => void;
  onContentPlan?: (plan: ContentPlanResponse) => void;
  onError?: ErrorCallback;
  onConnection?: ConnectionCallback;
}

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

interface PendingRequest {
  id: string;
  type: MessageType;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  timestamp: number;
}

class ImprovedWebSocketService {
  private static instance: ImprovedWebSocketService;
  private websocket: WebSocket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private clientId: string = '';
  private callbacks: WebSocketCallbacks = {};
  
  // Connection management
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout = 45000; // 45 seconds
  
  // Message handling
  private messageQueue: ClientMessage[] = [];
  private pendingRequests = new Map<string, PendingRequest>();
  private requestTimeout = 30000; // 30 seconds
  
  // Logging
  private logger = createServiceLogger('websocket');
  private wsLogger = createWebSocketLogger();
  
  public static getInstance(): ImprovedWebSocketService {
    if (!ImprovedWebSocketService.instance) {
      ImprovedWebSocketService.instance = new ImprovedWebSocketService();
    }
    return ImprovedWebSocketService.instance;
  }

  private constructor() {
    this.logger.info('WebSocket service initialized');
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(clientId: string, callbacks: WebSocketCallbacks = {}): Promise<boolean> {
    if (this.connectionState === ConnectionState.CONNECTING) {
      throw new Error('Connection already in progress');
    }

    if (this.connectionState === ConnectionState.CONNECTED && this.clientId === clientId) {
      this.wsLogger.logConnection(clientId, 'connected', { reason: 'already_connected' });
      return true;
    }

    // Disconnect existing connection if different client
    if (this.connectionState === ConnectionState.CONNECTED && this.clientId !== clientId) {
      this.wsLogger.logConnection(this.clientId!, 'disconnected', { reason: 'client_change' });
      await this.disconnect();
    }

    this.clientId = clientId;
    this.callbacks = callbacks;
    
    this.wsLogger.logConnection(clientId, 'connecting');
    
    return new Promise((resolve, reject) => {
      try {
        this.connectionState = ConnectionState.CONNECTING;
        this.notifyConnectionChange(false);

        const wsUrl = this.getWebSocketUrl(clientId);
        console.log(`Connecting to WebSocket: ${wsUrl}`);

        this.websocket = new WebSocket(wsUrl);

        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
          this.handleConnectionFailure();
        }, 10000); // 10 second timeout

        this.websocket.onopen = () => {
          clearTimeout(connectionTimeout);
          this.wsLogger.logConnection(clientId, 'connected', { 
            reconnectAttempts: this.reconnectAttempts 
          });
          
          this.connectionState = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          this.notifyConnectionChange(true);
          
          resolve(true);
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.websocket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.wsLogger.logConnection(clientId, 'disconnected', { 
            code: event.code, 
            reason: event.reason 
          });
          
          this.handleDisconnection(event.code !== 1000); // Reconnect if not normal close
        };

        this.websocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocket error:', error);
          
          if (this.connectionState === ConnectionState.CONNECTING) {
            reject(new Error('Connection failed'));
          }
          
          this.handleConnectionFailure();
        };

      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        this.connectionState = ConnectionState.FAILED;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public async disconnect(): Promise<void> {
    console.log('Disconnecting WebSocket...');
    
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.clearPendingRequests();
    
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    
    this.connectionState = ConnectionState.DISCONNECTED;
    this.notifyConnectionChange(false);
  }

  /**
   * Send a message to the server
   */
  public async sendMessage<T = any>(type: MessageType, data: any = {}): Promise<T> {
    const message: ClientMessage = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      client_id: this.clientId,
      data
    };

    // If not connected, queue the message
    if (this.connectionState !== ConnectionState.CONNECTED) {
      console.log(`Queueing message of type ${type} (not connected)`);
      this.messageQueue.push(message);
      return Promise.reject(new Error('Not connected'));
    }

    return new Promise((resolve, reject) => {
      try {
        // Create pending request for tracking
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(message.id);
          reject(new Error(`Request timeout for ${type}`));
        }, this.requestTimeout);

        this.pendingRequests.set(message.id, {
          id: message.id,
          type,
          resolve,
          reject,
          timeout,
          timestamp: Date.now()
        });

        // Send message
        this.websocket!.send(JSON.stringify(message));
        console.log(`Message sent: ${type}`, message);

      } catch (error) {
        console.error(`Error sending message ${type}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Send file upload message
   */
  public async sendFileUpload(filename: string, content: string, fileType: string, fileSize: number): Promise<any> {
    return this.sendMessage(MessageType.FILE_UPLOAD, {
      filename,
      content,
      file_type: fileType,
      file_size: fileSize
    });
  }

  /**
   * Send theme selection message
   */
  public async sendThemeSelection(themeId: string, themeName: string, colorPalette: string[], slideCount: number = 1): Promise<any> {
    return this.sendMessage(MessageType.THEME_SELECTION, {
      theme_id: themeId,
      theme_name: themeName,
      color_palette: colorPalette,
      slide_count: slideCount
    });
  }

  /**
   * Send content planning message
   */
  public async sendContentPlanning(contentOutline?: string, includeResearch: boolean = false, researchTopics: string[] = []): Promise<ContentPlanResponse> {
    return this.sendMessage<ContentPlanResponse>(MessageType.CONTENT_PLANNING, {
      content_outline: contentOutline,
      include_research: includeResearch,
      research_topics: researchTopics
    });
  }

  /**
   * Send slide generation message
   */
  public async sendSlideGeneration(contentPlan: any, themeConfig: any, generationOptions: any = {}): Promise<SlideComplete> {
    return this.sendMessage<SlideComplete>(MessageType.SLIDE_GENERATION, {
      content_plan: contentPlan,
      theme_config: themeConfig,
      generation_options: generationOptions
    });
  }

  /**
   * Send slide description message (compatibility with old interface)
   */
  public async sendSlideDescription(description: string): Promise<any> {
    return this.sendMessage<any>('slide_description', {
      description
    });
  }

  /**
   * Send research request message (compatibility with old interface)
   */
  public async sendResearchRequest(description: string, researchOptions: any, wantsResearch: boolean): Promise<any> {
    return this.sendMessage<any>('research_request', {
      description,
      research_options: researchOptions,
      wants_research: wantsResearch
    });
  }

  /**
   * Send generate slide message (compatibility with old interface)
   */
  public async sendGenerateSlide(description: string, theme: string = "default", wantsResearch: boolean = false, useAIAgent: boolean = false, contentStyle: string = "professional"): Promise<any> {
    return this.sendMessage<any>('generate_slide', {
      description,
      theme,
      wants_research: wantsResearch,
      use_ai_agent: useAIAgent,
      content_style: contentStyle
    });
  }

  /**
   * Send step guidance request message (compatibility with old interface)
   */
  public async sendStepGuidanceRequest(currentStep: string): Promise<any> {
    return this.sendMessage<any>('get_step_guidance', {
      current_step: currentStep
    });
  }

  /**
   * Send session status request message (compatibility with old interface)
   */
  public async sendSessionStatusRequest(): Promise<any> {
    return this.sendMessage<any>('get_session_status', {});
  }

  /**
   * Send process slide message (compatibility with old interface)
   */
  public async sendProcessSlide(options: any): Promise<any> {
    return this.sendMessage<any>('process_slide', options);
  }

  /**
   * Send status request
   */
  public async sendStatusRequest(): Promise<any> {
    return this.sendMessage(MessageType.STATUS_REQUEST);
  }

  /**
   * Get connection status
   */
  public isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getClientId(): string {
    return this.clientId;
  }

  // Private methods

  private getWebSocketUrl(clientId: string): string {
    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000';
    return `${wsUrl}/ws/${clientId}`;
  }

  private handleMessage(data: string): void {
    try {
      const message: ServerMessage = JSON.parse(data);
      
      this.wsLogger.logMessage(
        this.clientId || 'unknown',
        message.type,
        message.id,
        'received',
        { dataSize: data.length, hasRequestId: !!message.request_id }
      );

      // Handle pending request responses
      if (message.request_id && this.pendingRequests.has(message.request_id)) {
        const pendingRequest = this.pendingRequests.get(message.request_id)!;
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(message.request_id);

        if (message.type === MessageType.ERROR_RESPONSE) {
          pendingRequest.reject(new Error(message.data.error_message));
        } else {
          pendingRequest.resolve(message.data);
        }
        return;
      }

      // Handle specific message types
      switch (message.type) {
        case MessageType.SESSION_INITIALIZED:
          console.log('Session initialized:', message.data);
          break;

        case MessageType.PROGRESS_UPDATE:
          const progressData = message.data as ProgressUpdate;
          this.wsLogger.logProgress(
            this.clientId || 'unknown',
            progressData.step,
            progressData.progress,
            progressData.message
          );
          if (this.callbacks.onProgress) {
            this.callbacks.onProgress(progressData);
          }
          break;

        case MessageType.SLIDE_COMPLETE:
          if (this.callbacks.onSlideComplete) {
            this.callbacks.onSlideComplete(message.data as SlideComplete);
          }
          break;

        case MessageType.CONTENT_PLAN_RESPONSE:
          if (this.callbacks.onContentPlan) {
            this.callbacks.onContentPlan(message.data as ContentPlanResponse);
          }
          break;

        case MessageType.ERROR_RESPONSE:
          if (this.callbacks.onError) {
            this.callbacks.onError(message.data as ErrorResponse);
          }
          break;

        case MessageType.PONG:
          // Heartbeat response - connection is alive
          break;

        case MessageType.ACKNOWLEDGE:
          console.log('Message acknowledged:', message.data);
          break;

        default:
          console.log('Unhandled message type:', message.type);
      }

      // Call general message callback
      if (this.callbacks.onMessage) {
        this.callbacks.onMessage(message);
      }

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleDisconnection(shouldReconnect: boolean): void {
    this.stopHeartbeat();
    
    if (this.connectionState === ConnectionState.CONNECTED) {
      this.connectionState = shouldReconnect ? ConnectionState.RECONNECTING : ConnectionState.DISCONNECTED;
      this.notifyConnectionChange(false);
    }

    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.connectionState = ConnectionState.FAILED;
      console.error('Max reconnection attempts reached');
    }
  }

  private handleConnectionFailure(): void {
    this.stopHeartbeat();
    this.connectionState = ConnectionState.FAILED;
    this.notifyConnectionChange(false);
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect(this.clientId, this.callbacks);
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.handleDisconnection(true);
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === ConnectionState.CONNECTED) {
        this.sendMessage(MessageType.PING).catch(() => {
          console.warn('Heartbeat failed');
        });
      }
    }, this.heartbeatTimeout);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`Processing ${this.messageQueue.length} queued messages`);
      
      const messages = [...this.messageQueue];
      this.messageQueue = [];
      
      messages.forEach(message => {
        if (this.websocket && this.connectionState === ConnectionState.CONNECTED) {
          this.websocket.send(JSON.stringify(message));
        }
      });
    }
  }

  private clearPendingRequests(): void {
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();
  }

  private notifyConnectionChange(connected: boolean): void {
    if (this.callbacks.onConnection) {
      this.callbacks.onConnection(connected);
    }
  }
}

// Export singleton instance
export const improvedWebSocketService = ImprovedWebSocketService.getInstance();
export default improvedWebSocketService;