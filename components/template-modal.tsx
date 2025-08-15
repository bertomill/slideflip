"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Maximize2, 
  Code, 
  Palette, 
  Copy,
  Check,
  Save,
  AlertCircle 
} from "lucide-react";
import { Canvas } from "fabric";
import { createSlideCanvas, calculateOptimalScale } from "@/lib/slide-to-fabric";
import type { SlideDefinition } from "@/lib/slide-types";

interface TemplateModalProps {
  template: {
    id: string;
    name: string;
    theme: string;
    description: string;
    aspect_ratio: string;
    slide_json: SlideDefinition;
  };
  palette?: string[];
  onTemplateUpdate?: (updatedTemplate: any) => void;
  children: React.ReactNode;
}

export function TemplateModal({ 
  template, 
  palette, 
  onTemplateUpdate, 
  children 
}: TemplateModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [jsonContent, setJsonContent] = useState(
    JSON.stringify(template.slide_json, null, 2)
  );
  const [copied, setCopied] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(true);
  const [canvasError, setCanvasError] = useState<string | null>(null);

  // Preview canvas refs
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const canvasInstanceRef = React.useRef<Canvas | null>(null);
  const [modifiedSlide, setModifiedSlide] = useState(template.slide_json);

  // Apply color palette to slide JSON
  React.useEffect(() => {
    if (!palette || palette.length === 0) {
      setModifiedSlide(template.slide_json);
      return;
    }
    
    // Deep clone the slide and apply the palette colors
    const slideClone = JSON.parse(JSON.stringify(template.slide_json));
    const defaultColors = ['#980000', '#111111', '#333333', '#b3b3b3', '#ffffff'];
    
    // Helper function to replace color in object
    const replaceColor = (color: unknown) => {
      if (!color) return color;
      if (typeof color === 'string') {
        let colorStr = color.toLowerCase();
        
        // Normalize color format - add # if missing
        if (colorStr.match(/^[0-9a-f]{6}$/)) {
          colorStr = `#${colorStr}`;
        }
        
        // Check against default colors (also normalize them)
        for (let i = 0; i < defaultColors.length && i < palette.length; i++) {
          let defaultColor = defaultColors[i].toLowerCase();
          if (colorStr === defaultColor) {
            return palette[i].replace('#', ''); // Remove # for JSON format
          }
        }
        
        // Also check common template colors we see in the logs
        const templateColors = ['111827', '764ba2', '1f2937', '3b82f6', 'ffffff'];
        templateColors.forEach((templateColor, index) => {
          if (colorStr === `#${templateColor}` && palette[index]) {
            return palette[index].replace('#', ''); // Remove # for JSON format
          }
        });
      }
      return color;
    };
    
    // Apply palette to slide objects (text, shapes, etc.)
    if (slideClone.objects) {
      slideClone.objects.forEach((obj: { options?: { color?: unknown; fill?: { color?: unknown }; line?: { color?: unknown } } }) => {
        if (obj.options) {
          // Text color
          if (obj.options.color) {
            obj.options.color = replaceColor(obj.options.color);
          }
          // Shape fill color
          if (obj.options.fill?.color) {
            obj.options.fill.color = replaceColor(obj.options.fill.color);
          }
          // Shape line color
          if (obj.options.line?.color) {
            obj.options.line.color = replaceColor(obj.options.line.color);
          }
        }
      });
    }
    
    // Apply palette to background
    if (slideClone.background?.color) {
      slideClone.background.color = replaceColor(slideClone.background.color);
    }
    
    setModifiedSlide(slideClone);
  }, [template.slide_json, palette]);

  // Render the Fabric.js canvas
  React.useEffect(() => {
    if (activeTab !== "preview" || !isOpen) return;
    
    const renderCanvas = async () => {
      // Wait for DOM to be ready and container to have dimensions
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (!containerRef.current || !canvasRef.current) {
        console.log('Container or canvas ref not ready');
        return;
      }
      
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      console.log('Container dimensions:', { containerWidth, containerHeight });
      
      // Ensure we have valid dimensions
      if (containerWidth === 0 || containerHeight === 0) {
        console.log('Invalid container dimensions');
        return;
      }
      
      try {
        setCanvasLoading(true);
        setCanvasError(null);
        console.log('Creating slide canvas with:', { modifiedSlide, containerWidth, containerHeight });
        
        // Dispose of existing canvas to prevent memory leaks
        if (canvasInstanceRef.current) {
          canvasInstanceRef.current.dispose();
          canvasInstanceRef.current = null;
        }
        
        const s = calculateOptimalScale(containerWidth, containerHeight);
        console.log('Calculated scale:', s);
        
        // Create new canvas instance with proper scaling
        canvasInstanceRef.current = createSlideCanvas(canvasRef.current!, modifiedSlide, s);
        console.log('Canvas created successfully');
        
        setCanvasLoading(false);
      } catch (error) {
        console.error('Error creating slide canvas:', error);
        setCanvasError(error instanceof Error ? error.message : 'Failed to render canvas');
        setCanvasLoading(false);
      }
    };
    
    renderCanvas();
    
    // Cleanup function to dispose canvas on unmount
    return () => {
      if (canvasInstanceRef.current) {
        canvasInstanceRef.current.dispose();
        canvasInstanceRef.current = null;
      }
    };
  }, [modifiedSlide, activeTab, isOpen]);

  // Handle JSON content changes
  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    setHasChanges(true);
    
    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      // Validate it's a proper slide definition
      if (parsed.objects && Array.isArray(parsed.objects)) {
        setModifiedSlide(parsed);
      }
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Invalid JSON");
    }
  };

  // Copy JSON to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Save changes
  const saveChanges = () => {
    if (jsonError) return;
    
    try {
      const parsed = JSON.parse(jsonContent);
      const updatedTemplate = {
        ...template,
        slide_json: parsed
      };
      
      if (onTemplateUpdate) {
        onTemplateUpdate(updatedTemplate);
      }
      
      setHasChanges(false);
    } catch (error) {
      setJsonError("Invalid JSON format");
    }
  };

  // Highlight background properties in JSON
  const highlightBackgroundInJson = (jsonString: string) => {
    return jsonString.replace(
      /"background":\s*{[^}]*}/g,
      '<span class="bg-yellow-100 dark:bg-yellow-900/20 px-1 rounded">$&</span>'
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      
      <DialogContent className="max-w-[95vw] w-full sm:w-[90vw] md:w-[80vw] lg:w-[60vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            {template.name}
            <Badge variant="outline" className="text-xs">
              {template.theme}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {template.description}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">
              <Maximize2 className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="json">
              <Code className="h-4 w-4 mr-2" />
              JSON Code
            </TabsTrigger>
            <TabsTrigger value="colors">
              <Palette className="h-4 w-4 mr-2" />
              Color Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <Card className="h-[60vh] sm:h-[65vh] md:h-[70vh] overflow-hidden">
              <CardContent className="p-4 h-full">
                <div 
                  ref={containerRef} 
                  className="relative w-full h-full bg-white rounded border overflow-hidden"
                >
                  {canvasLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading preview...</p>
                      </div>
                    </div>
                  )}
                  {canvasError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                      <div className="text-center">
                        <div className="text-red-500 mb-2">⚠️</div>
                        <p className="text-sm text-red-600">Failed to load preview</p>
                        <p className="text-xs text-red-500 mt-1">{canvasError}</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <canvas 
                      ref={canvasRef} 
                      className={canvasLoading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json" className="flex-1 overflow-hidden">
            <div className="space-y-4 h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Template JSON</h3>
                  {hasChanges && (
                    <Badge variant="outline" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Unsaved changes
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                  {hasChanges && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={saveChanges}
                      disabled={!!jsonError}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>

              {jsonError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                    JSON Error: {jsonError}
                  </p>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-900 rounded-md border overflow-hidden h-[400px]">
                <textarea
                  value={jsonContent}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full h-full p-4 bg-transparent font-mono text-sm resize-none outline-none"
                  placeholder="Template JSON code..."
                  spellCheck={false}
                />
              </div>

              <div className="text-xs text-muted-foreground">
                <strong>Background Property:</strong> Look for the <code>&quot;background&quot;</code> object 
                to modify slide backgrounds. Example: <code>{`{"background": {"color": "#FFFFFF"}}`}</code>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="colors" className="flex-1 overflow-hidden">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Color System Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Background Color</h4>
                    <div className="flex items-center gap-3">
                      {template.slide_json.background?.color ? (
                        <>
                          <div
                            className="w-8 h-8 rounded border"
                            style={{
                              backgroundColor: template.slide_json.background.color.startsWith('#') 
                                ? template.slide_json.background.color 
                                : `#${template.slide_json.background.color}`
                            }}
                          />
                          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">
                            {template.slide_json.background.color}
                          </code>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          No background color defined
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">All Colors Found</h4>
                    <div className="space-y-2">
                      {(() => {
                        const colors = new Set<string>();
                        
                        // Extract all colors from the template
                        if (template.slide_json.background?.color) {
                          colors.add(template.slide_json.background.color as string);
                        }
                        
                        template.slide_json.objects.forEach((obj: any) => {
                          if (obj.options?.color) colors.add(obj.options.color);
                          if (obj.options?.fill?.color) colors.add(obj.options.fill.color);
                          if (obj.options?.line?.color) colors.add(obj.options.line.color);
                        });

                        return Array.from(colors).map((color) => (
                          <div key={color} className="flex items-center gap-3">
                            <div
                              className="w-6 h-6 rounded border"
                              style={{
                                backgroundColor: color.startsWith('#') ? color : `#${color}`
                              }}
                            />
                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">
                              {color}
                            </code>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <p className="text-blue-600 dark:text-blue-400 text-sm">
                      <strong>Tip:</strong> To make the background color customizable, ensure your 
                      template JSON includes a <code>&quot;background&quot;</code> property. This allows users 
                      to change the background color uniformly across all templates.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}