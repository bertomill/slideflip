"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, ArrowRight } from "lucide-react";
import { SlideData } from "@/app/builder/page";

interface UploadStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
}

export function UploadStep({ slideData, updateSlideData, onNext }: UploadStepProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      updateSlideData({ documents: [...slideData.documents, ...files] });
    }
  }, [slideData.documents, updateSlideData]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      updateSlideData({ documents: [...slideData.documents, ...files] });
    }
  };

  const removeFile = (index: number) => {
    const newFiles = slideData.documents.filter((_, i) => i !== index);
    updateSlideData({ documents: newFiles });
  };

  const canProceed = slideData.documents.length > 0 && slideData.description.trim().length > 0;

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Your Documents
          </CardTitle>
          <CardDescription>
            Upload documents that contain the content you want to include in your slide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-premium cursor-pointer ${
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
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Drop files here or click to upload</p>
            <p className="text-sm text-muted-foreground">
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
          <CardTitle>Describe Your Slide</CardTitle>
          <CardDescription>
            Tell us what kind of slide you want to create and any specific requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="description">Slide Description</Label>
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
          variant="notion" 
          size="lg" 
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