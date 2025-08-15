import { NextRequest, NextResponse } from 'next/server';

interface ScrapingBeeResponse {
  title?: string;
  text?: string;
  url?: string;
}

// Helper function to extract content from HTML
function extractContentFromHtml(html: string, url: string): ScrapingBeeResponse {
  try {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Remove script and style tags
    let cleanHtml = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>.*?<\/style>/gis, '');
    cleanHtml = cleanHtml.replace(/<!--.*?-->/gs, '');

    // Extract content from main content areas
    const contentSelectors = [
      /<article[^>]*>(.*?)<\/article>/gis,
      /<main[^>]*>(.*?)<\/main>/gis,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*entry[^"]*"[^>]*>(.*?)<\/div>/gis,
    ];

    let extractedContent = '';
    
    for (const selector of contentSelectors) {
      const matches = cleanHtml.match(selector);
      if (matches && matches.length > 0) {
        extractedContent = matches.join(' ');
        break;
      }
    }

    // If no main content found, extract all paragraphs
    if (!extractedContent) {
      const paragraphs = cleanHtml.match(/<p[^>]*>.*?<\/p>/gis) || [];
      extractedContent = paragraphs.join(' ');
    }

    // Clean up the extracted content
    extractedContent = extractedContent
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    console.log(`Extracted title: "${title}"`);
    console.log(`Extracted content length: ${extractedContent.length}`);
    console.log(`Content preview: ${extractedContent.substring(0, 200)}...`);

    return {
      title: title || new URL(url).hostname,
      text: extractedContent,
      url
    };
  } catch (error) {
    console.error('Error extracting content from HTML:', error);
    return {
      title: new URL(url).hostname,
      text: '',
      url
    };
  }
}

interface ArticleResult {
  title: string;
  content: string;
  url: string;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'Invalid URLs provided' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ScrapingBee API key not configured' },
        { status: 500 }
      );
    }

    const articles: ArticleResult[] = [];

    // Process each URL
    for (const url of urls) {
      try {
        console.log(`Scraping article: ${url}`);
        
        // First try with basic scraping (no extraction rules)
        let scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false`;
        
        let response = await fetch(scrapingBeeUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html',
          },
        });

        console.log(`ScrapingBee response status: ${response.status}`);
        
        if (!response.ok) {
          // Try with different settings if basic fails
          console.log(`Basic scraping failed, trying with render_js=true`);
          scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=2000`;
          
          response = await fetch(scrapingBeeUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/html',
            },
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.log(`ScrapingBee error response: ${errorText}`);
            throw new Error(`ScrapingBee API error: ${response.status} - ${errorText}`);
          }
        }

        const htmlContent = await response.text();
        console.log(`Received HTML content length: ${htmlContent.length}`);
        
        // Extract title and content from HTML manually
        const data = extractContentFromHtml(htmlContent, url);
        
        // Extract and clean content
        const title = data.title || new URL(url).hostname;
        const content = data.text || '';

        // Clean and validate content
        const cleanContent = content
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();

        console.log(`Final content length: ${cleanContent.length}`);

        if (cleanContent.length < 50) {
          console.log(`Content too short (${cleanContent.length} chars), treating as failed extraction`);
          throw new Error(`Insufficient content extracted (${cleanContent.length} characters)`);
        }

        articles.push({
          title: title.slice(0, 200), // Limit title length
          content: cleanContent.slice(0, 15000), // Increased content length limit
          url,
          success: true,
        });

        console.log(`✅ Successfully scraped: "${title}" (${cleanContent.length} chars)`);
        console.log(`Content preview: ${cleanContent.substring(0, 300)}...`);

      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        articles.push({
          title: new URL(url).hostname,
          content: `Failed to extract content from ${url}`,
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Add small delay between requests to be respectful
      if (urls.indexOf(url) < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      articles,
      totalProcessed: articles.length,
      successCount: articles.filter(a => a.success).length,
    });

  } catch (error) {
    console.error('Error in scrape-articles API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}