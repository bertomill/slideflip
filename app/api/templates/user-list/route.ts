import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// API endpoint to get user's saved templates for theme selection
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ templates: [] }, { status: 200 });
    }

    // Get user's templates from database
    const { data, error } = await supabase
      .from('slide_templates')
      .select('id,name,description,theme,created_at,slide_json')
      .eq('is_active', true)
      .eq('user_id', user.id) // Only user's templates
      .order('created_at', { ascending: false })
      .limit(12); // Limit for theme selection

    if (error) {
      console.error('Error loading user templates:', error);
      return NextResponse.json({ templates: [] }, { status: 200 });
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    console.error('User templates API error:', error);
    return NextResponse.json({ templates: [] }, { status: 500 });
  }
}