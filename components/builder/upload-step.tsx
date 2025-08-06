"use client";

import { useState, useCallback } from "react";
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
}

export function UploadStep({ slideData, updateSlideData, onNext }: UploadStepProps) {
  // State for managing drag and drop visual feedback
  const [dragActive, setDragActive] = useState(false);
  // State for toggling text input area visibility
  const [showTextInput, setShowTextInput] = useState(false);
  // State for storing pasted text content
  const [pastedText, setPastedText] = useState("");
  // State for managing loading state during description generation
  const [isGenerating, setIsGenerating] = useState(false);
  // State for managing document parsing
  const [isParsing, setIsParsing] = useState(false);
  // Generate a session ID for this upload session
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Handle drag events for file upload area
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Show active state when dragging over the area
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Parse documents and extract content
  const parseDocuments = async (files: File[]) => {
    setIsParsing(true);
    
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/parse-documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse documents');
      }

      const result = await response.json();
      
      if (result.success) {
        // Store parsed document data in slideData for later use
        const parsedContent = result.documents.map((doc: any) => ({
          filename: doc.filename,
          content: doc.content,
          success: doc.success,
          id: doc.id
        }));
        
        updateSlideData({ 
          documents: [...slideData.documents, ...files],
          parsedDocuments: [...(slideData.parsedDocuments || []), ...parsedContent],
          sessionId: sessionId
        });
      } else {
        console.error('Document parsing failed:', result.error);
        // Still add files to documents array even if parsing fails
        updateSlideData({ documents: [...slideData.documents, ...files] });
      }
    } catch (error) {
      console.error('Error parsing documents:', error);
      // Still add files to documents array even if parsing fails
      updateSlideData({ documents: [...slideData.documents, ...files] });
    } finally {
      setIsParsing(false);
    }
  };

  // Handle file drop event
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    // Process dropped files and parse their content
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      parseDocuments(files);
    }
  }, [slideData.documents, updateSlideData, sessionId]);

  // Handle file selection through input element
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      parseDocuments(files);
    }
  };

  // Remove a file from the uploaded documents list
  const removeFile = (index: number) => {
    const fileToRemove = slideData.documents[index];
    const newFiles = slideData.documents.filter((_: File, i: number) => i !== index);
    
    // Also remove from parsed documents if it exists
    const newParsedDocs = slideData.parsedDocuments?.filter(
      doc => doc.filename !== fileToRemove.name
    );
    
    updateSlideData({ 
      documents: newFiles,
      parsedDocuments: newParsedDocs
    });
  };

  // Convert pasted text into a virtual file and add to documents
  const handlePasteText = () => {
    if (pastedText.trim()) {
      // Create a virtual file from the pasted text
      const textFile = new File([pastedText], "pasted-text.txt", { type: "text/plain" });
      updateSlideData({ documents: [...slideData.documents, textFile] });
      setPastedText("");
      setShowTextInput(false);
    }
  };

  // Generate an example description using AI or fallback to static examples
  // This helps users who need inspiration for their slide description
  const generateExampleDescription = async () => {
    setIsGenerating(true);
    
    try {
      // Attempt to generate description via API based on uploaded documents
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
      
      // Fallback to static examples if API fails - ensures users always get help
      const fallbackExamples = [
        "Create a professional slide summarizing quarterly financial performance with key metrics and clean charts.",
        "Design an executive summary slide highlighting project milestones with timeline visualization.",
        "Build a product launch slide showcasing key features and benefits with compelling visuals.",
        "Generate a team performance slide displaying achievements and KPIs with data visualizations."
      ];
      
      // Select a random example from the fallback list
      const randomExample = fallbackExamples[Math.floor(Math.random() * fallbackExamples.length)];
      updateSlideData({ description: randomExample });
    } finally {
      setIsGenerating(false);
    }
  };

  // Check if user can proceed to next step (requires documents and description)
  const canProceed = slideData.documents.length > 0 && slideData.description.trim().length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
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
        <CardContent className="space-y-4 sm:space-y-6">
          {/* Drag and Drop File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-premium cursor-pointer ${dragActive
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
            {/* Hidden file input element */}
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Divider between upload methods */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Button to toggle text input area */}
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

          {/* Text Input Area (conditionally rendered) */}
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
              {/* Action buttons for text input */}
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
                  const parsedDoc = slideData.parsedDocuments?.find(doc => doc.filename === file.name);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-primary" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{file.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                            {parsedDoc && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                parsedDoc.success 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {parsedDoc.success ? 'Parsed' : 'Parse failed'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Remove file button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slide Description Section */}
      <Card variant="glass">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-xl sm:text-2xl font-semibold tracking-tight">Describe Your Slide</CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground">
            Tell us what kind of slide you want to create and any specific requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            {/* Header with generate example button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label htmlFor="description">Slide Description</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateExampleDescription}
                disabled={isGenerating}
                className="gap-2 text-xs self-start sm:self-auto"
              >
                <Sparkles className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'Generating...' : 'Generate Example'}
              </Button>
            </div>
            {/* Description textarea */}
            <textarea
              id="description"
              placeholder="e.g., Create a professional slide about quarterly sales results with charts and key insights..."
              className="w-full h-24 sm:h-32 px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-premium"
              value={slideData.description}
              onChange={(e) => updateSlideData({ description: e.target.value })}
            />
            {/* Character count display */}
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
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue to Themes
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}