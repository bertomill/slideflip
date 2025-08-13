// Client-side component for theme selection and customization
"use client";

// Import necessary React hooks and types
import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent } from 'react';

// Import UI components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Sparkles, Image as ImageIcon, Palette, Layers } from "lucide-react";
import { SlideData } from "@/app/build/page";
// Accordion primitives for collapsible sections
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
// Fabric.js preview for template cards
import { Canvas } from "fabric";
import { createSlideCanvas, calculateOptimalScale } from "@/lib/slide-to-fabric";
import type { SlideDefinition } from "@/lib/slide-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Props interface for ThemeStep component
interface ThemeStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// Shared type for curated example entries (Fabric JSON only)
type CuratedExample = {
  id: string;
  name: string;
  theme: string;
  description: string;
  aspect_ratio: string;
  slide_json: SlideDefinition; // Required - no HTML fallback
};

export function ThemeStep({ slideData, updateSlideData, onNext, onPrev }: ThemeStepProps) {
  type ModelAwareSlideData = SlideData & { selectedModel?: string };
  const modelAwareSlideData = slideData as ModelAwareSlideData;
  
  // State for managing examples and loading state
  const [examples, setExamples] = useState<CuratedExample[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  
  // State for palette selection and customization
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);
  const [paletteMode, setPaletteMode] = useState<'logo' | 'ai' | 'manual'>('logo');
  const [manualColors, setManualColors] = useState<string[]>(['#980000', '#111111', '#333333', '#b3b3b3', '#ffffff']);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string>('modern, professional, trustworthy');
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);
  const pasteZoneRef = useRef<HTMLDivElement | null>(null);

  const [userTemplates, setUserTemplates] = useState<CuratedExample[]>([]);

  // Load both Slideo and user templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingExamples(true);
        
        // Load Slideo templates
        const slideoResponse = await fetch('/api/examples/list');
        const slideoData = await slideoResponse.json();
        setExamples(slideoData.examples || []);

        // Load user templates (if authenticated)
        try {
          const userResponse = await fetch('/api/templates/user-list');
          const userData = await userResponse.json();
          if (userData.templates) {
            const formattedUserTemplates = userData.templates.map((t: any) => ({
              id: t.id,
              name: t.name,
              theme: t.theme || 'Custom',
              description: t.description || 'User template',
              aspect_ratio: '16:9',
              slide_json: t.slide_json,
            }));
            setUserTemplates(formattedUserTemplates);
          }
        } catch (userError) {
          // User not authenticated or no templates - that's fine
          setUserTemplates([]);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
        setExamples([]);
      } finally {
        setLoadingExamples(false);
      }
    };
    loadTemplates();
  }, []);

  // Update manual colors when template is selected
  useEffect(() => {
    if (slideData.selectedTheme && (examples.length > 0 || userTemplates.length > 0)) {
      const templateColors = getCurrentTemplateColors();
      if (templateColors.length > 0) {
        // Use extracted template colors as the default manual colors
        setManualColors(templateColors);
        // Also apply them as the selected palette if no custom palette is set
        if (!slideData.selectedPalette || slideData.selectedPalette.length === 0) {
          applyCustomPalette(templateColors);
        }
      }
    }
  }, [slideData.selectedTheme, examples, userTemplates]);

  // Check if user can proceed to next step
  const canProceed = slideData.selectedTheme !== "";

  // Component for rendering slide preview with proper scaling
  // This creates a responsive preview window that shows how the slide will look
  // Note: SlidePreview (HTML-based) component removed - now using only Fabric JSON templates

  // Component to preview a Fabric/PptxGen-compatible slide JSON
  // This renders slide definitions using Fabric.js canvas for interactive previews
  const SlidePreviewJSON = ({ slide, palette }: { slide: SlideDefinition; palette?: string[] }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasInstanceRef = useRef<Canvas | null>(null);
    const [modifiedSlide, setModifiedSlide] = useState(slide);
    
    // Apply color palette to slide JSON by replacing color values in slide objects
    useEffect(() => {
      if (!palette || palette.length === 0) {
        setModifiedSlide(slide);
        return;
      }
      
      // Deep clone the slide and apply the palette colors
      const slideClone = JSON.parse(JSON.stringify(slide));
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
    }, [slide, palette]);
    
    // Render the Fabric.js canvas with optimal scaling
    useEffect(() => {
      if (!containerRef.current || !canvasRef.current) return;
      
      const renderCanvas = () => {
        const containerWidth = containerRef.current!.clientWidth;
        const containerHeight = containerRef.current!.clientHeight || 300;
        const s = calculateOptimalScale(containerWidth, containerHeight);
        
        // Dispose of existing canvas to prevent memory leaks
        if (canvasInstanceRef.current) {
          canvasInstanceRef.current.dispose();
        }
        
        // Create new canvas instance with proper scaling
        canvasInstanceRef.current = createSlideCanvas(canvasRef.current!, modifiedSlide, s);
      };
      
      renderCanvas();
      
      // Cleanup function to dispose canvas on unmount
      return () => {
        if (canvasInstanceRef.current) {
          canvasInstanceRef.current.dispose();
          canvasInstanceRef.current = null;
        }
      };
    }, [modifiedSlide]);
    
    return (
      <div ref={containerRef} className="relative w-full aspect-[16/9] overflow-hidden rounded-t-lg bg-white">
        <div className="absolute inset-0 flex items-center justify-center">
          <canvas ref={canvasRef} />
        </div>
      </div>
    );
  };

  // Define standard color roles for consistent theming
  type ColorRole = 'background' | 'title' | 'body' | 'accent' | 'secondary';
  
  interface ColorSystem {
    background: string;  // Slide background
    title: string;       // Main titles and headings
    body: string;        // Body text and descriptions  
    accent: string;      // Primary accent color (buttons, highlights)
    secondary: string;   // Secondary elements and dividers
  }

  // Function to extract standardized color system from a slide template
  const extractTemplateColorSystem = (slide: SlideDefinition): ColorSystem => {
    const defaultSystem: ColorSystem = {
      background: '#FFFFFF',
      title: '#000000', 
      body: '#666666',
      accent: '#0066CC',
      secondary: '#CCCCCC'
    };

    // Extract background color
    if (slide.background?.color && typeof slide.background.color === 'string') {
      const bgColor = slide.background.color;
      defaultSystem.background = bgColor.startsWith('#') ? bgColor : `#${bgColor}`;
    }

    // Analyze slide objects to categorize colors by role
    const textColors: string[] = [];
    const fillColors: string[] = [];
    
    slide.objects.forEach(obj => {
      if (obj.options) {
        // Categorize text colors by fontSize to determine hierarchy
        if (obj.options.color && typeof obj.options.color === 'string') {
          const color = obj.options.color.startsWith('#') ? obj.options.color : `#${obj.options.color}`;
          const fontSize = obj.options.fontSize || 16;
          
          if (fontSize >= 36) {
            defaultSystem.title = color; // Large text = title
          } else if (fontSize >= 20) {
            if (!textColors.includes(color)) textColors.push(color);
          } else {
            defaultSystem.body = color; // Small text = body
          }
        }
        
        // Shape fill colors for accent and secondary
        if (obj.options.fill?.color && typeof obj.options.fill.color === 'string') {
          const color = obj.options.fill.color.startsWith('#') ? obj.options.fill.color : `#${obj.options.fill.color}`;
          if (!fillColors.includes(color)) fillColors.push(color);
        }
      }
    });

    // Assign accent and secondary from available colors
    if (fillColors.length > 0) defaultSystem.accent = fillColors[0];
    if (fillColors.length > 1) defaultSystem.secondary = fillColors[1];
    if (textColors.length > 0 && !defaultSystem.title) defaultSystem.title = textColors[0];

    return defaultSystem;
  };

  // Get color system array in consistent order
  const getColorSystemArray = (colorSystem: ColorSystem): string[] => {
    return [
      colorSystem.background,
      colorSystem.title, 
      colorSystem.body,
      colorSystem.accent,
      colorSystem.secondary
    ];
  };

  // Get color role labels
  const getColorRoleLabels = (): string[] => {
    return ['Background', 'Title', 'Body', 'Accent', 'Secondary'];
  };

  // Get current template color system based on selection
  const getCurrentTemplateColorSystem = (): ColorSystem | null => {
    if (!slideData.selectedTheme) return null;
    
    // Find selected template
    const selectedTemplate = [...examples, ...userTemplates].find(t => t.id === slideData.selectedTheme);
    if (!selectedTemplate?.slide_json) return null;
    
    return extractTemplateColorSystem(selectedTemplate.slide_json);
  };

  // Get current template colors as array for backwards compatibility
  const getCurrentTemplateColors = (): string[] => {
    const colorSystem = getCurrentTemplateColorSystem();
    return colorSystem ? getColorSystemArray(colorSystem) : [];
  };

  // Predefined color palettes for curated examples (fallback)
  // These are carefully chosen color combinations that work well together
  const curatedPalettes: Record<string, string[]> = {
    'imported-02': ['#980000', '#111111', '#333333', '#b3b3b3', '#ffffff'], // Classic red/black/white
    'Hero Title': ['#0B1220', '#1D4ED8', '#10B981', '#FFFFFF', '#111827'], // Modern blue/green
    'Three Column KPIs': ['#1F2937', '#3B82F6', '#10B981', '#F59E0B', '#6B7280'], // Business dashboard colors
  };

  // Function to apply a predefined palette
  const applyPalette = (id: string) => {
    const colors = curatedPalettes[id];
    if (!colors) return;
    setSelectedPaletteId(id);
    setManualColors(colors); // Update manual colors to match applied palette
    updateSlideData({ ...( {} as Partial<SlideData>), ...( { selectedPalette: colors } as Partial<SlideData>) });
  };

  // Function to apply a custom color palette
  const applyCustomPalette = (colors: string[]) => {
    updateSlideData({ ...( {} as Partial<SlideData>), ...( { selectedPalette: colors } as Partial<SlideData>) });
  };

  // Utility function to convert RGB to hex color
  const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  // Function to extract color palette from uploaded image using k-means clustering
  // This analyzes image pixels to find the most dominant colors for palette generation
  const extractPaletteFromImage = async (file: File, k: number = 5) => {
    return new Promise<string[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setLogoPreview(url);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          // Resize image for faster processing (max 128px width)
          const maxW = 128;
          const scale = Math.min(1, maxW / image.width);
          const w = Math.max(1, Math.floor(image.width * scale));
          const h = Math.max(1, Math.floor(image.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No canvas context')); return; }
          
          // Draw image to canvas and extract pixel data
          ctx.drawImage(image, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          const samples: number[][] = [];
          
          // Extract RGB values from pixels (skip transparent pixels)
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a < 200) continue; // Skip mostly transparent pixels
            samples.push([r, g, b]);
          }
          
          // K-means clustering algorithm to find dominant colors
          const clusters = Array.from({ length: k }, () => samples[Math.floor(Math.random() * samples.length)]);
          const assignments = new Array(samples.length).fill(0);
          const dist2 = (p: number[], c: number[]) => (p[0]-c[0])**2 + (p[1]-c[1])**2 + (p[2]-c[2])**2;
          
          // Iterate to find optimal color clusters
          for (let iter = 0; iter < 8; iter++) {
            // Assign each pixel to nearest cluster
            for (let si = 0; si < samples.length; si++) {
              let best = 0, bestD = Infinity;
              for (let ci = 0; ci < k; ci++) {
                const d = dist2(samples[si], clusters[ci]);
                if (d < bestD) { bestD = d; best = ci; }
              }
              assignments[si] = best;
            }
            
            // Update cluster centers based on assignments
            const sums = Array.from({ length: k }, () => [0,0,0,0]);
            for (let si = 0; si < samples.length; si++) {
              const c = assignments[si];
              sums[c][0] += samples[si][0];
              sums[c][1] += samples[si][1];
              sums[c][2] += samples[si][2];
              sums[c][3] += 1;
            }
            for (let ci = 0; ci < k; ci++) {
              const cnt = Math.max(1, sums[ci][3]);
              clusters[ci] = [Math.round(sums[ci][0]/cnt), Math.round(sums[ci][1]/cnt), Math.round(sums[ci][2]/cnt)];
            }
          }
          
          // Sort clusters by frequency and convert to hex
          const counts = Array(k).fill(0);
          for (const a of assignments) counts[a]++;
          const order = counts.map((c, i) => ({i, c})).sort((a,b) => b.c - a.c).map(o => o.i);
          const palette = order.map(i => rgbToHex(clusters[i][0], clusters[i][1], clusters[i][2])).slice(0, k);
          resolve(palette);
        };
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = url;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  // Handler for pasting images from clipboard
  const handlePasteImage = async (e: ReactClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type && it.type.startsWith('image/')) {
        const blob = it.getAsFile();
        if (blob) {
          const file = new File([blob], 'pasted-image.png', { type: blob.type });
          const colors = await extractPaletteFromImage(file, 5);
          setManualColors(colors);
          applyCustomPalette(colors);
          setLogoPreview(URL.createObjectURL(blob));
        }
        break;
      }
    }
  };

  // Function to generate color palette based on text prompt
  // Uses simple keyword matching to suggest appropriate color schemes
  const generatePaletteFromPrompt = (prompt: string): string[] => {
    const p = prompt.toLowerCase();
    if (p.includes('modern')) return ['#0F172A', '#3B82F6', '#22D3EE', '#E2E8F0', '#FFFFFF']; // Modern tech colors
    if (p.includes('corporate') || p.includes('professional')) return ['#1F2937', '#3B82F6', '#64748B', '#E5E7EB', '#FFFFFF']; // Corporate blues
    if (p.includes('warm')) return ['#DC2626', '#F97316', '#F59E0B', '#FDE68A', '#FFFFFF']; // Warm reds/oranges
    if (p.includes('tech')) return ['#0B1220', '#78DBFF', '#10B981', '#334155', '#FFFFFF']; // Tech startup colors
    return manualColors; // Fallback to current manual colors
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto px-4">
      {/* Header section - no card wrapper for clean presentation */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ImageIcon className="h-5 w-5 text-primary" />
          Choose Your Slide Template
        </h2>
        <p className="text-sm text-muted-foreground">
          Select a slide template that matches your presentation style and industry
        </p>
        {/* AI Model selection dropdown - allows users to choose between different AI models */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">AI Model</span>
          <Select
            value={modelAwareSlideData.selectedModel || "gpt-4"}
            onValueChange={(value) =>
              updateSlideData({ ...( {} as Partial<SlideData>), ...( { selectedModel: value } as Partial<SlideData>) })
            }
          >
            <SelectTrigger className="w-[220px] h-8 rounded-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4">GPT-4 (current)</SelectItem>
              <SelectItem value="gpt-5-2025-08-07">GPT-5 (2025-08-07)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template Selection Section */}
      <Card variant="glass">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Layers className="h-5 w-5 text-primary" />
            Choose Template
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Select a slide template that matches your presentation style and industry
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
          <Accordion type="multiple" className="w-full" defaultValue={["templates"]}>
          {/* Template selection section */}
          <AccordionItem value="templates" className="border-0">
            <AccordionTrigger className="hover:no-underline pb-4">
              <div className="flex flex-col items-start">
                <h3 className="text-base font-semibold text-foreground">Available Templates</h3>
                <p className="text-sm text-muted-foreground">Professional templates optimized for slide generation</p>
              </div>
            </AccordionTrigger>
          <AccordionContent>
            {loadingExamples ? (
              <div className="text-sm text-muted-foreground">Loading templates…</div>
            ) : (
              <div className="space-y-8">
                {/* Slideo Curated Templates */}
                {examples.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-5 w-5 bg-primary/10 rounded-sm flex items-center justify-center">
                        <div className="h-2.5 w-2.5 bg-primary rounded-sm" />
                      </div>
                      <h4 className="font-semibold text-foreground">Slideo Templates</h4>
                      <Badge variant="secondary" className="text-xs">Curated</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                      {examples.map((ex) => {
                        const isSelected = slideData.selectedTheme === ex.id;
                        return (
                          <Card
                            key={ex.id}
                            variant={isSelected ? 'premium' : 'glass'}
                            className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}`}
                            onClick={() => updateSlideData({ selectedTheme: ex.id })}
                          >
                            <SlidePreviewJSON slide={ex.slide_json} palette={slideData.selectedPalette} />
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-sm">{ex.name}</h4>
                                <Badge variant="outline" className="text-xs border-primary/30 text-primary/80">Slideo</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{ex.description}</p>
                              <div className="mt-3">
                                <div className="text-xs text-muted-foreground mb-2">Template colors</div>
                                <div className="flex items-center gap-2">
                                  {getColorSystemArray(extractTemplateColorSystem(ex.slide_json)).map((colorHexVal, colorIdx) => {
                                    const roleLabels = getColorRoleLabels();
                                    return (
                                      <div key={`${colorHexVal}-${colorIdx}`} className="relative group">
                                        <input
                                          type="color"
                                          value={colorHexVal}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            const newColor = e.target.value.toUpperCase();
                                            const currentColors = getColorSystemArray(extractTemplateColorSystem(ex.slide_json));
                                            const updatedColors = [...currentColors];
                                            updatedColors[colorIdx] = newColor;
                                            setManualColors(updatedColors);
                                            applyCustomPalette(updatedColors);
                                          }}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-5 h-5"
                                          title={`${roleLabels[colorIdx]}: ${colorHexVal}`}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <div 
                                          className="w-5 h-5 rounded-full border cursor-pointer"
                                          style={{ backgroundColor: colorHexVal }}
                                        />
                                        {/* Tooltip showing color role */}
                                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                          {roleLabels[colorIdx]}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <Button size="sm" variant="outline" className="ml-2" onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const templateColors = getColorSystemArray(extractTemplateColorSystem(ex.slide_json));
                                    setManualColors(templateColors);
                                    applyCustomPalette(templateColors);
                                  }}>
                                    Use colors
                                  </Button>
                                  {slideData.selectedTheme === ex.id && (
                                    <span className="text-xs text-primary ml-2">Applied</span>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-2 flex items-center gap-1 text-primary">
                                  <Sparkles className="h-3 w-3" />
                                  <span className="text-xs font-medium">Selected</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* User Templates */}
                {userTemplates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-5 w-5 bg-secondary/10 rounded-sm flex items-center justify-center">
                        <div className="h-2.5 w-2.5 bg-secondary rounded-sm" />
                      </div>
                      <h4 className="font-semibold text-foreground">My Templates</h4>
                      <Badge variant="outline" className="text-xs">{userTemplates.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                      {userTemplates.map((template) => {
                        const isSelected = slideData.selectedTheme === template.id;
                        return (
                          <Card
                            key={template.id}
                            variant={isSelected ? 'premium' : 'glass'}
                            className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}`}
                            onClick={() => updateSlideData({ selectedTheme: template.id })}
                          >
                            <SlidePreviewJSON slide={template.slide_json} palette={slideData.selectedPalette} />
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-sm">{template.name}</h4>
                                <Badge variant="outline" className="text-xs">Mine</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                              <div className="mt-3">
                                <div className="text-xs text-muted-foreground mb-2">Template colors</div>
                                <div className="flex items-center gap-2">
                                  {getColorSystemArray(extractTemplateColorSystem(template.slide_json)).map((colorHexVal, colorIdx) => {
                                    const roleLabels = getColorRoleLabels();
                                    return (
                                      <div key={`${colorHexVal}-${colorIdx}`} className="relative group">
                                        <input
                                          type="color"
                                          value={colorHexVal}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            const newColor = e.target.value.toUpperCase();
                                            const currentColors = getColorSystemArray(extractTemplateColorSystem(template.slide_json));
                                            const updatedColors = [...currentColors];
                                            updatedColors[colorIdx] = newColor;
                                            setManualColors(updatedColors);
                                            applyCustomPalette(updatedColors);
                                          }}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-5 h-5"
                                          title={`${roleLabels[colorIdx]}: ${colorHexVal}`}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <div 
                                          className="w-5 h-5 rounded-full border cursor-pointer"
                                          style={{ backgroundColor: colorHexVal }}
                                        />
                                        {/* Tooltip showing color role */}
                                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                          {roleLabels[colorIdx]}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <Button size="sm" variant="outline" className="ml-2" onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const templateColors = getColorSystemArray(extractTemplateColorSystem(template.slide_json));
                                    setManualColors(templateColors);
                                    applyCustomPalette(templateColors);
                                  }}>
                                    Use colors
                                  </Button>
                                  {slideData.selectedTheme === template.id && (
                                    <span className="text-xs text-primary ml-2">Applied</span>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-2 flex items-center gap-1 text-primary">
                                  <Sparkles className="h-3 w-3" />
                                  <span className="text-xs font-medium">Selected</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
        </Accordion>
        </CardContent>
      </Card>

      {/* Color palette customization section - only show when template is selected */}
      {slideData.selectedTheme && (
        <Card variant="glass" className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Customize Colors</h3>
              <Badge variant="secondary" className="text-xs rounded-full">
                {examples.find(ex => ex.id === slideData.selectedTheme)?.name || userTemplates.find(t => t.id === slideData.selectedTheme)?.name}
              </Badge>
            </div>

            {/* Mode selection tabs */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Button variant={paletteMode === 'logo' ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setPaletteMode('logo')}>From File</Button>
              <Button variant={paletteMode === 'ai' ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setPaletteMode('ai')}>AI Suggestion</Button>
            </div>

            {/* Logo-based palette extraction interface */}
            {paletteMode === 'logo' && (
              <Card variant="glass" className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      {/* File upload input for logo/image */}
                      <input type="file" accept="image/*" onChange={async (e) => {
                        const f = e.target.files && e.target.files[0];
                        if (!f) return;
                        const colors = await extractPaletteFromImage(f, 5);
                        setManualColors(colors);
                        applyCustomPalette(colors);
                      }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Upload a logo or paste an image (Cmd/Ctrl+V) to extract a 5‑color palette.</p>
                  </div>
                  {/* Logo preview with remove option */}
                  {logoPreview && (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="logo preview" className="h-16 w-auto rounded border" />
                      <button type="button" aria-label="Remove image" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/70 text-white text-xs" onClick={() => setLogoPreview(null)}>×</button>
                    </div>
                  )}
                  {/* Color palette preview with inline editing and role labels */}
                  <div className="flex items-center gap-2 ml-auto">
                    {manualColors.map((colorHexVal, idx) => {
                      const roleLabels = getColorRoleLabels();
                      const roleLabel = roleLabels[idx] || `Color ${idx + 1}`;
                      return (
                        <div key={`${colorHexVal}-${idx}`} className="relative group">
                          <input
                            type="color"
                            value={colorHexVal}
                            onChange={(e) => {
                              const next = [...manualColors];
                              next[idx] = e.target.value.toUpperCase();
                              setManualColors(next);
                              applyCustomPalette(next);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
                            title={`${roleLabel}: ${colorHexVal}`}
                          />
                          <div 
                            className="w-6 h-6 rounded-full border cursor-pointer"
                            style={{ backgroundColor: colorHexVal }}
                          />
                          {/* Tooltip showing color role */}
                          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                            {roleLabel}
                          </div>
                        </div>
                      );
                    })}
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => { 
                      const next = [...manualColors, '#FFFFFF']; 
                      setManualColors(next); 
                      applyCustomPalette(next); 
                    }}>
                      + Add Color
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* AI-powered palette generation interface */}
            {paletteMode === 'ai' && (
              <Card variant="glass" className="p-4 space-y-3">
                {/* Text input for style description */}
                <input className="w-full rounded border px-3 py-2 text-sm bg-background" placeholder="Describe the style (e.g., modern tech with clean blue accents)" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                <div className="flex items-center gap-2">
                  {/* Preview of generated colors */}
                  {generatePaletteFromPrompt(aiPrompt).map((c, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border" style={{ backgroundColor: c }} title={c} />
                  ))}
                  {/* Generate button with loading state */}
                  <Button size="sm" disabled={isPaletteLoading} onClick={async () => {
                    setIsPaletteLoading(true);
                    try {
                      // Call API to generate palette from prompt
                      const res = await fetch('/api/color-palette/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) });
                      const data = await res.json();
                      const colors: string[] = data.colors || [];
                      if (colors.length) { setManualColors(colors); applyCustomPalette(colors); }
                    } catch {
                      // Fallback to local generation if API fails
                      applyCustomPalette(generatePaletteFromPrompt(aiPrompt));
                    } finally {
                      setIsPaletteLoading(false);
                    }
                  }}>
                    {isPaletteLoading ? 'Generating…' : 'Generate colors'}
                  </Button>
                </div>
              </Card>
            )}

          </CardContent>
        </Card>
      )}


      {/* Navigation buttons - consistent spacing and styling */}
      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Upload
        </Button>
        <Button variant="default" size="lg" onClick={onNext} disabled={!canProceed}>
          Continue to Research
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
