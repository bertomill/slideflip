import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

// Upsert a curated PPTX/HTML example into Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, name, tags, notes } = body as { templateId: string; name: string; tags?: string[]; notes?: string };

    if (!templateId || !name) {
      return NextResponse.json({ error: 'templateId and name are required' }, { status: 400 });
    }

    // Load local HTML and schema for the given template id
    const htmlPath = path.join(process.cwd(), 'templates', `${templateId}.html`);
    const schemaPath = path.join(process.cwd(), 'templates', 'powerpoint', `${templateId}.json`);
    if (!fs.existsSync(htmlPath) || !fs.existsSync(schemaPath)) {
      return NextResponse.json({ error: 'Local template files not found' }, { status: 404 });
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
    const schemaJson = JSON.parse(schemaRaw);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pptx_html_examples')
      .upsert({
        template_id: templateId,
        name,
        tags: tags ?? [],
        html,
        schema_json: schemaJson,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, example: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

