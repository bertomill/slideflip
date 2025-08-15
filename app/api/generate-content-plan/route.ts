import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// CONTENT PLANNING API ENDPOINT
// ============================================================================
// This endpoint analyzes all user inputs (documents, description, theme, research)
// and generates a structured content plan that users can review before final
// slide generation. This creates a collaborative workflow where users can
// see and modify what the AI plans to include in their slide.
// ============================================================================

// Initialize Anthropic client for content analysis and planning
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * API endpoint for generating structured content plans from user inputs
 * 
 * WORKFLOW POSITION: Between research gathering and slide generation
 * 
 * PURPOSE: Analyzes all available information and creates a detailed plan
 * showing exactly what content will appear in the final slide, allowing
 * users to review and request modifications before committing to generation.
 * 
 * @param request - Contains description, theme, research data, and document info
 * @returns JSON response with structured content plan or error details
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  let flowIdVar: string | undefined;
  
  try {
    // ========================================================================
    // REQUEST PARSING: Extract planning context from request body
    // ========================================================================
    
    const {
      flowId,            // Flow ID for logging
      description,        // User's slide description
      selectedTheme,      // Visual theme choice
      hasResearch,        // Whether research was conducted
      researchData,       // Research insights from Tavily
      documentCount,      // Number of uploaded documents
      documentTypes,       // Metadata about uploaded files
      model: requestedModel
    } = await request.json();

    flowIdVar = flowId;

    // INPUT VALIDATION: Ensure we have minimum required information
    if (!description) {
      return NextResponse.json(
        { error: 'Description is required for content planning' },
        { status: 400 }
      );
    }

    // API KEY VALIDATION: Verify Anthropic configuration
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // ========================================================================
    // PROMPT CONSTRUCTION: Build comprehensive planning prompt
    // ========================================================================
    
    let prompt = `You are an expert powerpoint/google slides/canva presentation designer creating a detailed content plan for a professional slide. Analyze the provided information and create a structured plan that shows exactly what will appear on the final slide.

USER'S SLIDE DESCRIPTION:
${description}

SELECTED THEME: ${selectedTheme || 'Professional'}

`;

    // Add research context if available
    if (hasResearch && researchData) {
      prompt += `RESEARCH DATA TO INCORPORATE:
${researchData}

`;
    }

    // Add document context information
    if (Array.isArray(documentTypes) && documentTypes.length > 0) {
      prompt += `DOCUMENT CONTEXT:
      - Number of uploaded documents: ${documentTypes.length}
      - Document types: ${documentTypes.map((doc: { name: string; type?: string }) => `${doc.name}${doc.type ? ` (${doc.type})` : ''}`).join(', ')}

`;
    }

    // Complete the prompt with detailed planning requirements
    prompt += `CONTENT PLANNING REQUIREMENTS:

Create a detailed, structured content plan that includes:

1. SLIDE TITLE: A compelling, clear title that captures the main message
2. SUBTITLE/KEY MESSAGE: Supporting text that reinforces the main point
3. MAIN CONTENT SECTIONS: 
   - Key points
   - Important statistics or data points
   - Supporting information
4. VISUAL ELEMENTS: Describe what visual components will enhance the content
5. CONTENT HIERARCHY: Show how information will be organized

PLANNING GUIDELINES:
- Consider the ${selectedTheme || 'Professional'} theme in your content suggestions
- Prioritize information that directly supports the user's description
- If research data is available, identify the most relevant insights to include
- Make the plan specific enough that someone could create the slide from it

OUTPUT FORMAT:
Provide a clear, structured plan using this format:

CONTENT PLAN FOR: [Slide Title]

SLIDE STRUCTURE:
• Title: [Specific title text]
• Subtitle: [Supporting message]
• Theme: ${selectedTheme || 'Professional'}

MAIN CONTENT

KEY STATISTICS/DATA

VISUAL ELEMENTS

CONTENT SOURCES:
• User description: [How it's being interpreted]
${hasResearch ? '• Research insights: [Key findings being incorporated]' : ''}
${documentCount > 0 ? '• Document content: [How uploaded files inform the content]' : ''}

Make this plan detailed enough that the user can clearly see what their final slide will contain and make informed decisions about any changes they want.`;

    // ========================================================================
    // AI CONTENT PLANNING: Generate structured plan using Anthropic Claude
    // ========================================================================
    
    const completion = await anthropic.messages.create({
      model: requestedModel || "claude-sonnet-4-20250514",
      max_tokens: 3000,  // Sufficient for detailed planning
      temperature: 0.7,  // Balanced creativity and consistency
      system: "You are an expert powerpoint/google slides/canva presentation designer who creates detailed, structured content plans. You analyze user requirements and create comprehensive plans that clearly show what will appear on the final slide. You focus on clarity, impact, and professional presentation standards. You always provide specific, actionable content suggestions rather than vague descriptions.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    // RESPONSE EXTRACTION: Get the generated content plan
    const contentPlan = completion.content[0]?.text;

    if (!contentPlan) {
      throw new Error('No content plan generated by AI');
    }

    // ========================================================================
    // LOG PLANNING EVENT TO SUPABASE
    // ========================================================================
    
    if (typeof flowIdVar === 'string' && flowIdVar) {
      const sb = await supabase;
      await sb.from('flow_events').insert({
        flow_id: flowIdVar,
        step: 'content',
        actor: 'ai',
        event_type: 'content_plan_generated',
        payload: {
          contentPlan,
          theme: selectedTheme,
          hasResearch,
          documentCount: documentCount || 0
        }
      });
    }

    // ========================================================================
    // SUCCESS RESPONSE: Return structured content plan
    // ========================================================================
    
    return NextResponse.json({
      success: true,
      contentPlan: contentPlan.trim(),
      planningContext: {
        description,
        selectedTheme,
        hasResearch,
        documentCount,
        timestamp: new Date().toISOString()
      },
      message: 'Content plan generated successfully'
    });

  } catch (error) {
    // ========================================================================
    // ERROR HANDLING: Log error to Supabase and return user-friendly response
    // ========================================================================
    
    console.error('Content planning error:', error);
    
    if (typeof flowIdVar === 'string' && flowIdVar) {
      const sb = await supabase;
      await sb.from('flow_events').insert({
        flow_id: flowIdVar,
        step: 'content',
        actor: 'ai',
        event_type: 'content_plan_error',
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
    
    return NextResponse.json(
      {
        error: 'Failed to generate content plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}