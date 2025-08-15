/**
 * Converts Fabric.js canvas objects to PptxGenJS-compatible JSON format
 * This is the reverse of slide-to-fabric.ts converter
 */

import { Canvas, Object as FabricObject } from 'fabric';
import { SlideDefinition, SlideObject, SlideColor } from './slide-types';

/**
 * Convert pixels to inches (PptxGenJS uses inches)
 * Assuming 96 DPI (standard for web)
 */
const pixelsToInches = (pixels: number): number => {
  return pixels / 96;
};

/**
 * Convert Fabric.js color to PptxGenJS format
 * Removes # prefix and handles transparency
 */
const convertColor = (color: string | undefined): SlideColor | undefined => {
  if (!color) return undefined;
  
  // Remove # prefix if present
  const cleanColor = color.replace('#', '');
  
  // Handle rgba format
  if (color.startsWith('rgba')) {
    // Extract RGB values from rgba
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `${r}${g}${b}`;
    }
  }
  
  return cleanColor;
};

/**
 * Map Fabric.js text alignment to PptxGenJS alignment
 */
const mapTextAlign = (align: string | undefined): 'left' | 'center' | 'right' | undefined => {
  switch (align) {
    case 'left': return 'left';
    case 'center': return 'center';
    case 'right': return 'right';
    default: return undefined;
  }
};

/**
 * Map Fabric.js vertical alignment to PptxGenJS
 */
const mapVerticalAlign = (align: string | undefined): 'top' | 'middle' | 'bottom' | undefined => {
  switch (align) {
    case 'top': return 'top';
    case 'middle': return 'middle';
    case 'bottom': return 'bottom';
    default: return undefined;
  }
};

/**
 * Convert a Fabric.js text object to PptxGenJS text object
 */
const convertTextObject = (obj: FabricObject): SlideObject | null => {
  // Type guard for text objects
  if (obj.type !== 'textbox' && obj.type !== 'text' && obj.type !== 'i-text') {
    return null;
  }

  const textObj = obj as any; // Cast to any to access text-specific properties
  
  return {
    type: 'text',
    text: textObj.text || '',
    options: {
      x: pixelsToInches(obj.left || 0),
      y: pixelsToInches(obj.top || 0),
      w: pixelsToInches(obj.width || 100),
      h: pixelsToInches(obj.height || 50),
      fontSize: textObj.fontSize || 18,
      fontFace: textObj.fontFamily || 'Arial',
      color: convertColor(textObj.fill as string),
      bold: textObj.fontWeight === 'bold' || textObj.fontWeight === '700',
      italic: textObj.fontStyle === 'italic',
      underline: textObj.underline || false,
      align: mapTextAlign(textObj.textAlign),
      valign: mapVerticalAlign(textObj.verticalAlign || 'top'),
      lineSpacing: textObj.lineHeight ? textObj.lineHeight * (textObj.fontSize || 18) : undefined,
    }
  };
};

/**
 * Convert a Fabric.js rectangle to PptxGenJS shape
 */
const convertRectObject = (obj: FabricObject): SlideObject | null => {
  if (obj.type !== 'rect') return null;

  const rectObj = obj as any;
  
  return {
    type: 'shape',
    shape: rectObj.rx || rectObj.ry ? 'roundRect' : 'rect',
    options: {
      x: pixelsToInches(obj.left || 0),
      y: pixelsToInches(obj.top || 0),
      w: pixelsToInches(obj.width || 100),
      h: pixelsToInches(obj.height || 50),
      fill: obj.fill ? { color: convertColor(obj.fill as string) } : undefined,
      line: obj.stroke ? {
        color: convertColor(obj.stroke as string),
        width: obj.strokeWidth || 1
      } : undefined,
      rectRadius: rectObj.rx ? pixelsToInches(rectObj.rx) : undefined,
    }
  };
};

/**
 * Convert a Fabric.js circle/ellipse to PptxGenJS shape
 */
const convertCircleObject = (obj: FabricObject): SlideObject | null => {
  if (obj.type !== 'circle' && obj.type !== 'ellipse') return null;

  const circleObj = obj as any;
  
  return {
    type: 'shape',
    shape: 'ellipse',
    options: {
      x: pixelsToInches(obj.left || 0),
      y: pixelsToInches(obj.top || 0),
      w: pixelsToInches((circleObj.radius || circleObj.rx || 50) * 2),
      h: pixelsToInches((circleObj.radius || circleObj.ry || 50) * 2),
      fill: obj.fill ? { color: convertColor(obj.fill as string) } : undefined,
      line: obj.stroke ? {
        color: convertColor(obj.stroke as string),
        width: obj.strokeWidth || 1
      } : undefined,
    }
  };
};

/**
 * Convert a Fabric.js line to PptxGenJS shape
 */
const convertLineObject = (obj: FabricObject): SlideObject | null => {
  if (obj.type !== 'line') return null;

  const lineObj = obj as any;
  
  // Calculate line dimensions
  const x1 = lineObj.x1 || 0;
  const y1 = lineObj.y1 || 0;
  const x2 = lineObj.x2 || 100;
  const y2 = lineObj.y2 || 0;
  
  return {
    type: 'shape',
    shape: 'line',
    options: {
      x: pixelsToInches(Math.min(x1, x2) + (obj.left || 0)),
      y: pixelsToInches(Math.min(y1, y2) + (obj.top || 0)),
      w: pixelsToInches(Math.abs(x2 - x1)),
      h: pixelsToInches(Math.abs(y2 - y1)),
      line: {
        color: convertColor(obj.stroke as string) || '000000',
        width: obj.strokeWidth || 1
      }
    }
  };
};

/**
 * Convert a Fabric.js triangle to PptxGenJS shape
 */
const convertTriangleObject = (obj: FabricObject): SlideObject | null => {
  if (obj.type !== 'triangle') return null;
  
  return {
    type: 'shape',
    shape: 'triangle',
    options: {
      x: pixelsToInches(obj.left || 0),
      y: pixelsToInches(obj.top || 0),
      w: pixelsToInches(obj.width || 100),
      h: pixelsToInches(obj.height || 100),
      fill: obj.fill ? { color: convertColor(obj.fill as string) } : undefined,
      line: obj.stroke ? {
        color: convertColor(obj.stroke as string),
        width: obj.strokeWidth || 1
      } : undefined,
    }
  };
};

/**
 * Main converter function: Fabric.js Canvas to PptxGenJS SlideDefinition
 */
export function convertFabricToSlideJson(canvas: Canvas): SlideDefinition {
  const objects: SlideObject[] = [];
  
  // Convert each Fabric object to PptxGenJS format
  canvas.getObjects().forEach(obj => {
    let slideObject: SlideObject | null = null;
    
    switch (obj.type) {
      case 'text':
      case 'textbox':
      case 'i-text':
        slideObject = convertTextObject(obj);
        break;
      case 'rect':
        slideObject = convertRectObject(obj);
        break;
      case 'circle':
      case 'ellipse':
        slideObject = convertCircleObject(obj);
        break;
      case 'line':
        slideObject = convertLineObject(obj);
        break;
      case 'triangle':
        slideObject = convertTriangleObject(obj);
        break;
      // Add more shape types as needed
    }
    
    if (slideObject) {
      objects.push(slideObject);
    }
  });
  
  // Get canvas background color
  const backgroundColor = canvas.backgroundColor as string | undefined;
  
  return {
    id: `template-${Date.now()}`,
    title: 'User Created Template',
    background: backgroundColor ? { color: convertColor(backgroundColor) } : { color: 'ffffff' },
    objects
  };
}

/**
 * Convert Fabric.js Canvas to both formats for saving
 */
export function exportCanvasFormats(canvas: Canvas) {
  return {
    fabricJson: canvas.toJSON(), // Fabric's native format for re-editing
    pptxJson: convertFabricToSlideJson(canvas), // PptxGenJS format for export
    previewImage: canvas.toDataURL({ format: 'png', quality: 0.8 }) // PNG preview
  };
}