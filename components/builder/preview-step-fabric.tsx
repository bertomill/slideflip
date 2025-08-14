"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, RefreshCw, MessageSquare, Sparkles, Download } from "lucide-react";
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
  isConnected?: boolean;
  connectionStatus?: string;
  sendProcessSlide?: (options?: any) => boolean;
  lastMessage?: any;
}

// Extend SlideData type to include JSON slide
interface ExtendedSlideData extends SlideData {
  slideJson?: SlideDefinition;
}

type ModelAwareSlideData = SlideData & { selectedModel?: string };

export function PreviewStep({ slideData, updateSlideData, onPrev, isConnected = false, connectionStatus = 'disconnected', sendProcessSlide, lastMessage }: PreviewStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [backendProgress, setBackendProgress] = useState<{progress: number, message: string} | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const extendedSlideData: ExtendedSlideData = slideData as ExtendedSlideData;
  const modelAwareSlideData = slideData as ModelAwareSlideData;

  // Handle backend messages
  useEffect(() => {
    if (lastMessage) {
      console.log('Preview step received message from backend:', lastMessage);
      console.log('Message type:', lastMessage.type);
      console.log('Message data:', lastMessage.data);
      
      if (lastMessage.type === 'slide_generation_complete' || lastMessage.type === 'slide_generation_success' || lastMessage.type === 'processing_complete') {
        console.log('Processing slide generation completion message');
        setIsGenerating(false);
        setIsRegenerating(false);
        setBackendProgress(null);
        
        // Update slide data with backend response
        if (lastMessage.data.slide_html) {
          console.log('Updating slide HTML from backend:', lastMessage.data.slide_html.substring(0, 100) + '...');
          updateSlideData({ slideHtml: lastMessage.data.slide_html });
          console.log('Slide HTML updated from backend');
        } else if (lastMessage.data.slide_data) {
          const slideData = lastMessage.data.slide_data;
          if (slideData.slide_json) {
            updateSlideData({ slideJson: slideData.slide_json });
            console.log('Slide JSON updated from backend');
          } else if (slideData.content) {
            // Handle HTML content if JSON not available
            updateSlideData({ slideHtml: slideData.content });
            console.log('Slide HTML updated from backend');
          }
        } else {
          console.log('No slide data found in completion message');
        }
      } else if (lastMessage.type === 'slide_generation_error' || lastMessage.type === 'processing_error') {
        console.log('Processing slide generation error message');
        setIsGenerating(false);
        setIsRegenerating(false);
        setBackendProgress(null);
        console.error('Slide generation error from backend:', lastMessage.data.error);
        
        // Generate fallback slide
        generateFallbackSlide();
      } else if (lastMessage.type === 'progress_update' && lastMessage.data.step === 'slide_generation') {
        // Handle slide generation progress updates
        console.log('Processing slide generation progress update:', lastMessage.data.progress, lastMessage.data.message);
        
        // Update loading state based on progress
        if (lastMessage.data.progress < 100) {
          setIsGenerating(true);
          setBackendProgress({
            progress: lastMessage.data.progress,
            message: lastMessage.data.message
          });
        } else {
          setIsGenerating(false);
          setBackendProgress(null);
        }
      } else if (lastMessage.type === 'slide_generation_progress' || lastMessage.type === 'processing_status') {
        // Handle progress updates if needed
        console.log('Slide generation progress:', lastMessage.data);
      } else {
        console.log('Unhandled message type:', lastMessage.type);
      }
    }
  }, [lastMessage, updateSlideData]);

  // Generate fallback slide when backend fails
  const generateFallbackSlide = () => {
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
            align: 'center',
            valign: 'middle'
          }
        }
      ]
    };
    
    updateSlideData({ slideJson: sampleSlide });
  };

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

  // Call backend to generate slide JSON
  const generateSlide = async (overrideFeedback?: string) => {
    if (!slideData.description || isGenerating) return;
    
    // Check if backend is connected
    if (!isConnected || !sendProcessSlide) {
      console.error('Backend not connected or sendProcessSlide not available');
      generateFallbackSlide();
      return;
    }

    setIsGenerating(true);
    
    try {
      // Send slide generation request to backend via WebSocket
      const success = sendProcessSlide({
        description: slideData.description,
        theme: slideData.selectedTheme || "Professional",
        researchData: slideData.wantsResearch ? slideData.researchData : undefined,
        contentPlan: slideData.contentPlan,
        userFeedback: overrideFeedback || slideData.userFeedback,
        documents: slideData.parsedDocuments || slideData.documents,
        format: "json" // Request JSON format
      });

      if (success) {
        console.log('Slide generation request sent to backend successfully');
        // The response will be handled in the useEffect hook
      } else {
        throw new Error('Failed to send slide generation request to backend');
      }

    } catch (error) {
      console.error('Slide generation request failed:', error);
      setIsGenerating(false);
      generateFallbackSlide();
    }
  };

  // Initialize and update canvas when slide JSON changes
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !extendedSlideData.slideJson) return;

    // Calculate scale based on container size
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight || 500;
    const scale = calculateOptimalScale(containerWidth, containerHeight);

    if (!canvas) {
      // Create new canvas
      const newCanvas = createSlideCanvas(canvasRef.current, extendedSlideData.slideJson, scale);
      setCanvas(newCanvas);
    } else {
      // Update existing canvas
      import('@/lib/slide-to-fabric').then(module => {
        module.renderSlideOnCanvas(canvas, extendedSlideData.slideJson!, scale);
      });
    }
  }, [extendedSlideData.slideJson, canvas]);

  // Auto-generate on first entry if we don't have JSON yet
  useEffect(() => {
    if (!extendedSlideData.slideJson && slideData.description) {
      generateSlide();
    }
  }, [extendedSlideData.slideJson, slideData.description]);

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
                      
                      {/* Backend Progress Indicator */}
                      {backendProgress && (
                        <div className="mt-4 space-y-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${backendProgress.progress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>Backend Progress</span>
                            <span>{backendProgress.progress}%</span>
                          </div>
                          <p className="text-xs text-gray-500 max-w-xs">
                            {backendProgress.message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              ref={containerRef}
              className="border rounded-lg overflow-hidden shadow-lg bg-gray-100"
              style={{ minHeight: '400px' }}
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <canvas ref={canvasRef} className="shadow-lg" />
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