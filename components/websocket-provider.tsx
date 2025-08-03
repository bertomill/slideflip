"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { websocketService } from '@/services/websocket-service';

interface WebSocketContextType {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  clientId: string | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  connectionStatus: 'disconnected',
  clientId: null,
});

export const useWebSocketContext = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update connection status from service
  const updateConnectionStatus = useCallback(() => {
    const status = websocketService.getConnectionStatus();
    const connected = websocketService.isConnected();
    const currentClientId = websocketService.getClientId();
    
    setConnectionStatus(status);
    setIsConnected(connected);
    setClientId(currentClientId);
  }, []);

  useEffect(() => {
    // Set up periodic status updates
    statusIntervalRef.current = setInterval(updateConnectionStatus, 1000);

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [updateConnectionStatus]);

  const contextValue: WebSocketContextType = {
    isConnected,
    connectionStatus,
    clientId,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
} 