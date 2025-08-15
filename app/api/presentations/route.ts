import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();

    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Create new presentation - start with minimal required fields
    const insertData: any = {
      user_id: user.id,
      title: title || "Untitled Presentation"
      // Don't set status - let it use table default
    };

    // Add builder fields if they exist
    if (true) { // We'll try to add these
      insertData.current_step = 1;
      insertData.builder_status = "draft";  
      insertData.documents = [];
      insertData.step_timestamps = { step_1: new Date().toISOString() };
    }

    const { data: presentation, error: createError } = await supabase
      .from("presentations")
      .insert(insertData)
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
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's presentations with all builder data (now stored directly in presentations table)
    const { data: presentations, error: fetchError } = await supabase
      .from("presentations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching presentations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch presentations" },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format for the UI
    const items = presentations?.map((presentation: any) => {
      // Determine description based on builder progress
      let description = presentation.description || 'New presentation';
      if (presentation.builder_status === 'completed') {
        description = 'Completed presentation';
      } else if (presentation.current_step > 1) {
        description = `In progress - Step ${presentation.current_step}`;
      }
      
      return {
        id: presentation.id,
        title: presentation.title,
        description: description,
        createdAt: presentation.created_at,
        status: presentation.status,
        slideHtml: presentation.slide_html || null, // HTML from builder step 4
        builderStatus: presentation.builder_status || 'draft',
        currentStep: presentation.current_step || 1,
        hasGeneratedContent: !!(presentation.slide_json || presentation.slide_html)
      };
    }) || [];

    return NextResponse.json({ items });

  } catch (error) {
    console.error("Error in presentations GET API:", error);
    return NextResponse.json(
      { error: "Failed to fetch presentations" },
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

    const supabase = await createClient();

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

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: "Presentation ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Delete presentation (will cascade to related flows and their data)
    const { data: presentation, error: deleteError } = await supabase
      .from("presentations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id) // Ensure user owns this presentation
      .select()
      .single();

    if (deleteError) {
      console.error("Error deleting presentation:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete presentation" },
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
      message: "Presentation deleted successfully"
    });

  } catch (error) {
    console.error("Error in presentations DELETE API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}