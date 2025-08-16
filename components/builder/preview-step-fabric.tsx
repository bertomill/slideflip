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

// Extend SlideData type to include JSON slide
interface ExtendedSlideData extends SlideData {
  slideJson?: SlideDefinition;
}

type ModelAwareSlideData = SlideData & { selectedModel?: string };

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
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [canvasKey, setCanvasKey] = useState(0); // Add this line
  const [isSavingTemplate, setIsSavingTemplate] = useState(false); 
  const [templateSaved, setTemplateSaved] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const extendedSlideData: ExtendedSlideData = slideData as ExtendedSlideData;

  // Debug logging when component mounts
  useEffect(() => {
    console.log('🔍 PreviewStepFabric mounted with props:', {
      isConnected,
      connectionStatus,
      hasSendGenerateSlideRequest: !!sendGenerateSlideRequest,
      hasDescription: !!slideData.description,
      hasSlideHtml: !!slideData.slideHtml
    });
  }, [isConnected, connectionStatus, sendGenerateSlideRequest, slideData.description, slideData.slideHtml]);

  // Add timeout to reset generating state if it gets stuck
  useEffect(() => {
    if (isGenerating) {
      const timeout = setTimeout(() => {
        console.log('🔍 ⚠️ Generating state stuck for 30 seconds, auto-resetting...');
        setIsGenerating(false);
        setIsRegenerating(false);
      }, 60000); // 60 seconds timeout
      
      return () => clearTimeout(timeout);
    }
  }, [isGenerating]);

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
      client_id: `frontend_${Date.now()}`,
      slide_description: overrideFeedback || slideData.description,
      documents: simplifiedDocs,  // ← ADD THIS LINE!
      top_k: 10,
      similarity_threshold: 0.3,
      include_embeddings: false,
      max_tokens: 2000
    };
  };

  // Call API to generate slide JSON
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
        console.log('🔍 Using websocket for slide generation (Fabric)');
        const success = sendGenerateSlideRequest(
          slideData.description,
          slideData.selectedTheme || "Professional",
          slideData.wantsResearch ? slideData.researchData : undefined,
          slideData.contentPlan,
          typeof overrideFeedback === "string" ? overrideFeedback : slideData.userFeedback,
          buildRequestPayload(overrideFeedback).documents,
          modelAwareSlideData.selectedModel
        );
        
        console.log('🔍 sendGenerateSlideRequest result (Fabric):', success);
        
        if (!success) {
          console.log('🔍 ❌ WebSocket send failed, falling back to API or fallback slide');
          throw new Error('Failed to send websocket message');
        }
        
        console.log('🔍 WebSocket message sent successfully (Fabric), waiting for response');
        // Don't set isGenerating to false here - wait for websocket response
        return;
      }
      
      // Fallback to existing API call if websocket not available
      console.log('🔍 Using API fallback for slide generation (Fabric)');
      const payload = buildRequestPayload(overrideFeedback);
    
      // 🔍 DEBUG: Log what's being sent to backend
      console.log("🔍 FULL PAYLOAD TO BACKEND:", JSON.stringify(payload, null, 2));
      console.log("🔍 DOCUMENTS ARRAY:", payload.documents);
      console.log("🔍 SLIDE DESCRIPTION:", payload.slide_description);

      const response = await fetch("http://localhost:8000/api/graph-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // ADD THIS DEBUG LOG:
      console.log("🔍 BACKEND RESPONSE STATUS:", response.status);
      console.log("🔍 RESPONSE HEADERS:", [...response.headers.entries()]);
      const responseText = await response.text(); // Get raw response
      console.log("🔍 RAW BACKEND RESPONSE:", responseText);

      // Then try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("🔍 PARSED BACKEND DATA:", data);
      } catch (e) {
        console.error("❌ Backend returned non-JSON:", responseText.substring(0, 200));
        return;
      }

      if (response.ok) {
        // Look for slideJson in the data object
        if (data?.success && data?.data?.slideJson) {
          console.log("✅ Found slideJson:", data.data.slideJson);
          updateSlideData({ slideJson: data.data.slideJson });
          return;
        } else {
          console.log("⚠️ No slideJson found in response:", data);
        }
      }

      // Fallback to a sample slide if API fails
      console.log("🔄 Using fallback slide");
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
      console.error("💥 Slide generation network/parsing error:", err);
      console.error("🔍 Error details:", {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      createFallbackSlide();
    } finally {
      // Only set isGenerating to false if we're not using websocket
      // (websocket will handle this in the message handler)
      if (!isConnected || !sendGenerateSlideRequest) {
        setIsGenerating(false);
      }
      console.log("🏁 Slide generation process complete");
    }
  };

  // Create a fallback slide when generation fails
  const createFallbackSlide = () => {
    console.log("🔧 Creating fallback slide...");
    const fallbackSlide: SlideDefinition = {
      id: 'fallback-slide',
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
          text: 'Content generated from your documents',
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
    console.log("📋 Fallback slide created:", fallbackSlide);
    updateSlideData({ slideJson: fallbackSlide });
    console.log("✅ Fallback slide updated in state");
  };

  // Initialize and update canvas when slide JSON changes
  useEffect(() => {
    if (!extendedSlideData.slideJson) {
      console.log('No slide JSON available for canvas rendering');
      return;
    }

    // Use a small delay to ensure DOM is ready
    const initCanvas = () => {
      if (!canvasRef.current || !containerRef.current) {
        console.log('Canvas refs not ready, will retry...', {
          hasCanvasRef: !!canvasRef.current,
          hasContainerRef: !!containerRef.current
        });
        // Try again after a short delay
        setTimeout(initCanvas, 100);
        return;
      }

      console.log('Canvas refs ready, initializing canvas...');
      
      // Calculate scale based on container size
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight || 500;
      const scale = calculateOptimalScale(containerWidth, containerHeight);

      // Always dispose of existing canvas first
      if (canvas) {
        console.log('Disposing existing canvas');
        canvas.dispose();
        setCanvas(null);
      }

      try {
        // Create new canvas for each update
        console.log('Creating new canvas with scale:', scale);
        const newCanvas = createSlideCanvas(canvasRef.current, extendedSlideData.slideJson, scale);
        setCanvas(newCanvas);
        console.log('Canvas created successfully');
      } catch (error) {
        console.error('Failed to create canvas:', error);
        // If creation fails, retry once more after a delay
        if (error instanceof Error && error.message === 'Canvas element is required') {
          setTimeout(initCanvas, 200);
        }
      }
    };

    // Start the initialization
    initCanvas();

    // Cleanup function
    return () => {
      if (canvas) {
        console.log('Cleaning up canvas on unmount/update');
        canvas.dispose();
      }
    };
  }, [extendedSlideData.slideJson, canvasKey]); // Add canvasKey to dependencies

  // Auto-generate on first entry if we don't have JSON yet
  useEffect(() => {
    console.log("🎯 Preview step useEffect triggered");
    console.log("🔍 Current state:", {
      hasSlideJson: !!extendedSlideData.slideJson,
      hasSlideHtml: !!slideData.slideHtml,
      slideJsonId: extendedSlideData.slideJson?.id,
      description: slideData.description,
      isGenerating,
      isConnected,
      hasSendGenerateSlideRequest: !!sendGenerateSlideRequest
    });

    // If we already have slide content (JSON or HTML), skip generation
    if (extendedSlideData.slideJson || slideData.slideHtml) {
      console.log("✅ Slide content already exists, skipping generation");
      return;
    }

    // If we don't have a description, create a fallback slide
    if (!slideData.description) {
      console.log("⚠️ No description available, creating fallback slide");
      createFallbackSlide();
      return;
    }

    // Only try WebSocket generation if we're properly connected
    // This prevents the step validation error when not connected to backend
    if (isConnected && sendGenerateSlideRequest) {
      console.log("🚀 Triggering slide generation with description via websocket");
      // Note: This may fail with step validation error if previous steps aren't completed
      // The backend requires step_1_upload to be completed before step_5_preview
      console.log("⚠️ Note: Generation may fail if previous steps aren't marked as completed in backend");
      generateSlide();
    } else {
      console.log("⚠️ Cannot generate via websocket - not connected or missing function");
      console.log("💡 Creating fallback slide for offline preview");
      createFallbackSlide();
    }
  }, [extendedSlideData.slideJson, slideData.slideHtml, slideData.description, isConnected, sendGenerateSlideRequest]);

  // Add this useEffect for cleanup - PUT IT HERE
  useEffect(() => {
    return () => {
      // Cleanup canvas on component unmount
      if (canvas) {
        canvas.dispose();
      }
    };
  }, [canvas]);

  // Handle websocket messages for slide generation
  useEffect(() => {
    console.log('🔍 useEffect triggered with lastMessage:', lastMessage);
    console.log('🔍 Current isGenerating state:', isGenerating);
    console.log('🔍 Current isRegenerating state:', isRegenerating);
    
    if (!lastMessage) {
      console.log('🔍 No lastMessage, returning early');
      return;
    }
    
    console.log('🔍 Processing message type:', lastMessage.type);
    console.log('🔍 Message data keys:', lastMessage.data ? Object.keys(lastMessage.data) : 'No data');
    console.log('🔍 Full message data:', lastMessage.data);
    
    if (lastMessage.type === 'slide_generation_complete') {
      console.log('🔍 ✅ RECEIVED SLIDE GENERATION COMPLETE MESSAGE!');
      if (lastMessage.data?.slide_html) {
        // Store the generated HTML content in slideData
        const generatedHtml = lastMessage.data.slide_html;
        console.log('🔍 Generated HTML content length:', generatedHtml.length);
        console.log('🔍 Generated HTML content preview:', generatedHtml.substring(0, 200) + '...');
        
        console.log('🔍 About to call updateSlideData...');
        // Update the slide data with the generated HTML
        updateSlideData({ 
          slideHtml: generatedHtml,
          slideJson: undefined // Clear any existing JSON since we have HTML
        });
        console.log('🔍 updateSlideData called successfully');
        
        console.log('🔍 About to reset generation states...');
        // Reset generation states
        setIsGenerating(false);
        setIsRegenerating(false);
        console.log('🔍 Generation states reset to false');
        
        // Force canvas recreation to show the new content
        setCanvasKey(prev => prev + 1);
        
        console.log('🔍 ✅ Slide data updated with generated HTML, canvas key incremented');
      } else {
        console.log('🔍 ❌ No slide_html in message data');
        console.log('🔍 Message data content:', lastMessage.data);
      }
    } else if (lastMessage.type === 'slide_generation_error' || lastMessage.type === 'error') {
      console.error('🔍 ❌ Slide generation error:', lastMessage.data?.error || lastMessage.data?.message);
      
      // Check if it's a step validation error
      if (lastMessage.data?.error?.includes('must be completed before') || 
          lastMessage.data?.message?.includes('must be completed before')) {
        console.log('🔍 ⚠️ Step validation error detected - creating fallback slide');
        console.log('🔍 💡 This happens when previous builder steps haven\'t been completed');
      }
      
      // Fallback to placeholder so user can continue the flow
      createFallbackSlide();
      setIsGenerating(false);
      setIsRegenerating(false);
    } else if (lastMessage.type === 'progress_update') {
      console.log('🔍 Progress update received:', lastMessage.data?.message, 'Progress:', lastMessage.data?.progress + '%');
      // Don't reset isGenerating here - only reset on completion or error
    } else {
      console.log('🔍 Received other message type:', lastMessage.type);
    }
  }, [lastMessage, updateSlideData, slideData.description]);

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
    if (!extendedSlideData.slideJson && !slideData.slideHtml) {
      console.error('No slide data available for export');
      alert('No slide data available to export');
      return;
    }

    try {
      console.log('Starting PPTX export...');
      
      // If we have HTML content, use the HTML-to-PPTX API
      if (slideData.slideHtml) {
        console.log('Using HTML content for export');
        
        const requestData = {
          slideHtml: slideData.slideHtml,
          theme: slideData.selectedTheme || 'Professional',
          description: slideData.description || 'Generated Slide'
        };
        
        console.log('Sending request data:', requestData);
        
        const response = await fetch('/api/generate-pptx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('PPTX export failed:', response.status, errorText);
          throw new Error(`PPTX export failed: ${response.status} - ${errorText}`);
        }
        
        console.log('PPTX export response received, creating blob...');
        const blob = await response.blob();
        console.log('Blob created, size:', blob.size, 'bytes');
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slide-${Date.now()}.pptx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('PPTX export completed from HTML');
        return;
      }
      
      // Fallback to JSON-based export
      if (!extendedSlideData.slideJson) {
        console.error('No slide JSON available for export');
        alert('No slide data available to export');
        return;
      }

      const PptxGenJSImport = await ensurePptx();
      if (!PptxGenJSImport) {
        console.error('PptxGenJS library failed to load');
        alert('Failed to load PowerPoint export library');
        return;
      }

      console.log('PptxGenJS loaded successfully');
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
      
      console.log('Creating slide...');
      const slide = pptx.addSlide() as unknown as {
        background?: { color?: string };
        addText: (text: string, opts: Record<string, unknown>) => void;
        addShape: (shape: string, opts: Record<string, unknown>) => void;
      };
      
      // Set background - ensure color format is correct
      if (extendedSlideData.slideJson.background?.color) {
        let bgColor = extendedSlideData.slideJson.background.color;
        // Ensure color has # prefix if it's a hex color
        if (typeof bgColor === 'string' && bgColor.match(/^[0-9A-Fa-f]{6}$/)) {
          bgColor = `#${bgColor}`;
        }
        console.log('Setting background color:', bgColor);
        slide.background = { color: bgColor };
      }
      
      // Add objects
      console.log(`Adding ${extendedSlideData.slideJson.objects.length} objects to slide...`);
      extendedSlideData.slideJson.objects.forEach((obj, index) => {
        console.log(`Processing object ${index + 1}:`, obj.type);
        try {
          switch (obj.type) {
            case 'text':
              let textColor = obj.options.color;
              // Ensure text color has # prefix if it's a hex color
              if (typeof textColor === 'string' && textColor.match(/^[0-9A-Fa-f]{6}$/)) {
                textColor = `#${textColor}`;
              }
              
              slide.addText(obj.text, {
                x: obj.options.x,
                y: obj.options.y,
                w: obj.options.w,
                h: obj.options.h,
                fontSize: obj.options.fontSize,
                fontFace: obj.options.fontFace,
                color: textColor,
                bold: obj.options.bold,
                italic: obj.options.italic,
                underline: obj.options.underline,
                align: obj.options.align,
                valign: obj.options.valign
              });
              console.log(`Text object added: "${obj.text.substring(0, 50)}..."`);
              break;
              
            case 'shape':
              const shapeObj = obj as any; // Type assertion for shape objects
              if (shapeObj.shape === 'rect' || shapeObj.shape === 'roundRect') {
                let fillColor = undefined;
                if (shapeObj.options.fill?.color) {
                  fillColor = shapeObj.options.fill.color;
                  // Ensure fill color has # prefix if it's a hex color
                  if (typeof fillColor === 'string' && fillColor.match(/^[0-9A-Fa-f]{6}$/)) {
                    fillColor = `#${fillColor}`;
                  }
                }
                
                slide.addShape(shapeObj.shape === 'roundRect' ? 'roundRect' : 'rect', {
                  x: shapeObj.options.x,
                  y: shapeObj.options.y,
                  w: shapeObj.options.w,
                  h: shapeObj.options.h,
                  fill: fillColor ? { color: fillColor } : undefined,
                  rectRadius: shapeObj.options.rectRadius
                });
                console.log(`Shape object added: ${shapeObj.shape}`);
              }
              break;
              
            case 'rect':
              // Handle rect objects that might be stored as type 'rect' instead of 'shape'
              let rectFillColor = undefined;
              if (obj.options.fill?.color) {
                rectFillColor = obj.options.fill.color;
                if (typeof rectFillColor === 'string' && rectFillColor.match(/^[0-9A-Fa-f]{6}$/)) {
                  rectFillColor = `#${rectFillColor}`;
                }
              }
              
              slide.addShape('rect', {
                x: obj.options.x,
                y: obj.options.y,
                w: obj.options.w,
                h: obj.options.h,
                fill: rectFillColor ? { color: rectFillColor } : undefined
              });
              console.log('Rect object added');
              break;
              
            default:
              console.warn(`Unsupported object type: ${obj.type}`);
          }
        } catch (objError) {
          console.error(`Error processing object ${index + 1}:`, objError);
        }
      });
      
      console.log('Writing PPTX file...');
      const fileName = `${slideData.description || 'presentation'}.pptx`.replace(/[^a-zA-Z0-9\-_]/g, '-');
      await pptx.writeFile({ fileName });
      console.log('PPTX export completed successfully');
      
      // Show success message
      alert('PowerPoint file downloaded successfully!');
      
    } catch (error) {
      console.error('PPTX export failed:', error);
      alert('Failed to export PowerPoint file. Please try again.');
    }
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

  const canProceed = (extendedSlideData.slideJson || slideData.slideHtml) && !isGenerating && !isRegenerating;

  return (
    <div className="space-y-6">
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Generated Slide</CardTitle>
              <CardDescription>
                {slideData.slideHtml ? 'HTML preview with PowerPoint export' : 'Rendered on canvas for exact PowerPoint representation'}
              </CardDescription>
            </div>
            {(extendedSlideData.slideJson || slideData.slideHtml) && (
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
                      <p className="text-sm text-gray-600">Creating HTML content for preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : slideData.slideHtml ? (
            // Show generated HTML content
            <div className="border rounded-lg overflow-hidden shadow-lg bg-white">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  srcDoc={slideData.slideHtml}
                  className="absolute inset-0 w-full h-full border-0"
                  title="Generated Slide Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <div className="p-4 bg-gray-50 border-t">
                <p className="text-sm text-gray-600">
                  <strong>HTML Content Generated:</strong> {slideData.slideHtml.length} characters
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This is the AI-generated HTML slide content. You can export it as PowerPoint or save as a template.
                </p>
              </div>
            </div>
          ) : (
            // Show Fabric.js canvas (fallback)
            <div 
              ref={containerRef}
              key={`canvas-container-${canvasKey}`}
              className="border rounded-lg overflow-hidden shadow-lg bg-gray-100"
              style={{ minHeight: '400px' }}
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <canvas 
                    ref={canvasRef} 
                    key={`canvas-${canvasKey}`}
                    className="shadow-lg" 
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {extendedSlideData.slideJson || slideData.slideHtml ? (
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
        </>
      ) : null}

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Themes
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