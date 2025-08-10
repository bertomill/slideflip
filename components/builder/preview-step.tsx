"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
<<<<<<< HEAD
import { Eye, ArrowLeft, ArrowRight, RefreshCw, MessageSquare, Sparkles, CheckCircle } from "lucide-react";
import { SlideData } from "@/app/builder/page";
=======
import { Eye, ArrowLeft, ArrowRight, RefreshCw, MessageSquare, Sparkles } from "lucide-react";
import { SlideData } from "@/app/build/page";
>>>>>>> origin/main

// ============================================================================
// PREVIEW STEP COMPONENT
// ============================================================================
// Fourth step in the slide builder workflow where users can:
// - View their AI-generated slide preview
// - Provide feedback for improvements
// - Regenerate slides with modifications
// - Navigate to the final download step
//
// KEY RECENT CHANGE: Now prioritizes parsed document content over raw files
// when sending data to the AI slide generation API for better content quality
// ============================================================================

/**
 * Props interface for the PreviewStep component
 * Handles the fourth step in the slide builder workflow where users review and refine their generated slide
 */
interface PreviewStepProps {
<<<<<<< HEAD
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrev: () => void;
  sendGenerateSlide: (description: string, theme?: string, wantsResearch?: boolean) => boolean;
}

export function PreviewStep({ slideData, updateSlideData, onNext, onPrev, sendGenerateSlide }: PreviewStepProps) {
=======
  slideData: SlideData;                                    // Current slide data containing all user inputs and generated content
  updateSlideData: (updates: Partial<SlideData>) => void; // Callback to update slide data with user feedback
  onNext: () => void;                                      // Navigate to download step
  onPrev: () => void;                                      // Navigate back to content planning step
}

/**
 * PreviewStep Component - Fourth step in the slide builder workflow
 * 
 * MAIN FUNCTIONALITY:
 * - Auto-generates AI slide from user data when component mounts
 * - Displays generated slide preview with fallback handling
 * - Allows users to provide feedback for slide improvements
 * - Regenerates slides based on user feedback
 * - Provides navigation to download step
 * 
 * KEY FEATURES:
 * - Prioritizes parsed document content over raw files for AI processing
 * - Graceful error handling with placeholder slide fallback
 * - Real-time feedback integration for iterative improvements
 * - Debug tools for development and troubleshooting
 */
export function PreviewStep({ slideData, updateSlideData, onNext, onPrev }: PreviewStepProps) {
  // ============================================================================
  // COMPONENT STATE: Loading states and user input management
  // ============================================================================

  // Loading state for initial slide generation when component first loads
  const [isGenerating, setIsGenerating] = useState(false);

  // Loading state for slide regeneration when user provides feedback
>>>>>>> origin/main
  const [isRegenerating, setIsRegenerating] = useState(false);

  // User's feedback text input for slide improvements and refinements
  const [feedback, setFeedback] = useState("");

<<<<<<< HEAD
  // Debug logging to see current state
  console.log('PreviewStep - Current state:', {
    isGenerating: slideData.isGenerating,
    generationStatus: slideData.generationStatus,
    generationProgress: slideData.generationProgress,
    hasHtml: !!slideData.slideHtml,
    htmlLength: slideData.slideHtml?.length || 0,
    timestamp: new Date().toISOString()
  });

  // Ensure generating state is set if we have a description but no HTML yet
=======
  // RESPONSIVE SCALING: Container width tracking for adaptive slide display
  // Monitors the slide container's width to calculate appropriate scaling factors
  // Used in the slide content renderer to adjust font sizes and transforms based on available space
  const [containerWidth, setContainerWidth] = useState(800);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  // LIFECYCLE: Auto-generate slide when component mounts if no slide exists yet
  // This ensures users see their slide immediately upon reaching the preview step
>>>>>>> origin/main
  useEffect(() => {
    if (slideData.description && !slideData.slideHtml && !slideData.isGenerating && !slideData.generationError) {
      console.log('Setting generating state to true - slide should be generating');
      updateSlideData({ 
        isGenerating: true, 
        generationStatus: "Starting slide generation...",
        generationProgress: 0
      });
    }
<<<<<<< HEAD
  }, [slideData.description, slideData.slideHtml, slideData.isGenerating, slideData.generationError, updateSlideData]);

  // Log when the component re-renders due to state changes
  useEffect(() => {
    console.log('PreviewStep re-rendered with new state:', {
      isGenerating: slideData.isGenerating,
      generationStatus: slideData.generationStatus,
      generationProgress: slideData.generationProgress,
      timestamp: new Date().toISOString()
    });
  }, [slideData.isGenerating, slideData.generationStatus, slideData.generationProgress]);

  // Remove automatic slide generation - will be triggered manually by user action

  // Watch for slide HTML updates to know when regeneration is complete
  useEffect(() => {
    if (slideData.slideHtml && isRegenerating) {
      setIsRegenerating(false);
    }
  }, [slideData.slideHtml, isRegenerating]);
=======
  }, [slideData.slideHtml]);
>>>>>>> origin/main

  // CONTAINER WIDTH TRACKING: Monitor container size changes for responsive scaling
  useEffect(() => {
    const container = slideContainerRef.current;
    if (!container) return;

    // RESIZE OBSERVER: Watches for container dimension changes (sidebar collapse/expand, window resize)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Update container width state when dimensions change
        setContainerWidth(entry.contentRect.width);
      }
    });

    // Start observing the slide container for size changes
    resizeObserver.observe(container);

    // INITIAL WIDTH: Set the starting container width on component mount
    setContainerWidth(container.offsetWidth);

    return () => {
      resizeObserver.disconnect();
    };
  }, [slideData.slideHtml]);

  /**
   * SLIDE GENERATION: Generate initial slide from user data
   * Makes API call to generate-slide endpoint with user's description, theme, research, and documents
   * Includes 5-second delay for better UX and fallback handling for errors
   */
  const generateSlide = async () => {
<<<<<<< HEAD
    // This function is now only used for regeneration with feedback
    // The main slide generation is handled by the research step
    try {
      // Send slide generation request via websocket
      const success = sendGenerateSlide(
        slideData.description,
        slideData.selectedTheme || "default",
        slideData.wantsResearch || false
      );
      
      if (!success) {
        throw new Error("Failed to send generation request");
      } else {
        console.log('Slide generation request sent');
      }
      
    } catch (error) {
      console.error('Error generating slide:', error);
      updateSlideData({ generationError: error instanceof Error ? error.message : 'Failed to generate slide' });
=======
    setIsGenerating(true);

    // UX ENHANCEMENT: Simulate 5-second loading time for better perceived performance
    // This gives users confidence that complex AI processing is happening
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      // API CALL: Send all user data to OpenAI-powered slide generation endpoint
      const response = await fetch('/api/generate-slide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: slideData.description,
          theme: slideData.selectedTheme,
          palette: slideData.selectedPalette,
          researchData: slideData.researchData,
          contentPlan: slideData.contentPlan,
          userFeedback: slideData.userFeedback,
          documents: slideData.parsedDocuments || slideData.documents
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate slide');
      }

      const result = await response.json();
      // SUCCESS: Update parent component with generated HTML slide content
      updateSlideData({ slideHtml: result.slideHtml });
    } catch (error) {
      console.error('Error generating slide:', error);
      // FALLBACK: Use placeholder cat slide image if AI generation fails
      // This ensures users always see something rather than a broken state
      updateSlideData({ slideHtml: 'cat-slide-placeholder' });
    } finally {
      setIsGenerating(false);
>>>>>>> origin/main
    }
  };

  /**
   * SLIDE REGENERATION: Regenerate slide with user feedback incorporated
   * Makes API call with original description plus user feedback for improvements
   * Includes fallback handling for errors to ensure graceful degradation
   */
  const regenerateWithFeedback = async () => {
    if (!feedback.trim()) return;

    setIsRegenerating(true);
    updateSlideData({ userFeedback: feedback });
<<<<<<< HEAD
    
    try {
      // Send regeneration request with feedback
      const success = sendGenerateSlide(
        `${slideData.description}\n\nUser feedback: ${feedback}`,
        slideData.selectedTheme || "default",
        slideData.wantsResearch || false
      );
      
      if (!success) {
        throw new Error("Failed to send regeneration request");
      }
      
      // Set timeout for regeneration
      setTimeout(() => {
        if (isRegenerating) {
          updateSlideData({ generationError: "Slide regeneration timed out. Please try again." });
          setIsRegenerating(false);
        }
      }, 30000);
      
    } catch (error) {
      console.error('Error regenerating slide:', error);
      updateSlideData({ generationError: error instanceof Error ? error.message : 'Failed to regenerate slide' });
      setIsRegenerating(false);
    }
  };

  // Button is enabled when not generating/regenerating, regardless of slide existence
  // The button will handle slide generation if needed

  // Handle proceeding to download - slide should already be generated from research step
  const handleContinueToDownload = () => {
    onNext();
  };
=======

    try {
      // API CALL: Send enhanced prompt with user feedback to improve the slide
      const response = await fetch('/api/generate-slide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `${slideData.description}\n\nUser feedback: ${feedback}`,
          theme: slideData.selectedTheme,
          palette: slideData.selectedPalette,
          researchData: slideData.researchData,
          contentPlan: slideData.contentPlan,
          userFeedback: feedback,
          // DOCUMENT PRIORITIZATION: Use parsed text content when available, fallback to raw files
          // - parsedDocuments: Contains extracted text content that AI can actually process
          // - documents: Raw File objects used as fallback when text extraction fails
          // This ensures AI gets the best possible content for slide generation
          documents: slideData.parsedDocuments || slideData.documents
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate slide');
      }

      const result = await response.json();
      // SUCCESS: Update slide with improved version based on feedback
      updateSlideData({ slideHtml: result.slideHtml });
    } catch (error) {
      console.error('Error regenerating slide:', error);
      // FALLBACK: Apply basic text update if API fails to ensure user sees some change
      const updatedHtml = slideData.slideHtml?.replace(
        'Generated Content',
        `Updated with feedback: "${feedback.slice(0, 50)}..."`
      );
      updateSlideData({ slideHtml: updatedHtml });
    } finally {
      setIsRegenerating(false);
      setFeedback("");
    }
  };

  // VALIDATION: Check if user can proceed to next step
  // Requires slide to be generated and no active processing
  const canProceed = (slideData.slideHtml || slideData.slideHtml === 'cat-slide-placeholder') && !isGenerating && !isRegenerating;
>>>>>>> origin/main

  return (
    <div className="space-y-6">
      {/* HEADER SECTION: Step introduction and instructions */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Preview Your Slide
          </CardTitle>
          <CardDescription>
            Review your AI-generated slide and provide feedback for improvements
          </CardDescription>
        </CardHeader>
      </Card>

<<<<<<< HEAD
      {/* Error Display */}
      {slideData.generationError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <MessageSquare className="h-4 w-4" />
              <p className="font-medium">Generation Error</p>
            </div>
            <p className="text-sm mt-2">{slideData.generationError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                updateSlideData({ generationError: undefined });
                generateSlide();
              }}
              className="mt-3"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Slide Preview */}
=======
      {/* MAIN SLIDE PREVIEW: Display generated slide with loading states */}
>>>>>>> origin/main
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Generated Slide</CardTitle>
              <CardDescription>
                Based on your documents, theme, and {slideData.wantsResearch ? 'research' : 'content'}
              </CardDescription>
            </div>
<<<<<<< HEAD
            <div className="flex items-center gap-2">
              {slideData.slideHtml ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Generated
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Remove debug info section */}
          
          {slideData.isGenerating ? (
            <div className="flex items-center justify-center h-96 bg-muted/30 rounded-lg">
              <div className="text-center space-y-6 w-full max-w-md">
                <div className="space-y-4">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  <div>
                    <p className="font-medium text-lg">Generating your slide...</p>
                    {slideData.generationStatus && (
                      <p className="text-sm text-muted-foreground mt-2">{slideData.generationStatus}</p>
                    )}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${slideData.generationProgress || 0}%` }}
                  />
                </div>
                
                {/* Progress Steps */}
                <div className="space-y-2 text-xs">
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 5 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 5 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Starting process</span>
                  </div>
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 15 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 15 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Processing files</span>
                  </div>
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 40 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 40 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Combining content</span>
                  </div>
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 50 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 50 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Generating layout</span>
                  </div>
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 60 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 60 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Creating content</span>
                  </div>
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 75 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 75 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Building presentation</span>
                  </div>
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 85 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 85 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Generating preview</span>
                  </div>
                  <div className={`flex items-center gap-2 ${(slideData.generationProgress || 0) >= 95 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${(slideData.generationProgress || 0) >= 95 ? 'bg-primary' : 'bg-muted'}`} />
                    <span>Finalizing</span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">This may take a few moments</p>
              </div>
            </div>
          ) : slideData.slideHtml ? (
            <div className="flex justify-center">
              <div className="border rounded-lg overflow-hidden shadow-lg bg-white max-w-4xl w-full">
                <iframe
                  srcDoc={slideData.slideHtml}
                  className="w-full border-0"
                  style={{ 
                    height: '600px',
                    minHeight: '400px',
                    maxHeight: '800px'
                  }}
                  sandbox="allow-same-origin"
                  title="Slide Preview"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-muted/30 rounded-lg">
              <div className="text-center space-y-4">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <div>
                  <p className="font-medium">Preparing your slide...</p>
                  <p className="text-sm text-muted-foreground">Slide generation was initiated from the previous step</p>
                </div>
              </div>
            </div>
          )}
=======
            {/* Badge indicating AI generation */}
            <Badge variant="secondary">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* LOADING STATE: Show spinner while generating slide in 16:9 aspect ratio */}
          {isGenerating ? (
            <div className="border rounded-lg overflow-hidden shadow-lg">
              {/* 16:9 ASPECT RATIO CONTAINER: Consistent loading state */}
              <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                  <div className="text-center space-y-4">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    <div>
                      <p className="font-medium">Generating your slide...</p>
                      <p className="text-sm text-muted-foreground">This may take a few moments</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : slideData.slideHtml === 'cat-slide-placeholder' ? (
            // FALLBACK STATE: Show placeholder cat slide image in 16:9 aspect ratio
            <div className="border rounded-lg overflow-hidden shadow-lg">
              {/* 16:9 ASPECT RATIO CONTAINER: Consistent with generated slides */}
              <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
                <img
                  src="/samples/slides/cat_slide_1.png"
                  alt="Generated Slide Preview"
                  className="absolute inset-0 w-full h-full object-contain bg-white"
                />
              </div>
            </div>
          ) : slideData.slideHtml ? (
            // SUCCESS STATE: Render HTML slide with responsive container width tracking
            // The slideContainerRef enables real-time monitoring of container dimensions for adaptive scaling
            <div className="border rounded-lg overflow-hidden shadow-lg" ref={slideContainerRef}>
              {/* 
                ASPECT RATIO CONTAINER: Creates a responsive 16:9 container that maintains PowerPoint proportions
                - Uses padding-bottom technique to create intrinsic aspect ratio
                - 56.25% = (9/16) * 100% for perfect 16:9 ratio
                - Ensures slide preview matches final PowerPoint export dimensions
                - Container width is tracked via slideContainerRef for responsive scaling calculations
              */}
              <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
                {/* 
                  SLIDE VIEWPORT: Absolute positioned container that fills the aspect ratio box
                  - White background provides clean canvas for slide content
                  - Absolute positioning allows content to fill the entire 16:9 area
                */}
                <div className="absolute inset-0 bg-white">
                  {/* 
                    DEBUG HEADER: Development information bar for troubleshooting slide generation
                    - Shows HTML content length and data type for debugging
                    - Fixed position at top with high z-index to stay visible
                    - Helps developers verify AI content generation is working correctly
                  */}
                  <div className="absolute top-0 left-0 right-0 p-2 bg-gray-100 text-xs text-gray-600 border-b z-10">
                    Debug: HTML length: {slideData.slideHtml.length} chars | Container: {containerWidth}px
                  </div>
                  {/* 
                    SLIDE CONTENT RENDERER: Displays the AI-generated HTML slide content with responsive container-based scaling
                    
                    SECURITY NOTE: Uses dangerouslySetInnerHTML to render OpenAI-generated HTML
                    - This is necessary to display formatted slide content with styling
                    - Content comes from trusted OpenAI API, not user input
                    - HTML is scoped to prevent affecting parent page styles
                    
                    LAYOUT FEATURES:
                    - pt-8: Top padding to account for debug header above
                    - overflow-auto: Allows scrolling if content exceeds container bounds
                    - absolute inset-0: Fills entire 16:9 aspect ratio container
                    - slide-content-scaler: Custom class that enables container query scaling
                    
                    SCALING APPROACH:
                    - Uses CSS Container Queries for responsive font scaling
                    - Adapts to container width changes (sidebar collapse/expand)
                    - Maintains readability across all screen sizes
                    - Preserves slide proportions and visual hierarchy
                  */}
                  <div
                    className="absolute inset-0 pt-8 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: slideData.slideHtml }}
                    style={{
                      // RESPONSIVE FONT SCALING: Calculate scale factor based on container width
                      // 800px = 1.0 scale baseline, with bounds 0.6-1.3 for readability
                      fontSize: `${Math.max(0.6, Math.min(1.3, containerWidth / 800))}rem`,
                      lineHeight: '1.4',
                      // TRANSFORM SCALING: Apply proportional scaling for consistent visual hierarchy
                      // Uses slightly tighter bounds (0.7-1.2) to prevent extreme scaling
                      transform: `scale(${Math.max(0.7, Math.min(1.2, containerWidth / 800))})`,
                      transformOrigin: 'top left',
                      // CONTAINER COMPENSATION: Adjust container dimensions to account for transform scaling
                      // Prevents content from being cut off when scaled down
                      width: `${100 / Math.max(0.7, Math.min(1.2, containerWidth / 800))}%`,
                      height: `${100 / Math.max(0.7, Math.min(1.2, containerWidth / 800))}%`,
                    }}
                  />


                </div>
              </div>
            </div>
          ) : null}
>>>>>>> origin/main
        </CardContent>
      </Card>

      {/* FEEDBACK SECTION: User input for slide improvements - only shown after slide is generated */}
      {slideData.slideHtml && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Provide Feedback
            </CardTitle>
            <CardDescription>
              Tell us what you’d like to change or improve about the slide
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {/* Input field for user feedback */}
              <Label htmlFor="feedback">Your feedback</Label>
              <Input
                id="feedback"
                placeholder="e.g., Make the title larger, change colors to blue, add more bullet points..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
            {/* Button to regenerate slide with feedback */}
            <Button
              variant="outline"
              onClick={regenerateWithFeedback}
              disabled={!feedback.trim() || isRegenerating}
              className="w-full"
            >
              {isRegenerating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Regenerating slide...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate with feedback
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* NAVIGATION: Step navigation buttons */}
      <div className="flex justify-between">
        {/* Back button to previous step */}
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
<<<<<<< HEAD
          Back to Research
        </Button>
        <Button 
          variant="engineering" 
          size="lg" 
          onClick={handleContinueToDownload}
          disabled={slideData.isGenerating || isRegenerating || !slideData.slideHtml}
        >
          Continue to Download
          <ArrowRight className="h-4 w-4 ml-2" />
=======
          Back to Content Planning
>>>>>>> origin/main
        </Button>

        <div className="flex gap-2">
          {/* DEBUG BUTTON: Developer tool to inspect generated HTML code */}
          {/* Opens generated HTML in new window and logs details to console */}
          {slideData.slideHtml && slideData.slideHtml !== 'cat-slide-placeholder' && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                // Log HTML details to browser console for debugging
                console.log('Generated HTML:', slideData.slideHtml);
                console.log('HTML type:', typeof slideData.slideHtml);
                console.log('HTML length:', slideData.slideHtml?.length);

                // Open HTML in new browser window for visual inspection
                if (slideData.slideHtml) {
                  const newWindow = window.open('', '_blank');
                  if (newWindow) {
                    newWindow.document.write(slideData.slideHtml);
                    newWindow.document.close();
                  }
                }
              }}
            >
              Debug: View HTML
            </Button>
          )}

          {/* Next button to download step - disabled until slide is ready */}
          <Button
            variant="engineering"
            size="lg"
            onClick={onNext}
            disabled={!canProceed}
          >
            Continue to Download
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
