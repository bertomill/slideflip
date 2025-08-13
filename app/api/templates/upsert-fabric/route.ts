import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

// ============================================================================
// TEMPLATE UPSERT API ENDPOINT
// ============================================================================
// This endpoint handles creating and updating slide templates that use Fabric.js
// for rendering. It reads template JSON files from the local filesystem and
// upserts them into the database, maintaining consistency between files and DB.
// ============================================================================

/**
 * API endpoint for upserting (insert or update) slide templates
 * 
 * WORKFLOW: Template Management
 * - Reads template JSON from local files
 * - Validates required fields
 * - Upserts template data to database
 * - Maintains template consistency
 * 
 * @param req - Contains template metadata like id, name, theme etc.
 * @returns JSON response with template data or error details
 */
export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const { id, name, description, theme = 'Professional', aspect_ratio = '16:9', tags = [] } = body as {
      id: string; name: string; description?: string; theme?: string; aspect_ratio?: string; tags?: string[];
    };
    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }

    // Load template JSON from filesystem
    // ID is used as filename in templates/fabric directory
    const jsonPath = path.join(process.cwd(), 'templates', 'fabric', `${id}.json`);
    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ error: 'Template JSON not found' }, { status: 404 });
    }
    const jsonRaw = fs.readFileSync(jsonPath, 'utf8');
    const slideJson = JSON.parse(jsonRaw);

    // Initialize Supabase client for database operations
    const supabase = await createClient();
    
    // Check if template already exists (by name)
    const { data: existing } = await supabase
      .from('slide_templates')
      .select('id')
      .eq('name', name)
      .limit(1)
      .maybeSingle();

    let data;
    let error;
    
    // Update existing template if found
    if (existing?.id) {
      ({ data, error } = await supabase
        .from('slide_templates')
        .update({
          description: description ?? 'Fabric template',
          theme,
          html_content: '',  // Empty since using Fabric.js
          css_scoped: true,
          aspect_ratio,
          tags,
          is_active: true,
          slide_json: slideJson,
        })
        .eq('id', existing.id)
        .select()
        .single());
    } 
    // Insert new template if not found
    else {
      ({ data, error } = await supabase
        .from('slide_templates')
        .insert({
          name,
          description: description ?? 'Fabric template',
          theme,
          html_content: '',  // Empty since using Fabric.js
          css_scoped: true,
          aspect_ratio,
          tags,
          is_active: true,
          slide_json: slideJson,
        })
        .select()
        .single());
    }

    // Handle response
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, template: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
