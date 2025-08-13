"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, X, ArrowRight, Type, Sparkles, Mic, Square, Eye, CheckCircle, Clock, XCircle } from "lucide-react";
import { SlideData } from "@/app/build/page";

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

type BackendMessage = {
  type: string;
  data: {
    filename?: string;
    error?: string;
    file_path?: string;
    file_size?: number;
    file_type?: string;
    content_info?: { text?: string; text_length?: number };
  };
};

// Interface defining props for the UploadStep component
interface UploadStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  // WebSocket props
  isConnected?: boolean;
  connectionStatus?: string;
  sendFileUpload?: (file: File) => Promise<boolean>;
  sendSlideDescription?: (description: string) => boolean;
  lastMessage?: BackendMessage;
}

export function UploadStep({ 
  slideData, 
  updateSlideData, 
  onNext,
  isConnected = false,
  connectionStatus = 'disconnected',
  sendFileUpload,
  sendSlideDescription,
  lastMessage
}: UploadStepProps) {
  type ModelAwareSlideData = SlideData & { selectedModel?: string };
  const modelAwareSlideData = slideData as ModelAwareSlideData;
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing] = useState(false);
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const [parsingFiles, setParsingFiles] = useState<Set<string>>(new Set());
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const parsingFilesRef = useRef<Set<string>>(new Set());
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const descriptionRef = useRef<string>(slideData.description);

  // Keep a ref of latest description so speech results append correctly
  useEffect(() => {
    descriptionRef.current = slideData.description;
  }, [slideData.description]);

  // Handle backend messages
  useEffect(() => {
    if (!lastMessage) return;
    
    // Create a unique message ID to prevent processing the same message multiple times
    const messageId = `${lastMessage.type}_${Date.now()}_${JSON.stringify(lastMessage.data).slice(0, 50)}`;
    
    // Skip if we've already processed this message
    if (processedMessagesRef.current.has(messageId)) {
      return;
    }
    
    // Mark message as processed
    processedMessagesRef.current.add(messageId);
    
    // Clean up old message IDs to prevent memory leak (keep only last 10)
    if (processedMessagesRef.current.size > 10) {
      const ids = Array.from(processedMessagesRef.current);
      processedMessagesRef.current = new Set(ids.slice(-10));
    }
    
    console.log('🔄 Processing message:', lastMessage.type, 'for file:', lastMessage.data?.filename);
    console.log('🔄 Full message:', lastMessage);
    
    if (lastMessage.type === 'file_upload_success') {
      const name = lastMessage.data?.filename || "";
      console.log('Processing success for file:', name);
      
      // Clear the upload status after showing success briefly
      setUploadStatus(`Successfully uploaded ${name}`);
      setTimeout(() => setUploadStatus(""), 3000);
      
      // If backend provided a text snippet, store it for preview
      const text = lastMessage.data.content_info?.text || "";
      console.log('🔍 Processing file:', name, 'text length:', text.length);
      console.log('🔍 Text sample:', text.substring(0, 100));
      
      if (name) {
        // Remove from parsing state
        setParsingFiles(prev => {
          const next = new Set(prev);
          next.delete(name);
          console.log('Removed file from parsing:', name);
          return next;
        });
        
        const parsedEntry = {
          filename: name,
          success: Boolean(text && text.length > 0 && !text.includes("[No extractable text")),
          content: text && !text.includes("[No extractable text") ? text : "",
        } as unknown as import("@/app/build/page").ParsedDocument;
        
        console.log('🔍 Created parsedEntry:', parsedEntry);
        console.log('🔍 updateSlideData function:', typeof updateSlideData, updateSlideData);
        
        // Update slideData with the parsed document
        console.log('🔍 About to call updateSlideData...');
        const existing = (slideData as any).parsedDocuments || [];
        const updated = Array.isArray(existing) ? [...existing] : [];
        console.log('🔧 existing parsedDocuments:', existing);
        console.log('🔧 adding parsedEntry:', parsedEntry);
        // Replace or push
        const idx = updated.findIndex((d: any) => d.filename === name);
        if (idx >= 0) updated[idx] = parsedEntry; else updated.push(parsedEntry);
        console.log('🔧 updated parsedDocuments:', updated);
        
        updateSlideData({ parsedDocuments: updated });
      }
    } else if (lastMessage.type === 'file_upload_error') {
      setUploadStatus(`Failed to upload: ${lastMessage.data.error}`);
      setTimeout(() => setUploadStatus(""), 5000);
      // Remove from parsing state on error
      const name = lastMessage.data.filename || "";
      if (name) {
        setParsingFiles(prev => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    }
  }, [lastMessage]);

  // Detect SpeechRecognition support and initialize recognition instance
  useEffect(() => {
    if (typeof window === "undefined") return;
    const getSpeechCtor = (): SpeechRecognitionConstructor | undefined => {
      const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      return w.SpeechRecognition || w.webkitSpeechRecognition;
    };
    const SpeechRecognitionCtor = getSpeechCtor();
    if (!SpeechRecognitionCtor) {
      setIsSpeechSupported(false);
      return;
    }
    setIsSpeechSupported(true);

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcriptChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        transcriptChunk += result[0].transcript;
        if (result.isFinal) {
          const combined = `${descriptionRef.current} ${transcriptChunk}`.trim();
          updateSlideData({ description: combined });
          transcriptChunk = "";
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [updateSlideData]);

  const startVoiceInput = () => {
    if (!isSpeechSupported || isListening) return;
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {
      // no-op
    }
  };

  const stopVoiceInput = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }
    setIsListening(false);
  };

  // Handle drag events for file upload area
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle file drop event
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      
      // Update local state
      updateSlideData({ documents: [...slideData.documents, ...files] });
      
      // Upload to backend if connected
      if (isConnected && sendFileUpload) {
        for (const file of files) {
          try {
            console.log('Uploading file to backend:', file.name);
            setUploadStatus(`Uploading ${file.name}...`);
            setParsingFiles(prev => {
              const next = new Set(prev);
              next.add(file.name);
              console.log('Added file to parsing:', file.name);
              return next;
            });
            await sendFileUpload(file);
          } catch (error) {
            console.error('Failed to upload file:', error);
            setUploadStatus(`Failed to upload ${file.name}`);
            setParsingFiles(prev => {
              const next = new Set(prev);
              next.delete(file.name);
              return next;
            });
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
      
      // Upload to backend if connected
      if (isConnected && sendFileUpload) {
        for (const file of files) {
          try {
            console.log('Uploading file to backend:', file.name);
            setUploadStatus(`Uploading ${file.name}...`);
            setParsingFiles(prev => {
              const next = new Set(prev);
              next.add(file.name);
              console.log('Added file to parsing:', file.name);
              return next;
            });
            await sendFileUpload(file);
          } catch (error) {
            console.error('Failed to upload file:', error);
            setUploadStatus(`Failed to upload ${file.name}`);
            setParsingFiles(prev => {
              const next = new Set(prev);
              next.delete(file.name);
              return next;
            });
          }
        }
      }
    }
  };

  // Remove a file from the uploaded documents list
  const removeFile = (index: number) => {
    const newFiles = slideData.documents.filter((_: File, i: number) => i !== index);
    updateSlideData({ documents: newFiles });
  };

  // Convert pasted text into a virtual file and add to documents
  const handlePasteText = async () => {
    if (pastedText.trim()) {
      const textFile = new File([pastedText], "pasted-text.txt", { type: "text/plain" });
      updateSlideData({ documents: [...slideData.documents, textFile] });
      
      // Upload to backend if connected
      if (isConnected && sendFileUpload) {
        try {
          console.log('Uploading pasted text to backend');
          setUploadStatus('Uploading pasted text...');
          setParsingFiles(prev => new Set(prev).add(textFile.name));
          await sendFileUpload(textFile);
        } catch (error) {
          console.error('Failed to upload pasted text:', error);
          setUploadStatus('Failed to upload pasted text');
          setParsingFiles(prev => {
            const next = new Set(prev);
            next.delete(textFile.name);
            return next;
          });
        }
      }
      
      setPastedText("");
      setShowTextInput(false);
    }
  };

  // Generate an example description using AI or fallback to static examples
  const generateExampleDescription = async () => {
    setIsGenerating(true);
    
    try {
      // For now, use static examples
      const examples = [
        "Create a quarterly business review presentation highlighting revenue growth, customer acquisition metrics, and strategic initiatives for the next quarter",
        "Design an investor pitch deck showcasing our AI-powered SaaS platform, market opportunity, traction metrics, and funding requirements",
        "Build a product launch presentation featuring our new mobile app, target audience demographics, key features, and go-to-market strategy"
      ];
      
      const randomExample = examples[Math.floor(Math.random() * examples.length)];
      updateSlideData({ description: randomExample });
    } finally {
      setIsGenerating(false);
    }
  };

  // Check if user can proceed to next step
  const canProceed = slideData.documents.length > 0 && slideData.description.trim().length > 0;

  // Send description to backend when proceeding to next step
  const handleContinueToThemes = async () => {
    if (slideData.description.trim() && isConnected && sendSlideDescription) {
      try {
        console.log('Sending slide description to backend');
        sendSlideDescription(slideData.description);
      } catch (error) {
        console.error('Failed to send description to backend:', error);
      }
    }
    onNext();
  };

  return (
    <>
      {/* Content viewing modal */}
      {viewingContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Parsed Content</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingContent(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="whitespace-pre-wrap text-sm text-foreground bg-muted/30 p-4 rounded-lg">
                {viewingContent}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto px-4">
      {/* Upload Status - only show when actively uploading */}
      {uploadStatus && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">{uploadStatus}</span>
        </div>
      )}

      {/* Document Upload Section */}
      <Card variant="glass" className="card-contrast">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Upload className="h-5 w-5 text-primary" />
            Upload Documents
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Add content for your slide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
          {/* Drag and Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all hover:bg-muted/50 ${
              dragActive 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-medium mb-1">Drop files or click to upload</p>
            <p className="text-sm text-muted-foreground">
              PDF, DOCX, TXT
            </p>
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setShowTextInput(!showTextInput)}
              className="gap-2"
            >
              <Type className="h-4 w-4" />
              Paste Text
            </Button>
          </div>

          {/* Text Input Area */}
          {showTextInput && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
              <Label htmlFor="paste-text">Paste your text content</Label>
              <textarea
                id="paste-text"
                placeholder="Paste your content here..."
                className="w-full min-h-[100px] p-2 text-sm rounded-lg border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowTextInput(false);
                    setPastedText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePasteText}
                  disabled={!pastedText.trim()}
                >
                  Add Text
                </Button>
              </div>
            </div>
          )}

          {/* Document parsing status */}
          {isParsing && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-primary font-medium">Parsing documents...</span>
            </div>
          )}

          {/* Display uploaded files list */}
          {slideData.documents.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Files ({slideData.documents.length})</Label>
              <div className="space-y-2">
                {slideData.documents.map((file, index) => {
                  const isCurrentlyParsing = parsingFiles.has(file.name);
                  const parsedDoc = (slideData as any).parsedDocuments?.find((d: any) => d.filename === file.name);
                  const hasContent = parsedDoc && parsedDoc.success;
                  const hasFailed = parsedDoc && !parsedDoc.success;
                  
                  console.log('🔍 File display debug for:', file.name);
                  console.log('🔍 isCurrentlyParsing:', isCurrentlyParsing);
                  console.log('🔍 parsedDoc:', parsedDoc);
                  console.log('🔍 hasContent:', hasContent);
                  console.log('🔍 hasFailed:', hasFailed);
                  console.log('🔍 slideData.parsedDocuments:', (slideData as any).parsedDocuments);
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative">
                          <FileText className="h-4 w-4 text-primary" />
                          {/* Status indicator overlay */}
                          {isCurrentlyParsing && (
                            <div className="absolute -top-1 -right-1">
                              <Clock className="h-2 w-2 text-blue-500 animate-pulse" />
                            </div>
                          )}
                          {hasContent && (
                            <div className="absolute -top-1 -right-1">
                              <CheckCircle className="h-2 w-2 text-green-500" />
                            </div>
                          )}
                          {hasFailed && (
                            <div className="absolute -top-1 -right-1">
                              <XCircle className="h-2 w-2 text-red-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-medium">{file.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                            {isCurrentlyParsing && (
                              <span className="text-xs text-blue-600">Parsing...</span>
                            )}
                            {hasContent && (
                              <span className="text-xs text-green-600">Ready</span>
                            )}
                            {hasFailed && (
                              <span className="text-xs text-red-600">Parse failed</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasContent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingContent(parsedDoc.content)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slide Focus / Description Section */}
      <Card variant="glass">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
            Slide Focus
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground">
            What do you want the focus of the content on this slide to be?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          {/* Global AI Model selection (available early) */}
          <div className="flex items-center gap-3">
            <Label className="min-w-[80px]">AI Model</Label>
            <Select
              value={modelAwareSlideData.selectedModel || "gpt-4"}
              onValueChange={(value) => updateSlideData({ selectedModel: value } as Partial<SlideData>)}
            >
              <SelectTrigger className="w-[220px] h-8 rounded-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4 (current)</SelectItem>
                <SelectItem value="gpt-5-2025-08-07">GPT-5 (2025-08-07)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Slide Focus</Label>
              <div className="flex items-center gap-1 sm:gap-2">
                {isSpeechSupported && (
                  <Button
                    variant={isListening ? "destructive" : "ghost"}
                    size="sm"
                    onClick={isListening ? stopVoiceInput : startVoiceInput}
                    className="gap-2 text-xs"
                  >
                    {isListening ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    {isListening ? "Stop" : "Voice Input"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateExampleDescription}
                  disabled={isGenerating}
                  className="gap-2 text-xs"
                >
                  <Sparkles className="h-3 w-3" />
                  {isGenerating ? "Generating..." : "Generate Example"}
                </Button>
              </div>
            </div>
            <textarea
              id="description"
              placeholder="E.g., Focus on Q3 revenue growth, key wins, and next-quarter priorities for our product team..."
              className="w-full min-h-[80px] p-2 text-sm rounded-lg border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={slideData.description}
              onChange={(e) => updateSlideData({ description: e.target.value })}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {slideData.description.length}/500 characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Continue button */}
      <div className="flex justify-end pt-2">
        <Button
          variant="engineering"
          size="default"
          className="w-full sm:w-auto"
          onClick={handleContinueToThemes}
          disabled={!canProceed}
        >
          Continue to Themes
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
      </div>
    </>
  );
}