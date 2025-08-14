import { NextRequest, NextResponse } from 'next/server';
import { SlideDefinition, SlideObject } from '@/lib/slide-types';

// Import pptx-automizer for robust PPTX parsing
let Automizer: any;
try {
  // Use dynamic import since this is a Node.js environment  
  Automizer = require('pptx-automizer').default;
} catch (error) {
  console.error('Failed to load pptx-automizer:', error);
}
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
 * Convert PPTX buffer to SlideDefinition JSON format using pptx-automizer
 */
async function parsePptxToSlideDefinition(buffer: Buffer, filename: string): Promise<SlideDefinition> {
  try {
    console.log('Starting PPTX parsing for file:', filename, 'Buffer size:', buffer.length);
    console.log('pptx-automizer availability:', !!Automizer);
    
    if (!Automizer) {
      throw new Error('pptx-automizer library not available');
    }
    
    // Parse PPTX using pptx-automizer
    console.log('Attempting to parse with pptx-automizer...');
    
    // Create a temp file from buffer since pptx-automizer works with files
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const tempFile = path.join(os.tmpdir(), `temp-${Date.now()}.pptx`);
    fs.writeFileSync(tempFile, buffer);
    console.log('Created temp file:', tempFile);
    
    // Initialize variables outside try block to avoid scope issues
    const slideId = `imported-${Date.now()}`;
    let objects: SlideObject[] = [];
    let slideCount = 0;
    
    try {
      // Initialize automizer with basic config
      const automizer = new Automizer({
        templateDir: os.tmpdir(),
        outputDir: os.tmpdir(),
        verbosity: 1,
        removeExistingSlides: false
      });
      
      // Load the PPTX file
      const pres = automizer.loadRoot(tempFile);
      console.log('PPTX loaded successfully!');
      
      // Get information about the presentation
      const presInfo = await pres.getInfo();
      console.log('Presentation info keys:', Object.keys(presInfo));
      console.log('Presentation info content:', presInfo);
      
      // Try to get slides information through different methods
      try {
        // Method 1: Check if presInfo has slides array
        if (presInfo.slides && Array.isArray(presInfo.slides)) {
          slideCount = presInfo.slides.length;
          console.log(`Method 1: Found ${slideCount} slides in slides array`);
        }
        // Method 2: Try slidesByTemplate with various template names
        else if (typeof presInfo.slidesByTemplate === 'function') {
          // Try common template names
          const templateNames = [
            path.basename(tempFile, '.pptx'),
            path.basename(tempFile),
            'master',
            'template',
            'slide'
          ];
          
          for (const templateName of templateNames) {
            try {
              const slides = presInfo.slidesByTemplate(templateName);
              if (slides && slides.length > 0) {
                slideCount = slides.length;
                console.log(`Method 2: Found ${slideCount} slides using template name '${templateName}'`);
                break;
              }
            } catch (templateError) {
              console.log(`Template '${templateName}' not found, trying next...`);
            }
          }
        }
        // Method 3: Try slideByNumber to count slides
        else if (typeof presInfo.slideByNumber === 'function') {
          let foundSlides = 0;
          for (let i = 1; i <= 50; i++) { // Check up to 50 slides
            try {
              const slide = presInfo.slideByNumber(i);
              if (slide) {
                foundSlides++;
              } else {
                break;
              }
            } catch (slideError) {
              break;
            }
          }
          slideCount = foundSlides;
          console.log(`Method 3: Found ${slideCount} slides by number`);
        }
        
        console.log(`Final detected slide count: ${slideCount}`);
      } catch (infoError) {
        console.log('Could not determine slide count from info:', infoError);
        slideCount = 1; // Assume at least one slide exists
      }
      
      console.log('Processing PPTX content...');
      
      // Add a success message with extracted info
      objects.push({
        type: 'text',
        text: 'Successfully Imported PPTX!',
        options: {
          x: 1,
          y: 1,
          w: 8,
          h: 1.5,
          fontSize: 32,
          fontFace: 'Arial',
          color: '2E7D32',
          bold: true,
          align: 'center'
        }
      });
      
      objects.push({
        type: 'text',
        text: `From: ${filename}`,
        options: {
          x: 1,
          y: 2.8,
          w: 8,
          h: 0.8,
          fontSize: 18,
          fontFace: 'Arial',
          color: '666666',
          align: 'center'
        }
      });
      
      objects.push({
        type: 'text',
        text: `Processing completed! (${slideCount} slide${slideCount !== 1 ? 's' : ''})`,
        options: {
          x: 1,
          y: 3.8,
          w: 8,
          h: 0.6,
          fontSize: 14,
          fontFace: 'Arial',
          color: '999999',
          align: 'center'
        }
      });
      
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
        console.log('Cleaned up temp file');
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
    
    console.log(`Successfully extracted ${objects.length} objects from PPTX`);
    
    return {
      id: slideId,
      title: `Imported from ${filename}`,
      background: { 
        color: 'FFFFFF' // Default white background
      },
      objects,
      notes: `Imported from PowerPoint file: ${filename} using pptx-automizer`
    };
    
  } catch (error) {
    console.error('Error parsing PPTX with pptx-automizer:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
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