"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Download, Eye, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { SlideData } from "@/app/build/page";
import { useImprovedWebSocket, SlideComplete } from "@/hooks/use-improved-websocket";
import { useUser } from "@/lib/supabase/client";

interface ImprovedPreviewStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function ImprovedPreviewStep({ 
  slideData, 
  updateSlideData, 
  onNext, 
  onPrevious 
}: ImprovedPreviewStepProps) {
  const user = useUser();
  const clientId = user?.id || `anonymous_${Date.now()}`;
  
  // Use the improved WebSocket hook
  const {
    state,
    sendSlideGeneration,
    isConnected
  } = useImprovedWebSocket({
    clientId,
    autoConnect: true,
    onProgress: (progress) => {
      setGenerationMessage(progress.message);
      setGenerationProgress(progress.progress);
    },
    onSlideComplete: (slide: SlideComplete) => {
      setGeneratedHtml(slide.slide_html);
      setSlideName(slide.slide_name);
      setGenerationTime(slide.generation_time);
      setIsGenerating(false);
      setGenerationMessage("Slide generation completed!");
      
      // Update slide data
      updateSlideData({ 
        generatedSlide: slide.slide_html,
        slideName: slide.slide_name 
      });
    },
    onError: (error) => {
      setGenerationMessage(`Error: ${error.error_message}`);
      setIsGenerating(false);
    }
  });

  const [generatedHtml, setGeneratedHtml] = useState(slideData.generatedSlide || "");
  const [slideName, setSlideName] = useState(slideData.slideName || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationTime, setGenerationTime] = useState(0);

  // Generate slide using AI
  const handleGenerateSlide = async () => {
    if (!isConnected) {
      alert("Not connected to server. Please wait for connection.");
      return;
    }

    if (!slideData.contentOutline) {
      alert("Please define content outline first.");
      return;
    }

    if (!slideData.theme) {
      alert("Please select a theme first.");
      return;
    }

    setIsGenerating(true);
    setGenerationMessage("Starting slide generation...");
    setGenerationProgress(0);

    try {
      // Prepare content plan
      const contentPlan = {
        outline: slideData.contentOutline,
        documents: slideData.documents.map(doc => ({
          name: doc.name,
          type: doc.type,
          size: doc.size
        })),
        description: slideData.description,
        slideCount: slideData.slideCount || 1
      };

      // Prepare theme config
      const themeConfig = {
        theme: slideData.theme,
        themeData: slideData.themeData,
        slideCount: slideData.slideCount || 1
      };

      // Generation options
      const generationOptions = {
        model: slideData.selectedModel || "gpt-4",
        includeImages: true,
        includeCharts: true
      };

      await sendSlideGeneration(contentPlan, themeConfig, generationOptions);

    } catch (error) {
      console.error('Failed to generate slide:', error);
      setGenerationMessage('Failed to generate slide');
      setIsGenerating(false);
    }
  };

  // Download slide as HTML
  const downloadSlideHtml = () => {
    if (!generatedHtml) return;

    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slideName || 'slide'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`p-2 rounded text-sm ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {isConnected ? '🟢 Connected to server' : '🟡 Connecting to server...'}
      </div>

      {/* Generation Status */}
      {(isGenerating || generationMessage) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-2">
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            <p className="text-sm text-blue-800">{generationMessage}</p>
          </div>
          {generationProgress > 0 && (
            <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
          )}
          {generationTime > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              Generated in {generationTime.toFixed(1)}s
            </p>
          )}
        </div>
      )}

      {/* Slide Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Slide
          </CardTitle>
          <CardDescription>
            Generate your professional slide using AI based on your content and theme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generation Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{slideData.documents?.length || 0}</div>
              <div className="text-sm text-gray-600">Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{slideData.slideCount || 1}</div>
              <div className="text-sm text-gray-600">Slides</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {slideData.theme ? slideData.themeData?.name || slideData.theme : 'None'}
              </div>
              <div className="text-sm text-gray-600">Theme</div>
            </div>
          </div>

          {/* Content Preview */}
          {slideData.contentOutline && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Content Outline Preview:</h4>
              <div className="p-3 bg-gray-50 rounded border max-h-32 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {slideData.contentOutline.substring(0, 200)}
                  {slideData.contentOutline.length > 200 && '...'}
                </pre>
              </div>
            </div>
          )}

          {/* Generation Button */}
          <Button
            onClick={handleGenerateSlide}
            disabled={!isConnected || isGenerating || !slideData.contentOutline || !slideData.theme}
            className="w-full flex items-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generatedHtml ? 'Regenerate Slide' : 'Generate Slide'}
          </Button>

          {/* Requirements Check */}
          <div className="space-y-2 text-sm">
            <div className={`flex items-center gap-2 ${slideData.contentOutline ? 'text-green-600' : 'text-red-600'}`}>
              {slideData.contentOutline ? '✅' : '❌'} Content outline defined
            </div>
            <div className={`flex items-center gap-2 ${slideData.theme ? 'text-green-600' : 'text-red-600'}`}>
              {slideData.theme ? '✅' : '❌'} Theme selected
            </div>
            <div className={`flex items-center gap-2 ${slideData.documents?.length > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
              {slideData.documents?.length > 0 ? '✅' : '⚠️'} Documents uploaded {slideData.documents?.length > 0 ? '' : '(optional)'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Slide Preview */}
      {generatedHtml && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Slide Preview
            </CardTitle>
            <CardDescription>
              {slideName && `Slide: ${slideName}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview Frame */}
            <div className="border rounded-lg overflow-hidden bg-white">
              <div 
                className="w-full min-h-[400px] border-none"
                dangerouslySetInnerHTML={{ __html: generatedHtml }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={downloadSlideHtml}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download HTML
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const newWindow = window.open('', '_blank');
                  if (newWindow) {
                    newWindow.document.write(generatedHtml);
                    newWindow.document.close();
                  }
                }}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {state.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Generation Error</h3>
                <p className="text-sm text-red-700 mt-1">{state.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {generatedHtml && !isGenerating && !state.error && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-medium text-green-900">Slide Generated Successfully!</h3>
                <p className="text-sm text-green-700">
                  Your professional slide is ready. You can preview it above or proceed to download options.
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
          disabled={!generatedHtml}
          className="flex items-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}