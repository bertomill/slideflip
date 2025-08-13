"use client";

import { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, Textbox, Rect, Circle, Line, Triangle } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  Type, Square, Circle as CircleIcon, Minus, Triangle as TriangleIcon,
  Save, Download, Trash2, Copy, Palette, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Layers, Eye, EyeOff, Menu,
  ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { convertFabricToSlideJson, exportCanvasFormats } from '@/lib/fabric-to-slide';
import { renderSlideOnCanvas } from '@/lib/slide-to-fabric';
import { SlideDefinition } from '@/lib/slide-types';
import { useRouter, useSearchParams } from 'next/navigation';

// Canvas dimensions for 16:9 aspect ratio
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

function TemplateEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');
  
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [templateName, setTemplateName] = useState('New Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewJson, setPreviewJson] = useState<SlideDefinition | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

    // Calculate canvas size based on container
    const containerRect = containerRef.current.getBoundingClientRect();
    const aspectRatio = 16 / 9;
    
    let canvasWidth = Math.min(containerRect.width - 40, CANVAS_WIDTH);
    let canvasHeight = canvasWidth / aspectRatio;
    
    // Ensure canvas fits vertically too
    if (canvasHeight > containerRect.height - 40) {
      canvasHeight = containerRect.height - 40;
      canvasWidth = canvasHeight * aspectRatio;
    }

    const fabricCanvas = new Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });

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

    // Add mouse wheel zoom support
    fabricCanvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = fabricCanvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 3) zoom = 3;
      if (zoom < 0.3) zoom = 0.3;
      
      fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      setZoomLevel(zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Add pan functionality
    fabricCanvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      if (evt.altKey === true || (evt.shiftKey === true && fabricCanvas.getZoom() > 1)) {
        setIsPanning(true);
        (fabricCanvas as any).isDragging = true;
        fabricCanvas.selection = false;
        setLastPanPoint({ x: evt.clientX, y: evt.clientY });
      }
    });

    fabricCanvas.on('mouse:move', (opt) => {
      if ((fabricCanvas as any).isDragging) {
        const e = opt.e;
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
      (fabricCanvas as any).isDragging = false;
      fabricCanvas.selection = true;
      setIsPanning(false);
    });

    setCanvas(fabricCanvas);

    // Load template if editing existing one
    if (templateId) {
      loadTemplate(templateId, fabricCanvas);
    }

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const aspectRatio = 16 / 9;
      
      let newCanvasWidth = Math.min(containerRect.width - 40, CANVAS_WIDTH);
      let newCanvasHeight = newCanvasWidth / aspectRatio;
      
      if (newCanvasHeight > containerRect.height - 40) {
        newCanvasHeight = containerRect.height - 40;
        newCanvasWidth = newCanvasHeight * aspectRatio;
      }
      
      fabricCanvas.setDimensions({
        width: newCanvasWidth,
        height: newCanvasHeight
      });
      fabricCanvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      fabricCanvas.dispose();
    };
  }, [templateId]);

  // Load existing template
  const loadTemplate = async (id: string, fabricCanvas: Canvas) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('slide_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setTemplateName(data.name);
      setTemplateDescription(data.description || '');
      
      // Load from Fabric JSON if available, otherwise convert from PptxGenJS JSON
      if (data.fabric_json) {
        fabricCanvas.loadFromJSON(data.fabric_json, () => {
          fabricCanvas.renderAll();
        });
      } else if (data.slide_json) {
        renderSlideOnCanvas(fabricCanvas, data.slide_json, 1);
      }
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
    
    selectedObject.clone((cloned: any) => {
      cloned.left += 20;
      cloned.top += 20;
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  };

  // Update selected object properties
  const updateSelectedProperty = (property: string, value: any) => {
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

  // Zoom functions
  const zoomIn = () => {
    if (!canvas) return;
    const newZoom = Math.min(zoomLevel * 1.2, 3);
    setZoomLevel(newZoom);
    canvas.setZoom(newZoom);
    canvas.renderAll();
  };

  const zoomOut = () => {
    if (!canvas) return;
    const newZoom = Math.max(zoomLevel / 1.2, 0.3);
    setZoomLevel(newZoom);
    canvas.setZoom(newZoom);
    canvas.renderAll();
  };

  const resetZoom = () => {
    if (!canvas) return;
    setZoomLevel(1);
    canvas.setZoom(1);
    canvas.renderAll();
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
      const PptxGenJS = (window as any).PptxGenJS;
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
      slideJson.objects.forEach((obj: any) => {
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
          "transition-all duration-300 lg:mr-80 h-screen flex flex-col",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60"
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
                    "absolute inset-0 bg-muted/30 flex items-center justify-center",
                    isPanning && "cursor-grabbing"
                  )}
                >
                  <canvas 
                    ref={canvasRef} 
                    className={cn(
                      "shadow-lg",
                      zoomLevel > 1 && !isPanning && "cursor-grab"
                    )} 
                  />
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
        <div className="hidden lg:block fixed right-0 top-0 z-30 h-screen w-80 transform bg-background border-l border-border">
          <div className="h-full overflow-y-auto">
            <div className="p-4 space-y-4 sm:space-y-6">
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

              {/* Text Formatting */}
              {selectedObject?.type === 'textbox' && (
                <Card variant="glass">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                      Text Formatting
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-3">
                    <div className="flex gap-1">
                      <Button
                        variant={selectedObject.fontWeight === 'bold' ? 'default' : 'outline'}
                        size="sm"
                        onClick={toggleBold}
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selectedObject.fontStyle === 'italic' ? 'default' : 'outline'}
                        size="sm"
                        onClick={toggleItalic}
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selectedObject.underline ? 'default' : 'outline'}
                        size="sm"
                        onClick={toggleUnderline}
                      >
                        <Underline className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant={selectedObject.textAlign === 'left' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTextAlign('left')}
                      >
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selectedObject.textAlign === 'center' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTextAlign('center')}
                      >
                        <AlignCenter className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selectedObject.textAlign === 'right' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTextAlign('right')}
                      >
                        <AlignRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

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