import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    console.log('🚀 Starting fabric template import...');
    
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // Path to fabric templates
    const templatesDir = path.join(process.cwd(), 'templates', 'fabric');
    
    // Check if directory exists
    if (!fs.existsSync(templatesDir)) {
      return NextResponse.json({ 
        error: 'Templates directory not found',
        path: templatesDir 
      }, { status: 404 });
    }
    
    // Read all JSON files from the fabric templates directory
    const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
    console.log(`📁 Found ${files.length} template files: ${files.join(', ')}`);

    const templates = [];

    // Process each template file
    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Convert fabric template to slide_templates format
      const template = {
        name: templateData.title || templateData.id,
        description: templateData.notes || `Template: ${templateData.title || templateData.id}`,
        theme: 'Fabric',
        html_content: '', // We'll generate HTML from the fabric JSON later
        slide_json: templateData, // Store the original fabric JSON
        is_active: true,
      };

      templates.push(template);
      console.log(`✅ Processed template: ${template.name}`);
    }

    // Check if templates already exist to avoid duplicates
    const existingTemplates = await supabase
      .from('slide_templates')
      .select('name')
      .eq('theme', 'Fabric');

    const existingNames = new Set(existingTemplates.data?.map(t => t.name) || []);
    const newTemplates = templates.filter(t => !existingNames.has(t.name));

    if (newTemplates.length === 0) {
      return NextResponse.json({ 
        message: 'All fabric templates already exist in the database',
        existing: templates.length,
        imported: 0
      });
    }

    // Insert new templates into the database
    console.log(`💾 Inserting ${newTemplates.length} new templates into the database...`);
    
    const { data, error } = await supabase
      .from('slide_templates')
      .insert(newTemplates)
      .select();

    if (error) {
      console.error('❌ Error inserting templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`🎉 Successfully imported ${data.length} templates!`);
    
    return NextResponse.json({
      message: `Successfully imported ${data.length} fabric templates`,
      imported: data.length,
      existing: templates.length - newTemplates.length,
      templates: data.map(t => ({ id: t.id, name: t.name }))
    });

  } catch (error) {
    console.error('❌ Import failed:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Import failed'
    }, { status: 500 });
  }
}