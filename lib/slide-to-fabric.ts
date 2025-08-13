import { Canvas, Textbox, Rect, Ellipse, Line, Triangle } from 'fabric';
import { SlideDefinition, SlideObject, TextObject, ShapeObject, SlideColor } from './slide-types';

/**
 * PowerPoint slide dimensions (16:9 aspect ratio)
 * PptxGenJS uses inches, we'll convert to pixels for canvas
 */
const SLIDE_WIDTH_INCHES = 10;
const SLIDE_HEIGHT_INCHES = 5.625;
const DPI = 96; // Standard screen DPI

export const SLIDE_WIDTH_PX = SLIDE_WIDTH_INCHES * DPI;  // 960px
export const SLIDE_HEIGHT_PX = SLIDE_HEIGHT_INCHES * DPI; // 540px

/**
 * Convert inches to pixels
 */
function inchesToPixels(inches: number): number {
  return inches * DPI;
}

/**
 * Convert color to fabric.js compatible format
 */
function convertColor(color: SlideColor | undefined): string {
  if (!color) return '#000000';
  
  if (typeof color === 'string') {
    // Add # if it's a hex color without it
    if (color.match(/^[0-9A-Fa-f]{6}$/)) {
      return `#${color}`;
    }
    return color;
  }
  
  // RGB object
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Render text object on canvas
 */
function renderTextObject(canvas: Canvas, obj: TextObject) {
  console.log('📝 Rendering text object:', obj);
  const { text, options } = obj;
  
  // Convert position and size from inches to pixels
  const left = inchesToPixels(options.x);
  const top = inchesToPixels(options.y);
  const width = inchesToPixels(options.w);
  const height = inchesToPixels(options.h);
  
  console.log('📐 Text positioning:', {
    original: { x: options.x, y: options.y, w: options.w, h: options.h },
    pixels: { left, top, width, height }
  });
  
  const color = convertColor(options.color);
  console.log(`🎨 Text color: ${options.color} → ${color}`);
  
  // Create fabric text object
  const fabricText = new Textbox(text, {
    left: left,
    top: top,
    width: width,
    height: height,
    fontSize: options.fontSize || 18,
    fontFamily: options.fontFace || 'Arial',
    fill: color,
    fontWeight: options.bold ? 'bold' : 'normal',
    fontStyle: options.italic ? 'italic' : 'normal',
    underline: options.underline || false,
    textAlign: options.align || 'left',
    lineHeight: options.lineSpacing ? (options.lineSpacing / (options.fontSize || 18)) : 1.2,
    selectable: false,
    evented: false
  });
  
  console.log('📝 Fabric text object created:', {
    text,
    fontSize: options.fontSize,
    fontFamily: options.fontFace,
    fill: color,
    position: { left, top, width, height }
  });
  
  // Handle vertical alignment
  if (options.valign === 'middle') {
    fabricText.set('originY', 'center');
    fabricText.set('top', top + height / 2);
    console.log('📐 Applied middle vertical alignment');
  } else if (options.valign === 'bottom') {
    fabricText.set('originY', 'bottom');
    fabricText.set('top', top + height);
    console.log('📐 Applied bottom vertical alignment');
  }
  
  console.log('➕ Adding text to canvas...');
  canvas.add(fabricText);
  console.log('✅ Text added to canvas');
}

/**
 * Render shape object on canvas
 */
function renderShapeObject(canvas: Canvas, obj: ShapeObject) {
  const { shape, options } = obj;
  
  // Convert position and size from inches to pixels
  const left = inchesToPixels(options.x);
  const top = inchesToPixels(options.y);
  const width = inchesToPixels(options.w);
  const height = inchesToPixels(options.h);
  
  let fabricShape: any | null = null;
  
  switch (shape) {
    case 'rect':
    case 'roundRect':
      fabricShape = new Rect({
        left: left,
        top: top,
        width: width,
        height: height,
        fill: options.fill ? convertColor(options.fill.color) : 'transparent',
        stroke: options.line ? convertColor(options.line.color) : undefined,
        strokeWidth: options.line?.width || 0,
        rx: shape === 'roundRect' && options.rectRadius ? inchesToPixels(options.rectRadius) : 0,
        ry: shape === 'roundRect' && options.rectRadius ? inchesToPixels(options.rectRadius) : 0,
        opacity: options.fill?.transparency ? (1 - options.fill.transparency) : 1,
        selectable: false,
        evented: false
      });
      break;
      
    case 'ellipse':
      fabricShape = new Ellipse({
        left: left,
        top: top,
        rx: width / 2,
        ry: height / 2,
        fill: options.fill ? convertColor(options.fill.color) : 'transparent',
        stroke: options.line ? convertColor(options.line.color) : undefined,
        strokeWidth: options.line?.width || 0,
        opacity: options.fill?.transparency ? (1 - options.fill.transparency) : 1,
        selectable: false,
        evented: false
      });
      break;
      
    case 'line':
      fabricShape = new Line(
        [left, top, left + width, top + height],
        {
          stroke: options.line ? convertColor(options.line.color) : '#000000',
          strokeWidth: options.line?.width || 1,
          strokeDashArray: options.line?.dashType === 'dash' ? [5, 5] : 
                          options.line?.dashType === 'dot' ? [2, 2] : undefined,
          selectable: false,
          evented: false
        }
      );
      break;
      
    case 'triangle':
      fabricShape = new Triangle({
        left: left,
        top: top,
        width: width,
        height: height,
        fill: options.fill ? convertColor(options.fill.color) : 'transparent',
        stroke: options.line ? convertColor(options.line.color) : undefined,
        strokeWidth: options.line?.width || 0,
        opacity: options.fill?.transparency ? (1 - options.fill.transparency) : 1,
        selectable: false,
        evented: false
      });
      break;
  }
  
  if (fabricShape) {
    canvas.add(fabricShape);
  }
}

/**
 * Main function to render a slide definition on a Fabric.js canvas
 */
export function renderSlideOnCanvas(
  canvas: Canvas, 
  slide: SlideDefinition,
  scale: number = 1
) {
  console.log('🎨 Starting canvas rendering...');
  console.log('📋 Slide to render:', slide);
  console.log('🔍 Scale factor:', scale);
  
  // Check if canvas is properly initialized
  if (!canvas) {
    console.error('❌ Canvas not provided');
    return;
  }
  
  // Check if canvas has required properties
  if (typeof canvas.clear !== 'function' || typeof canvas.setWidth !== 'function') {
    console.error('❌ Canvas not properly initialized - missing methods');
    return;
  }
  
  console.log('✅ Canvas is properly initialized');
  
  // Clear existing content
  canvas.clear();
  console.log('🧹 Canvas cleared');
  
  // Set canvas dimensions (scaled for display)
  canvas.setWidth(SLIDE_WIDTH_PX * scale);
  canvas.setHeight(SLIDE_HEIGHT_PX * scale);
  console.log(`📐 Canvas dimensions set: ${SLIDE_WIDTH_PX * scale} x ${SLIDE_HEIGHT_PX * scale}`);
  
  // Set zoom for scaling
  canvas.setZoom(scale);
  console.log(`🔍 Canvas zoom set to: ${scale}`);
  
  // Set background
  if (slide.background) {
    if (slide.background.color) {
      const bgColor = convertColor(slide.background.color);
      canvas.backgroundColor = bgColor;
      console.log(`🎨 Background color set to: ${bgColor}`);
    }
    // Note: background images would need additional handling
  } else {
    canvas.backgroundColor = '#ffffff';
    console.log('🎨 Default white background set');
  }
  
  // Render each object
  console.log(`📝 Rendering ${slide.objects.length} objects...`);
  slide.objects.forEach((obj, index) => {
    console.log(`🔄 Rendering object ${index + 1}:`, obj);
    switch (obj.type) {
      case 'text':
        renderTextObject(canvas, obj as TextObject);
        console.log(`✅ Text object ${index + 1} rendered`);
        break;
      case 'shape':
        renderShapeObject(canvas, obj as ShapeObject);
        console.log(`✅ Shape object ${index + 1} rendered`);
        break;
      case 'image':
        // TODO: Implement image rendering
        console.log('⚠️ Image rendering not yet implemented');
        break;
      case 'chart':
        // TODO: Implement chart rendering (would need Chart.js or similar)
        console.log('⚠️ Chart rendering not yet implemented');
        break;
      case 'table':
        // TODO: Implement table rendering
        console.log('⚠️ Table rendering not yet implemented');
        break;
    }
  });
  
  // Render the canvas
  console.log('🎨 Calling canvas.renderAll()...');
  canvas.renderAll();
  console.log('✅ Canvas rendering complete!');
  console.log('📊 Canvas object count:', canvas.getObjects().length);
}

/**
 * Create a Fabric.js canvas for slide preview
 */
export function createSlideCanvas(
  canvasElement: HTMLCanvasElement,
  slide: SlideDefinition,
  scale: number = 1
): Canvas {
  if (!canvasElement) {
    throw new Error('Canvas element is required');
  }
  
  console.log('🏗️ Creating Fabric canvas...');
  console.log('📄 Canvas element:', canvasElement);
  console.log('📋 Slide:', slide);
  console.log('🔍 Scale:', scale);
  
  try {
    const canvas = new Canvas(canvasElement, {
      selection: false,
      preserveObjectStacking: true
    });
    
    console.log('✅ Fabric canvas created');
    console.log('🔧 Canvas properties:', {
      width: canvas.width,
      height: canvas.height,
      lowerCanvasEl: !!canvas.lowerCanvasEl,
      upperCanvasEl: !!canvas.upperCanvasEl
    });
    
    // Immediately render - the canvas should be ready
    try {
      console.log('🔄 Rendering slide immediately...');
      renderSlideOnCanvas(canvas, slide, scale);
    } catch (error) {
      console.error('❌ Error rendering slide on canvas:', error);
      // Try once more after a short delay
      setTimeout(() => {
        try {
          console.log('🔄 Retrying slide render after delay...');
          renderSlideOnCanvas(canvas, slide, scale);
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
        }
      }, 100);
    }
    
    return canvas;
  } catch (error) {
    console.error('❌ Error creating Fabric canvas:', error);
    throw error;
  }
}

/**
 * Calculate optimal scale to fit canvas in container
 */
export function calculateOptimalScale(
  containerWidth: number,
  containerHeight: number,
  slideWidth: number = SLIDE_WIDTH_PX,
  slideHeight: number = SLIDE_HEIGHT_PX
): number {
  const scaleX = containerWidth / slideWidth;
  const scaleY = containerHeight / slideHeight;
  return Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
}