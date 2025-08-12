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
}

export function PreviewStep({ slideData, updateSlideData, onNext, onPrev }: PreviewStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [containerWidth, setContainerWidth] = useState(800);
  const slideContainerRef = useRef<HTMLDivElement>(null);

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
    };
  };

  // Call API to generate slide HTML
  const generateSlide = async (overrideFeedback?: string) => {
    if (!slideData.description || isGenerating) return;
    setIsGenerating(true);
    try {
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
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate on first entry to this step if we don't have HTML yet
  useEffect(() => {
    if (!slideData.slideHtml && slideData.description) {
      generateSlide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideData.slideHtml, slideData.description, slideData.selectedTheme, slideData.contentPlan, slideData.userFeedback, slideData.researchData, slideData.wantsResearch]);

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

