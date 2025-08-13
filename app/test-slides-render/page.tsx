"use client";

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createSlideCanvas, calculateOptimalScale } from '@/lib/slide-to-fabric';
import { SlideDefinition } from '@/lib/slide-types';
import { Canvas } from 'fabric';

export default function TestSlidesRender() {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sample slide JSON (the competitive analysis example)
  const zoomAnalysisSlide: SlideDefinition = {
    "id": "zoom-competitive-analysis",
    "background": { "color": "ffffff" },
    "objects": [
      {
        "type": "text",
        "text": "Video Conferencing Competitive Analysis",
        "options": {
          "x": 0.5,
          "y": 0.4,
          "w": 9,
          "h": 0.6,
          "fontSize": 32,
          "fontFace": "Arial",
          "color": "003366",
          "bold": true,
          "align": "center"
        }
      },
      {
        "type": "text",
        "text": "Q3 2024 Strategic Overview",
        "options": {
          "x": 0.5,
          "y": 1.0,
          "w": 9,
          "h": 0.4,
          "fontSize": 16,
          "fontFace": "Arial",
          "color": "666666",
          "align": "center"
        }
      },
      {
        "type": "shape",
        "shape": "line",
        "options": {
          "x": 0.5,
          "y": 1.6,
          "w": 9,
          "h": 0,
          "line": { "color": "cccccc", "width": 2 }
        }
      },
      {
        "type": "text",
        "text": "📊 ZOOM PERFORMANCE",
        "options": {
          "x": 0.5,
          "y": 2.0,
          "w": 2.8,
          "h": 0.4,
          "fontSize": 14,
          "fontFace": "Arial",
          "color": "003366",
          "bold": true,
          "align": "center"
        }
      },
      {
        "type": "text",
        "text": "Revenue: $1.16B\\nGrowth: +3.2% YoY\\n\\nEnterprise: 204K\\nGrowth: +8.1% YoY\\n\\nMonthly Users: 467M\\nChange: -1.8% YoY",
        "options": {
          "x": 0.5,
          "y": 2.5,
          "w": 2.8,
          "h": 2.0,
          "fontSize": 12,
          "fontFace": "Arial",
          "color": "333333",
          "lineSpacing": 18,
          "align": "left"
        }
      },
      {
        "type": "text",
        "text": "📈 MARKET DYNAMICS",
        "options": {
          "x": 3.6,
          "y": 2.0,
          "w": 2.8,
          "h": 0.4,
          "fontSize": 14,
          "fontFace": "Arial",
          "color": "003366",
          "bold": true,
          "align": "center"
        }
      },
      {
        "type": "text",
        "text": "Total Market: $8.5B\\nIndustry Growth: +12.4%\\n\\nRemote Work: 78% permanent\\nHybrid Model: Leading trend\\n\\nCompetition: Intensifying\\nPrice Pressure: Increasing",
        "options": {
          "x": 3.6,
          "y": 2.5,
          "w": 2.8,
          "h": 2.0,
          "fontSize": 12,
          "fontFace": "Arial",
          "color": "333333",
          "lineSpacing": 18,
          "align": "left"
        }
      },
      {
        "type": "text",
        "text": "🏢 TECHCORP POSITION",
        "options": {
          "x": 6.7,
          "y": 2.0,
          "w": 2.8,
          "h": 0.4,
          "fontSize": 14,
          "fontFace": "Arial",
          "color": "003366",
          "bold": true,
          "align": "center"
        }
      },
      {
        "type": "text",
        "text": "Current Revenue: $340M\\nMarket Share: 4.2%\\n\\nEnterprise Clients: 47K\\nGrowth: +15.2% YoY\\n\\nUser Base: 52M\\nRetention: 94.3%",
        "options": {
          "x": 6.7,
          "y": 2.5,
          "w": 2.8,
          "h": 2.0,
          "fontSize": 12,
          "fontFace": "Arial",
          "color": "333333",
          "lineSpacing": 18,
          "align": "left"
        }
      },
      {
        "type": "shape",
        "shape": "line",
        "options": {
          "x": 0.5,
          "y": 4.8,
          "w": 9,
          "h": 0,
          "line": { "color": "cccccc", "width": 1 }
        }
      },
      {
        "type": "text",
        "text": "KEY INSIGHTS & STRATEGIC IMPLICATIONS",
        "options": {
          "x": 0.5,
          "y": 5.0,
          "w": 9,
          "h": 0.3,
          "fontSize": 16,
          "fontFace": "Arial",
          "color": "003366",
          "bold": true,
          "align": "left"
        }
      },
      {
        "type": "text",
        "text": "• Zoom's consumer decline (-1.8%) signals market maturation; enterprise segment (+8.1%) remains strong\\n• Industry growing 4x faster than Zoom, indicating competitive displacement opportunity\\n• TechCorp's 15.2% growth outpaces market leaders—momentum for aggressive expansion\\n• Price compression expected as Microsoft Teams integration intensifies competitive pressure",
        "options": {
          "x": 0.5,
          "y": 5.4,
          "w": 9,
          "h": 1.0,
          "fontSize": 11,
          "fontFace": "Arial",
          "color": "333333",
          "lineSpacing": 16,
          "align": "left"
        }
      }
    ]
  };

  // Initialize canvas and render slide
  const renderSlide = () => {
    if (!canvasRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    // Force 16:9 aspect ratio: height = width / (16/9)
    const containerHeight = (containerWidth * 9) / 16;
    
    // Use calculateOptimalScale from lib to match preview component
    const scale = calculateOptimalScale(containerWidth, containerHeight);

    if (canvas) {
      canvas.dispose();
    }

    const newCanvas = createSlideCanvas(canvasRef.current, zoomAnalysisSlide, scale);
    setCanvas(newCanvas);
  };

  useEffect(() => {
    renderSlide();
  }, []);

  // Export to PPTX using improved script loading logic
  const exportToPPTX = async () => {
    try {
      if (typeof window === 'undefined') return;

      // Load PptxGenJS from CDN with proper waiting
      await new Promise<void>((resolve, reject) => {
        // Check if already loaded
        if ((window as any).PptxGenJS) {
          resolve();
          return;
        }

        // Check if script is already being loaded
        const existing = document.querySelector('script[src*="pptxgen"]');
        if (existing) {
          existing.addEventListener('load', () => {
            // Wait a bit for the global to be available
            setTimeout(() => resolve(), 100);
          });
          existing.addEventListener('error', () => reject(new Error('Script failed to load')));
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.min.js';
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
          // Wait a bit for the global to be available
          setTimeout(() => {
            if ((window as any).PptxGenJS) {
              resolve();
            } else {
              reject(new Error('PptxGenJS global not found after load'));
            }
          }, 200);
        };
        script.onerror = () => reject(new Error('Failed to load PptxGenJS script'));
        
        document.head.appendChild(script);
      });

      const PptxGenJS = (window as any).PptxGenJS;

      if (!PptxGenJS) {
        throw new Error('PptxGenJS not available after loading');
      }

      console.log('PptxGenJS loaded successfully:', typeof PptxGenJS);

      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'SlideFlip Demo';
      pptx.title = 'Zoom Competitive Analysis';
      
      const slide = pptx.addSlide();
      
      // Set background
      slide.background = { color: 'ffffff' };
      
      // Add all objects from our JSON
      zoomAnalysisSlide.objects.forEach((obj: any) => {
        if (obj.type === 'text') {
          slide.addText(obj.text.replace(/\\\\n/g, '\n'), {
            x: obj.options.x,
            y: obj.options.y,
            w: obj.options.w,
            h: obj.options.h,
            fontSize: obj.options.fontSize,
            fontFace: obj.options.fontFace,
            color: obj.options.color,
            bold: obj.options.bold,
            align: obj.options.align
          });
        } else if (obj.type === 'shape' && obj.shape === 'line') {
          slide.addShape('line', {
            x: obj.options.x,
            y: obj.options.y,
            w: obj.options.w,
            h: obj.options.h,
            line: { 
              color: obj.options.line?.color || '000000', 
              width: obj.options.line?.width || 1 
            }
          });
        }
      });
      
      await pptx.writeFile({ fileName: 'zoom-competitive-analysis-demo.pptx' });
      console.log('PPTX export completed successfully');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export PPTX: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Slide Renderer Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={renderSlide} className="w-full">
                Re-render Slide
              </Button>
              
              <Button onClick={exportToPPTX} variant="outline" className="w-full">
                Export to PPTX
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Slide Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">ID:</span> {zoomAnalysisSlide.id}</div>
                <div><span className="font-medium">Objects:</span> {zoomAnalysisSlide.objects.length}</div>
                <div><span className="font-medium">Background:</span> #{zoomAnalysisSlide.background?.color}</div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Canvas */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Fabric.js Canvas Render</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef}
                className="border rounded-lg bg-gray-50 flex items-center justify-center"
                style={{ 
                  width: '100%',
                  paddingBottom: '56.25%', // 16:9 aspect ratio (9/16 * 100%)
                  position: 'relative',
                  minHeight: '400px'
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <canvas ref={canvasRef} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* JSON Display */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Slide JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(zoomAnalysisSlide, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}