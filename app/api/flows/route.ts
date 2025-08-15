// app/api/flows/route.ts
// API routes for flows CRUD operations

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET /api/flows - Get all flows for the current user
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('flows')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status && ['draft', 'in_progress', 'completed', 'archived'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: flows, error } = await query;

    if (error) {
      console.error('Error fetching flows:', error);
      return NextResponse.json({ error: 'Failed to fetch flows' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      flows: flows || [],
      total: flows?.length || 0
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/flows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/flows - Create a new flow
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      description,
      documents,
      parsed_documents,
      selected_model,
      title
    } = body;

    // Validate required fields
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    // Prepare flow data
    const flowData = {
      user_id: user.id,
      title: title || null,
      description,
      status: 'draft',
      current_step: 1,
      
      // Step 1 data
      documents: Array.isArray(documents) ? documents : [],
      parsed_documents: Array.isArray(parsed_documents) ? parsed_documents : [],
      selected_model: selected_model || 'gpt-4',
      
      // Initialize defaults
      wants_research: false,
      research_options: {
        maxResults: 4,
        includeImages: true,
        includeAnswer: 'advanced',
        timeRange: 'month',
        excludeSocial: true
      },
      selected_palette: [],
      theme_customizations: {},
      generation_metadata: {},
      download_history: [],
      share_links: [],
      step_timestamps: { step_1: new Date().toISOString() },
      error_logs: [],
      total_generation_time: 0,
      api_calls_made: {
        content_planning: 0,
        research: 0,
        slide_generation: 0,
        color_generation: 0
      }
    };

    // Insert flow
    const { data: flow, error } = await supabase
      .from('flows')
      .insert(flowData)
      .select()
      .single();

    if (error) {
      console.error('Error creating flow:', error);
      return NextResponse.json({ error: 'Failed to create flow' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      flow 
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/flows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}