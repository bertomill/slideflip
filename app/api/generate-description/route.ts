import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * API endpoint to generate slide descriptions using Anthropic Claude
 * 
 * This endpoint processes uploaded document metadata and generates AI-powered
 * slide descriptions for the Slideo presentation builder. The descriptions
 * are concise, actionable, and include visual element suggestions.
 * 
 * @param request - Contains document metadata in JSON format
 * @returns JSON response with generated description or error message
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize Anthropic client with API key from environment variables
    // Requires ANTHROPIC_API_KEY to be set in .env.local
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Parse request body to extract document information
    // Expected format: { documents: [{ name: string, ... }] }
    const { documents, model: requestedModel } = await request.json();
    
    // Create contextual information about uploaded documents
    // This helps the AI understand what content is available for the slide
    const documentContext = documents?.length > 0 
      ? `Context: User has uploaded ${documents.length} document(s): ${documents.map((doc: any) => doc.name).join(', ')}. `
      : '';

    // Define AI system role and constraints
    // Sets expectations for response format, length, and content type
    const systemMessage = "You are a presentation expert. Generate a concise, professional slide description (under 200 characters) that specifies the type of slide, key content elements, and visual components. Focus on actionable, specific descriptions that would help create effective slides.";
    
    // Construct user prompt with document context
    // Combines document information with specific instructions for slide generation
    const userPrompt = `${documentContext}Generate a slide description for a professional presentation. Make it specific and actionable, mentioning visual elements like charts, bullet points, or graphics where appropriate.`;

    // Make API call to Anthropic's message endpoint
    // Using Claude Haiku for cost-effective, fast responses
    const completion = await anthropic.messages.create({
      model: requestedModel || "claude-3-haiku-20240307",           // Cost-effective model for text generation
      max_tokens: 100,                  // Limit response length for concise descriptions
      temperature: 0.7,                 // Balance creativity with consistency
      system: systemMessage,
      messages: [
        { role: "user", content: userPrompt }
      ],
    });

    // Extract the generated text from Anthropic's response structure
    // Uses optional chaining to safely access nested response properties
    const description = completion.content[0]?.text?.trim();
    
    // Validate that OpenAI returned a valid description
    // Prevents returning empty or null responses to the client
    if (!description) {
      throw new Error('No description generated');
    }

    // Return successful JSON response with the generated slide description
    return NextResponse.json({ description });
    
  } catch (error) {
    // Handle any errors during the Anthropic API call or processing
    // Log detailed error for server debugging while returning user-friendly message
    console.error('Anthropic API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate description. Please check your Anthropic API key configuration.' }, 
      { status: 500 }
    );
  }
}