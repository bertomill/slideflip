import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';

/**
 * Test endpoint for PPTX generation
 * Creates a simple test PowerPoint file to verify the library works correctly
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Creating test PPTX...');
    
    // Create new PowerPoint presentation
    const pptx = new PptxGenJS();
    
    // Set presentation properties
    pptx.author = 'Slideo AI';
    pptx.company = 'Slideo';
    pptx.subject = 'Test Presentation';
    pptx.title = 'PPTX Generation Test';

    // Create a test slide
    const slide = pptx.addSlide();
    
    // Set gradient background
    slide.background = {
      fill: {
        type: 'gradient',
        colors: ['667eea', '764ba2'],
        angle: 45
      }
    };

    // Add title
    slide.addText('PPTX Generation Test', {
      x: 1,
      y: 1,
      w: 8,
      h: 1.5,
      fontSize: 44,
      fontFace: 'Arial',
      color: 'FFFFFF',
      bold: true,
      align: 'center'
    });

    // Add subtitle
    slide.addText('This slide was generated programmatically using Node.js', {
      x: 1,
      y: 2.5,
      w: 8,
      h: 0.8,
      fontSize: 24,
      fontFace: 'Arial',
      color: 'F0F0F0',
      align: 'center'
    });

    // Add bullet points
    slide.addText([
      '• PPTX generation is working correctly',
      '• Gradients and styling are applied',
      '• Text formatting is preserved',
      '• Ready for production use'
    ], {
      x: 2,
      y: 4,
      w: 6,
      h: 2,
      fontSize: 16,
      fontFace: 'Arial',
      color: 'F0F0F0',
      bullet: true
    });

    console.log('Generating PPTX buffer...');
    
    // Generate PPTX file
    const pptxBuffer = await pptx.write('nodebuffer');
    
    console.log(`PPTX generated successfully, size: ${pptxBuffer.length} bytes`);

    // Return PPTX file as download
    return new NextResponse(pptxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="test-slide.pptx"',
        'Content-Length': pptxBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Test PPTX generation error:', error);
    
    return NextResponse.json({
      error: 'Failed to generate test PowerPoint file',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}