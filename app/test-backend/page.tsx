"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackendStatus } from "@/components/backend-status";
import { useWebSocket } from "@/hooks/use-websocket";
import { BackendService } from "@/services/backend-service";

export default function TestBackendPage() {
  // Use useRef to ensure client ID is stable across re-renders and avoid hydration issues
  const clientIdRef = useRef<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);

  // Generate client ID only on the client side to avoid hydration issues
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = `test_client_${Date.now()}`;
      setClientId(clientIdRef.current);
    }
  }, []);

  const { 
    isConnected, 
    connectionStatus, 
    lastMessage,
    sendFileUpload, 
    sendSlideDescription,
    sendProcessSlide,
    ping 
  } = useWebSocket({
    clientId: clientId || 'temp_test_client',
    onMessage: (message) => {
      console.log('Test page received:', message);
      setMessages(prev => [...prev, message]);
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setUploadStatus(`Uploading ${file.name}...`);
        await sendFileUpload(file, true); // Always use knowledge graph for testing
        setUploadStatus(`Successfully uploaded ${file.name}`);
      } catch (error) {
        setUploadStatus(`Failed to upload ${file.name}: ${error}`);
      }
    }
  };

  const handleSendDescription = async () => {
    if (description.trim()) {
      try {
        setUploadStatus('Sending description...');
        await sendSlideDescription(description);
        setUploadStatus('Description sent successfully');
      } catch (error) {
        setUploadStatus(`Failed to send description: ${error}`);
      }
    }
  };

  const handleProcessSlide = async () => {
    try {
      setUploadStatus('Processing slide...');
      await sendProcessSlide({ theme: 'professional', layout: 'standard' });
      setUploadStatus('Slide processing started');
    } catch (error) {
      setUploadStatus(`Failed to process slide: ${error}`);
    }
  };

  // Don't render until client ID is generated to avoid hydration issues
  if (!clientId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Backend WebSocket Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BackendStatus 
                clientId={clientId}
                isConnected={isConnected}
                connectionStatus={connectionStatus}
                lastMessage={lastMessage}
                onPing={ping}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle>Connection Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                      {connectionStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connected:</span>
                    <span>{isConnected ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Client ID:</span>
                    <span className="text-xs font-mono">{clientId}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Test Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Test Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload Test */}
                <div className="space-y-2">
                  <Label htmlFor="file-upload">File Upload Test</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    accept=".txt,.pdf,.docx,.md"
                  />
                </div>

                {/* Description Test */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description Test</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter slide description..."
                  />
                  <Button onClick={handleSendDescription} disabled={!isConnected}>
                    Send Description
                  </Button>
                </div>

                {/* Process Slide Test */}
                <div className="space-y-2">
                  <Button onClick={handleProcessSlide} disabled={!isConnected}>
                    Process Slide
                  </Button>
                </div>

                {/* Ping Test */}
                <div className="space-y-2">
                  <Button onClick={() => ping()} disabled={!isConnected}>
                    Ping Backend
                  </Button>
                </div>

                {/* Status */}
                {uploadStatus && (
                  <div className="p-2 bg-muted rounded">
                    <span className="text-sm">{uploadStatus}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Message Log */}
            <Card>
              <CardHeader>
                <CardTitle>Message Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {messages.map((message, index) => (
                    <div key={index} className="p-2 bg-muted rounded text-xs">
                      <div className="font-medium">{message.type}</div>
                      <div className="text-muted-foreground">
                        {JSON.stringify(message.data, null, 2)}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-muted-foreground text-sm">
                      No messages received yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 