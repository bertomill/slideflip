"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowLeft, CheckCircle, FileText, Share, Star } from "lucide-react";
import { SlideData } from "@/app/builder/page";

interface DownloadStepProps {
  slideData: SlideData;
  onPrev: () => void;
}

export function DownloadStep({ slideData, onPrev }: DownloadStepProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const downloadPPTX = async () => {
    setIsExporting(true);
    
    // Simulate PPTX generation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // In a real app, this would generate and download the actual PPTX file
    const blob = new Blob(['Mock PPTX content'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slideflip-presentation.pptx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setIsExporting(false);
    setExportComplete(true);
  };

  const createNewSlide = () => {
    window.location.href = '/builder';
  };

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Download Your Presentation
          </CardTitle>
          <CardDescription>
            Your slide is ready! Download it as a PowerPoint presentation or share it with others.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Slide Summary */}
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Slide Complete
          </CardTitle>
          <CardDescription>
            Here's a summary of your generated presentation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Documents</span>
              </div>
              <p className="text-2xl font-bold">{slideData.documents.length}</p>
              <p className="text-xs text-muted-foreground">files processed</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Theme</span>
              </div>
              <p className="text-lg font-bold capitalize">{slideData.selectedTheme}</p>
              <p className="text-xs text-muted-foreground">design applied</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Share className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Research</span>
              </div>
              <p className="text-lg font-bold">{slideData.wantsResearch ? 'Enhanced' : 'Standard'}</p>
              <p className="text-xs text-muted-foreground">content level</p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium mb-2">Slide Description:</p>
            <p className="text-sm text-muted-foreground italic">"{slideData.description}"</p>
          </div>
        </CardContent>
      </Card>

      {/* Download Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg">PowerPoint Download</CardTitle>
            <CardDescription>
              Download as a .pptx file that you can edit in PowerPoint or Google Slides
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="premium" 
              size="lg" 
              className="w-full"
              onClick={downloadPPTX}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Generating PPTX...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download PPTX
                </>
              )}
            </Button>
            
            {exportComplete && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Download complete!</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg">Share & Collaborate</CardTitle>
            <CardDescription>
              Get a shareable link or export in other formats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" disabled>
              <Share className="h-4 w-4 mr-2" />
              Get Shareable Link
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
            <Button variant="outline" className="w-full" disabled>
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Next Steps */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>What's Next?</CardTitle>
          <CardDescription>
            Continue building amazing presentations with SlideFlip
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="premium" onClick={createNewSlide} className="flex-1">
              Create Another Slide
            </Button>
            <Button variant="outline" className="flex-1" disabled>
              View My Presentations
              <Badge variant="secondary" className="ml-2">Soon</Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Preview
        </Button>
      </div>
    </div>
  );
}