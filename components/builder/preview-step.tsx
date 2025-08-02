"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, ArrowRight, RefreshCw, MessageSquare, Sparkles } from "lucide-react";
import { SlideData } from "@/app/builder/page";

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

  useEffect(() => {
    if (!slideData.slideHtml) {
      generateSlide();
    }
  }, []);

  const generateSlide = async () => {
    setIsGenerating(true);
    
    // Simulate AI slide generation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const mockSlideHtml = `
      <div style="width: 800px; height: 600px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px; color: white; font-family: 'Arial', sans-serif; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>'); opacity: 0.3;"></div>
        
        <div style="position: relative; z-index: 1;">
          <h1 style="font-size: 48px; font-weight: bold; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
            ${slideData.description.split(' ').slice(0, 4).join(' ')}
          </h1>
          
          <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 15px; padding: 30px; margin: 40px 0;">
            <h2 style="font-size: 24px; margin-bottom: 20px; color: #f0f0f0;">Key Insights</h2>
            <ul style="list-style: none; padding: 0;">
              <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                <span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span>
                Document analysis reveals key trends
              </li>
              <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                <span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #60a5fa; border-radius: 50%;"></span>
                ${slideData.selectedTheme} theme applied for optimal impact
              </li>
              ${slideData.wantsResearch ? `
              <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                <span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span>
                Enhanced with AI research insights
              </li>
              ` : ''}
            </ul>
          </div>
          
          <div style="position: absolute; bottom: 40px; right: 60px; font-size: 14px; opacity: 0.8;">
            Created with SlideFlip AI
          </div>
        </div>
      </div>
    `;
    
    updateSlideData({ slideHtml: mockSlideHtml });
    setIsGenerating(false);
  };

  const regenerateWithFeedback = async () => {
    if (!feedback.trim()) return;
    
    setIsRegenerating(true);
    updateSlideData({ userFeedback: feedback });
    
    // Simulate AI regeneration with feedback
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Update the slide HTML based on feedback (mock)
    const updatedHtml = slideData.slideHtml?.replace(
      'Document analysis reveals key trends',
      `Updated based on your feedback: "${feedback.slice(0, 50)}..."`
    );
    
    updateSlideData({ slideHtml: updatedHtml });
    setIsRegenerating(false);
    setFeedback("");
  };

  const canProceed = slideData.slideHtml && !isGenerating && !isRegenerating;

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
            <Badge variant="secondary">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="flex items-center justify-center h-96 bg-muted/30 rounded-lg">
              <div className="text-center space-y-4">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <div>
                  <p className="font-medium">Generating your slide...</p>
                  <p className="text-sm text-muted-foreground">This may take a few moments</p>
                </div>
              </div>
            </div>
          ) : slideData.slideHtml ? (
            <div className="border rounded-lg overflow-hidden shadow-lg">
              <div 
                dangerouslySetInnerHTML={{ __html: slideData.slideHtml }}
                className="transform scale-75 origin-top-left"
                style={{ width: '133.33%', height: '133.33%' }}
              />
            </div>
          ) : null}
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
                variant="premium"
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
          variant="premium" 
          size="lg" 
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue to Download
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}