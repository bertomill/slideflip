import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params as required in Next.js 15
    const { id: templateId } = await params;

    // First check if the template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('slide_templates')
      .select('id')
      .eq('id', templateId)
      .eq('is_active', true)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from('slide_templates')
      .update({ is_active: false })
      .eq('id', templateId);

    if (deleteError) {
      console.error('Error deleting template:', deleteError);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Template deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/templates/[id] - Get a specific template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Await params as required in Next.js 15
    const { id: templateId } = await params;

    // Get the template
    const { data: template, error } = await supabase
      .from('slide_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Template fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}