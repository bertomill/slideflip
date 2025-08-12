import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// This file handles retrieving PowerPoint/HTML examples from our database
// It's used to show previews of templates in the user interface

// The GET function retrieves up to 24 of the most recently created examples
export async function GET(_req: NextRequest) {
  try {
    // Connect to our database
    const supabase = await createClient();

    // Get examples from the database, ordered by newest first
    // We select specific fields we need: template ID, name, tags, etc.
    // Prefer new slide_templates with Fabric-compatible JSON. Fallback to legacy table if empty.
    const { data: modern, error: modernError } = await supabase
      .from('slide_templates')
      .select('id,name,tags,aspect_ratio,slide_json,description,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(24);

    if (!modernError && modern && modern.length > 0) {
      const examples = modern.map((row) => ({
        id: String(row.id),
        name: (row.name as string) || String(row.id),
        theme: 'Curated',
        description: (row.description as string) || 'Curated Fabric template',
        aspect_ratio: (row.aspect_ratio as string) || '16:9',
        // expose as html empty; we’ll rely on slide_json on the client
        html: '',
        slide_json: row.slide_json ?? null,
        tags: (row.tags as string[]) || [],
      }));
      return NextResponse.json({ examples });
    }

    const { data, error } = await supabase
      .from('pptx_html_examples')
      .select('template_id,name,tags,aspect_ratio,html,notes,created_at')
      .order('created_at', { ascending: false })
      .limit(24);

    // Convert the database rows into a format our frontend can use
    // For each example, we create an object with properties like:
    // - id: unique identifier for the template
    // - name: display name (falls back to template ID if no name given)
    // - theme: always set to 'Curated' for these examples
    // - description: notes about the example or a default description
    // - aspect_ratio: slide dimensions (default 16:9)
    // - html: the actual template content
    // - tags: keywords/categories for the template
    const examples = (data || []).map((row) => ({
      id: row.template_id as string,
      name: (row.name as string) || row.template_id,
      theme: 'Curated',
      description: (row.notes as string) || 'Curated PPTX/HTML example',
      aspect_ratio: (row.aspect_ratio as string) || '16:9',
      html: (row.html as string) || '',
      slide_json: null,
      tags: (row.tags as string[]) || [],
    }));

    // Return the processed examples to the frontend
    return NextResponse.json({ examples });
  } catch (e: any) {
    // If anything goes wrong, return an empty list and the error message
    return NextResponse.json({ examples: [], error: e?.message || 'Unknown error' }, { status: 200 });
  }
}
