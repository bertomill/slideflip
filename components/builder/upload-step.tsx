"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, ArrowRight, Type, Sparkles } from "lucide-react";
import { SlideData } from "@/app/build/page";

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
  lastMessage?: any;
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
  const [isParsing, setIsParsing] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

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
      <Card variant="elevated">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-semibold tracking-tight">
            <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Upload Your Documents
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground">
            Upload documents that contain the content you want to include in your slide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-all hover:bg-muted/50 ${
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
            <p className="text-lg sm:text-xl font-semibold tracking-tight mb-2">Drop files here or click to upload</p>
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
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <Label htmlFor="paste-text">Paste your text content</Label>
              <textarea
                id="paste-text"
                placeholder="Paste your content here..."
                className="w-full min-h-[150px] p-3 text-sm rounded-lg border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

      {/* Slide Description Section */}
      <Card variant="glass">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl font-semibold tracking-tight">
            Describe Your Slide
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground">
            Tell us what you want to create
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Slide Description</Label>
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
            <textarea
              id="description"
              placeholder="E.g., Create a professional quarterly business review presentation highlighting our Q3 achievements..."
              className="w-full min-h-[120px] p-3 text-sm rounded-lg border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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