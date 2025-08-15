"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, ArrowRight, RefreshCw, MessageSquare, Sparkles } from "lucide-react";
import { SlideData } from "@/app/build/page";

interface PreviewStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrev: () => void;
  // WebSocket props
  isConnected?: boolean;
  connectionStatus?: string;
  sendGenerateSlideRequest?: (
    description: string,
    theme: string,
    researchData?: string,
    contentPlan?: string,
    userFeedback?: string,
    documents?: Array<{ filename: string; success?: boolean; content?: string }>,
    model?: string
  ) => boolean;
  lastMessage?: any;
}

export function PreviewStep({ 
  slideData, 
  updateSlideData, 
  onNext, 
  onPrev,
  isConnected = false,
  connectionStatus = 'disconnected',
  sendGenerateSlideRequest,
  lastMessage
}: PreviewStepProps) {
  type ModelAwareSlideData = SlideData & { selectedModel?: string };
  const modelAwareSlideData = slideData as ModelAwareSlideData;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [containerWidth, setContainerWidth] = useState(800);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  // Debug logging when component mounts
  useEffect(() => {
    console.log('🔍 PreviewStep mounted with props:', {
      isConnected,
      connectionStatus,
      hasSendGenerateSlideRequest: !!sendGenerateSlideRequest,
      hasDescription: !!slideData.description,
      hasSlideHtml: !!slideData.slideHtml
    });
  }, [isConnected, connectionStatus, sendGenerateSlideRequest, slideData.description, slideData.slideHtml]);

  useEffect(() => {
    if (!slideData.slideHtml) {
      updateSlideData({
        slideHtml: `<div><h2>Test Slide</h2><ul><li>Bullet 1</li><li>Bullet 2</li></ul></div>`
      });
    }
    const container = slideContainerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    resizeObserver.observe(container);
    setContainerWidth(container.offsetWidth);
    return () => resizeObserver.disconnect();
  }, [slideData.slideHtml]);

  // Build request body for slide generation API
  const buildRequestPayload = (overrideFeedback?: string) => {
    const hasParsedDocs = Array.isArray(slideData.parsedDocuments) && slideData.parsedDocuments.length > 0;
    const simplifiedDocs = hasParsedDocs
      ? slideData.parsedDocuments!.map((d) => ({
          filename: d.filename,
          success: d.success,
          content: d.content,
        }))
      : slideData.documents && slideData.documents.length > 0
      ? slideData.documents.map((f) => ({ filename: f.name }))
      : undefined;

    return {
      description: slideData.description,
      theme: slideData.selectedTheme || "Professional",
      researchData: slideData.wantsResearch ? slideData.researchData : undefined,
      contentPlan: slideData.contentPlan,
      userFeedback: typeof overrideFeedback === "string" ? overrideFeedback : slideData.userFeedback,
      documents: simplifiedDocs,
      model: modelAwareSlideData.selectedModel || undefined,
    };
  };

  // Call API to generate slide HTML
  const generateSlide = async (overrideFeedback?: string) => {
    console.log('🔍 generateSlide called with overrideFeedback:', overrideFeedback);
    console.log('🔍 Current state - isGenerating:', isGenerating, 'description:', !!slideData.description);
    console.log('🔍 WebSocket connection - isConnected:', isConnected, 'sendGenerateSlideRequest:', !!sendGenerateSlideRequest);
    
    if (!slideData.description || isGenerating) {
      console.log('🔍 Skipping slide generation - no description or already generating');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Try websocket first if connected
      if (isConnected && sendGenerateSlideRequest) {
        console.log('🔍 Using websocket for slide generation');
        const success = sendGenerateSlideRequest(
          slideData.description,
          slideData.selectedTheme || "Professional",
          slideData.wantsResearch ? slideData.researchData : undefined,
          slideData.contentPlan,
          typeof overrideFeedback === "string" ? overrideFeedback : slideData.userFeedback,
          buildRequestPayload(overrideFeedback).documents,
          modelAwareSlideData.selectedModel
        );
        
        console.log('🔍 sendGenerateSlideRequest result:', success);
        
        if (!success) {
          throw new Error('Failed to send websocket message');
        }
        
        console.log('🔍 WebSocket message sent successfully, waiting for response');
        // Don't set isGenerating to false here - wait for websocket response
        return;
      }
      
      // Fallback to API call if websocket not available
      console.log('🔍 Using API fallback for slide generation');
      const response = await fetch("/api/generate-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(overrideFeedback)),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.success && data?.slideHtml) {
          updateSlideData({ slideHtml: data.slideHtml });
          return;
        }
      }
      // If primary generation failed or returned no HTML, try fallback API
      const fallbackRes = await fetch('/api/fallback-slide');
      if (fallbackRes.ok) {
        const fb = await fallbackRes.json();
        if (fb?.slideHtml) {
          updateSlideData({ slideHtml: fb.slideHtml });
          return;
        }
      }
      throw new Error('Slide generation failed and no fallback available');
    } catch (err) {
      console.error("Slide generation error:", err);
      // Fallback to placeholder so user can continue the flow
      updateSlideData({ slideHtml: "cat-slide-placeholder" });
      setIsGenerating(false);
    }
  };

  // Auto-generate on first entry to this step if we don't have HTML yet
  useEffect(() => {
    if (!slideData.slideHtml && slideData.description && isConnected) {
      console.log('🔍 Auto-generating slide - websocket connected, description available');
      generateSlide();
    } else if (!slideData.slideHtml && slideData.description && !isConnected) {
      console.log('🔍 Cannot auto-generate slide - websocket not connected');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideData.slideHtml, slideData.description, slideData.selectedTheme, slideData.contentPlan, slideData.userFeedback, slideData.researchData, slideData.wantsResearch, isConnected]);

  // Handle websocket messages for slide generation
  useEffect(() => {
    if (!lastMessage) return;
    
    if (lastMessage.type === 'slide_generation_complete') {
      console.log('Received slide generation complete message:', lastMessage);
      if (lastMessage.data?.slide_html) {
        updateSlideData({ slideHtml: lastMessage.data.slide_html });
        setIsGenerating(false);
        setIsRegenerating(false);
      }
    } else if (lastMessage.type === 'slide_generation_error') {
      console.error('Slide generation error:', lastMessage.data?.error);
      // Fallback to placeholder so user can continue the flow
      updateSlideData({ slideHtml: "cat-slide-placeholder" });
      setIsGenerating(false);
      setIsRegenerating(false);
    }
  }, [lastMessage, updateSlideData]);

  const regenerateWithFeedback = async () => {
    if (!feedback.trim()) return;
    setIsRegenerating(true);
    try {
      await generateSlide(feedback.trim());
    } finally {
      setIsRegenerating(false);
      setFeedback("");
    }
  };

  const canProceed = (slideData.slideHtml || slideData.slideHtml === 'cat-slide-placeholder') && !isGenerating && !isRegenerating;

  return (
    <div className="space-y-6">
      {/* Debug information */}
      <Card variant="glass" className="border-orange-200 bg-orange-50/50">
        <CardContent className="p-4">
          <div className="text-sm space-y-2">
            <div className="font-semibold text-orange-800">🔍 Debug Info</div>
            <div>WebSocket Connected: <span className={isConnected ? 'text-green-600' : 'text-red-600'}>{isConnected ? 'Yes' : 'No'}</span></div>
            <div>Connection Status: <span className="font-mono">{connectionStatus}</span></div>
            <div>Has sendGenerateSlideRequest: <span className={sendGenerateSlideRequest ? 'text-green-600' : 'text-red-600'}>{sendGenerateSlideRequest ? 'Yes' : 'No'}</span></div>
            <div>Has Description: <span className={slideData.description ? 'text-green-600' : 'text-red-600'}>{slideData.description ? 'Yes' : 'No'}</span></div>
            <div>Has Slide HTML: <span className={slideData.slideHtml ? 'text-green-600' : 'text-red-600'}>{slideData.slideHtml ? 'Yes' : 'No'}</span></div>
            <div>Is Generating: <span className={isGenerating ? 'text-orange-600' : 'text-gray-600'}>{isGenerating ? 'Yes' : 'No'}</span></div>
          </div>
          <div className="mt-4 pt-4 border-t border-orange-200">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log('🔍 Manual test button clicked');
                if (isConnected && sendGenerateSlideRequest && slideData.description) {
                  console.log('🔍 Sending manual test message');
                  const success = sendGenerateSlideRequest(
                    slideData.description,
                    slideData.selectedTheme || "Professional",
                    slideData.wantsResearch ? slideData.researchData : undefined,
                    slideData.contentPlan,
                    slideData.userFeedback,
                    [],
                    "gpt-4o"
                  );
                  console.log('🔍 Manual test result:', success);
                } else {
                  console.log('🔍 Cannot send test message - missing requirements');
                }
              }}
              disabled={!isConnected || !sendGenerateSlideRequest || !slideData.description}
              className="w-full"
            >
              Test WebSocket Message
            </Button>
          </div>
        </CardContent>
      </Card>

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

      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Generated Slide</CardTitle>
              <CardDescription>
                Based on your documents, theme, and {slideData.wantsResearch ? 'research' : 'content'}
              </CardDescription>
            </div>
            <Badge variant="secondary">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="border rounded-lg overflow-hidden shadow-lg">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
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
            <div className="border rounded-lg overflow-hidden shadow-lg">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/samples/slides/cat_slide_1.png" alt="Generated Slide Preview" className="absolute inset-0 w-full h-full object-contain bg-white" />
              </div>
            </div>
          ) : slideData.slideHtml ? (
            <div className="border rounded-lg overflow-hidden shadow-lg" ref={slideContainerRef}>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 bg-white">
                  <div className="absolute top-0 left-0 right-0 p-2 bg-gray-100 text-xs text-gray-600 border-b z-10">
                    Debug: HTML length: {slideData.slideHtml.length} chars | Container: {containerWidth}px
                  </div>
                  <div
                    className="absolute inset-0 pt-8 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: slideData.slideHtml }}
                    style={{
                      fontSize: `${Math.max(0.6, Math.min(1.3, containerWidth / 800))}rem`,
                      lineHeight: '1.4',
                      transform: `scale(${Math.max(0.7, Math.min(1.2, containerWidth / 800))})`,
                      transformOrigin: 'top left',
                      width: `${100 / Math.max(0.7, Math.min(1.2, containerWidth / 800))}%`,
                      height: `${100 / Math.max(0.7, Math.min(1.2, containerWidth / 800))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
              <Label htmlFor="feedback">Your feedback</Label>
              <Input id="feedback" placeholder="e.g., Make the title larger, change colors to blue, add more bullet points..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
            <Button variant="outline" onClick={regenerateWithFeedback} disabled={!feedback.trim() || isRegenerating} className="w-full">
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
          Back to Content Planning
        </Button>
        <div className="flex gap-2">
          <Button variant="engineering" size="lg" onClick={onNext} disabled={!canProceed}>
            Continue to Download
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

