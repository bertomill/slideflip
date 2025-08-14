"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, X, ArrowRight, Type, Sparkles, Mic, Square } from "lucide-react";
import { SlideData } from "@/app/build/page";
import { useImprovedWebSocket, ProgressUpdate } from "@/hooks/use-improved-websocket";
import { useUser } from "@/lib/supabase/client";

// Minimal types to avoid 'any' while supporting browser SpeechRecognition
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: Array<{ 0: { transcript: string }; isFinal: boolean }>;
};

type MinimalSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

// Interface defining props for the UploadStep component
interface ImprovedUploadStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
}

export function ImprovedUploadStep({ 
  slideData, 
  updateSlideData, 
  onNext
}: ImprovedUploadStepProps) {
  const user = useUser();
  const clientId = user?.id || `anonymous_${Date.now()}`;
  
  // Use the improved WebSocket hook
  const {
    state,
    sendFileUpload,
    isConnected
  } = useImprovedWebSocket({
    clientId,
    autoConnect: true,
    onProgress: (progress: ProgressUpdate) => {
      setUploadStatus(`${progress.step}: ${progress.message} (${progress.progress}%)`);
    },
    onError: (error) => {
      setUploadStatus(`Error: ${error.error_message}`);
      setIsUploading(false);
    }
  });

  type ModelAwareSlideData = SlideData & { selectedModel?: string };
  const modelAwareSlideData = slideData as ModelAwareSlideData;
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const descriptionRef = useRef<string>(slideData.description);

  // Keep a ref of latest description so speech results append correctly
  useEffect(() => {
    descriptionRef.current = slideData.description;
  }, [slideData.description]);

  // Update status based on WebSocket state
  useEffect(() => {
    if (state.isConnected) {
      if (state.isProcessing) {
        setUploadStatus(`Processing: ${state.lastMessage}`);
      } else if (state.error) {
        setUploadStatus(`Error: ${state.error}`);
      } else if (state.currentStep === 'completed') {
        setUploadStatus("Upload completed successfully!");
        setIsUploading(false);
      }
    } else {
      setUploadStatus(`Connection: ${state.connectionState}`);
    }
  }, [state]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      setIsSpeechSupported(true);
      const SpeechRecognition = (window as any).webkitSpeechRecognition as SpeechRecognitionConstructor;
      recognitionRef.current = new SpeechRecognition();
      
      if (recognitionRef.current) {
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.interimResults = true;
        recognitionRef.current.continuous = true;

        recognitionRef.current.onresult = (event: SpeechRecognitionEventLike) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          
          // Append to existing description rather than replacing
          const newDescription = descriptionRef.current + ' ' + transcript;
          updateSlideData({ description: newDescription.trim() });
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
        };
      }
    }
  }, [updateSlideData]);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      
      // Update local state
      updateSlideData({ documents: [...slideData.documents, ...files] });
      
      // Upload to backend using improved WebSocket
      if (isConnected) {
        setIsUploading(true);
        for (const file of files) {
          try {
            console.log('Uploading file to backend:', file.name);
            setUploadStatus(`Uploading ${file.name}...`);
            await sendFileUpload(file);
          } catch (error) {
            console.error('Failed to upload file:', error);
            setUploadStatus(`Failed to upload ${file.name}`);
            setIsUploading(false);
          }
        }
      }
    }
  }, [slideData.documents, updateSlideData, sendFileUpload, isConnected]);

  // Handle file selection through input element
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Update local state
      updateSlideData({ documents: [...slideData.documents, ...files] });
      
      // Upload to backend using improved WebSocket
      if (isConnected) {
        setIsUploading(true);
        for (const file of files) {
          try {
            console.log('Uploading file to backend:', file.name);
            setUploadStatus(`Uploading ${file.name}...`);
            await sendFileUpload(file);
          } catch (error) {
            console.error('Failed to upload file:', error);
            setUploadStatus(`Failed to upload ${file.name}`);
            setIsUploading(false);
          }
        }
      }
    }
  };

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Remove file
  const removeFile = (index: number) => {
    const newDocuments = [...slideData.documents];
    newDocuments.splice(index, 1);
    updateSlideData({ documents: newDocuments });
  };

  // Handle pasted text upload
  const handlePastedTextUpload = async () => {
    if (pastedText.trim()) {
      const textFile = new File([pastedText], "pasted-text.txt", { type: "text/plain" });
      updateSlideData({ documents: [...slideData.documents, textFile] });
      
      // Upload to backend using improved WebSocket
      if (isConnected) {
        setIsUploading(true);
        try {
          console.log('Uploading pasted text to backend');
          setUploadStatus('Uploading pasted text...');
          await sendFileUpload(textFile);
          setPastedText("");
          setShowTextInput(false);
        } catch (error) {
          console.error('Failed to upload pasted text:', error);
          setUploadStatus('Failed to upload pasted text');
          setIsUploading(false);
        }
      }
    }
  };

  // Voice input controls
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`p-2 rounded text-sm ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {isConnected ? '🟢 Connected to server' : '🟡 Connecting to server...'}
      </div>

      {/* Upload Status */}
      {uploadStatus && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">{uploadStatus}</p>
          {state.progress > 0 && (
            <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${state.progress}%` }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Upload your documents to generate professional slides
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop your files here, or{" "}
              <label className="text-blue-600 hover:text-blue-500 cursor-pointer">
                browse
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileInput}
                  disabled={isUploading}
                />
              </label>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports PDF, DOCX, TXT, and MD files
            </p>
          </div>

          {/* Text Input Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTextInput(!showTextInput)}
              className="flex items-center gap-2"
            >
              <Type className="h-4 w-4" />
              Paste Text
            </Button>

            {/* Voice Input Button */}
            {isSpeechSupported && (
              <Button
                type="button"
                variant="outline"
                onClick={isListening ? stopListening : startListening}
                className={`flex items-center gap-2 ${
                  isListening ? "bg-red-50 border-red-200 text-red-700" : ""
                }`}
              >
                {isListening ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {isListening ? "Stop" : "Voice"}
              </Button>
            )}
          </div>

          {/* Text Input Area */}
          {showTextInput && (
            <div className="space-y-2">
              <Label htmlFor="pastedText">Paste your text content</Label>
              <textarea
                id="pastedText"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none"
                placeholder="Paste your text content here..."
              />
              <Button
                onClick={handlePastedTextUpload}
                disabled={!pastedText.trim() || isUploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Text
              </Button>
            </div>
          )}

          {/* Uploaded Files List */}
          {slideData.documents.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Files</Label>
              <div className="space-y-2">
                {slideData.documents.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slide Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Slide Description
          </CardTitle>
          <CardDescription>
            Describe what you want your slides to be about (optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={slideData.description}
              onChange={(e) => updateSlideData({ description: e.target.value })}
              className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none"
              placeholder="Optional: Describe what you want your slides to focus on..."
            />
            {isListening && (
              <p className="text-sm text-red-600 animate-pulse">
                🎤 Listening... Speak now
              </p>
            )}
          </div>

          {/* AI Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model-select">AI Model</Label>
            <Select
              value={modelAwareSlideData.selectedModel || "gpt-4"}
              onValueChange={(value) => updateSlideData({ selectedModel: value })}
            >
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4 (Recommended)</SelectItem>
                <SelectItem value="gpt-4-mini">GPT-4 Mini (Faster)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Next Button */}
      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={slideData.documents.length === 0 || isUploading || !isConnected}
          className="flex items-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}