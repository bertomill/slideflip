"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, ArrowRight, Brain, CheckCircle, XCircle, Lightbulb } from "lucide-react";
import { SlideData } from "@/app/builder/page";

interface ResearchStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function ResearchStep({ slideData, updateSlideData, onNext, onPrev }: ResearchStepProps) {
  const [isResearching, setIsResearching] = useState(false);
  const [researchComplete, setResearchComplete] = useState(false);

  const handleResearchChoice = async (wantsResearch: boolean) => {
    updateSlideData({ wantsResearch });
    
    if (wantsResearch) {
      setIsResearching(true);
      
      // Simulate AI research
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const mockResearchData = `
        Additional insights found:
        • Industry trends show 23% growth in this sector
        • Recent studies indicate best practices include visual storytelling
        • Competitor analysis reveals key differentiators
        • Market data suggests focusing on ROI metrics
      `;
      
      updateSlideData({ researchData: mockResearchData });
      setIsResearching(false);
      setResearchComplete(true);
    }
  };

  const canProceed = slideData.wantsResearch !== undefined;

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Additional Research
          </CardTitle>
          <CardDescription>
            Would you like AI to conduct additional research to enhance your slide content?
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Yes Option */}
        <Card 
          variant={slideData.wantsResearch === true ? "premium" : "glass"}
          className={`cursor-pointer transition-premium hover:scale-[1.02] ${
            slideData.wantsResearch === true ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => !isResearching && handleResearchChoice(true)}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Yes, enhance with research</CardTitle>
                {slideData.wantsResearch === true && (
                  <Badge variant="secondary" className="mt-1">
                    <Brain className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              AI will research relevant industry data, trends, and best practices to make your slide more compelling and data-driven.
            </CardDescription>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Industry insights & trends
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Supporting statistics
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Best practice recommendations
              </div>
            </div>
          </CardContent>
        </Card>

        {/* No Option */}
        <Card 
          variant={slideData.wantsResearch === false ? "premium" : "glass"}
          className={`cursor-pointer transition-premium hover:scale-[1.02] ${
            slideData.wantsResearch === false ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => !isResearching && handleResearchChoice(false)}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">No, use existing content</CardTitle>
                {slideData.wantsResearch === false && (
                  <Badge variant="secondary" className="mt-1">
                    <Brain className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Proceed with just the content from your uploaded documents. This is faster and works well when you have comprehensive source material.
            </CardDescription>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Faster processing time
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Focus on your specific content
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Maintain original context
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Research Progress */}
      {isResearching && (
        <Card variant="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <h3 className="font-semibold">AI Research in Progress</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Our AI is analyzing industry trends, gathering supporting data, and finding relevant insights to enhance your slide...
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Analyzing industry trends...
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Gathering supporting statistics...
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Finding best practices...
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Research Results */}
      {researchComplete && slideData.researchData && (
        <Card variant="premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Research Complete
            </CardTitle>
            <CardDescription>
              AI has gathered additional insights to enhance your slide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <pre className="text-sm whitespace-pre-wrap text-foreground">
                {slideData.researchData}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Themes
        </Button>
        <Button 
          variant="notion" 
          size="lg" 
          onClick={onNext}
          disabled={!canProceed || isResearching}
        >
          Continue to Preview
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}