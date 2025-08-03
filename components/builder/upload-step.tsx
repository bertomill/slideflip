"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { Upload, FileText, X, ArrowRight, Type, Sparkles, Wifi, WifiOff } from "lucide-react";
import { SlideData } from "@/app/builder/page";
import { BackendFileInfo } from "@/types/backend";

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
  const [showTextInput, setShowTextInput] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [backendFiles, setBackendFiles] = useState<BackendFileInfo[]>([]);

  // Handle backend messages
  useEffect(() => {
    if (lastMessage) {
      console.log('Backend message received:', lastMessage);
      switch (lastMessage.type) {
        case 'file_upload_success':
          setUploadStatus('File uploaded successfully');
          setBackendFiles(prev => [...prev, lastMessage.data]);
          break;
        case 'file_upload_error':
          setUploadStatus(`Upload error: ${lastMessage.data.error}`);
          break;
        case 'slide_description_success':
          setUploadStatus('Description saved to backend');
          break;
        case 'slide_description_error':
          setUploadStatus(`Description error: ${lastMessage.data.error}`);
          break;
      }
    }
  }, [lastMessage]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

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
            console.log('Starting file upload for:', file.name);
            setUploadStatus(`Uploading ${file.name}...`);
            const result = await sendFileUpload(file);
            console.log('File upload result:', result);
            setUploadStatus(`Successfully uploaded ${file.name}`);
          } catch (error) {
            console.error('Failed to upload file to backend:', error);
            setUploadStatus(`Failed to upload ${file.name}: ${error}`);
          }
        }
      } else {
        console.log('Not connected or sendFileUpload not available:', { isConnected, sendFileUpload });
      }
    }
  }, [slideData.documents, updateSlideData, sendFileUpload, isConnected]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Update local state
      updateSlideData({ documents: [...slideData.documents, ...files] });
      
      // Upload to backend if connected
      if (isConnected && sendFileUpload) {
        for (const file of files) {
          try {
            console.log('Starting file upload for:', file.name);
            setUploadStatus(`Uploading ${file.name}...`);
            const result = await sendFileUpload(file);
            console.log('File upload result:', result);
            setUploadStatus(`Successfully uploaded ${file.name}`);
          } catch (error) {
            console.error('Failed to upload file to backend:', error);
            setUploadStatus(`Failed to upload ${file.name}: ${error}`);
          }
        }
      } else {
        console.log('Not connected or sendFileUpload not available:', { isConnected, sendFileUpload });
      }
    }
  };

  const removeFile = (index: number) => {
    const newFiles = slideData.documents.filter((_, i) => i !== index);
    updateSlideData({ documents: newFiles });
  };

  const handlePasteText = async () => {
    if (pastedText.trim()) {
      // Create a virtual file from the pasted text
      const textFile = new File([pastedText], "pasted-text.txt", { type: "text/plain" });
      updateSlideData({ documents: [...slideData.documents, textFile] });
      
      // Upload to backend if connected
      if (isConnected && sendFileUpload) {
        try {
          console.log('Starting pasted text upload');
          setUploadStatus('Uploading pasted text...');
          const result = await sendFileUpload(textFile);
          console.log('Pasted text upload result:', result);
          setUploadStatus('Successfully uploaded pasted text');
        } catch (error) {
          console.error('Failed to upload pasted text to backend:', error);
          setUploadStatus('Failed to upload pasted text');
        }
      } else {
        console.log('Not connected or sendFileUpload not available for pasted text');
      }
      
      setPastedText("");
      setShowTextInput(false);
    }
  };

  const generateExampleDescription = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documents: slideData.documents.map(doc => ({ 
            name: doc.name, 
            type: doc.type,
            size: doc.size 
          }))
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate description');
      }
      
      const data = await response.json();
      if (data.description) {
        updateSlideData({ description: data.description });
      } else {
        throw new Error('No description received');
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
      
      // Fallback to static examples if API fails
      const fallbackExamples = [
        "Create a professional slide summarizing quarterly financial performance with key metrics and clean charts.",
        "Design an executive summary slide highlighting project milestones with timeline visualization.",
        "Build a product launch slide showcasing key features and benefits with compelling visuals.",
        "Generate a team performance slide displaying achievements and KPIs with data visualizations."
      ];
      
      const randomExample = fallbackExamples[Math.floor(Math.random() * fallbackExamples.length)];
      updateSlideData({ description: randomExample });
    } finally {
      setIsGenerating(false);
    }
  };

  const canProceed = slideData.documents.length > 0 && slideData.description.trim().length > 0;

  // Send description to backend when user clicks "Continue to Themes"
  const handleContinueToThemes = async () => {
    if (slideData.description.trim() && isConnected && sendSlideDescription) {
      try {
        console.log('Sending slide description to backend before proceeding to themes');
        sendSlideDescription(slideData.description);
        // Add a small delay to ensure the message is sent before proceeding
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Failed to send description to backend:', error);
      }
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Backend Connection Status */}
      <Card variant="glass" className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                Backend Connection: {connectionStatus}
              </span>
            </div>
            {uploadStatus && (
              <span className="text-sm text-muted-foreground">{uploadStatus}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Upload className="h-6 w-6 text-primary" />
            Upload Your Documents
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Upload documents that contain the content you want to include in your slide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-premium cursor-pointer ${dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl font-semibold tracking-tight mb-2">Drop files here or click to upload</p>
            <p className="text-base text-muted-foreground">
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

          {/* Alternative: Paste Text */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

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
                placeholder="Paste your text content here..."
                className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-premium"
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

          {/* Uploaded Files */}
          {slideData.documents.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Files ({slideData.documents.length})</Label>
              <div className="space-y-2">
                {slideData.documents.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
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

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">Describe Your Slide</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Tell us what kind of slide you want to create and any specific requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <Sparkles className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'Generating...' : 'Generate Example'}
              </Button>
            </div>
            <textarea
              id="description"
              placeholder="e.g., Create a professional slide about quarterly sales results with charts and key insights..."
              className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-premium"
              value={slideData.description}
              onChange={(e) => updateSlideData({ description: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {slideData.description.length}/500 characters
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="engineering"
          size="lg"
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