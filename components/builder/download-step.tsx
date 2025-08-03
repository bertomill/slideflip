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
    
    try {
      if (slideData.pptFilePath) {
        console.log('Downloading PPT file from:', slideData.pptFilePath);
        
        // First, let's check if the file exists using the debug endpoint
        const checkUrl = `http://localhost:8000/debug/check-file/${slideData.pptFilePath}`;
        console.log('Checking file existence at:', checkUrl);
        
        try {
          const checkResponse = await fetch(checkUrl);
          const checkResult = await checkResponse.json();
          console.log('File check result:', checkResult);
        } catch (checkError) {
          console.log('File check failed:', checkError);
        }
        
        // Download the actual PPT file from the backend
        const downloadUrl = `http://localhost:8000/download/${slideData.pptFilePath}`;
        console.log('Downloading from URL:', downloadUrl);
        
        const response = await fetch(downloadUrl, {
          method: 'GET',
        });
        
        console.log('Download response status:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`Failed to download PPT file: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = slideData.pptFilePath.split('/').pop() || 'slideflip-presentation.pptx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('PPT file downloaded successfully');
        setExportComplete(true);
      } else {
        throw new Error('No PPT file available for download. Please regenerate the slide.');
      }
    } catch (error) {
      console.error('Error downloading PPT file:', error);
      
      // Show user-friendly error message
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using fallback download.`);
      
      // Fallback to mock download for now
      const blob = new Blob(['Mock PPTX content'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'slideflip-presentation.pptx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportComplete(true);
    } finally {
      setIsExporting(false);
    }
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
          
          {/* Generation Summary */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-sm font-medium mb-2">Generated Content:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {slideData.slideHtml ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>HTML preview generated</span>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 border border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <span>HTML preview pending</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {slideData.pptFilePath ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>PPT file generated</span>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 border border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <span>PPT file pending</span>
                  </>
                )}
              </div>
            </div>
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
            {/* File Status Indicator */}
            <div className="mb-4 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                {slideData.pptFilePath ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-700 dark:text-green-400">
                      PPT file ready for download
                    </span>
                  </>
                ) : (
                  <>
                    <div className="h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-400">
                      PPT file not available
                    </span>
                  </>
                )}
              </div>
              {slideData.pptFilePath && (
                <p className="text-xs text-muted-foreground mt-1">
                  File: {slideData.pptFilePath.split('/').pop()}
                </p>
              )}
            </div>
            
            <Button 
              variant="engineering" 
              size="lg" 
              className="w-full"
              onClick={downloadPPTX}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Downloading...
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
            <Button variant="engineering" onClick={createNewSlide} className="flex-1">
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