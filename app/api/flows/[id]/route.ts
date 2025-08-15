// app/api/flows/[id]/route.ts
// API routes for individual flow operations

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET /api/flows/[id] - Get a specific flow
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flowId = params.id;

    // Get flow
    const { data: flow, error } = await supabase
      .from('flows')
      .select('*')
      .eq('id', flowId)
      .eq('user_id', user.id) // Ensure user can only access their own flows
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }
      console.error('Error fetching flow:', error);
      return NextResponse.json({ error: 'Failed to fetch flow' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      flow 
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/flows/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/flows/[id] - Update a specific flow
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flowId = params.id;

    // Parse request body
    const updates = await request.json();

    // Remove fields that shouldn't be directly updated
    const {
      id,
      user_id,
      created_at,
      updated_at,
      ...allowedUpdates
    } = updates;

    // Add step timestamp if current_step is being updated
    if (allowedUpdates.current_step) {
      const stepKey = `step_${allowedUpdates.current_step}`;
      allowedUpdates.step_timestamps = {
        ...allowedUpdates.step_timestamps,
        [stepKey]: new Date().toISOString()
      };
    }

    // Update flow
    const { data: flow, error } = await supabase
      .from('flows')
      .update(allowedUpdates)
      .eq('id', flowId)
      .eq('user_id', user.id) // Ensure user can only update their own flows
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }
      console.error('Error updating flow:', error);
      return NextResponse.json({ error: 'Failed to update flow' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      flow 
    });

  } catch (error) {
    console.error('Unexpected error in PATCH /api/flows/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/flows/[id] - Delete a specific flow
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flowId = params.id;

    // Soft delete - mark as archived instead of hard delete
    const { data: flow, error } = await supabase
      .from('flows')
      .update({ 
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', flowId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }
      console.error('Error archiving flow:', error);
      return NextResponse.json({ error: 'Failed to delete flow' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Flow archived successfully',
      flow 
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/flows/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}