"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { SlideData } from "@/app/build/page";

interface GoogleSlidesButtonProps {
  slideData: SlideData;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive" | "engineering";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * GoogleSlidesButton Component
 * Allows users to export their generated slide to Google Slides
 * Creates a new Google Slides presentation with the slide content
 */
export function GoogleSlidesButton({ 
  slideData, 
  variant = "outline", 
  size = "default",
  className = ""
}: GoogleSlidesButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle Google Slides export
   * Creates a new Google Slides presentation and opens it in a new tab
   */
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      // Validate slide data
      if (!slideData.slideHtml && !slideData.description) {
        throw new Error('No slide content available to export');
      }

      // Extract content for Google Slides
      const slideContent = extractContentForGoogleSlides();
      
      // Create Google Slides URL with content
      const googleSlidesUrl = createGoogleSlidesUrl(slideContent);
      
      // Open Google Slides in new tab
      window.open(googleSlidesUrl, '_blank');

    } catch (error) {
      console.error('Error exporting to Google Slides:', error);
      setError(error instanceof Error ? error.message : 'Failed to export to Google Slides');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Extract and format content for Google Slides
   */
  const extractContentForGoogleSlides = () => {
    let title = slideData.description?.split('.')[0] || 'AI Generated Slide';
    let content = '';

    // Extract content from HTML if available
    if (slideData.slideHtml && slideData.slideHtml !== 'cat-slide-placeholder') {
      const htmlContent = extractFromHtml(slideData.slideHtml);
      title = htmlContent.title || title;
      content = htmlContent.content;
    }

    // Add research data if available
    if (slideData.researchData) {
      content += '\n\nResearch Insights:\n' + slideData.researchData;
    }

    // Add user feedback if available
    if (slideData.userFeedback) {
      content += '\n\nUser Notes:\n' + slideData.userFeedback;
    }

    return { title, content };
  };

  /**
   * Extract content from HTML slide
   */
  const extractFromHtml = (html: string) => {
    try {
      // Extract title
      const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : null;

      // Extract all text content
      const textContent = html
        .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>.*?<\/style>/gi, '')   // Remove styles
        .replace(/<[^>]*>/g, ' ')                    // Remove HTML tags
        .replace(/\s+/g, ' ')                       // Normalize whitespace
        .trim();

      return { title, content: textContent };
    } catch (error) {
      console.error('Error extracting HTML content:', error);
      return { title: null, content: '' };
    }
  };

  /**
   * Create Google Slides URL with pre-filled content
   * Uses Google Slides template URL with encoded content
   */
  const createGoogleSlidesUrl = ({ title, content }: { title: string; content: string }) => {
    // Base Google Slides URL for creating new presentation
    const baseUrl = 'https://docs.google.com/presentation/create';
    
    // For now, we'll just open a new Google Slides presentation
    // In the future, we could use the Google Slides API to pre-populate content
    // This would require OAuth authentication and API setup
    
    return baseUrl;
  };

  // Don't show button if no slide content is available
  if (!slideData.slideHtml && !slideData.description) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleExport}
        disabled={isExporting}
        variant={variant}
        size={size}
        className={className}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Opening Google Slides...
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in Google Slides
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