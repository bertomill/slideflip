import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getTemplatesForAI } from '@/lib/local-templates';
import { logEvent, savePreview } from '@/lib/flow-logging';

// ============================================================================
// OPENAI CLIENT INITIALIZATION
// ============================================================================
// Initialize OpenAI client with API key from environment variables
// This client will be used to generate professional presentation slides using GPT-4
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * API endpoint for generating professional presentation slides using OpenAI GPT-4
 * 
 * This endpoint takes user inputs (description, theme, research data, documents) and
 * generates a complete HTML slide with scoped CSS that can be safely embedded in
 * the preview component without affecting the parent page styling.
 * 
 * Key features:
 * - CSS scoping to prevent style conflicts
 * - Accessibility-compliant high contrast text
 * - Research data integration
 * - Professional theme application
 * - Embeddable HTML output format
 * 
 * @param request - Contains description, theme, researchData, and documents
 * @returns JSON response with generated slideHtml or error details
 */
export async function POST(request: NextRequest) {
  // Hoisted so we can log in catch
  let flow_id: string | undefined;
  let description: string | undefined;
  let theme: string | undefined;
  try {
    // Extract slide generation parameters from request body
    // - description: User's description of what the slide should contain
    // - theme: Visual theme preference (Professional, Modern, etc.)
    // - researchData: Optional research insights to incorporate
    // - contentPlan: AI-generated content plan from content planning step
    // - userFeedback: User's additional requirements and modifications
    // - documents: Optional uploaded files for additional context
    const parsed = await request.json();
    description = parsed.description;
    theme = parsed.theme;
    const researchData = parsed.researchData;
    const contentPlan = parsed.contentPlan;
    const userFeedback = parsed.userFeedback;
    const documents = parsed.documents;
    flow_id = parsed.flow_id;
    // Flow logging to Supabase:
    // - Record request intent in `flow_events`
    await logEvent({
      flowId: flow_id,
      step: 'preview',
      actor: 'user',
      eventType: 'slide_generation_requested',
      payload: { hasPlan: !!contentPlan, hasResearch: !!researchData }
    });

    // Validate required parameters - description is mandatory for slide generation
    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Verify OpenAI API key is configured in environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // PROMPT CONSTRUCTION: Build the comprehensive prompt for OpenAI based on available data
    // This prompt engineering approach ensures consistent, high-quality slide generation
    // by providing clear requirements, examples, and constraints to the AI model
    let prompt = `Create a professional PowerPoint slide in HTML format based on the following requirements:

SLIDE DESCRIPTION: ${description}

THEME: ${theme || 'Professional'}

`;

    // Add content plan from content planning step if available
    // This provides structured guidance for what should be included on the slide
    if (contentPlan) {
      prompt += `CONTENT PLAN:
${contentPlan}

`;
    }

    // Add user feedback and additional requirements if provided
    // This allows for iterative improvements and specific user requests
    if (userFeedback) {
      prompt += `USER FEEDBACK & ADDITIONAL REQUIREMENTS:
${userFeedback}

`;
    }

    // Append research data to prompt if provided by user
    // This allows AI to incorporate relevant insights and statistics
    if (researchData) {
      prompt += `RESEARCH DATA TO INCORPORATE:
${researchData}

`;
    }

    // Add parsed document content if available
    // This provides the actual content from uploaded documents for AI to use
    if (documents && documents.length > 0) {
      prompt += `DOCUMENT CONTENT:\n`;

      // If we have parsed document content, include the actual text
      if (Array.isArray(documents) && documents[0] && typeof documents[0] === 'object' && 'content' in documents[0]) {
        // documents contains parsed content
        type ParsedDoc = { filename: string; success?: boolean; content?: string };
        (documents as ParsedDoc[]).forEach((doc, index: number) => {
          if (doc.success && doc.content) {
            prompt += `Document ${index + 1} (${doc.filename}):\n${doc.content}\n\n`;
          } else {
            prompt += `Document ${index + 1} (${doc.filename}): [Content extraction failed]\n\n`;
          }
        });
      } else {
        // Fallback: just mention document count if no parsed content available
        prompt += `User has uploaded ${documents.length} document(s) for reference.\n\n`;
      }
    }

    // TEMPLATE EXAMPLES: Fetch example templates (Supabase first, local fallback) to show OpenAI what good slides look like
    // This significantly improves the quality and consistency of generated slides by providing concrete examples
    // of proper CSS scoping, 16:9 aspect ratio optimization, and professional styling patterns
    const templatesContent = await getTemplatesForAI(theme, 2);

    if (templatesContent.trim()) {
      prompt += `EXAMPLE TEMPLATES TO FOLLOW:
Here are examples of well-designed slides that you should use as inspiration for structure, styling, and layout:

${templatesContent}

Please create a slide that follows similar structural patterns, CSS scoping practices, and professional styling as shown in the examples above.

`;
    }

    // SLIDE GENERATION REQUIREMENTS: Complete the prompt with detailed requirements and style guidelines
    // This section emphasizes accessibility, readability, and professional appearance
    // Key focus areas: CSS scoping, accessibility compliance, and embeddable HTML output
    prompt += `REQUIREMENTS:
1. Create a complete HTML slide that looks professional and presentation-ready
2. Use modern CSS styling with the ${theme || 'Professional'} theme
3. Incorporate the research data naturally into the slide content
4. Make it visually appealing with proper typography, spacing, and layout
5. Include relevant data points, statistics, or insights from the research
6. Use a clean, readable design suitable for presentations
7. Ensure the slide is self-contained with scoped CSS that won't affect parent elements
8. Make it responsive and well-structured
9. CRITICAL: Design for 16:9 aspect ratio (PowerPoint slide dimensions) - the slide will be displayed in a container with 16:9 proportions

ASPECT RATIO REQUIREMENTS:
// ============================================================================
// 16:9 ASPECT RATIO OPTIMIZATION: Critical design constraints for slide display
// ============================================================================
// The generated slide must work perfectly within a 16:9 aspect ratio container
// This ensures consistency between web preview and PowerPoint export formats
- Design the slide content to work optimally in a 16:9 aspect ratio container
- This matches standard PowerPoint slide dimensions (1920x1080, 1280x720, etc.)
- Content should be well-proportioned and not cramped when displayed in this format
- Use appropriate font sizes and spacing that work well in the 16:9 format
- Consider that the slide will be viewed at various sizes but always maintain 16:9 proportions

OUTPUT FORMAT:
Return a complete, self-contained HTML slide that can be embedded safely. You can choose either:
1. A complete HTML document with scoped CSS in the <head> (recommended for complex layouts)
2. A single container div with inline <style> tag containing scoped CSS (simpler embedding)

CRITICAL CSS SCOPING REQUIREMENTS:
- ALL CSS must be scoped to prevent affecting the parent page
- If using a complete HTML document, scope all styles to a main container class
- If using a div container, scope all styles to that container class
- NEVER use global selectors like body, html, *, or unscoped element selectors
- Example: Use ".slide-container h1" instead of just "h1"
- Example: Use ".slide-container .title" instead of just ".title"

STYLE GUIDELINES:
- Use professional fonts (Arial, Helvetica, or similar)
- CRITICAL: Ensure high contrast text - use dark text (#333333 or darker) on light backgrounds, never light grey text
- Main headings should be #1a1a1a or #000000 for maximum readability
- Body text should be #333333 minimum, never lighter than #555555
- Background colors should provide strong contrast with text
- Include appropriate margins, padding, and spacing optimized for 16:9 viewing
- Use bullet points, headings, and visual hierarchy effectively
- Incorporate any statistics or data points from the research prominently
- Make the layout clean and uncluttered, suitable for 16:9 presentation format
- Test color combinations for WCAG accessibility standards

PREFERRED STRUCTURE (Option 1 - Complete HTML):
<!DOCTYPE html>
<html>
<head>
<style>
.slide-main { 
  width: 100%; 
  height: 100%; 
  background: white; 
  padding: 40px; 
  box-sizing: border-box; 
  font-family: Arial, sans-serif;
  display: flex;                    /* Enable flexbox layout for vertical centering */
  flex-direction: column;           /* Stack content vertically */
  justify-content: center;          /* Center content vertically in 16:9 container */
}
.slide-main h1 { color: #1a1a1a; font-size: 2.5rem; margin-bottom: 1rem; }
.slide-main p { color: #333333; font-size: 1.1rem; line-height: 1.6; }
</style>
</head>
<body>
<div class="slide-main">
  <!-- Your slide content here -->
</div>
</body>
</html>

ALTERNATIVE STRUCTURE (Option 2 - Container div):
<div class="slide-container" style="width: 100%; height: 100%; background: white; padding: 40px; box-sizing: border-box; font-family: Arial, sans-serif; display: flex; flex-direction: column; justify-content: center;">
  <style>
    .slide-container h1 { color: #1a1a1a; font-size: 2.5rem; margin-bottom: 1rem; }
    .slide-container p { color: #333333; font-size: 1.1rem; line-height: 1.6; }
  </style>
  <!-- Your slide content here -->
</div>`;

    // Make API call to OpenAI GPT-4 for slide generation
    // Using specific model, temperature, and token limits for optimal results
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          // System prompt that defines the AI's role and critical constraints
          // Emphasizes CSS scoping, accessibility, and professional design standards
          content: "You are an expert presentation designer who creates professional, visually appealing PowerPoint slides with excellent accessibility and readability. You NEVER use light grey text on light backgrounds and always ensure high contrast ratios. You ALWAYS create complete, working HTML slides that render properly when embedded. You ALWAYS scope ALL CSS to prevent affecting parent page styles. You specialize in incorporating research data and creating clean, modern slide layouts with proper typography contrast. You return valid HTML that displays immediately without errors."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000, // Sufficient tokens for complete HTML slide generation
      temperature: 0.7, // Balanced creativity while maintaining consistency
    });

    // Extract the generated slide HTML content from OpenAI response
    let slideHtml = completion.choices[0]?.message?.content;

    // Validate that content was actually generated
    if (!slideHtml) {
      throw new Error('No slide content generated');
    }

    // Clean up the response by extracting HTML from markdown code blocks
    // OpenAI sometimes wraps HTML in markdown formatting that needs removal
    if (slideHtml.includes('```html')) {
      // Extract content from HTML-specific code blocks
      const htmlMatch = slideHtml.match(/```html\n([\s\S]*?)\n```/);
      if (htmlMatch) {
        slideHtml = htmlMatch[1];
      }
    } else if (slideHtml.includes('```')) {
      // Extract content from generic code blocks
      const codeMatch = slideHtml.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
      if (codeMatch) {
        slideHtml = codeMatch[1];
      }
    }

    // RESPONSE VALIDATION: Debug logging to monitor OpenAI output quality and format
    // These logs help troubleshoot issues with slide generation and ensure we receive valid HTML
    console.log('Generated slide HTML length:', slideHtml.length);
    console.log('Generated slide HTML preview:', slideHtml.substring(0, 200) + '...');

    // CONTENT VALIDATION: Verify that OpenAI returned actual HTML markup
    // Check for common HTML elements to ensure the response contains valid slide content
    // This helps catch cases where OpenAI might return plain text or malformed responses
    if (!slideHtml.includes('<div') && !slideHtml.includes('<html')) {
      console.log('Warning: Generated content may not be valid HTML');
    }

    // Persist preview artifact to `flow_previews` and log completion event
    await savePreview({ flowId: flow_id, requestPayload: { description, theme, hasPlan: !!contentPlan, hasResearch: !!researchData }, model: 'gpt-4', slideHtml, success: true });
    await logEvent({ flowId: flow_id, step: 'preview', actor: 'ai', eventType: 'slide_generated', payload: { length: slideHtml.length } });

    // Return successful response with generated slide HTML
    return NextResponse.json({
      success: true,
      slideHtml: slideHtml.trim(), // Remove any leading/trailing whitespace
      message: 'Slide generated successfully'
    });

  } catch (error) {
    // Log error details for debugging and monitoring
    console.error('Slide generation error:', error);

    // Persist failure in `flow_previews` and log failure event
    await savePreview({ flowId: flow_id, requestPayload: {}, model: 'gpt-4', slideHtml: null, success: false });
    await logEvent({ flowId: flow_id, step: 'preview', actor: 'system', eventType: 'slide_generation_failed', payload: { message: error instanceof Error ? error.message : 'unknown' } });

    // Return user-friendly error response with details for troubleshooting
    return NextResponse.json(
      {
        error: 'Failed to generate slide',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}