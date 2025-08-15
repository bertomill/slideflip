import { NextRequest, NextResponse } from 'next/server';
import { SlideDefinition } from '@/lib/slide-types';
import { createClient } from '@supabase/supabase-js';

/**
 * PPTX to PNG Conversion using CloudConvert API
 * 
 * Sign up at https://cloudconvert.com/api/v2
 * Add CLOUDCONVERT_API_KEY to your .env.local
 * Costs ~$0.01 per conversion, first 25 conversions free
 */

export async function POST(request: NextRequest) {
  let file: File | null = null;
  
  try {
    const formData = await request.formData();
    file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      return NextResponse.json({ error: 'Only .pptx files are supported' }, { status: 400 });
    }

    const apiKey = process.env.CLOUDCONVERT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'CloudConvert API key not configured. Please add CLOUDCONVERT_API_KEY to your environment variables.' 
      }, { status: 500 });
    }

    console.log('Converting PPTX to PNG using CloudConvert...');
    
    // Step 1: Create conversion job
    const jobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tasks: {
          'import-pptx': {
            operation: 'import/upload'
          },
          'convert-to-png': {
            operation: 'convert',
            input: 'import-pptx',
            output_format: 'png'
          },
          'export-png': {
            operation: 'export/url',
            input: 'convert-to-png'
          }
        },
        tag: 'pptx-to-png'
      })
    });

    if (!jobResponse.ok) {
      throw new Error(`CloudConvert job creation failed: ${jobResponse.status}`);
    }

    const job = await jobResponse.json();
    console.log('CloudConvert job created:', job.data.id);

    // Step 2: Upload the PPTX file
    const uploadTask = job.data.tasks.find((task: any) => task.name === 'import-pptx');
    const uploadForm = new FormData();
    
    // Add all form fields from CloudConvert
    if (uploadTask.result.form.parameters) {
      Object.entries(uploadTask.result.form.parameters).forEach(([key, value]) => {
        uploadForm.append(key, value as string);
      });
    }
    
    // Add the file last
    uploadForm.append('file', file);

    const uploadResponse = await fetch(uploadTask.result.form.url, {
      method: 'POST',
      body: uploadForm
    });

    if (!uploadResponse.ok) {
      throw new Error('File upload to CloudConvert failed');
    }

    console.log('File uploaded to CloudConvert');

    // Step 3: Wait for conversion to complete
    let jobStatus = job.data;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (jobStatus.status !== 'finished' && jobStatus.status !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${job.data.id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        jobStatus = statusData.data;
        console.log('Job status:', jobStatus.status);
      }
      
      attempts++;
    }

    if (jobStatus.status === 'error') {
      throw new Error('CloudConvert conversion failed');
    }

    if (jobStatus.status !== 'finished') {
      throw new Error('CloudConvert conversion timed out');
    }

    // Step 4: Get the converted PNG
    const exportTask = jobStatus.tasks.find((task: any) => task.name === 'export-png');
    if (!exportTask || !exportTask.result?.files?.[0]?.url) {
      throw new Error('No PNG file generated');
    }

    const pngUrl = exportTask.result.files[0].url;
    console.log('PNG generated:', pngUrl);

    // Step 5: Download the PNG and upload to Supabase Storage
    const pngResponse = await fetch(pngUrl);
    if (!pngResponse.ok) {
      throw new Error('Failed to download generated PNG');
    }

    const pngBuffer = await pngResponse.arrayBuffer();
    
    // Convert to base64 for immediate display (no CORS issues)
    const base64 = Buffer.from(pngBuffer).toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;
    
    // Log size for monitoring
    console.log('PNG converted, base64 data URL length:', Math.round(dataUrl.length / 1024), 'KB');

    // Step 6: Create slide definition with the image
    const slideJson: SlideDefinition = {
      id: `imported-${Date.now()}`,
      title: `Imported from ${file.name}`,
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
            w: 10,  // Full slide width
            h: 5.625,  // Full slide height (16:9)
          }
        }
      ],
      notes: `Imported PowerPoint slide from ${file.name} using CloudConvert`
    };

    return NextResponse.json({
      success: true,
      slideJson,
      message: 'PPTX converted to PNG successfully'
    });

  } catch (error) {
    console.error('CloudConvert conversion error:', error);
    
    return NextResponse.json({
      error: 'Failed to convert PPTX file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Upload image buffer to Supabase Storage
 */
async function uploadToSupabase(buffer: Buffer, originalFilename: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for server-side storage operations
  );
  
  // Generate unique filename
  const timestamp = Date.now();
  const filename = `imported-slides/${timestamp}-${originalFilename.replace('.pptx', '.png')}`;
  
  console.log('Uploading to Supabase Storage:', filename);
  
  const { data, error } = await supabase.storage
    .from('slide-images')
    .upload(filename, buffer, {
      contentType: 'image/png',
      cacheControl: '3600'
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('slide-images')
    .getPublicUrl(filename);

  console.log('Image uploaded to:', publicUrl);
  return publicUrl;
}