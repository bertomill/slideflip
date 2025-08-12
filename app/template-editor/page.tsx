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
  AlignLeft, AlignCenter, AlignRight, Layers, Eye, EyeOff, Menu
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
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });

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

    setCanvas(fabricCanvas);

    // Load template if editing existing one
    if (templateId) {
      loadTemplate(templateId, fabricCanvas);
    }

    return () => {
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
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Content Area */}
        <div className={cn(
          "transition-all duration-300 lg:mr-80",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60"
        )}>
          {/* Canvas Area */}
          <div className="p-4 sm:p-6">
            {/* Header */}
            <div className="mb-4 space-y-4">
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
                <div className="flex gap-2">
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

            {/* Canvas */}
            <Card className="flex-1">
              <CardContent className="p-6 h-full">
                <div 
                  ref={containerRef}
                  className="border rounded-lg bg-gray-50 flex items-center justify-center h-full"
                  style={{ 
                    minHeight: '500px'
                  }}
                >
                  <canvas ref={canvasRef} />
                </div>
              </CardContent>
            </Card>

            {/* Preview JSON */}
            {showPreview && previewJson && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
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
                <CardContent>
                  <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                    {JSON.stringify(previewJson, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
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