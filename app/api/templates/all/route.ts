import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// API endpoint to get all templates (both fabric and user templates) for homepage display
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get all active templates from database (both fabric and user templates)
    const { data, error } = await supabase
      .from('slide_templates')
      .select('id,name,description,theme,created_at,slide_json,html_content')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12); // Limit for homepage display

    if (error) {
      console.error('Error loading templates:', error);
      return NextResponse.json({ templates: [] }, { status: 200 });
    }

    // Format templates for frontend consumption
    const formattedTemplates = (data || []).map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      theme: template.theme,
      html: template.html_content || '', // Use html_content as html for consistency
      slide_json: template.slide_json,
    }));

    return NextResponse.json({ templates: formattedTemplates });
  } catch (error) {
    console.error('Templates API error:', error);
    return NextResponse.json({ templates: [] }, { status: 500 });
  }
}