/**
 * Improved WebSocket React Hook with better state management and type safety
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import improvedWebSocketService, {
  MessageType,
  ProcessingStatus,
  WebSocketCallbacks,
  ProgressUpdate,
  SlideComplete,
  ContentPlanResponse,
  ErrorResponse
} from '@/services/improved-websocket-service';

export interface WebSocketState {
  isConnected: boolean;
  connectionState: string;
  currentStep: string;
  progress: number;
  lastMessage: string;
  isProcessing: boolean;
  error: string | null;
}

export interface UseWebSocketOptions {
  clientId: string;
  autoConnect?: boolean;
  onProgress?: (progress: ProgressUpdate) => void;
  onSlideComplete?: (slide: SlideComplete) => void;
  onContentPlan?: (plan: ContentPlanResponse) => void;
  onError?: (error: ErrorResponse) => void;
}

export interface UseWebSocketReturn {
  // State
  state: WebSocketState;
  
  // Connection methods
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  
  // Message sending methods
  sendFileUpload: (file: File) => Promise<any>;
  sendThemeSelection: (themeId: string, themeName: string, colors: string[], slideCount?: number) => Promise<any>;
  sendContentPlanning: (outline?: string, includeResearch?: boolean, topics?: string[]) => Promise<ContentPlanResponse>;
  sendSlideGeneration: (contentPlan: any, themeConfig: any, options?: any) => Promise<SlideComplete>;
  sendStatusRequest: () => Promise<any>;
  
  // Utility methods
  isConnected: boolean;
  clientId: string;
}

export function useImprovedWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { 
    clientId, 
    autoConnect = true, 
    onProgress, 
    onSlideComplete, 
    onContentPlan, 
    onError 
  } = options;

  // State
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    connectionState: 'disconnected',
    currentStep: 'idle',
    progress: 0,
    lastMessage: '',
    isProcessing: false,
    error: null
  });

  // Refs to avoid stale closures
  const optionsRef = useRef(options);
  const stateRef = useRef(state);
  
  // Update refs when props change
  useEffect(() => {
    optionsRef.current = options;
    stateRef.current = state;
  });

  // Memoized callbacks to prevent unnecessary re-renders
  const callbacks = useMemo((): WebSocketCallbacks => ({
    onConnection: (connected: boolean) => {
      setState(prev => ({
        ...prev,
        isConnected: connected,
        connectionState: connected ? 'connected' : 'disconnected',
        error: connected ? null : prev.error
      }));
    },

    onProgress: (progress: ProgressUpdate) => {
      setState(prev => ({
        ...prev,
        currentStep: progress.step,
        progress: progress.progress,
        lastMessage: progress.message,
        isProcessing: progress.progress > 0 && progress.progress < 100,
        error: null
      }));

      // Call user callback
      if (optionsRef.current.onProgress) {
        optionsRef.current.onProgress(progress);
      }
    },

    onSlideComplete: (slide: SlideComplete) => {
      setState(prev => ({
        ...prev,
        currentStep: 'completed',
        progress: 100,
        lastMessage: 'Slide generation completed',
        isProcessing: false,
        error: null
      }));

      if (optionsRef.current.onSlideComplete) {
        optionsRef.current.onSlideComplete(slide);
      }
    },

    onContentPlan: (plan: ContentPlanResponse) => {
      setState(prev => ({
        ...prev,
        lastMessage: 'Content plan generated',
        isProcessing: false,
        error: null
      }));

      if (optionsRef.current.onContentPlan) {
        optionsRef.current.onContentPlan(plan);
      }
    },

    onError: (error: ErrorResponse) => {
      setState(prev => ({
        ...prev,
        error: error.error_message,
        isProcessing: false,
        lastMessage: `Error: ${error.error_message}`
      }));

      if (optionsRef.current.onError) {
        optionsRef.current.onError(error);
      }
    }
  }), []);

  // Connection methods
  const connect = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, connectionState: 'connecting', error: null }));
      
      const connected = await improvedWebSocketService.connect(clientId, callbacks);
      
      setState(prev => ({
        ...prev,
        isConnected: connected,
        connectionState: connected ? 'connected' : 'failed',
        error: connected ? null : 'Failed to connect'
      }));
      
      return connected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionState: 'failed',
        error: errorMessage
      }));
      return false;
    }
  }, [clientId, callbacks]);

  const disconnect = useCallback(async (): Promise<void> => {
    await improvedWebSocketService.disconnect();
    setState(prev => ({
      ...prev,
      isConnected: false,
      connectionState: 'disconnected',
      isProcessing: false,
      error: null
    }));
  }, []);

  // File upload helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:mime/type;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Message sending methods
  const sendFileUpload = useCallback(async (file: File): Promise<any> => {
    if (!improvedWebSocketService.isConnected()) {
      throw new Error('Not connected to WebSocket');
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const base64Content = await fileToBase64(file);
      
      return await improvedWebSocketService.sendFileUpload(
        file.name,
        base64Content,
        file.type,
        file.size
      );
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: error instanceof Error ? error.message : 'File upload failed' 
      }));
      throw error;
    }
  }, []);

  const sendThemeSelection = useCallback(async (
    themeId: string, 
    themeName: string, 
    colors: string[], 
    slideCount: number = 1
  ): Promise<any> => {
    if (!improvedWebSocketService.isConnected()) {
      throw new Error('Not connected to WebSocket');
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      return await improvedWebSocketService.sendThemeSelection(themeId, themeName, colors, slideCount);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Theme selection failed' 
      }));
      throw error;
    }
  }, []);

  const sendContentPlanning = useCallback(async (
    outline?: string, 
    includeResearch: boolean = false, 
    topics: string[] = []
  ): Promise<ContentPlanResponse> => {
    if (!improvedWebSocketService.isConnected()) {
      throw new Error('Not connected to WebSocket');
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      return await improvedWebSocketService.sendContentPlanning(outline, includeResearch, topics);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: error instanceof Error ? error.message : 'Content planning failed' 
      }));
      throw error;
    }
  }, []);

  const sendSlideGeneration = useCallback(async (
    contentPlan: any, 
    themeConfig: any, 
    options: any = {}
  ): Promise<SlideComplete> => {
    if (!improvedWebSocketService.isConnected()) {
      throw new Error('Not connected to WebSocket');
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      return await improvedWebSocketService.sendSlideGeneration(contentPlan, themeConfig, options);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: error instanceof Error ? error.message : 'Slide generation failed' 
      }));
      throw error;
    }
  }, []);

  const sendStatusRequest = useCallback(async (): Promise<any> => {
    if (!improvedWebSocketService.isConnected()) {
      throw new Error('Not connected to WebSocket');
    }

    try {
      return await improvedWebSocketService.sendStatusRequest();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Status request failed' 
      }));
      throw error;
    }
  }, []);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && clientId) {
      connect().catch(error => {
        console.error('Auto-connect failed:', error);
      });
    }

    return () => {
      if (autoConnect) {
        disconnect().catch(error => {
          console.error('Auto-disconnect failed:', error);
        });
      }
    };
  }, [clientId, autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (improvedWebSocketService.isConnected()) {
        improvedWebSocketService.disconnect().catch(console.error);
      }
    };
  }, []);

  return {
    state,
    connect,
    disconnect,
    sendFileUpload,
    sendThemeSelection,
    sendContentPlanning,
    sendSlideGeneration,
    sendStatusRequest,
    isConnected: state.isConnected,
    clientId
  };
}

export default useImprovedWebSocket;