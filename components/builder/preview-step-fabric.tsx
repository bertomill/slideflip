"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, RefreshCw, MessageSquare, Sparkles, Download, Save, Heart } from "lucide-react";
import { SlideData } from "@/app/build/page";
import { Canvas } from "fabric";
import { createSlideCanvas, calculateOptimalScale } from "@/lib/slide-to-fabric";
import { SlideDefinition } from "@/lib/slide-types";

// Load PptxGenJS UMD bundle at runtime via CDN to avoid bundling Node-only imports
// We'll access it via the global `window.PptxGenJS` exposed by the minified browser build
// PptxGenJS exposes a constructor on window at runtime
// Using unknown here to avoid importing node-bound types; narrowed at call-site
type PptxWindow = Window & { PptxGenJS?: unknown };
async function ensurePptx() {
  if (typeof window === 'undefined') return null;
  const w = window as PptxWindow;
  if (w.PptxGenJS) return w.PptxGenJS;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-lib="pptxgenjs"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load PptxGenJS')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.min.js';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-lib', 'pptxgenjs');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PptxGenJS'));
    document.head.appendChild(script);
  });
  return (window as PptxWindow).PptxGenJS ?? null;
}

interface PreviewStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData & { slideJson?: SlideDefinition }>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// Extend SlideData type to include JSON slide
interface ExtendedSlideData extends SlideData {
  slideJson?: SlideDefinition;
}

type ModelAwareSlideData = SlideData & { selectedModel?: string };

export function PreviewStep({ slideData, updateSlideData, onPrev }: PreviewStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [canvasKey, setCanvasKey] = useState(0); // Add this line
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const extendedSlideData: ExtendedSlideData = slideData as ExtendedSlideData;
  const modelAwareSlideData = slideData as ModelAwareSlideData;

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
      format: "json" // Request JSON format instead of HTML
      , model: modelAwareSlideData.selectedModel || undefined
    };
  };

  // Call API to generate slide JSON
  const generateSlide = async (overrideFeedback?: string) => {
    if (!slideData.description || isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-slide-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(overrideFeedback)),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.success && data?.slideJson) {
           updateSlideData({ slideJson: data.slideJson });
          return;
        }
      }
      
      // Fallback to a sample slide if API fails
      const sampleSlide: SlideDefinition = {
        id: 'generated-slide',
        background: { color: 'ffffff' },
        objects: [
          {
            type: 'text',
            text: slideData.description || 'Your Presentation Title',
            options: {
              x: 0.5,
              y: 2.0,
              w: 9,
              h: 1.5,
              fontSize: 44,
              fontFace: 'Arial',
              color: '003366',
              bold: true,
              align: 'center',
              valign: 'middle'
            }
          },
          {
            type: 'text',
            text: 'Generated from your content',
            options: {
              x: 0.5,
              y: 3.5,
              w: 9,
              h: 0.75,
              fontSize: 24,
              fontFace: 'Arial',
              color: '666666',
              align: 'center'
            }
          }
        ]
      };
      updateSlideData({ slideJson: sampleSlide });
    } catch (err) {
      console.error("Slide generation error:", err);
      // Create a basic slide as fallback
      const fallbackSlide: SlideDefinition = {
        id: 'fallback-slide',
        background: { color: 'f5f5f5' },
        objects: [
          {
            type: 'text',
            text: 'Slide Generation in Progress',
            options: {
              x: 1,
              y: 2,
              w: 8,
              h: 1,
              fontSize: 36,
              fontFace: 'Arial',
              color: '333333',
              align: 'center'
            }
          }
        ]
      };
      updateSlideData({ slideJson: fallbackSlide });
    } finally {
      setIsGenerating(false);
    }
  };

  // Initialize and update canvas when slide JSON changes
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !extendedSlideData.slideJson) return;

    // Calculate scale based on container size
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight || 500;
    const scale = calculateOptimalScale(containerWidth, containerHeight);

    // Always dispose of existing canvas first
    if (canvas) {
      canvas.dispose();
      setCanvas(null);
    }

    // Create new canvas for each update
    const newCanvas = createSlideCanvas(canvasRef.current, extendedSlideData.slideJson, scale);
    setCanvas(newCanvas);

    // Cleanup function
    return () => {
      if (newCanvas) {
        newCanvas.dispose();
      }
    };
  }, [extendedSlideData.slideJson, canvasKey]); // Add canvasKey to dependencies

  // Auto-generate on first entry if we don't have JSON yet
  useEffect(() => {
    if (!extendedSlideData.slideJson && slideData.description) {
      generateSlide();
    }
  }, []);

  // Add this useEffect for cleanup - PUT IT HERE
  useEffect(() => {
    return () => {
      // Cleanup canvas on component unmount
      if (canvas) {
        canvas.dispose();
      }
    };
  }, [canvas]);

  const regenerateWithFeedback = async () => {
  if (!feedback.trim()) return;
  setIsRegenerating(true);
  try {
    // Force canvas recreation by updating key
    setCanvasKey(prev => prev + 1);
    await generateSlide(feedback.trim());
  } finally {
    setIsRegenerating(false);
    setFeedback("");
  }
};

  // Open in Google Slides
  const openInGoogleSlides = async () => {
    if (!extendedSlideData.slideJson) return;
    
    try {
      // Create a temporary PPTX file and upload to Google Drive
      // For now, we'll export PPTX and let user manually upload
      exportToPowerPoint();
      
      // TODO: Integrate with Google Drive API to automatically upload
      // window.open('https://docs.google.com/presentation/', '_blank');
    } catch (error) {
      console.error('Error opening in Google Slides:', error);
    }
  };

  // Copy shareable link
  const copyShareLink = async () => {
    try {
      // Generate a shareable link (you'd need to implement slide storage)
      const slideId = extendedSlideData.slideJson?.id || 'generated-slide';
      const shareUrl = `${window.location.origin}/shared/${slideId}`;
      
      await navigator.clipboard.writeText(shareUrl);
      
      // TODO: Show toast notification
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Error copying share link:', error);
      alert('Could not copy share link');
    }
  };

  // Export to PowerPoint
  const exportToPowerPoint = async () => {
    if (!extendedSlideData.slideJson) return;
    const PptxGenJSImport = await ensurePptx();
    if (!PptxGenJSImport) return;
    const PptxCtor = PptxGenJSImport as unknown as new () => {
      layout: string;
      author: string;
      title: string;
      addSlide: () => unknown;
      writeFile: (opts: { fileName: string }) => Promise<unknown>;
    };
    const pptx = new PptxCtor();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'SlideFlip';
    pptx.title = slideData.description || 'Presentation';
    
    const slide = pptx.addSlide() as unknown as {
      background?: { color?: string };
      addText: (text: string, opts: Record<string, unknown>) => void;
      addShape: (shape: string, opts: Record<string, unknown>) => void;
    };
    
    // Set background
    if (extendedSlideData.slideJson.background?.color) {
      const bgColor = extendedSlideData.slideJson.background.color;
      slide.background = { color: typeof bgColor === 'string' ? bgColor : undefined };
    }
    
    // Add objects
    extendedSlideData.slideJson.objects.forEach(obj => {
      switch (obj.type) {
        case 'text':
          slide.addText(obj.text, {
            x: obj.options.x,
            y: obj.options.y,
            w: obj.options.w,
            h: obj.options.h,
            fontSize: obj.options.fontSize,
            fontFace: obj.options.fontFace,
            color: typeof obj.options.color === 'string' ? obj.options.color : undefined,
            bold: obj.options.bold,
            italic: obj.options.italic,
            underline: obj.options.underline,
            align: obj.options.align,
            valign: obj.options.valign
          });
          break;
        case 'shape':
          if (obj.shape === 'rect' || obj.shape === 'roundRect') {
            slide.addShape(obj.shape === 'roundRect' ? 'roundRect' : 'rect', {
              x: obj.options.x,
              y: obj.options.y,
              w: obj.options.w,
              h: obj.options.h,
              fill: obj.options.fill ? 
                { color: typeof obj.options.fill.color === 'string' ? obj.options.fill.color : 'ffffff' } : 
                undefined,
              rectRadius: obj.options.rectRadius
            });
          }
          break;
      }
    });
    
    await pptx.writeFile({ fileName: 'slide-export.pptx' });
  };

  // Save current slide as a template
  const saveAsTemplate = async () => {
    if (!extendedSlideData.slideJson || isSavingTemplate) return;
    
    const templateName = prompt('Enter a name for your template:', slideData.description || 'My Custom Template');
    if (!templateName) return;
    
    const templateDescription = prompt('Enter a description (optional):', '') || '';
    
    setIsSavingTemplate(true);
    try {
      const response = await fetch('/api/templates/upsert-fabric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          theme: 'Custom',
          slide_json: extendedSlideData.slideJson,
          is_active: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save template: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setTemplateSaved(true);
        // Reset the success message after a few seconds
        setTimeout(() => setTemplateSaved(false), 3000);
      } else {
        throw new Error(data.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const canProceed = extendedSlideData.slideJson && !isGenerating && !isRegenerating;

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Preview Your Slide
          </CardTitle>
          <CardDescription>
            Review your AI-generated slide rendered with Fabric.js
          </CardDescription>
        </CardHeader>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Generated Slide</CardTitle>
              <CardDescription>
                Rendered on canvas for exact PowerPoint representation
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Generated
              </Badge>
              {extendedSlideData.slideJson && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={exportToPowerPoint}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export PPTX
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={openInGoogleSlides}
                  >
                    Open in Google Slides
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={saveAsTemplate}
                    disabled={isSavingTemplate}
                    className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                    {isSavingTemplate ? (
                      <>Saving...</>
                    ) : templateSaved ? (
                      <><Heart className="h-3 w-3 mr-1 fill-current" />Saved!</>
                    ) : (
                      <><Save className="h-3 w-3 mr-1" />Save as Template</>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={copyShareLink}
                  >
                    Copy Share Link
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="border rounded-lg overflow-hidden shadow-lg bg-gray-50">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    <div>
                      <p className="font-medium text-gray-800">Generating your slide...</p>
                      <p className="text-sm text-gray-600">Creating JSON structure for Fabric.js</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              ref={containerRef}
              key={`canvas-container-${canvasKey}`} // Add this line
              className="border rounded-lg overflow-hidden shadow-lg bg-gray-100"
              style={{ minHeight: '400px' }}
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <canvas 
                    ref={canvasRef} 
                    key={`canvas-${canvasKey}`} // Add this line
                    className="shadow-lg" 
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {extendedSlideData.slideJson && (
        <>
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Provide Feedback
              </CardTitle>
              <CardDescription>
                Tell us what you&apos;d like to change or improve about the slide
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

          {/* JSON Preview for debugging */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              View JSON Structure (Debug)
            </summary>
            <Card className="mt-2">
              <CardContent className="pt-4">
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-64 text-xs">
                  {JSON.stringify(extendedSlideData.slideJson, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </details>
        </>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Content Planning
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={saveAsTemplate}
            disabled={isSavingTemplate || !canProceed}
            className="border-green-200 text-green-700 hover:bg-green-50"
          >
            {isSavingTemplate ? (
              <>Saving...</>
            ) : templateSaved ? (
              <><Heart className="h-4 w-4 mr-2 fill-current" />Saved!</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save as Template</>
            )}
          </Button>
          <Button variant="engineering" size="lg" onClick={exportToPowerPoint} disabled={!canProceed}>
            <Download className="h-4 w-4 mr-2" />
            Download PPTX
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.location.href = '/'}>
            Create New Slide
          </Button>
        </div>
      </div>
    </div>
  );
}