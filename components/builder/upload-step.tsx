"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, ArrowRight, Type, Sparkles, Mic, Square } from "lucide-react";
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
  data: { filename?: string; error?: string };
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
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing] = useState(false);
  
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
    if (lastMessage) {
      console.log('Received message from backend:', lastMessage);
      
      if (lastMessage.type === 'file_upload_success') {
        setUploadStatus(`Successfully uploaded ${lastMessage.data.filename}`);
      } else if (lastMessage.type === 'file_upload_error') {
        setUploadStatus(`Failed to upload: ${lastMessage.data.error}`);
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
            await sendFileUpload(file);
          } catch (error) {
            console.error('Failed to upload file:', error);
            setUploadStatus(`Failed to upload ${file.name}`);
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
            await sendFileUpload(file);
          } catch (error) {
            console.error('Failed to upload file:', error);
            setUploadStatus(`Failed to upload ${file.name}`);
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
          await sendFileUpload(textFile);
        } catch (error) {
          console.error('Failed to upload pasted text:', error);
          setUploadStatus('Failed to upload pasted text');
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
    <div className="space-y-4 sm:space-y-6">
      {/* Connection Status Indicator */}
      {connectionStatus && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            Backend: {connectionStatus}
          </span>
          {uploadStatus && (
            <span className="text-sm text-muted-foreground ml-auto">{uploadStatus}</span>
          )}
        </div>
      )}

      {/* Document Upload Section */}
      <Card variant="glass" className="card-contrast">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight">
            <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Upload Your Documents
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground">
            Upload documents that contain the content you want to include in your slide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
          {/* Drag and Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-all hover:bg-muted/50 ${
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
            <Upload className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-semibold tracking-tight mb-2">Drop files here or click to upload</p>
            <p className="text-sm sm:text-base text-muted-foreground">
              Supports PDF, DOCX, TXT, and more
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

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Paste Text Button */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setShowTextInput(!showTextInput)}
              className="gap-2"
            >
              <Type className="h-4 w-4" />
              Paste Text Content
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
                {slideData.documents.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
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
  );
}