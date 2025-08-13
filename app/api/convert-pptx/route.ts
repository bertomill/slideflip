import { NextRequest, NextResponse } from 'next/server';
import { SlideDefinition, SlideObject } from '@/lib/slide-types';
import pptx2json from 'pptx2json';
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      return NextResponse.json({ error: 'Only .pptx files are supported' }, { status: 400 });
    }

    // Convert file to buffer for processing
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // For now, create a placeholder slide structure
    // This will be replaced with actual PPTX parsing once we install the library
    const slideJson: SlideDefinition = await parsePptxToSlideDefinition(buffer, file.name);
    
    return NextResponse.json({
      success: true,
      slideJson,
      message: 'PPTX converted successfully'
    });
    
  } catch (error) {
    console.error('PPTX conversion error:', error);
    return NextResponse.json({
      error: 'Failed to convert PPTX file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Convert PPTX buffer to SlideDefinition JSON format using pptx2json
 */
async function parsePptxToSlideDefinition(buffer: Buffer, filename: string): Promise<SlideDefinition> {
  try {
    // Parse PPTX using pptx2json
    const pptxData = await pptx2json.parse(buffer);
    const slideId = `imported-${Date.now()}`;
    const objects: SlideObject[] = [];
    
    // Extract content from the first slide (pptx2json returns array of slides)
    const firstSlide = pptxData[0];
    if (!firstSlide) {
      throw new Error('No slides found in PPTX file');
    }
    
    // Process text elements
    if (firstSlide.texts && Array.isArray(firstSlide.texts)) {
      firstSlide.texts.forEach((textElement: any, index: number) => {
        if (textElement.text && textElement.text.trim()) {
          objects.push({
            type: 'text',
            text: textElement.text.trim(),
            options: {
              x: textElement.x || (index === 0 ? 1 : 1 + (index % 3) * 2.5),
              y: textElement.y || (index === 0 ? 1 : 3 + Math.floor(index / 3) * 1.5),
              w: textElement.width || 7,
              h: textElement.height || 1,
              fontSize: textElement.fontSize || (index === 0 ? 32 : 16),
              fontFace: textElement.fontFamily || 'Arial',
              color: convertColor(textElement.color) || (index === 0 ? '333333' : '666666'),
              bold: textElement.bold || index === 0,
              align: textElement.align || 'left'
            }
          });
        }
      });
    }
    
    // Process shapes if available
    if (firstSlide.shapes && Array.isArray(firstSlide.shapes)) {
      firstSlide.shapes.forEach((shape: any) => {
        if (shape.type && shape.type !== 'text') {
          objects.push({
            type: 'shape',
            shape: mapShapeType(shape.type),
            options: {
              x: shape.x || 1,
              y: shape.y || 1,
              w: shape.width || 2,
              h: shape.height || 1,
              fill: shape.fill ? { color: convertColor(shape.fill) || 'CCCCCC' } : undefined,
              line: shape.border ? { 
                color: convertColor(shape.border.color) || '000000', 
                width: shape.border.width || 1 
              } : undefined
            }
          });
        }
      });
    }
    
    // If no content was found, add a placeholder
    if (objects.length === 0) {
      objects.push({
        type: 'text',
        text: 'Imported from PowerPoint',
        options: {
          x: 1,
          y: 2,
          w: 8,
          h: 1.5,
          fontSize: 36,
          fontFace: 'Arial',
          color: '333333',
          bold: true,
          align: 'center'
        }
      });
      
      objects.push({
        type: 'text',
        text: `Source: ${filename}`,
        options: {
          x: 1,
          y: 3.8,
          w: 8,
          h: 0.8,
          fontSize: 18,
          fontFace: 'Arial',
          color: '666666',
          align: 'center'
        }
      });
    }
    
    return {
      id: slideId,
      title: `Imported from ${filename}`,
      background: { 
        color: convertColor(firstSlide.background?.color) || 'FFFFFF'
      },
      objects,
      notes: `Imported from PowerPoint file: ${filename} using pptx2json`
    };
    
  } catch (error) {
    console.error('Error parsing PPTX with pptx2json:', error);
    
    // Fallback to placeholder slide if parsing fails
    const slideId = `imported-fallback-${Date.now()}`;
    const objects: SlideObject[] = [
      {
        type: 'text',
        text: 'PPTX Import (Fallback)',
        options: {
          x: 1,
          y: 1.5,
          w: 8,
          h: 1.5,
          fontSize: 36,
          fontFace: 'Arial',
          color: '333333',
          bold: true,
          align: 'center'
        }
      },
      {
        type: 'text',
        text: `Source: ${filename}`,
        options: {
          x: 1,
          y: 3.2,
          w: 8,
          h: 0.8,
          fontSize: 18,
          fontFace: 'Arial',
          color: '666666',
          align: 'center'
        }
      },
      {
        type: 'text',
        text: 'Content could not be parsed automatically',
        options: {
          x: 1,
          y: 4.5,
          w: 8,
          h: 0.8,
          fontSize: 14,
          fontFace: 'Arial',
          color: '999999',
          align: 'center'
        }
      }
    ];
    
    return {
      id: slideId,
      title: `Imported from ${filename}`,
      background: { color: 'FFFFFF' },
      objects,
      notes: `Imported from PowerPoint file: ${filename} (parsing failed, using fallback)`
    };
  }
}

/**
 * Convert color from various formats to hex string
 */
function convertColor(color: any): string | undefined {
  if (!color) return undefined;
  
  if (typeof color === 'string') {
    // Already a hex string
    if (color.startsWith('#')) return color.slice(1);
    if (/^[0-9A-Fa-f]{6}$/.test(color)) return color;
    return color;
  }
  
  if (typeof color === 'object') {
    // RGB object
    if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
      const r = Math.round(color.r).toString(16).padStart(2, '0');
      const g = Math.round(color.g).toString(16).padStart(2, '0');
      const b = Math.round(color.b).toString(16).padStart(2, '0');
      return `${r}${g}${b}`;
    }
  }
  
  return undefined;
}

/**
 * Map pptx2json shape types to SlideDefinition shape types
 */
function mapShapeType(pptxShapeType: string): 'rect' | 'ellipse' | 'line' | 'triangle' | 'roundRect' {
  switch (pptxShapeType?.toLowerCase()) {
    case 'rectangle':
    case 'rect':
      return 'rect';
    case 'circle':
    case 'ellipse':
    case 'oval':
      return 'ellipse';
    case 'line':
      return 'line';
    case 'triangle':
      return 'triangle';
    case 'roundrectangle':
    case 'roundrect':
      return 'roundRect';
    default:
      return 'rect'; // Default fallback
  }
}