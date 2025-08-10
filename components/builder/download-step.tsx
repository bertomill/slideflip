"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Code, ArrowLeft, Share2, Copy, Check } from "lucide-react";
import { SlideData } from "@/app/build/page";
import { DownloadPptxButton } from "@/components/download-pptx-button";
import { GoogleSlidesButton } from "@/components/google-slides-button";

interface DownloadStepProps {
  slideData: SlideData;
  onPrev: () => void;
  onComplete: () => void;
}

export function DownloadStep({ slideData, onPrev, onComplete }: DownloadStepProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);

  const downloadHtml = async () => {
    try {
      setIsDownloadingHtml(true);
      if (!slideData.slideHtml || slideData.slideHtml === "cat-slide-placeholder") {
        throw new Error("No slide content available for download");
      }
      const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${extractTitle(
        slideData.description
      )}</title><style>body{margin:0;padding:20px;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif}.slide-wrapper{max-width:1200px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.1);overflow:hidden}.slide-content{transform-origin:top left;transform:scale(.8);width:125%}@media print{body{background:#fff;padding:0}.slide-wrapper{box-shadow:none;border-radius:0}.slide-content{transform:scale(1);width:100%}}</style></head><body><div class="slide-wrapper"><div class="slide-content">${slideData.slideHtml}</div></div></body></html>`;
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `slide-${generateFileName()}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading HTML:", error);
    } finally {
      setIsDownloadingHtml(false);
    }
  };

  const copyShareLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/shared/${generateShareId()}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error("Error copying link:", error);
    }
  };

  const extractTitle = (description: string) => description?.split(".")[0]?.substring(0, 50)?.trim() || "AI Generated Slide";
  const generateFileName = () => {
    const ts = new Date().toISOString().slice(0, 10);
    const topic = (slideData.description || "slide").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 20) || "slide";
    return `${topic}-${ts}`;
  };
  const generateShareId = () => Math.random().toString(36).substring(2, 15);

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Download Your Slide
          </CardTitle>
          <CardDescription>Choose your preferred format and share your AI-generated presentation</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  PowerPoint Format
                </CardTitle>
                <CardDescription>Download as .pptx file for editing in PowerPoint</CardDescription>
              </div>
              <Badge variant="secondary">Recommended</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Fully editable in PowerPoint</li>
                <li>• Professional formatting preserved</li>
                <li>• Compatible with Office 365</li>
                <li>• Perfect for presentations</li>
              </ul>
              <DownloadPptxButton slideData={slideData} variant="default" size="lg" className="w-full" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5 text-red-500" />
              Google Slides
            </CardTitle>
            <CardDescription>Open in Google Slides for online editing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Edit online with Google Slides</li>
                <li>• Real-time collaboration</li>
                <li>• Automatic cloud saving</li>
                <li>• Share with team members</li>
              </ul>
              <GoogleSlidesButton slideData={slideData} variant="outline" size="lg" className="w-full" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5 text-green-500" />
              HTML Format
            </CardTitle>
            <CardDescription>Download as standalone HTML file</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Works in any web browser</li>
                <li>• Preserves all styling and effects</li>
                <li>• Easy to share via email</li>
                <li>• Print-friendly format</li>
              </ul>
              <Button onClick={downloadHtml} disabled={isDownloadingHtml || !slideData.slideHtml} variant="outline" size="lg" className="w-full">
                {isDownloadingHtml ? (
                  <>
                    <Download className="h-4 w-4 mr-2 animate-pulse" />
                    Preparing HTML...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download HTML
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-purple-500" />
            Share Your Slide
          </CardTitle>
          <CardDescription>Generate a shareable link for others to view your presentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={copyShareLink} variant="outline" className="flex-1">
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Share Link
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-lg">Slide Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Theme</p>
              <p className="font-semibold">{slideData.selectedTheme || "Professional"}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Research</p>
              <p className="font-semibold">{slideData.wantsResearch ? "Included" : "Not included"}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Documents</p>
              <p className="font-semibold">{slideData.documents?.length || 0} uploaded</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Feedback</p>
              <p className="font-semibold">{slideData.userFeedback ? "Applied" : "None"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Preview
        </Button>
        <Button variant="engineering" size="lg" onClick={onComplete}>
          Create Another Slide
        </Button>
      </div>
    </div>
  );
}

