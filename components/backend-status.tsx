"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";

interface BackendStatusProps {
  clientId?: string;
  isConnected?: boolean;
  connectionStatus?: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastMessage?: any;
  onPing?: () => void;
}

export function BackendStatus({ 
  clientId, 
  isConnected = false, 
  connectionStatus = 'disconnected',
  lastMessage,
  onPing 
}: BackendStatusProps) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    if (isConnected) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (connectionStatus === 'error') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Backend Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection:</span>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {connectionStatus}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        </div>

        {clientId && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Client ID:</span>
            <span className="text-xs font-mono">{clientId}</span>
          </div>
        )}

        {lastMessage && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Last Message:</span>
            <div className="text-xs bg-muted p-2 rounded">
              <div className="font-medium">{lastMessage.type}</div>
              <div className="text-muted-foreground">
                {JSON.stringify(lastMessage.data, null, 2)}
              </div>
            </div>
          </div>
        )}

        {onPing && (
          <div className="flex gap-2">
            <button
              onClick={onPing}
              disabled={!isConnected}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Ping
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 