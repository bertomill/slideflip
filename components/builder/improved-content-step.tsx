"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, FileText, Sparkles, Brain, Loader2 } from "lucide-react";
import { SlideData } from "@/app/build/page";
import { useImprovedWebSocket, ContentPlanResponse } from "@/hooks/use-improved-websocket";
import { useUser } from "@/lib/supabase/client";

interface ImprovedContentStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function ImprovedContentStep({ 
  slideData, 
  updateSlideData, 
  onNext, 
  onPrevious 
}: ImprovedContentStepProps) {
  const user = useUser();
  const clientId = user?.id || `anonymous_${Date.now()}`;
  
  // Use the improved WebSocket hook
  const {
    state,
    sendContentPlanning,
    isConnected
  } = useImprovedWebSocket({
    clientId,
    autoConnect: true,
    onProgress: (progress) => {
      setProcessingMessage(progress.message);
    },
    onContentPlan: (plan: ContentPlanResponse) => {
      setGeneratedPlan(plan.content_plan);
      setSuggestions(plan.suggestions);
      setIsGenerating(false);
    },
    onError: (error) => {
      setProcessingMessage(`Error: ${error.error_message}`);
      setIsGenerating(false);
    }
  });

  const [contentOutline, setContentOutline] = useState(slideData.contentOutline || "");
  const [generatedPlan, setGeneratedPlan] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [includeResearch, setIncludeResearch] = useState(false);
  const [researchTopics, setResearchTopics] = useState<string[]>([]);

  // Update slide data when outline changes
  useEffect(() => {
    updateSlideData({ contentOutline });
  }, [contentOutline, updateSlideData]);

  // Generate content plan using AI
  const handleGenerateContentPlan = async () => {
    if (!isConnected) {
      alert("Not connected to server. Please wait for connection.");
      return;
    }

    if (slideData.documents.length === 0) {
      alert("Please upload some documents first.");
      return;
    }

    setIsGenerating(true);
    setProcessingMessage("Generating content plan...");

    try {
      await sendContentPlanning(contentOutline, includeResearch, researchTopics);
    } catch (error) {
      console.error('Failed to generate content plan:', error);
      setProcessingMessage('Failed to generate content plan');
      setIsGenerating(false);
    }
  };

  // Apply a suggestion to the outline
  const applySuggestion = (suggestion: string) => {
    const newOutline = contentOutline + (contentOutline ? '\n\n' : '') + '• ' + suggestion;
    setContentOutline(newOutline);
  };

  // Use generated plan as the outline
  const useGeneratedPlan = () => {
    setContentOutline(generatedPlan);
    updateSlideData({ contentOutline: generatedPlan, generatedContentPlan: generatedPlan });
  };

  // Add research topic
  const addResearchTopic = () => {
    const topic = prompt("Enter a research topic:");
    if (topic && topic.trim()) {
      setResearchTopics([...researchTopics, topic.trim()]);
    }
  };

  // Remove research topic
  const removeResearchTopic = (index: number) => {
    setResearchTopics(researchTopics.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`p-2 rounded text-sm ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {isConnected ? '🟢 Connected to server' : '🟡 Connecting to server...'}
      </div>

      {/* Processing Status */}
      {(isGenerating || processingMessage) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-2">
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            <p className="text-sm text-blue-800">{processingMessage}</p>
          </div>
          {state.progress > 0 && (
            <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${state.progress}%` }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* Document Summary */}
      {slideData.documents.length > 0 && (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Uploaded Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {slideData.documents.map((doc, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <FileText className="h-3 w-3 text-gray-500" />
                  <span>{doc.name}</span>
                  <span className="text-gray-500">({(doc.size / 1024).toFixed(1)} KB)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Content Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Content Planning
          </CardTitle>
          <CardDescription>
            Let AI analyze your documents and generate a content plan for your slides
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Research Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include-research"
                checked={includeResearch}
                onChange={(e) => setIncludeResearch(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="include-research" className="text-sm">
                Include web research to enhance content
              </Label>
            </div>

            {includeResearch && (
              <div className="space-y-2">
                <Label className="text-sm">Research Topics (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {researchTopics.map((topic, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {topic}
                      <button
                        onClick={() => removeResearchTopic(index)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={addResearchTopic}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200"
                  >
                    + Add Topic
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleGenerateContentPlan}
            disabled={!isConnected || isGenerating || slideData.documents.length === 0}
            className="w-full flex items-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Content Plan
          </Button>
        </CardContent>
      </Card>

      {/* Generated Content Plan */}
      {generatedPlan && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Generated Content Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-4 rounded border border-green-200">
              <pre className="whitespace-pre-wrap text-sm font-mono">{generatedPlan}</pre>
            </div>
            <Button
              onClick={useGeneratedPlan}
              variant="outline"
              className="w-full border-green-300 text-green-700 hover:bg-green-100"
            >
              Use This Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content Suggestions */}
      {suggestions.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 text-sm">Content Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                  <span className="text-sm">{suggestion}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => applySuggestion(suggestion)}
                    className="text-blue-600 border-blue-300"
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Content Outline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Outline
          </CardTitle>
          <CardDescription>
            Define or refine the structure and content for your slides
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content-outline">Slide Content Structure</Label>
            <Textarea
              id="content-outline"
              value={contentOutline}
              onChange={(e) => setContentOutline(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder={`Define your slide content structure, for example:

• Introduction
  - Problem statement
  - Key objectives

• Main Content
  - Key point 1 with supporting data
  - Key point 2 with examples
  - Key point 3 with analysis

• Conclusion
  - Summary of findings
  - Next steps
  - Call to action

You can also use the AI generator above to create this automatically from your uploaded documents.`}
            />
          </div>
          
          <div className="text-sm text-gray-600">
            <p>
              💡 <strong>Tip:</strong> Be specific about what you want on each slide. 
              The AI will use this outline along with your uploaded documents to generate the final slides.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Content Summary */}
      {contentOutline && (
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-purple-600 mt-1" />
              <div>
                <h3 className="font-medium text-purple-900">Content Ready</h3>
                <p className="text-sm text-purple-700 mt-1">
                  Your content outline is defined ({contentOutline.split('\n').filter(line => line.trim()).length} lines). 
                  Click continue to proceed with slide generation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!contentOutline.trim() || isGenerating || !isConnected}
          className="flex items-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}