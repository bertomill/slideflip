"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, ArrowRight, RefreshCw, MessageSquare, Sparkles, CheckCircle } from "lucide-react";
import { SlideData } from "@/app/builder/page";

interface PreviewStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrev: () => void;
  sendGenerateSlide: (description: string, theme?: string, wantsResearch?: boolean) => boolean;
}

export function PreviewStep({ slideData, updateSlideData, onNext, onPrev, sendGenerateSlide }: PreviewStepProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [feedback, setFeedback] = useState("");

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
  useEffect(() => {
    if (slideData.description && !slideData.slideHtml && !slideData.isGenerating && !slideData.generationError) {
      console.log('Setting generating state to true - slide should be generating');
      updateSlideData({ 
        isGenerating: true, 
        generationStatus: "Starting slide generation...",
        generationProgress: 0
      });
    }
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

  const generateSlide = async () => {
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
    }
  };

  const regenerateWithFeedback = async () => {
    if (!feedback.trim()) return;
    
    setIsRegenerating(true);
    updateSlideData({ userFeedback: feedback });
    
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

  return (
    <div className="space-y-6">
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
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Generated Slide</CardTitle>
              <CardDescription>
                Based on your documents, theme, and {slideData.wantsResearch ? 'research' : 'content'}
              </CardDescription>
            </div>
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
        </CardContent>
      </Card>

      {/* Feedback Section */}
      {slideData.slideHtml && (
        <Card variant="premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Provide Feedback
            </CardTitle>
            <CardDescription>
              Tell us what you'd like to change or improve about the slide
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback">Your feedback</Label>
              <Input
                id="feedback"
                placeholder="e.g., Make the title larger, change colors to blue, add more bullet points..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
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

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
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
        </Button>
      </div>
    </div>
  );
}