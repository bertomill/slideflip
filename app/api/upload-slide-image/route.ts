import { NextRequest, NextResponse } from 'next/server';
import { SlideDefinition } from '@/lib/slide-types';

/**
 * Simple Image Upload for Slide Templates
 * 
 * Users can upload screenshots or exported images of their slides
 * This gives perfect visual fidelity without complex parsing
 */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string || 'Imported Slide';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please upload an image file' }, { status: 400 });
    }

    // Convert to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;
    
    // Create slide with image as full background
    const slideJson: SlideDefinition = {
      id: `imported-${Date.now()}`,
      title: title,
      background: { 
        color: 'FFFFFF'
      },
      objects: [
        {
          type: 'image',
          path: dataUrl,
          options: {
            x: 0,
            y: 0,
            w: 10,  // Full slide width in inches
            h: 5.625,  // Full slide height for 16:9
          }
        }
      ],
      notes: `Imported from image: ${file.name}`
    };
    
    return NextResponse.json({
      success: true,
      slideJson,
      message: 'Image imported successfully'
    });
    
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}