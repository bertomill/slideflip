"use client";

// React hooks and UI components for the final download step
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Code, ArrowLeft, Share2, Copy, Check } from "lucide-react";
import { SlideData } from "@/app/build/page";
import { DownloadPptxButton } from "@/components/download-pptx-button";
import { GoogleSlidesButton } from "@/components/google-slides-button";

// Props interface for the DownloadStep component - final step in slide builder workflow
interface DownloadStepProps {
  slideData: SlideData;    // Complete slide data with generated content
  onPrev: () => void;      // Navigate back to preview step
  onComplete: () => void;  // Reset workflow to start over
}

/**
 * DownloadStep Component - Final step in the slide builder workflow
 * 
 * PURPOSE: Provides multiple export options for the completed AI-generated slide
 * - PowerPoint (.pptx) download for editing and presentation
 * - HTML download for web sharing and archival
 * - Shareable link generation for collaboration
 * - Slide summary with metadata display
 */
export function DownloadStep({ slideData, onPrev, onComplete }: DownloadStepProps) {
  // UI state management for download operations and user feedback
  const [copiedLink, setCopiedLink] = useState(false);        // Tracks share link copy success
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false); // Loading state for HTML export

  /**
   * HTML Download Handler - Creates standalone HTML file from generated slide
   * 
   * PROCESS:
   * 1. Validates slide content exists and is not placeholder
   * 2. Wraps slide HTML in complete document structure
   * 3. Adds responsive styling and print optimization
   * 4. Triggers browser download with descriptive filename
   */
  const downloadHtml = async () => {
    try {
      setIsDownloadingHtml(true);

      // Content validation - ensure we have actual slide content to export
      if (!slideData.slideHtml || slideData.slideHtml === 'cat-slide-placeholder') {
        throw new Error('No slide content available for download');
      }

      // HTML Document Assembly - Create complete standalone HTML file
      // Wraps the AI-generated slide content in a proper document structure
      // with responsive styling and print optimization
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${extractTitle(slideData.description)}</title>
    <style>
        /* Base styling for web viewing with professional appearance */
        body {
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            font-family: system-ui, -apple-system, sans-serif;
        }
        /* Slide container with shadow and rounded corners for web display */
        .slide-wrapper {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        /* Content scaling for optimal web viewing */
        .slide-content {
            transform-origin: top left;
            transform: scale(0.8);
            width: 125%;
        }
        /* Print optimization - remove decorative elements for clean printing */
        @media print {
            body { background: white; padding: 0; }
            .slide-wrapper { box-shadow: none; border-radius: 0; }
            .slide-content { transform: scale(1); width: 100%; }
        }
    </style>
</head>
<body>
    <div class="slide-wrapper">
        <div class="slide-content">
            ${slideData.slideHtml}
        </div>
    </div>
</body>
</html>`;

      // File Download Process - Create blob and trigger browser download
      // Uses the standard HTML5 download pattern for client-side file generation
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `slide-${generateFileName()}.html`;  // Descriptive filename with timestamp
      document.body.appendChild(link);
      link.click();                                        // Trigger download
      document.body.removeChild(link);                     // Cleanup DOM
      window.URL.revokeObjectURL(url);                     // Free memory

    } catch (error) {
      console.error('Error downloading HTML:', error);
    } finally {
      setIsDownloadingHtml(false);
    }
  };

  /**
   * Share Link Generation - Creates shareable URL for slide collaboration
   * 
   * CURRENT: Generates placeholder URL for demonstration
   * FUTURE: Would save slide to database and create persistent sharing link
   * 
   * PROCESS:
   * 1. Generate unique share ID for the slide
   * 2. Create shareable URL with domain and ID
   * 3. Copy to clipboard and show success feedback
   */
  const copyShareLink = async () => {
    try {
      // Share URL generation - currently placeholder, would be database-backed in production
      const shareUrl = `${window.location.origin}/shared/${generateShareId()}`;

      // Clipboard API - copy share link for easy sharing
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);

      // User feedback - show success state for 2 seconds
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS: File naming and ID generation helpers
  // ============================================================================

  /**
   * Title Extraction - Creates clean title from user description for HTML document
   * Takes first sentence or 50 characters, whichever is shorter
   */
  const extractTitle = (description: string): string => {
    if (!description) return 'AI Generated Slide';
    return description.split('.')[0].substring(0, 50).trim();
  };

  /**
   * Filename Generation - Creates descriptive filename with timestamp
   * Format: topic-YYYY-MM-DD (e.g., "quarterly-results-2024-01-15")
   */
  const generateFileName = (): string => {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10);  // YYYY-MM-DD format
    const topic = slideData.description
      ?.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')    // Remove special characters
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .substring(0, 20) || 'slide';   // Limit length for filesystem compatibility

    return `${topic}-${timestamp}`;
  };

  /**
   * Share ID Generation - Creates unique identifier for shareable links
   * Uses random base36 string for URL-safe unique IDs
   */
  const generateShareId = (): string => {
    return Math.random().toString(36).substring(2, 15);
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================
          STEP HEADER: Final step introduction and overview
          ======================================================================== */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Download Your Slide
          </CardTitle>
          <CardDescription>
            Choose your preferred format and share your AI-generated presentation
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ========================================================================
          DOWNLOAD OPTIONS: Three-column grid with PowerPoint, Google Slides, and HTML export
          ======================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* PowerPoint Download Card - Primary recommended option */}
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  PowerPoint Format
                </CardTitle>
                <CardDescription>
                  Download as .pptx file for editing in PowerPoint
                </CardDescription>
              </div>
              <Badge variant="secondary">Recommended</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Feature list highlighting PowerPoint benefits */}
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Fully editable in PowerPoint</li>
                <li>• Professional formatting preserved</li>
                <li>• Compatible with Office 365</li>
                <li>• Perfect for presentations</li>
              </ul>

              {/* PowerPoint download button - handles PPTX generation via API */}
              <DownloadPptxButton
                slideData={slideData}
                variant="default"
                size="lg"
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Google Slides Export Card - Cloud-based editing option */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5 text-red-500" />
              Google Slides
            </CardTitle>
            <CardDescription>
              Open in Google Slides for online editing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Feature list highlighting Google Slides benefits */}
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Edit online with Google Slides</li>
                <li>• Real-time collaboration</li>
                <li>• Automatic cloud saving</li>
                <li>• Share with team members</li>
              </ul>

              {/* Google Slides export button */}
              <GoogleSlidesButton
                slideData={slideData}
                variant="outline"
                size="lg"
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* HTML Download Card - Alternative web-friendly format */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5 text-green-500" />
              HTML Format
            </CardTitle>
            <CardDescription>
              Download as standalone HTML file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Feature list highlighting HTML benefits */}
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Works in any web browser</li>
                <li>• Preserves all styling and effects</li>
                <li>• Easy to share via email</li>
                <li>• Print-friendly format</li>
              </ul>

              {/* HTML download button with loading state management */}
              <Button
                onClick={downloadHtml}
                disabled={isDownloadingHtml || !slideData.slideHtml}
                variant="outline"
                size="lg"
                className="w-full"
              >
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

      {/* ========================================================================
          SHARING OPTIONS: Generate shareable links for collaboration
          ======================================================================== */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-purple-500" />
            Share Your Slide
          </CardTitle>
          <CardDescription>
            Generate a shareable link for others to view your presentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {/* Share link button with success state feedback */}
            <Button
              onClick={copyShareLink}
              variant="outline"
              className="flex-1"
            >
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

      {/* ========================================================================
          SLIDE SUMMARY: Metadata overview of the generated slide
          ======================================================================== */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-lg">Slide Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Four-column grid showing slide generation parameters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Theme selection display */}
            <div>
              <p className="font-medium text-muted-foreground">Theme</p>
              <p className="font-semibold">{slideData.selectedTheme || 'Professional'}</p>
            </div>
            {/* Research inclusion status */}
            <div>
              <p className="font-medium text-muted-foreground">Research</p>
              <p className="font-semibold">{slideData.wantsResearch ? 'Included' : 'Not included'}</p>
            </div>
            {/* Document count summary */}
            <div>
              <p className="font-medium text-muted-foreground">Documents</p>
              <p className="font-semibold">{slideData.documents?.length || 0} uploaded</p>
            </div>
            {/* User feedback application status */}
            <div>
              <p className="font-medium text-muted-foreground">Feedback</p>
              <p className="font-semibold">{slideData.userFeedback ? 'Applied' : 'None'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================
          NAVIGATION: Final step controls for workflow completion
          ======================================================================== */}
      <div className="flex justify-between">
        {/* Back button - return to preview step for modifications */}
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Preview
        </Button>
        {/* Complete button - restart the entire slide builder workflow */}
        <Button
          variant="engineering"
          size="lg"
          onClick={onComplete}
        >
          Create Another Slide
        </Button>
      </div>
    </div>
  );
}