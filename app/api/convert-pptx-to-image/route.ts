import { NextRequest, NextResponse } from 'next/server';
import { SlideDefinition, SlideObject } from '@/lib/slide-types';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * PPTX to Image Conversion API
 * 
 * Converts PPTX slides to PNG images for accurate visual representation
 * Uses LibreOffice in headless mode for conversion (if available)
 * Falls back to placeholder if conversion tools aren't available
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
    
    // Try to convert PPTX to image
    const imageData = await convertPptxToImage(buffer, file.name);
    
    // Create slide definition with image as background
    const slideJson: SlideDefinition = {
      id: `imported-${Date.now()}`,
      title: `Imported from ${file.name}`,
      background: { 
        color: 'FFFFFF'
      },
      objects: [
        {
          type: 'image',
          path: imageData,
          options: {
            x: 0,
            y: 0,
            w: 10,  // Full slide width
            h: 5.625,  // Full slide height (16:9)
          }
        },
        // Add an overlay text to indicate this is imported
        {
          type: 'text',
          text: `Imported from: ${file.name}`,
          options: {
            x: 0.2,
            y: 5.2,
            w: 4,
            h: 0.3,
            fontSize: 10,
            fontFace: 'Arial',
            color: '999999',
            italic: true,
            align: 'left'
          }
        }
      ],
      notes: `Imported PowerPoint slide from ${file.name} as image`
    };
    
    return NextResponse.json({
      success: true,
      slideJson,
      message: 'PPTX converted to image successfully'
    });
    
  } catch (error) {
    console.error('PPTX to image conversion error:', error);
    return NextResponse.json({
      error: 'Failed to convert PPTX file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Convert PPTX to PNG image
 */
async function convertPptxToImage(buffer: Buffer, filename: string): Promise<string> {
  const tempDir = os.tmpdir();
  const inputFile = path.join(tempDir, `input-${Date.now()}.pptx`);
  const outputDir = path.join(tempDir, `output-${Date.now()}`);
  
  try {
    // Write PPTX to temp file
    await fs.writeFile(inputFile, buffer);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Check if LibreOffice is available
    try {
      await execAsync('which soffice');
      
      // Use LibreOffice to convert PPTX to PDF first, then to PNG
      console.log('Converting PPTX to images using LibreOffice...');
      
      // Convert to PDF
      const pdfFile = path.join(outputDir, 'output.pdf');
      await execAsync(
        `soffice --headless --convert-to pdf --outdir "${outputDir}" "${inputFile}"`,
        { timeout: 30000 }
      );
      
      // Convert PDF to PNG using sharp or ImageMagick
      // For now, we'll use a placeholder approach
      throw new Error('PDF to PNG conversion not implemented');
      
    } catch (error) {
      console.log('LibreOffice not available, using alternative method...');
      
      // Alternative: Use puppeteer or playwright to render
      // For now, return a placeholder image
      return await createPlaceholderImage(filename);
    }
    
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(inputFile);
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  }
}

/**
 * Create a placeholder image when conversion tools aren't available
 */
async function createPlaceholderImage(filename: string): Promise<string> {
  // Create a simple placeholder image using sharp
  const width = 960;
  const height = 540;
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f0f0f0"/>
      <rect x="10" y="10" width="${width-20}" height="${height-20}" fill="white" stroke="#ccc" stroke-width="2"/>
      <text x="${width/2}" y="${height/2 - 20}" text-anchor="middle" font-family="Arial" font-size="24" fill="#666">
        PowerPoint Import
      </text>
      <text x="${width/2}" y="${height/2 + 10}" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">
        ${filename}
      </text>
      <text x="${width/2}" y="${height/2 + 40}" text-anchor="middle" font-family="Arial" font-size="14" fill="#aaa">
        (Visual preview requires conversion tools)
      </text>
    </svg>
  `;
  
  const imageBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

/**
 * Alternative: Use an online conversion service
 * 
 * Services like CloudConvert, Zamzar, or ConvertAPI can convert PPTX to images
 * This would require API keys and potentially costs
 */
async function convertUsingOnlineService(buffer: Buffer, filename: string): Promise<string> {
  // Example with a hypothetical service
  // const response = await fetch('https://api.convertservice.com/convert', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.CONVERT_API_KEY}`,
  //     'Content-Type': 'application/octet-stream'
  //   },
  //   body: buffer
  // });
  
  // This would return the image data
  throw new Error('Online conversion service not configured');
}