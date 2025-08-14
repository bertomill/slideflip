"use client";

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Canvas, Textbox, Rect, Circle, Line, Triangle, FabricObject } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  Type, Square, Circle as CircleIcon, Minus, Triangle as TriangleIcon,
  Save, Download, Trash2, Copy, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Menu,
  ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { convertFabricToSlideJson, exportCanvasFormats } from '@/lib';
import { renderSlideOnCanvas } from '@/lib/slide-to-fabric';
import { SlideDefinition } from '@/lib/slide-types';
import { useRouter, useSearchParams } from 'next/navigation';

// Canvas dimensions for 16:9 aspect ratio
const CANVAS_WIDTH = 960;

function TemplateEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');
  
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [templateName, setTemplateName] = useState('New Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewJson, setPreviewJson] = useState<SlideDefinition | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<{
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomLevelRef = useRef(1);
  const updateCanvasSizeRef = useRef<(zoom: number) => void>();

  // Load user authentication
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Wait for container to be properly sized
    const containerRect = containerRef.current.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      // Container not yet sized, retry after a short delay
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          const newRect = containerRef.current.getBoundingClientRect();
          if (newRect.width > 0 && newRect.height > 0) {
            // Trigger re-initialization
            setCanvas(null);
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    const aspectRatio = 16 / 9;
    const padding = 60; // Account for container padding and margins
    
    let canvasWidth = Math.min(containerRect.width - padding, CANVAS_WIDTH);
    let canvasHeight = canvasWidth / aspectRatio;
    
    // Ensure canvas fits vertically too
    if (canvasHeight > containerRect.height - padding) {
      canvasHeight = containerRect.height - padding;
      canvasWidth = canvasHeight * aspectRatio;
    }

    try {
      const fabricCanvas = new Canvas(canvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true,
      });

      // Verify canvas is properly initialized before proceeding
      if (!fabricCanvas.lowerCanvasEl || !fabricCanvas.getContext) {
        console.error('Canvas not properly initialized');
        return;
      }

      // Ensure white background is always visible
      fabricCanvas.backgroundColor = '#ffffff';
      fabricCanvas.renderAll();

      // Handle object selection
      fabricCanvas.on('selection:created', (e) => {
        setSelectedObject(e.selected?.[0]);
      });

      fabricCanvas.on('selection:updated', (e) => {
        setSelectedObject(e.selected?.[0]);
      });

      fabricCanvas.on('selection:cleared', () => {
        setSelectedObject(null);
      });

      // Add mouse wheel zoom support - scale canvas dimensions  
      fabricCanvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let newZoom = zoomLevel;
        newZoom *= 0.999 ** delta;
        if (newZoom > 3) newZoom = 3;
        if (newZoom < 0.3) newZoom = 0.3;
        
        setZoomLevel(newZoom);
        
        // Use timeout to ensure state is updated before calling updateCanvasSize
        setTimeout(() => {
          updateCanvasSize(newZoom);
        }, 0);
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Add pan functionality
      fabricCanvas.on('mouse:down', (opt) => {
        const evt = opt.e as MouseEvent;
        if (evt.altKey === true || (evt.shiftKey === true && fabricCanvas.getZoom() > 1)) {
          setIsPanning(true);
          (fabricCanvas as Canvas & { isDragging: boolean }).isDragging = true;
          fabricCanvas.selection = false;
          setLastPanPoint({ x: evt.clientX, y: evt.clientY });
        }
      });

      fabricCanvas.on('mouse:move', (opt) => {
        if ((fabricCanvas as Canvas & { isDragging: boolean }).isDragging) {
          const e = opt.e as MouseEvent;
          const vpt = fabricCanvas.viewportTransform;
          if (vpt) {
            vpt[4] += e.clientX - lastPanPoint.x;
            vpt[5] += e.clientY - lastPanPoint.y;
            fabricCanvas.requestRenderAll();
            setLastPanPoint({ x: e.clientX, y: e.clientY });
          }
        }
      });

      fabricCanvas.on('mouse:up', () => {
        if (fabricCanvas.viewportTransform) {
          fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
        }
        (fabricCanvas as Canvas & { isDragging: boolean }).isDragging = false;
        fabricCanvas.selection = true;
        setIsPanning(false);
      });


      setCanvas(fabricCanvas);

      // Load template if editing existing one
      if (templateId) {
        loadTemplate(templateId, fabricCanvas);
      }

      // Handle window resize - maintain current zoom level
      const handleResize = () => {
        if (!containerRef.current || !fabricCanvas) return;
        
        // Use the updateCanvasSize function to maintain zoom level
        setTimeout(() => {
          updateCanvasSize(zoomLevel);
        }, 0);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        fabricCanvas.dispose();
      };
    } catch (error) {
      console.error('Error initializing canvas:', error);
      return;
    }
  }, [templateId]);

  // Load existing template
  const loadTemplate = async (id: string, fabricCanvas: Canvas) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('slide_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error loading template:', error);
        return;
      }

      if (data) {
        setTemplateName(data.name);
        setTemplateDescription(data.description || '');
        
        // Load from Fabric JSON if available, otherwise convert from PptxGenJS JSON
        if (data.fabric_json) {
          fabricCanvas.loadFromJSON(data.fabric_json, () => {
            fabricCanvas.renderAll();
          });
        } else if (data.slide_json) {
          // Add delay to ensure canvas is fully ready
          setTimeout(() => {
            try {
              renderSlideOnCanvas(fabricCanvas, data.slide_json, 1);
            } catch (renderError) {
              console.error('Error rendering slide on canvas:', renderError);
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error in loadTemplate:', error);
    }
  };

  // Add text element
  const addText = () => {
    if (!canvas) return;
    
    const text = new Textbox('Click to edit text', {
      left: 100,
      top: 100,
      width: 300,
      fontSize: 24,
      fill: '#333333',
      fontFamily: 'Arial',
      editable: true,
    });
    
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  // Add shape elements
  const addRectangle = () => {
    if (!canvas) return;
    
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 200,
      height: 100,
      fill: '#e3f2fd',
      stroke: '#1976d2',
      strokeWidth: 2,
    });
    
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  };

  const addCircle = () => {
    if (!canvas) return;
    
    const circle = new Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: '#fff3e0',
      stroke: '#f57c00',
      strokeWidth: 2,
    });
    
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
  };

  const addLine = () => {
    if (!canvas) return;
    
    const line = new Line([0, 0, 200, 0], {
      left: 100,
      top: 100,
      stroke: '#333333',
      strokeWidth: 2,
    });
    
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.renderAll();
  };

  const addTriangle = () => {
    if (!canvas) return;
    
    const triangle = new Triangle({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: '#f3e5f5',
      stroke: '#7b1fa2',
      strokeWidth: 2,
    });
    
    canvas.add(triangle);
    canvas.setActiveObject(triangle);
    canvas.renderAll();
  };

  // Delete selected object
  const deleteSelected = () => {
    if (!canvas || !selectedObject) return;
    canvas.remove(selectedObject);
    setSelectedObject(null);
    canvas.renderAll();
  };

  // Duplicate selected object
  const duplicateSelected = () => {
    if (!canvas || !selectedObject) return;
    
    selectedObject.clone((cloned: FabricObject) => {
      cloned.left += 20;
      cloned.top += 20;
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  };

  // Update selected object properties
  const updateSelectedProperty = (property: string, value: string | number | boolean) => {
    if (!canvas || !selectedObject) return;
    
    selectedObject.set(property, value);
    canvas.renderAll();
  };

  // Toggle text formatting
  const toggleBold = () => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    const isBold = selectedObject.fontWeight === 'bold';
    updateSelectedProperty('fontWeight', isBold ? 'normal' : 'bold');
  };

  const toggleItalic = () => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    const isItalic = selectedObject.fontStyle === 'italic';
    updateSelectedProperty('fontStyle', isItalic ? 'normal' : 'italic');
  };

  const toggleUnderline = () => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    updateSelectedProperty('underline', !selectedObject.underline);
  };

  // Set text alignment
  const setTextAlign = (align: string) => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    updateSelectedProperty('textAlign', align);
  };

  // Zoom functions - scale the canvas dimensions themselves
  const updateCanvasSize = useCallback((zoom: number) => {
    if (!canvas || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const aspectRatio = 16 / 9;
    const padding = 60;
    
    // Calculate base canvas size
    let baseCanvasWidth = Math.min(containerRect.width - padding, CANVAS_WIDTH);
    let baseCanvasHeight = baseCanvasWidth / aspectRatio;
    
    if (baseCanvasHeight > containerRect.height - padding) {
      baseCanvasHeight = containerRect.height - padding;
      baseCanvasWidth = baseCanvasHeight * aspectRatio;
    }
    
    // Apply zoom to canvas dimensions
    const scaledWidth = baseCanvasWidth * zoom;
    const scaledHeight = baseCanvasHeight * zoom;
    
    canvas.setDimensions({
      width: scaledWidth,
      height: scaledHeight
    });
    
    // Reset zoom on canvas (since we're scaling dimensions instead)
    canvas.setZoom(1);
    canvas.renderAll();
  }, [canvas]);

  // Update refs when values change
  React.useEffect(() => {
    zoomLevelRef.current = zoomLevel;
    updateCanvasSizeRef.current = updateCanvasSize;
  }, [zoomLevel, updateCanvasSize]);

  // Touch gesture handling
  React.useEffect(() => {
    if (!canvas || !containerRef.current) return;

    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const touch1 = touches[0];
      const touch2 = touches[1];
      return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    };

    let touchDistance = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        touchDistance = getDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = getDistance(e.touches);
        
        if (touchDistance > 0) {
          const scale = distance / touchDistance;
          const currentZoom = zoomLevelRef.current;
          const newZoom = Math.min(Math.max(currentZoom * scale, 0.3), 3);
          
          if (Math.abs(newZoom - currentZoom) > 0.01) {
            setZoomLevel(newZoom);
            if (updateCanvasSizeRef.current) {
              updateCanvasSizeRef.current(newZoom);
            }
          }
        }
        
        touchDistance = distance;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchDistance = 0;
      }
    };

    const containerElement = containerRef.current;
    containerElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    containerElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    containerElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      containerElement.removeEventListener('touchstart', handleTouchStart);
      containerElement.removeEventListener('touchmove', handleTouchMove);
      containerElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvas]);

  const zoomIn = () => {
    if (!canvas) return;
    const newZoom = Math.min(zoomLevel * 1.2, 3);
    setZoomLevel(newZoom);
    updateCanvasSize(newZoom);
  };

  const zoomOut = () => {
    if (!canvas) return;
    const newZoom = Math.max(zoomLevel / 1.2, 0.3);
    setZoomLevel(newZoom);
    updateCanvasSize(newZoom);
  };

  const resetZoom = () => {
    if (!canvas) return;
    setZoomLevel(1);
    updateCanvasSize(1);
  };

  // Preview as PptxGenJS JSON
  const updatePreview = () => {
    if (!canvas) return;
    const slideJson = convertFabricToSlideJson(canvas);
    setPreviewJson(slideJson);
    setShowPreview(true);
  };

  // Save template to Supabase
  const saveTemplate = async () => {
    if (!canvas) return;
    
    setIsSaving(true);
    try {
      const formats = exportCanvasFormats(canvas);
      const supabase = createClient();
      
      const templateData = {
        name: templateName,
        description: templateDescription,
        theme: 'Custom',
        fabric_json: formats.fabricJson,
        slide_json: formats.pptxJson,
        preview_image: formats.previewImage,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (templateId) {
        // Update existing template
        const { error } = await supabase
          .from('slide_templates')
          .update(templateData)
          .eq('id', templateId);
          
        if (!error) {
          alert('Template updated successfully!');
        }
      } else {
        // Create new template
        const { data, error } = await supabase
          .from('slide_templates')
          .insert({
            ...templateData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
          
        if (!error && data) {
          alert('Template saved successfully!');
          router.push('/template-editor?id=' + data.id);
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to PPTX
  const exportToPPTX = async () => {
    if (!canvas) return;
    
    const slideJson = convertFabricToSlideJson(canvas);
    
    // Load PptxGenJS dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.min.js';
    document.head.appendChild(script);
    
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PptxGenJS = (window as typeof window & { PptxGenJS?: any }).PptxGenJS;
      if (!PptxGenJS) return;
      
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'Template Editor';
      pptx.title = templateName;
      
      const slide = pptx.addSlide();
      
      // Set background
      if (slideJson.background?.color) {
        slide.background = { color: slideJson.background.color };
      }
      
      // Add objects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      slideJson.objects.forEach((obj: { type: string; text?: string; shape?: string; options: any }) => {
        if (obj.type === 'text') {
          slide.addText(obj.text, obj.options);
        } else if (obj.type === 'shape') {
          slide.addShape(obj.shape, obj.options);
        }
      });
      
      pptx.writeFile({ fileName: templateName + '.pptx' });
    };
  };

  return (
    <div className="min-h-screen builder-background">
      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex h-screen">
        {/* Left Sidebar using existing Sidebar component */}
        <Sidebar
          user={user}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Content Area */}
        <div className={cn(
          "transition-all duration-300 h-screen flex flex-col",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60",
          rightSidebarCollapsed ? "lg:mr-16 lg:ml-72" : "lg:mr-80 lg:ml-72"
        )}>
          {/* Header */}
          <div className="flex-shrink-0 p-4 sm:p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="text-xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                  placeholder="Template Name"
                />
                <Input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="text-sm text-muted-foreground border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                  placeholder="Template Description"
                />
              </div>
              <div className="flex gap-2 items-center">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 border rounded-lg p-1">
                  <Button variant="ghost" size="sm" onClick={zoomOut} className="h-8 w-8 p-0">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={resetZoom} className="h-8 w-8 p-0" title="Reset Zoom">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={zoomIn} className="h-8 w-8 p-0">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2 min-w-[3rem] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  {zoomLevel > 1 && (
                    <span className="text-xs text-muted-foreground px-2 border-l">
                      Hold Shift + drag to pan
                    </span>
                  )}
                </div>
                
                <div className="h-4 w-px bg-border" />
                
                <Button variant="outline" size="sm" onClick={updatePreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview JSON
                </Button>
                <Button variant="outline" size="sm" onClick={exportToPPTX}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PPTX
                </Button>
                <Button size="sm" onClick={saveTemplate} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>

          {/* Canvas Area - Takes remaining height */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Canvas */}
              <div className="flex-1 min-h-0 relative">
                <div 
                  ref={containerRef}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center p-4",
                    isPanning && "cursor-grabbing"
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <canvas 
                      ref={canvasRef} 
                      className={cn(
                        "shadow-lg rounded-lg border border-border/20",
                        zoomLevel > 1 && !isPanning && "cursor-grab"
                      )} 
                    />
                  </div>
                </div>
              </div>

              {/* Preview JSON - Fixed height overlay when shown */}
              {showPreview && previewJson && (
                <Card className="mt-4 max-h-80 flex-shrink-0">
                  <CardHeader className="p-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      PptxGenJS JSON Preview
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(false)}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <pre className="bg-gray-100 p-3 rounded-lg overflow-auto max-h-60 text-xs">
                      {JSON.stringify(previewJson, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Tools */}
        <div className={cn(
          "hidden lg:block fixed right-0 top-0 z-30 h-screen transform bg-background border-l border-border transition-all duration-300",
          rightSidebarCollapsed ? "w-16" : "w-80"
        )}>
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
            className={cn(
              "absolute z-10 h-8 w-8 p-0",
              rightSidebarCollapsed ? "left-2 top-4" : "left-2 top-4"
            )}
          >
            {rightSidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          
          {/* Collapsed Icons */}
          {rightSidebarCollapsed && (
            <div className="flex flex-col items-center pt-16 space-y-3">
              <Button variant="ghost" size="sm" onClick={addText} className="h-10 w-10 p-0" title="Add Text">
                <Type className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addRectangle} className="h-10 w-10 p-0" title="Add Rectangle">
                <Square className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addCircle} className="h-10 w-10 p-0" title="Add Circle">
                <CircleIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addLine} className="h-10 w-10 p-0" title="Add Line">
                <Minus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addTriangle} className="h-10 w-10 p-0" title="Add Triangle">
                <TriangleIcon className="h-4 w-4" />
              </Button>
              {selectedObject && (
                <>
                  <div className="w-8 h-px bg-border my-2" />
                  <Button variant="ghost" size="sm" onClick={duplicateSelected} className="h-10 w-10 p-0" title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deleteSelected} className="h-10 w-10 p-0" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
          
          {/* Expanded Content */}
          <div className={cn(
            "h-full overflow-y-auto",
            rightSidebarCollapsed && "hidden"
          )}>
            <div className="p-4 space-y-4 sm:space-y-6 pt-14">
              {/* Add Elements */}
              <Card variant="glass" className="card-contrast">
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight">
                    <Type className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    Add Elements
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={addText}>
                      <Type className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={addRectangle}>
                      <Square className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={addCircle}>
                      <CircleIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={addLine}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={addTriangle}>
                      <TriangleIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Object Actions */}
              {selectedObject && (
                <Card variant="glass">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                      Object Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={duplicateSelected}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={deleteSelected}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Text Formatting - Always Visible */}
              <Card variant="glass">
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                    Text Formatting
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-3">
                  <div className="flex gap-1">
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.fontWeight === 'bold' ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleBold}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.fontStyle === 'italic' ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleItalic}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.underline ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleUnderline}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.textAlign === 'left' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('left')}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.textAlign === 'center' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('center')}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.textAlign === 'right' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('right')}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Properties */}
              {selectedObject && (
                <Card variant="glass">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                      Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-3">
                    {/* Fill Color */}
                    <div>
                      <Label className="text-xs">Fill Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={selectedObject.fill || '#000000'}
                          onChange={(e) => updateSelectedProperty('fill', e.target.value)}
                          className="w-12 h-8 p-1"
                        />
                        <Input
                          value={selectedObject.fill || '#000000'}
                          onChange={(e) => updateSelectedProperty('fill', e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    {/* Stroke Color */}
                    {selectedObject.stroke !== undefined && (
                      <div>
                        <Label className="text-xs">Stroke Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={selectedObject.stroke || '#000000'}
                            onChange={(e) => updateSelectedProperty('stroke', e.target.value)}
                            className="w-12 h-8 p-1"
                          />
                          <Input
                            value={selectedObject.stroke || '#000000'}
                            onChange={(e) => updateSelectedProperty('stroke', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    )}

                    {/* Font Size for Text */}
                    {selectedObject.type === 'textbox' && (
                      <div>
                        <Label className="text-xs">Font Size: {selectedObject.fontSize}px</Label>
                        <Slider
                          value={[selectedObject.fontSize || 18]}
                          onValueChange={(value) => updateSelectedProperty('fontSize', value[0])}
                          min={8}
                          max={72}
                          step={1}
                        />
                      </div>
                    )}

                    {/* Opacity */}
                    <div>
                      <Label className="text-xs">Opacity: {Math.round((selectedObject.opacity || 1) * 100)}%</Label>
                      <Slider
                        value={[(selectedObject.opacity || 1) * 100]}
                        onValueChange={(value) => updateSelectedProperty('opacity', value[0] / 100)}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplateEditor() {
  return (
    <Suspense fallback={<div className="min-h-screen builder-background" />}> 
      <TemplateEditorInner />
    </Suspense>
  );
}