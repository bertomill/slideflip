import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// This file handles retrieving Fabric.js JSON templates from the local filesystem
// It loads templates directly from /templates/fabric/ directory

export async function GET(_req: NextRequest) {
  try {
    const templatesDir = join(process.cwd(), 'templates', 'fabric');
    
    // Define the templates we want to load
    const templateFiles = [
      'professional-gradient-01.json',
      'hero-title-01.json', 
      'three-column-kpis-01.json'
    ];

    const examples = [];

    // Load each template file
    for (const filename of templateFiles) {
      try {
        const filePath = join(templatesDir, filename);
        const fileContent = await readFile(filePath, 'utf8');
        const slideJson = JSON.parse(fileContent);

        // Create example object from the JSON template
        examples.push({
          id: slideJson.id,
          name: slideJson.title || slideJson.id,
          theme: 'Curated',
          description: slideJson.notes || 'Fabric JSON template',
          aspect_ratio: '16:9',
          html: '', // No HTML fallback needed
          slide_json: slideJson,
          tags: [], // Could be extracted from filename or added to JSON
        });
      } catch (fileError) {
        console.error(`Error loading template ${filename}:`, fileError);
        // Continue loading other templates if one fails
      }
    }

    return NextResponse.json({ examples });
  } catch (error) {
    console.error('Error loading fabric templates:', error);
    return NextResponse.json({ 
      examples: [], 
      error: 'Failed to load templates' 
    }, { status: 500 });
  }
}
