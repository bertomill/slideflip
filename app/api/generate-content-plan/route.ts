import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// CONTENT PLANNING API ENDPOINT
// ============================================================================
// This endpoint analyzes all user inputs (documents, description, theme, research)
// and generates a structured content plan that users can review before final
// slide generation. This creates a collaborative workflow where users can
// see and modify what the AI plans to include in their slide.
// ============================================================================

// Initialize OpenAI client for content analysis and planning
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
      documentTypes       // Metadata about uploaded files
    } = await request.json();

    // INPUT VALIDATION: Ensure we have minimum required information
    if (!description) {
      return NextResponse.json(
        { error: 'Description is required for content planning' },
        { status: 400 }
      );
    }

    // API KEY VALIDATION: Verify OpenAI configuration
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // ========================================================================
    // PROMPT CONSTRUCTION: Build comprehensive planning prompt
    // ========================================================================
    
    let prompt = `You are an expert presentation designer creating a detailed content plan for a professional slide. Analyze the provided information and create a structured plan that shows exactly what will appear on the final slide.

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
    if (documentCount > 0) {
      prompt += `DOCUMENT CONTEXT:
- Number of uploaded documents: ${documentCount}
- Document types: ${documentTypes?.map((doc: any) => `${doc.name} (${doc.type})`).join(', ') || 'Various files'}

`;
    }

    // Complete the prompt with detailed planning requirements
    prompt += `CONTENT PLANNING REQUIREMENTS:

Create a detailed, structured content plan that includes:

1. SLIDE TITLE: A compelling, clear title that captures the main message
2. SUBTITLE/KEY MESSAGE: Supporting text that reinforces the main point
3. MAIN CONTENT SECTIONS: 
   - Key bullet points (3-5 maximum for readability)
   - Important statistics or data points to highlight
   - Supporting information that reinforces the message
4. VISUAL ELEMENTS: Describe what visual components will enhance the content
5. CONTENT HIERARCHY: Show how information will be organized and prioritized

PLANNING GUIDELINES:
- Focus on clarity and impact - what are the most important points?
- Consider the ${selectedTheme || 'Professional'} theme in your content suggestions
- Ensure content is appropriate for a single slide (not overwhelming)
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

MAIN CONTENT:
• [Bullet point 1 - most important message]
• [Bullet point 2 - supporting information]
• [Bullet point 3 - additional context]
• [Additional points as needed, max 5 total]

KEY STATISTICS/DATA:
• [Specific number or percentage]: [What it represents]
• [Additional metrics if available from research]

VISUAL ELEMENTS:
• [Description of charts, graphics, or visual emphasis needed]
• [Color scheme and styling notes based on theme]

CONTENT SOURCES:
• User description: [How it's being interpreted]
${hasResearch ? '• Research insights: [Key findings being incorporated]' : ''}
${documentCount > 0 ? '• Document content: [How uploaded files inform the content]' : ''}

Make this plan detailed enough that the user can clearly see what their final slide will contain and make informed decisions about any changes they want.`;

    // ========================================================================
    // AI CONTENT PLANNING: Generate structured plan using OpenAI
    // ========================================================================
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert presentation designer who creates detailed, structured content plans. You analyze user requirements and create comprehensive plans that clearly show what will appear on the final slide. You focus on clarity, impact, and professional presentation standards. You always provide specific, actionable content suggestions rather than vague descriptions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,  // Sufficient for detailed planning
      temperature: 0.7,  // Balanced creativity and consistency
    });

    // RESPONSE EXTRACTION: Get the generated content plan
    const contentPlan = completion.choices[0]?.message?.content;

    if (!contentPlan) {
      throw new Error('No content plan generated by AI');
    }

    // ========================================================================
    // LOG PLANNING EVENT TO SUPABASE
    // ========================================================================
    
    if (flowId) {
      await supabase.from('flow_events').insert({
        flow_id: flowId,
        step: 'content',
        actor: 'ai',
        event_type: 'content_plan_generated',
        payload: {
          contentPlan,
          theme: selectedTheme,
          hasResearch,
          documentCount
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
    
    if (flowId) {
      await supabase.from('flow_events').insert({
        flow_id: flowId,
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