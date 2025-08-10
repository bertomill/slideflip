import { NextRequest, NextResponse } from 'next/server';
import { getLocalTemplatesWithContent } from '@/lib/local-templates';
import { loadSchemaById, renderHtmlPreview } from '@/lib/pptx-templates/schema';

// Returns a small list of local code templates (with HTML) for live preview in the UI
export async function GET(_request: NextRequest) {
  try {
    const templates = getLocalTemplatesWithContent(undefined, 6).map(t => ({
      id: t.id,
      name: t.name,
      theme: t.theme,
      description: t.description,
      aspect_ratio: t.aspect_ratio,
      html: t.html_content ?? ''
    }));

    // Include our schema-driven basic template with live HTML preview
    const basic = loadSchemaById('basic-01');
    if (basic) {
      // Remove any duplicate entry by id before inserting
      const existingIdx = templates.findIndex(t => t.id === basic.id);
      if (existingIdx !== -1) templates.splice(existingIdx, 1);
      templates.unshift({
        id: basic.id,
        name: basic.name,
        theme: basic.category,
        description: basic.description,
        aspect_ratio: '16:9',
        html: renderHtmlPreview(basic),
      });
    }

    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json({ templates: [] }, { status: 200 });
  }
}

