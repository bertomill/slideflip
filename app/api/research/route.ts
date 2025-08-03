import { NextRequest, NextResponse } from 'next/server';
import { tavily } from '@tavily/core';

/**
 * API endpoint for conducting research using Tavily search API
 * Accepts a query and description to find relevant industry insights and data
 * Returns formatted research results suitable for slide presentation content
 */
export async function POST(request: NextRequest) {
  try {
    // REQUEST VALIDATION: Extract search parameters from request body
    // - query: The main search term or question
    // - description: Additional context about what the user is looking for
    // - options: Optional search configuration (maxResults, timeRange, etc.)
    const { query, description, options } = await request.json();

    // Validate required parameters - both query and description are needed for effective research
    if (!query || !description) {
      return NextResponse.json(
        { error: 'Query and description are required' },
        { status: 400 }
      );
    }

    // Check for required API key configuration - fail early if not properly configured
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      return NextResponse.json(
        { error: 'Tavily API key not configured' },
        { status: 500 }
      );
    }

    // Initialize Tavily client with API key for search operations
    const client = tavily({ apiKey: tavilyApiKey });

    // QUERY OPTIMIZATION: Build optimized search query respecting Tavily's 400 character API limit
    // Strategy: prioritize user query, then add description and keywords as space allows
    let searchQuery = query.substring(0, 200); // Reserve half the limit for the primary query

    // Append user description if it fits, truncating to preserve space for keywords
    if (description && searchQuery.length < 300) {
      const remainingSpace = 350 - searchQuery.length; // Reserve 50 chars for final keywords
      const truncatedDescription = description.substring(0, remainingSpace);
      searchQuery += ` ${truncatedDescription}`;
    }

    // Add research-focused keywords to improve result quality if space permits
    if (searchQuery.length < 370) {
      searchQuery += ' trends insights'; // 30 chars max to stay under limit
    }

    // Final safety check to ensure we never exceed Tavily's 400 character limit
    searchQuery = searchQuery.substring(0, 400);

    // Configure search parameters with user options or sensible defaults
    const searchOptions: Record<string, any> = {
      searchDepth: 'advanced' as const, // Use advanced search for comprehensive results
      maxResults: options?.maxResults || 5, // Default to 5 results for performance
      includeAnswer: options?.includeAnswer !== false, // Include AI-generated answer summaries by default
      includeImages: options?.includeImages || false, // Only include images if explicitly requested
      includeImageDescriptions: options?.includeImages || false, // Include image descriptions with images
    };

    // Add domain exclusions based on user preferences
    const excludeDomains: string[] = [];
    if (options?.excludeSocial !== false) {
      // By default, exclude social media sites for higher quality research
      excludeDomains.push('reddit.com', 'quora.com', 'twitter.com', 'facebook.com', 'instagram.com');
    }
    if (excludeDomains.length > 0) {
      searchOptions.excludeDomains = excludeDomains;
    }

    // Add time range filtering if specified by user
    if (options?.timeRange && options.timeRange !== 'all') {
      // Note: Tavily doesn't directly support time ranges, but we can add temporal keywords
      const timeKeywords = {
        'day': 'today recent',
        'week': 'this week recent',
        'month': 'this month recent',
        'year': 'this year 2024 2025'
      };
      const timeKeyword = timeKeywords[options.timeRange as keyof typeof timeKeywords];
      if (timeKeyword && searchQuery.length < 380) {
        searchQuery += ` ${timeKeyword}`;
      }
    }

    // Execute search using Tavily SDK with user-customized parameters
    const data = await client.search(searchQuery, searchOptions);

    // SEARCH RESULT PROCESSING: Handle empty or insufficient search results gracefully
    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        success: true,
        researchData: `No specific research results found for "${query}". 

Your slide will be created using the uploaded documents and description provided. Consider refining your description with more specific keywords for better research results.`,
        sources: [],
        answer: data.answer || null,
      });
    }

    // RESULT QUALITY FILTERING: Process and filter research results for quality and relevance
    const researchInsights = data.results
      .filter((result: { score: number }) => result.score > 0.3) // 30% relevance threshold - balances quality vs quantity
      .slice(0, 4) // Limit to top 4 results for optimal slide content length
      .map((result: { title: string; content: string; url: string; score: number }) => ({
        title: result.title,
        content: result.content.substring(0, 200) + '...', // Truncate to 200 chars for slide readability
        url: result.url,
        score: result.score, // Keep score for potential future sorting/filtering
      }));

    // Handle case where no results meet quality threshold
    if (researchInsights.length === 0) {
      return NextResponse.json({
        success: true,
        researchData: `Limited research results found for "${query}". 

Your slide will be created using the uploaded documents and description provided. The search may have been too specific - consider using broader terms for better research results.`,
        sources: [],
        answer: data.answer || null,
      });
    }

    // RESEARCH FORMATTING: Create formatted research summary optimized for slide presentation
    let formattedResearch = `Research Insights for "${query}":

`;

    // Include AI answer if available and requested
    if (data.answer) {
      formattedResearch += `AI Summary:
${data.answer}

Detailed Sources:
`;
    }

    // Format individual research insights with clear structure
    formattedResearch += `${researchInsights.map((insight: { title: string; content: string; url: string }) =>
      `• ${insight.title}
  ${insight.content}
  Source: ${insight.url}
`).join('\n')}

Key Takeaways:
• ${researchInsights.length} relevant sources found
• Focus areas: industry trends, best practices, supporting data
• Research confidence: ${Math.round(researchInsights.reduce((acc: number, r: { score: number }) => acc + r.score, 0) / researchInsights.length * 100)}%`;

    // Return successful response with formatted research data and source metadata
    return NextResponse.json({
      success: true,
      researchData: formattedResearch,
      sources: researchInsights,
      answer: data.answer || null,
    });

  } catch (error) {
    // Log error details for debugging while returning generic error to client
    console.error('Research API error:', error);
    return NextResponse.json(
      { error: 'Failed to conduct research', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}