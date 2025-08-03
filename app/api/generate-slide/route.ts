import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * API endpoint for generating professional presentation slides using OpenAI GPT-4
 * Accepts user description, theme preferences, research data, and document context
 * Returns complete HTML slide content ready for presentation display
 */
export async function POST(request: NextRequest) {
  try {
    // Extract slide generation parameters from request body
    // - description: User's description of what the slide should contain
    // - theme: Visual theme preference (Professional, Modern, etc.)
    // - researchData: Optional research insights to incorporate
    // - documents: Optional uploaded files for additional context
    const { description, theme, researchData, documents } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build the prompt based on available data
    let prompt = `Create a professional PowerPoint slide in HTML format based on the following requirements:

SLIDE DESCRIPTION: ${description}

THEME: ${theme || 'Professional'}

`;

    // Add research data if available
    if (researchData) {
      prompt += `RESEARCH DATA TO INCORPORATE:
${researchData}

`;
    }

    // Add document context if available
    if (documents && documents.length > 0) {
      prompt += `DOCUMENT CONTEXT: User has uploaded ${documents.length} document(s) for reference.

`;
    }

    prompt += `REQUIREMENTS:
1. Create a complete HTML slide that looks professional and presentation-ready
2. Use modern CSS styling with the ${theme || 'Professional'} theme
3. Incorporate the research data naturally into the slide content
4. Make it visually appealing with proper typography, spacing, and layout
5. Include relevant data points, statistics, or insights from the research
6. Use a clean, readable design suitable for presentations
7. Ensure the slide is self-contained with inline CSS
8. Make it responsive and well-structured

OUTPUT FORMAT:
Return only the complete HTML code for the slide, starting with <!DOCTYPE html> and including all necessary CSS styling inline. The slide should be ready to display in a browser or presentation software.

STYLE GUIDELINES:
- Use professional fonts (Arial, Helvetica, or similar)
- CRITICAL: Ensure high contrast text - use dark text (#333333 or darker) on light backgrounds, never light grey text
- Main headings should be #1a1a1a or #000000 for maximum readability
- Body text should be #333333 minimum, never lighter than #555555
- Background colors should provide strong contrast with text
- Include appropriate margins, padding, and spacing
- Use bullet points, headings, and visual hierarchy effectively
- Incorporate any statistics or data points from the research prominently
- Make the layout clean and uncluttered
- Test color combinations for WCAG accessibility standards`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert presentation designer who creates professional, visually appealing PowerPoint slides with excellent accessibility and readability. You NEVER use light grey text on light backgrounds and always ensure high contrast ratios. You specialize in incorporating research data and creating clean, modern slide layouts with proper typography contrast."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    let slideHtml = completion.choices[0]?.message?.content;

    if (!slideHtml) {
      throw new Error('No slide content generated');
    }

    // Clean up the response - extract HTML content from markdown if needed
    if (slideHtml.includes('```html')) {
      const htmlMatch = slideHtml.match(/```html\n([\s\S]*?)\n```/);
      if (htmlMatch) {
        slideHtml = htmlMatch[1];
      }
    } else if (slideHtml.includes('```')) {
      const codeMatch = slideHtml.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
      if (codeMatch) {
        slideHtml = codeMatch[1];
      }
    }

    return NextResponse.json({
      success: true,
      slideHtml: slideHtml.trim(),
      message: 'Slide generated successfully'
    });

  } catch (error) {
    console.error('Slide generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate slide', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}