"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { SlideData } from "@/app/build/page";

interface DownloadPptxButtonProps {
  slideData: SlideData;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive" | "engineering";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * DownloadPptxButton Component
 * Allows users to download their generated slide as a PowerPoint (.pptx) file
 * Handles the API call to generate the PPTX and triggers the download
 */
export function DownloadPptxButton({ 
  slideData, 
  variant = "default", 
  size = "default",
  className = ""
}: DownloadPptxButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle PPTX download with enhanced error handling and user feedback
   * Makes API call to generate PowerPoint file and triggers browser download
   */
  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Validate slide data before sending
      if (!slideData.slideHtml && !slideData.description) {
        throw new Error('No slide content available to download');
      }

      // Prepare comprehensive slide data for PPTX generation
      const pptxData = {
        slideHtml: slideData.slideHtml,
        description: slideData.description,
        theme: slideData.selectedTheme || 'Professional',
        researchData: slideData.researchData,
        userFeedback: slideData.userFeedback,
        title: extractTitleFromDescription(slideData.description),
        subtitle: slideData.wantsResearch ? 'Research-Enhanced Presentation' : 'AI Generated Slide',
        // Additional metadata for better PowerPoint generation
        contentPlan: slideData.contentPlan,
        documents: slideData.parsedDocuments?.length || 0
      };

      // Make API call to generate PPTX with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/generate-pptx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pptxData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      // Verify response is actually a PPTX file
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
        console.warn('Unexpected content type:', contentType);
      }

      // Get the PPTX file as a blob
      const blob = await response.blob();
      
      // Verify blob size
      if (blob.size === 0) {
        throw new Error('Generated PowerPoint file is empty');
      }

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `slide-${generateFileName()}.pptx`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup with delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (error) {
      console.error('Error downloading PPTX:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setError('Download timed out. Please try again.');
        } else {
          setError(error.message);
        }
      } else {
        setError('Failed to download PowerPoint file. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Extract a title from the description for the filename
   * Creates a clean, descriptive filename from user's slide description
   */
  const extractTitleFromDescription = (description: string): string => {
    if (!description) return 'AI Generated Slide';
    
    // Take first sentence or first 50 characters
    const firstSentence = description.split('.')[0];
    return firstSentence.length > 50 
      ? firstSentence.substring(0, 50).trim() + '...'
      : firstSentence.trim();
  };

  /**
   * Generate a unique filename with timestamp
   * Ensures downloaded files have unique names
   */
  const generateFileName = (): string => {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
    const topic = slideData.description
      ?.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20) || 'slide';
    
    return `${topic}-${timestamp}`;
  };

  // Don't show button if no slide content is available
  if (!slideData.slideHtml || slideData.slideHtml === 'cat-slide-placeholder') {
    return null;
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleDownload}
        disabled={isGenerating}
        variant={variant}
        size={size}
        className={className}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating PowerPoint...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Download as PowerPoint
          </>
        )}
      </Button>
      
      {error && (
        <p className="text-sm text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}