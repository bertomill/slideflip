import { NextRequest, NextResponse } from 'next/server';
import { logEvent, saveContentPlan } from '@/lib/flow-logging';

// ============================================================================
// CONTENT PLANNING API ENDPOINT
// ============================================================================
// This endpoint generates a structured content plan that acts as a bridge
// between user input and AI slide generation. It creates a collaborative
// planning document that users can review and modify before final slide creation.
// ============================================================================

/**
 * Content Planning API Route Handler
 * 
 * Creates a detailed, structured content plan based on user inputs including:
 * - User's slide description and requirements
 * - Selected visual theme preferences
 * - Available research data from external sources
 * - Uploaded document context and count
 * 
 * The generated plan serves as a preview and allows users to provide feedback
 * before the final AI slide generation step.
 * 
 * @param request - Contains description, selectedTheme, hasResearch, researchData, documentCount
 * @returns JSON response with formatted content plan or error details
 */
export async function POST(request: NextRequest) {
    try {
        // REQUEST PARSING: Extract all planning parameters from request body
        // These inputs come from the slide builder workflow and determine plan structure
        const body = await request.json();
        const { description, selectedTheme, hasResearch, researchData, documentCount, flow_id } = body;
        // Log request event (optional)
        await logEvent({
            flowId: flow_id,
            step: 'content',
            actor: 'user',
            eventType: 'plan_requested',
            payload: { description, selectedTheme, hasResearch, documentCount }
        });

        // INPUT VALIDATION: Ensure minimum required data is present
        // Description is essential as it forms the foundation of the content plan
        if (!description) {
            return NextResponse.json(
                { success: false, error: 'Description is required for content planning' },
                { status: 400 }
            );
        }

        // CONTENT PLAN INITIALIZATION: Start building the structured plan document
        // This creates a comprehensive overview that users can review and modify
        let contentPlan = `Based on your description: "${description}"\n\n`;

        // SECTION 1: SLIDE OBJECTIVE
        // Clearly articulate what the slide aims to accomplish based on user input
        contentPlan += `🎯 **Slide Objective:**\n`;
        contentPlan += `I understand you want to create a slide that ${description.toLowerCase()}. `;
        contentPlan += `I'll structure this to be clear, engaging, and professional.\n\n`;

        // SECTION 2: CONTENT STRUCTURE OVERVIEW
        // Provide a high-level outline of how the slide will be organized
        contentPlan += `📋 **Planned Content Structure:**\n\n`;

        // SUBSECTION 2A: TITLE AND OPENING ELEMENTS
        // Define how the slide will capture attention and set context
        contentPlan += `**1. Title & Opening**\n`;
        contentPlan += `• Compelling headline derived from your description\n`;
        contentPlan += `• Brief context-setting subtitle if needed\n\n`;

        // SUBSECTION 2B: CORE CONTENT STRATEGY
        // Adapt content approach based on whether user uploaded documents
        contentPlan += `**2. Core Content**\n`;
        if (documentCount > 0) {
            // DOCUMENT-BASED CONTENT: When user has uploaded files for reference
            // Focus on extracting and organizing insights from their materials
            contentPlan += `• Key insights extracted from your ${documentCount} uploaded document${documentCount > 1 ? 's' : ''}\n`;
            contentPlan += `• Main points organized in logical flow\n`;
            contentPlan += `• Supporting details and examples from your materials\n`;
        } else {
            // DESCRIPTION-BASED CONTENT: When working primarily from user description
            // Create structured content based on their written requirements
            contentPlan += `• Main points based on your description\n`;
            contentPlan += `• Logical structure and flow\n`;
            contentPlan += `• Clear, actionable content\n`;
        }

        // SECTION 3: RESEARCH INTEGRATION (CONDITIONAL)
        // Only include this section if user requested research and data is available
        if (hasResearch && researchData) {
            contentPlan += `\n🔍 **Research Enhancement:**\n`;
            contentPlan += `• Industry trends and current data\n`;
            contentPlan += `• Supporting statistics and benchmarks\n`;
            contentPlan += `• Best practices and expert insights\n`;
            contentPlan += `• Credible sources and references\n`;
        }

        // SECTION 4: VISUAL DESIGN APPROACH
        // Outline how the selected theme will be applied to the slide
        contentPlan += `\n🎨 **Visual Design:**\n`;
        contentPlan += `• ${selectedTheme || 'Professional'} theme styling\n`;
        contentPlan += `• Clean, readable typography\n`;
        contentPlan += `• Balanced layout with proper hierarchy\n`;
        contentPlan += `• Strategic use of colors and spacing\n`;

        // SECTION 5: CONTENT ORGANIZATION PRINCIPLES
        // Explain how information will be structured for maximum impact
        contentPlan += `\n📊 **Content Organization:**\n`;
        contentPlan += `• Bullet points for easy scanning\n`;
        contentPlan += `• Logical information hierarchy\n`;
        contentPlan += `• Appropriate content density\n`;
        contentPlan += `• Clear call-to-action or conclusion\n\n`;

        // SECTION 6: USER FEEDBACK SOLICITATION
        // Encourage user input to refine the plan before slide generation
        contentPlan += `❓ **Your Input Needed:**\n`;
        contentPlan += `Is there anything specific you'd like me to:\n`;
        contentPlan += `• Add (specific data, examples, or sections)\n`;
        contentPlan += `• Emphasize (particular points or themes)\n`;
        contentPlan += `• Remove or de-emphasize\n`;
        contentPlan += `• Modify in terms of tone or approach\n\n`;

        // CLOSING SUMMARY: Reinforce the plan's alignment with user preferences
        contentPlan += `The slide will be optimized for ${selectedTheme || 'professional'} presentation style and designed to effectively communicate your message.`;

        // Persist the plan artifact if flow_id provided
        await saveContentPlan({
            flowId: flow_id,
            planningContext: { description, selectedTheme, hasResearch, researchData, documentCount },
            aiPlan: contentPlan,
            finalPlan: contentPlan
        });

        await logEvent({
            flowId: flow_id,
            step: 'content',
            actor: 'ai',
            eventType: 'plan_generated',
            payload: { length: contentPlan.length }
        });

        // SUCCESS RESPONSE: Return the completed content plan to the client
        return NextResponse.json({
            success: true,
            contentPlan: contentPlan
        });

    } catch (error) {
        // ERROR HANDLING: Log detailed error information and return user-friendly response
        console.error('Content planning error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to generate content plan' },
            { status: 500 }
        );
    }
}