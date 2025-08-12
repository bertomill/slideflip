import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

// Upsert a Fabric/PptxGenJS JSON template into slide_templates.slide_json
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, theme = 'Professional', aspect_ratio = '16:9', tags = [] } = body as {
      id: string; name: string; description?: string; theme?: string; aspect_ratio?: string; tags?: string[];
    };
    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }

    // Treat `id` as the local file key/slug. DB row id remains UUID auto-generated.
    const jsonPath = path.join(process.cwd(), 'templates', 'fabric', `${id}.json`);
    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ error: 'Template JSON not found' }, { status: 404 });
    }
    const jsonRaw = fs.readFileSync(jsonPath, 'utf8');
    const slideJson = JSON.parse(jsonRaw);

    const supabase = await createClient();
    // Use name as unique key for idempotent upserts (see migration adding unique index on name)
    const { data, error } = await supabase
      .from('slide_templates')
      .upsert(
        {
          // do not send UUID id, let DB generate/keep existing
          name,
          description: description ?? 'Fabric template',
          theme,
          html_content: '',
          css_scoped: true,
          aspect_ratio,
          tags,
          is_active: true,
          slide_json: slideJson,
        },
        { onConflict: 'name' },
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, template: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}


