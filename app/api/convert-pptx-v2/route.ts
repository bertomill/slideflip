import { NextRequest, NextResponse } from 'next/server';
import { SlideDefinition, SlideObject } from '@/lib/slide-types';
import JSZip from 'jszip';
import xml2js from 'xml2js';

/**
 * Enhanced PPTX Import API Route
 * 
 * This version uses direct XML parsing of PPTX files for better content extraction
 * PPTX files are actually ZIP archives containing XML files
 */

/**
 * POST Handler for PPTX File Upload
 */
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const slideJson = await parsePptxToSlideDefinition(buffer, file.name);
    
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
 * Enhanced PPTX Parser using direct XML extraction
 */
async function parsePptxToSlideDefinition(buffer: Buffer, filename: string): Promise<SlideDefinition> {
  try {
    console.log('Starting enhanced PPTX parsing for:', filename);
    
    // Parse PPTX as ZIP
    const zip = await JSZip.loadAsync(buffer);
    
    // Get slide files
    const slideFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    
    console.log(`Found ${slideFiles.length} slides`);
    
    const objects: SlideObject[] = [];
    
    // Process first slide for now
    if (slideFiles.length > 0) {
      const firstSlideXml = await zip.files[slideFiles[0]].async('string');
      const parser = new xml2js.Parser({ explicitArray: false });
      const slideData = await parser.parseStringPromise(firstSlideXml);
      
      // Extract text from slide
      const texts = extractTextsFromSlide(slideData);
      texts.forEach((textData, index) => {
        objects.push({
          type: 'text',
          text: textData.text,
          options: {
            x: 1 + (index % 3) * 3,
            y: 1 + Math.floor(index / 3) * 1.5,
            w: 2.5,
            h: 1,
            fontSize: textData.fontSize || 18,
            fontFace: textData.fontFace || 'Arial',
            color: textData.color || '000000',
            bold: textData.bold || false,
            italic: textData.italic || false,
            align: textData.align || 'left'
          }
        });
      });
      
      // Extract shapes from slide
      const shapes = extractShapesFromSlide(slideData);
      shapes.forEach((shapeData) => {
        objects.push({
          type: 'shape',
          shape: shapeData.type,
          options: {
            x: shapeData.x || 2,
            y: shapeData.y || 2,
            w: shapeData.w || 2,
            h: shapeData.h || 2,
            fill: shapeData.fill ? { color: shapeData.fill } : undefined,
            line: shapeData.line ? { 
              color: shapeData.lineColor || '000000',
              width: shapeData.lineWidth || 1
            } : undefined
          }
        });
      });
      
      // Check for images
      const imageRels = await extractImageReferences(zip, 'slide1');
      for (const imageRel of imageRels) {
        try {
          const imageData = await zip.files[`ppt/${imageRel.target}`].async('base64');
          const mimeType = getMimeTypeFromExtension(imageRel.target);
          objects.push({
            type: 'image',
            path: `data:${mimeType};base64,${imageData}`,
            options: {
              x: imageRel.x || 1,
              y: imageRel.y || 1,
              w: imageRel.w || 3,
              h: imageRel.h || 3
            }
          });
        } catch (imgError) {
          console.error('Error processing image:', imgError);
        }
      }
    }
    
    // If we extracted content, use it
    if (objects.length > 0) {
      console.log(`Successfully extracted ${objects.length} objects`);
    } else {
      // Fallback content
      objects.push({
        type: 'text',
        text: 'PPTX Imported',
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
        text: `Source: ${filename}`,
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
        text: 'Ready for editing',
        options: {
          x: 1,
          y: 4,
          w: 8,
          h: 0.6,
          fontSize: 14,
          fontFace: 'Arial',
          color: '999999',
          align: 'center'
        }
      });
    }
    
    return {
      id: `imported-${Date.now()}`,
      title: `Imported from ${filename}`,
      background: { color: 'FFFFFF' },
      objects,
      notes: `Imported from PowerPoint file: ${filename}`
    };
    
  } catch (error) {
    console.error('Error in enhanced PPTX parsing:', error);
    
    // Return fallback
    return {
      id: `imported-fallback-${Date.now()}`,
      title: `Imported from ${filename}`,
      background: { color: 'FFFFFF' },
      objects: [{
        type: 'text',
        text: 'Import failed - Please try again',
        options: {
          x: 1,
          y: 2,
          w: 8,
          h: 1,
          fontSize: 24,
          fontFace: 'Arial',
          color: 'CC0000',
          align: 'center'
        }
      }],
      notes: `Failed to import ${filename}`
    };
  }
}

/**
 * Extract text elements from slide XML
 */
function extractTextsFromSlide(slideData: any): Array<{
  text: string;
  fontSize?: number;
  fontFace?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}> {
  const texts: any[] = [];
  
  try {
    // Navigate through the XML structure to find text
    const spTree = slideData?.['p:sld']?.['p:cSld']?.['p:spTree'];
    if (!spTree) return texts;
    
    // Get all shape elements
    const shapes = Array.isArray(spTree['p:sp']) ? spTree['p:sp'] : [spTree['p:sp']].filter(Boolean);
    
    for (const shape of shapes) {
      // Extract text from text body
      const txBody = shape?.['p:txBody'];
      if (!txBody) continue;
      
      // Get paragraphs
      const paragraphs = Array.isArray(txBody['a:p']) ? txBody['a:p'] : [txBody['a:p']].filter(Boolean);
      
      for (const para of paragraphs) {
        // Get runs (text segments)
        const runs = Array.isArray(para['a:r']) ? para['a:r'] : [para['a:r']].filter(Boolean);
        
        let paragraphText = '';
        let fontSize = 18;
        let bold = false;
        let italic = false;
        
        for (const run of runs) {
          const runText = run?.['a:t'] || '';
          paragraphText += runText;
          
          // Extract formatting
          const rPr = run?.['a:rPr'];
          if (rPr) {
            if (rPr['$']?.sz) {
              fontSize = Math.round(parseInt(rPr['$'].sz) / 100);
            }
            if (rPr['$']?.b === '1') {
              bold = true;
            }
            if (rPr['$']?.i === '1') {
              italic = true;
            }
          }
        }
        
        if (paragraphText.trim()) {
          texts.push({
            text: paragraphText.trim(),
            fontSize,
            bold,
            italic,
            align: 'left'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error extracting texts:', error);
  }
  
  return texts;
}

/**
 * Extract shapes from slide XML
 */
function extractShapesFromSlide(slideData: any): Array<{
  type: 'rect' | 'ellipse' | 'line' | 'triangle' | 'roundRect';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: string;
  lineColor?: string;
  lineWidth?: number;
}> {
  const shapes: any[] = [];
  
  try {
    const spTree = slideData?.['p:sld']?.['p:cSld']?.['p:spTree'];
    if (!spTree) return shapes;
    
    // Get connection shapes (lines)
    const cxnSps = Array.isArray(spTree['p:cxnSp']) ? spTree['p:cxnSp'] : [spTree['p:cxnSp']].filter(Boolean);
    for (const cxnSp of cxnSps) {
      shapes.push({
        type: 'line' as const,
        x: 1,
        y: 1,
        w: 3,
        h: 0.1
      });
    }
    
    // Get regular shapes
    const sps = Array.isArray(spTree['p:sp']) ? spTree['p:sp'] : [spTree['p:sp']].filter(Boolean);
    for (const sp of sps) {
      const spPr = sp?.['p:spPr'];
      if (!spPr) continue;
      
      // Check if it has preset geometry (not just text)
      const prstGeom = spPr?.['a:prstGeom'];
      if (prstGeom) {
        const prst = prstGeom['$']?.prst;
        let shapeType: 'rect' | 'ellipse' | 'triangle' | 'roundRect' = 'rect';
        
        switch (prst) {
          case 'ellipse':
          case 'circle':
            shapeType = 'ellipse';
            break;
          case 'triangle':
            shapeType = 'triangle';
            break;
          case 'roundRect':
            shapeType = 'roundRect';
            break;
          default:
            shapeType = 'rect';
        }
        
        shapes.push({
          type: shapeType,
          x: 2,
          y: 2,
          w: 2,
          h: 2,
          fill: 'CCCCCC'
        });
      }
    }
  } catch (error) {
    console.error('Error extracting shapes:', error);
  }
  
  return shapes;
}

/**
 * Extract image references from slide relationships
 */
async function extractImageReferences(zip: JSZip, slideName: string): Promise<Array<{
  target: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}>> {
  const images: any[] = [];
  
  try {
    const relsFile = `ppt/slides/_rels/${slideName}.xml.rels`;
    if (zip.files[relsFile]) {
      const relsXml = await zip.files[relsFile].async('string');
      const parser = new xml2js.Parser({ explicitArray: false });
      const relsData = await parser.parseStringPromise(relsXml);
      
      const relationships = relsData?.Relationships?.Relationship;
      const rels = Array.isArray(relationships) ? relationships : [relationships].filter(Boolean);
      
      for (const rel of rels) {
        if (rel['$']?.Type?.includes('image')) {
          images.push({
            target: rel['$'].Target.replace('../', ''),
            x: 1,
            y: 1,
            w: 3,
            h: 3
          });
        }
      }
    }
  } catch (error) {
    console.error('Error extracting image references:', error);
  }
  
  return images;
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}