import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// CONTENT PLAN REFINEMENT API ENDPOINT
// ============================================================================
// This endpoint takes an existing content plan and user feedback to create
// an improved version that better matches user expectations. This enables
// iterative refinement of slide content before final generation.
// ============================================================================

// Initialize Anthropic client for plan refinement
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * API endpoint for refining content plans based on user feedback
 * 
 * PURPOSE: Allows users to iteratively improve their content plan by providing
 * specific feedback about what they want changed, added, or removed. This
 * creates a collaborative refinement process between AI and user.
 * 
 * @param request - Contains current plan, user feedback, and original context
 * @returns JSON response with refined content plan or error details
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // REQUEST PARSING: Extract refinement parameters
    // ========================================================================
    
    const {
      currentPlan,      // The existing content plan to be refined
      userFeedback,     // User's specific feedback and requested changes
      originalContext,   // Original slide data for context preservation
      model: requestedModel
    } = await request.json();

    // INPUT VALIDATION: Ensure we have required information for refinement
    if (!currentPlan || !userFeedback) {
      return NextResponse.json(
        { error: 'Current plan and user feedback are required' },
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
    // REFINEMENT PROMPT: Build prompt for plan improvement
    // ========================================================================
    
    const prompt = `You are refining a content plan for a presentation slide based on user feedback. Your goal is to improve the existing plan while maintaining its structure and incorporating the user's specific requests.

CURRENT CONTENT PLAN:
${currentPlan}

USER FEEDBACK AND REQUESTED CHANGES:
${userFeedback}

ORIGINAL CONTEXT:
- Description: ${originalContext?.description || 'Not provided'}
- Theme: ${originalContext?.selectedTheme || 'Professional'}
- Has Research: ${originalContext?.wantsResearch ? 'Yes' : 'No'}

REFINEMENT INSTRUCTIONS:

1. ANALYZE the user's feedback carefully to understand what they want changed
2. PRESERVE the overall structure and format of the original plan
3. INCORPORATE the requested changes while maintaining slide effectiveness
4. ENSURE the refined plan is still appropriate for a single slide
5. MAINTAIN professional presentation standards
6. KEEP the same content plan format for consistency

SPECIFIC REFINEMENT GUIDELINES:
- If user wants content added: Integrate it naturally into existing structure
- If user wants content removed: Remove while maintaining flow and coherence
- If user wants tone changes: Adjust language while keeping key information
- If user wants emphasis changes: Reorganize hierarchy and importance
- If user wants visual changes: Update the visual elements section accordingly

OUTPUT REQUIREMENTS:
- Use the same structured format as the original plan
- Make changes that directly address the user's feedback
- Ensure the refined plan is clear, actionable, and slide-appropriate
- Maintain the professional quality and completeness of the original

Provide the refined content plan that incorporates the user's feedback while maintaining the structure and effectiveness of the original plan.`;

    // ========================================================================
    // AI PLAN REFINEMENT: Generate improved plan using Anthropic Claude
    // ========================================================================
    
    const completion = await anthropic.messages.create({
      model: requestedModel || "claude-sonnet-4-20250514",
      max_tokens: 1500,  // Sufficient for refined planning
      temperature: 0.6,  // Slightly lower temperature for more focused refinement
      system: "You are an expert presentation designer who specializes in refining content plans based on user feedback. You maintain the structure and quality of existing plans while incorporating specific user requests. You ensure that all changes improve the plan while keeping it practical for slide creation.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    // RESPONSE EXTRACTION: Get the refined content plan
    const refinedPlan = completion.content[0]?.text;

    if (!refinedPlan) {
      throw new Error('No refined plan generated by AI');
    }

    // ========================================================================
    // SUCCESS RESPONSE: Return refined content plan
    // ========================================================================
    
    return NextResponse.json({
      success: true,
      refinedPlan: refinedPlan.trim(),
      userFeedback: userFeedback,
      refinementContext: {
        originalPlanLength: currentPlan.length,
        refinedPlanLength: refinedPlan.length,
        feedbackApplied: userFeedback,
        timestamp: new Date().toISOString()
      },
      message: 'Content plan refined successfully'
    });

  } catch (error) {
    // ========================================================================
    // ERROR HANDLING: Log and return user-friendly error
    // ========================================================================
    
    console.error('Plan refinement error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to refine content plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}