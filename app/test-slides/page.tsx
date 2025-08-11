"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sampleSlidesJson, sampleThemes, applyThemeToSlide } from '@/lib/sample-slides-json';
import { createSlideCanvas, calculateOptimalScale, SLIDE_WIDTH_PX, SLIDE_HEIGHT_PX } from '@/lib/slide-to-fabric';
import { SlideDefinition } from '@/lib/slide-types';
import { fabric } from 'fabric';

export default function TestSlides() {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState('professional');
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize and update canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Calculate scale based on container size
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = 500; // Fixed height for preview
    const scale = calculateOptimalScale(containerWidth, containerHeight);

    // Get current slide and apply theme
    const currentSlide = sampleSlidesJson[selectedSlideIndex];
    const themedSlide = applyThemeToSlide(currentSlide, sampleThemes[selectedTheme]);

    if (!canvas) {
      // Create new canvas
      const newCanvas = createSlideCanvas(canvasRef.current, themedSlide, scale);
      setCanvas(newCanvas);
    } else {
      // Update existing canvas
      canvas.clear();
      canvas.setWidth(SLIDE_WIDTH_PX * scale);
      canvas.setHeight(SLIDE_HEIGHT_PX * scale);
      canvas.setZoom(scale);
      
      // Re-render slide
      renderSlideOnCanvas(canvas, themedSlide);
    }
  }, [selectedSlideIndex, selectedTheme, canvas]);

  // Helper function to render slide on existing canvas
  const renderSlideOnCanvas = (canvas: fabric.Canvas, slide: SlideDefinition) => {
    // Import rendering logic
    import('@/lib/slide-to-fabric').then(module => {
      module.renderSlideOnCanvas(canvas, slide, canvas.getZoom());
    });
  };

  // Export to JSON
  const exportJSON = () => {
    const currentSlide = sampleSlidesJson[selectedSlideIndex];
    const themedSlide = applyThemeToSlide(currentSlide, sampleThemes[selectedTheme]);
    const json = JSON.stringify(themedSlide, null, 2);
    
    // Download JSON file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide-${currentSlide.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export to PPTX
  const exportPPTX = async () => {
    // Dynamic import to avoid SSR issues
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    
    // Set presentation properties
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'SlideFlip';
    pptx.company = 'SlideFlip';
    pptx.title = 'Sample Presentation';
    
    // Add current slide
    const currentSlide = sampleSlidesJson[selectedSlideIndex];
    const themedSlide = applyThemeToSlide(currentSlide, sampleThemes[selectedTheme]);
    
    const slide = pptx.addSlide();
    
    // Set background
    if (themedSlide.background?.color) {
      slide.background = { color: themedSlide.background.color };
    }
    
    // Add objects to slide
    themedSlide.objects.forEach(obj => {
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
          if (obj.shape === 'line') {
            slide.addShape('line', {
              x: obj.options.x,
              y: obj.options.y,
              w: obj.options.w,
              h: obj.options.h,
              line: obj.options.line?.color ? 
                { color: typeof obj.options.line.color === 'string' ? obj.options.line.color : '000000', width: obj.options.line.width } : 
                undefined
            });
          } else if (obj.shape === 'rect' || obj.shape === 'roundRect') {
            slide.addShape(obj.shape === 'roundRect' ? 'roundRect' : 'rect', {
              x: obj.options.x,
              y: obj.options.y,
              w: obj.options.w,
              h: obj.options.h,
              fill: obj.options.fill ? 
                { color: typeof obj.options.fill.color === 'string' ? obj.options.fill.color : 'ffffff' } : 
                undefined,
              line: obj.options.line ? 
                { color: typeof obj.options.line.color === 'string' ? obj.options.line.color : '000000', width: obj.options.line.width } : 
                undefined,
              rectRadius: obj.options.rectRadius
            });
          }
          break;
      }
    });
    
    // Save the presentation
    pptx.writeFile({ fileName: `slide-${currentSlide.id}.pptx` });
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Slide Preview Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slide Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Choose Slide</label>
                <Select 
                  value={selectedSlideIndex.toString()} 
                  onValueChange={(v) => setSelectedSlideIndex(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleSlidesJson.map((slide, index) => (
                      <SelectItem key={slide.id} value={index.toString()}>
                        {slide.title || slide.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Theme</label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(sampleThemes).map(themeKey => (
                      <SelectItem key={themeKey} value={themeKey}>
                        {sampleThemes[themeKey].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-4 space-y-2">
                <Button onClick={exportJSON} variant="outline" className="w-full">
                  Export as JSON
                </Button>
                <Button onClick={exportPPTX} variant="default" className="w-full">
                  Export as PPTX
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Slide Info */}
          <Card>
            <CardHeader>
              <CardTitle>Slide Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">ID:</span> {sampleSlidesJson[selectedSlideIndex].id}
                </div>
                <div>
                  <span className="font-medium">Objects:</span> {sampleSlidesJson[selectedSlideIndex].objects.length}
                </div>
                <div>
                  <span className="font-medium">Theme:</span> {sampleThemes[selectedTheme].name}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Canvas Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Canvas Preview (Fabric.js)</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef}
                className="border rounded-lg bg-gray-100 flex items-center justify-center"
                style={{ height: '500px' }}
              >
                <canvas ref={canvasRef} />
              </div>
            </CardContent>
          </Card>
          
          {/* JSON Preview */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>JSON Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(
                  applyThemeToSlide(sampleSlidesJson[selectedSlideIndex], sampleThemes[selectedTheme]), 
                  null, 
                  2
                )}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}