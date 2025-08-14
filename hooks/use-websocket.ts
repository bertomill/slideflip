import { useState, useEffect, useCallback, useRef } from 'react';
import { websocketService } from '@/services/websocket-service';

interface WebSocketMessage {
  type: string;
  data: any;
}

interface UseWebSocketProps {
  clientId: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  onOpen?: () => void;
  onProgressUpdate?: (step: string, progress: number, message: string, stepData?: any) => void;
}

export function useWebSocket({
  clientId,
  onMessage,
  onError,
  onClose,
  onOpen,
  onProgressUpdate
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const isInitialized = useRef(false);
  const lastClientId = useRef<string | null>(null);
  const pingInterval = useRef<NodeJS.Timeout | null>(null);

  // Update connection status from service
  const updateConnectionStatus = useCallback(() => {
    const status = websocketService.getConnectionStatus();
    const connected = websocketService.isConnected();
    
    setConnectionStatus(status);
    setIsConnected(connected);
  }, []);

  // Initialize connection
  useEffect(() => {
    // Don't connect if client ID is temporary or hasn't changed
    if (clientId.startsWith('temp_') || clientId === lastClientId.current) {
      return;
    }

    lastClientId.current = clientId;
    isInitialized.current = true;

    const connectToService = async () => {
      const success = await websocketService.connect(clientId, {
        onMessage: (message) => {
          setLastMessage(message);
          onMessage?.(message);
        },
        onError: (error) => {
          updateConnectionStatus();
          onError?.(error);
        },
        onClose: () => {
          updateConnectionStatus();
          onClose?.();
        },
        onOpen: () => {
          updateConnectionStatus();
          onOpen?.();
        },
        onProgressUpdate: (step, progress, message, stepData) => {
          onProgressUpdate?.(step, progress, message, stepData);
        }
      });

      if (success) {
        updateConnectionStatus();
      }
    };

    connectToService();

    // Set up periodic status updates
    const statusInterval = setInterval(updateConnectionStatus, 1000);

    return () => {
      clearInterval(statusInterval);
      // Don't disconnect here as other components might be using the service
    };
  }, [clientId, onMessage, onError, onClose, onOpen, updateConnectionStatus, onProgressUpdate]);

  const ping = useCallback(() => {
    return websocketService.ping();
  }, []);

  // Add ping interval to keep connection alive
  useEffect(() => {
    if (isConnected) {
      // Send initial ping immediately
      ping();
      
      // Then set up recurring ping
      pingInterval.current = setInterval(() => {
        ping();
      }, 45000);
      
      return () => {
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }
      };
    }
  }, [isConnected, ping]);

  const connect = useCallback(async () => {
    if (clientId.startsWith('temp_')) {
      return;
    }

    const success = await websocketService.connect(clientId, {
      onMessage: (message) => {
        setLastMessage(message);
        onMessage?.(message);
      },
      onError: (error) => {
        updateConnectionStatus();
        onError?.(error);
      },
      onClose: () => {
        updateConnectionStatus();
        onClose?.();
      },
      onOpen: () => {
        updateConnectionStatus();
        onOpen?.();
      },
      onProgressUpdate: (step, progress, message, stepData) => {
        onProgressUpdate?.(step, progress, message, stepData);
      }
    });

    if (success) {
      updateConnectionStatus();
    }
  }, [clientId, onMessage, onError, onClose, onOpen, updateConnectionStatus, onProgressUpdate]);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    return websocketService.sendMessage(message);
  }, []);

  const sendFileUpload = useCallback(async (file: File) => {
    return websocketService.sendFileUpload(file);
  }, []);

  const sendSlideDescription = useCallback((description: string) => {
    return websocketService.sendSlideDescription(description);
  }, []);

  const sendGenerateSlide = useCallback((description: string, theme: string = "default", wantsResearch: boolean = false, useAIAgent: boolean = false, contentStyle: string = "professional") => {
    return websocketService.sendGenerateSlide(description, theme, wantsResearch, useAIAgent, contentStyle);
  }, []);

  const sendThemeSelection = useCallback((themeData: any) => {
    return websocketService.sendThemeSelection(themeData);
  }, []);

  const sendResearchRequest = useCallback((description: string, researchOptions: any, wantsResearch: boolean) => {
    return websocketService.sendResearchRequest(description, researchOptions, wantsResearch);
  }, []);

  const sendContentPlanning = useCallback((
    description: string, 
    documents: any[], 
    researchData?: string, 
    userFeedback?: string, 
    theme?: string
  ) => {
    return websocketService.sendContentPlanning(description, documents, researchData, userFeedback, theme);
  }, []);

  const sendStepGuidanceRequest = useCallback((currentStep: string) => {
    return websocketService.sendStepGuidanceRequest(currentStep);
  }, []);

  const sendSessionStatusRequest = useCallback(() => {
    return websocketService.sendSessionStatusRequest();
  }, []);

  const sendProcessSlide = useCallback((options?: any) => {
    return websocketService.sendProcessSlide(options);
  }, []);



  return {
    isConnected,
    connectionStatus,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    sendFileUpload,
    sendSlideDescription,
    sendGenerateSlide,
    sendThemeSelection,
    sendResearchRequest,
    sendContentPlanning,
    sendStepGuidanceRequest,
    sendSessionStatusRequest,
    sendProcessSlide,
    ping
  };
} 