import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();

    const supabase = createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Create new presentation
    const { data: presentation, error: createError } = await supabase
      .from("presentations")
      .insert({
        user_id: user.id,
        title: title || "Untitled Presentation",
        status: "draft"
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating presentation:", createError);
      return NextResponse.json(
        { error: "Failed to create presentation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      presentation
    });

  } catch (error) {
    console.error("Error in presentations API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's presentations with latest flow status
    const { data: presentations, error: fetchError } = await supabase
      .from("presentations")
      .select(`
        *,
        flows (
          id,
          status,
          current_step,
          created_at,
          flow_previews (
            slide_html,
            created_at
          )
        )
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching presentations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch presentations" },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const items = presentations?.map(presentation => {
      // Get the latest flow for this presentation
      const latestFlow = presentation.flows?.[0];
      
      // Get the latest preview HTML if available
      const latestPreview = latestFlow?.flow_previews?.[0];
      
      return {
        id: presentation.id,
        title: presentation.title,
        description: presentation.description || (latestFlow?.status === 'completed' ? 'Completed presentation' : 'In progress'),
        createdAt: presentation.created_at,
        status: presentation.status,
        slideHtml: latestPreview?.slide_html || null,
        flowId: latestFlow?.id || null,
        currentStep: latestFlow?.current_step || null
      };
    }) || [];

    return NextResponse.json({ items });

  } catch (error) {
    console.error("Error in presentations GET API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, title, description, status } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Presentation ID is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Update presentation
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;

    const { data: presentation, error: updateError } = await supabase
      .from("presentations")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id) // Ensure user owns this presentation
      .select()
      .single();

    if (updateError) {
      console.error("Error updating presentation:", updateError);
      return NextResponse.json(
        { error: "Failed to update presentation" },
        { status: 500 }
      );
    }

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      presentation
    });

  } catch (error) {
    console.error("Error in presentations PUT API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}