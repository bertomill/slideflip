import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';

// ============================================================================
// POWERPOINT GENERATION API ENDPOINT
// ============================================================================
// This endpoint converts AI-generated HTML slides into downloadable PowerPoint files
// Key features:
// - Theme-based styling that matches HTML slide themes
// - Content extraction from HTML or direct data input
// - Research data integration as bullet points
// - Statistics visualization with styled boxes
// - Binary PPTX file generation for immediate download
// ============================================================================

/**
 * API endpoint for generating PowerPoint (PPTX) files from slide data
 * 
 * Accepts slide content in multiple formats (HTML, structured data, research text)
 * and converts it into a professionally formatted PowerPoint presentation that
 * matches the visual theme selected by the user in the slide builder.
 * 
 * @param request - Contains slideHtml, description, theme, researchData, userFeedback, title, subtitle
 * @returns Binary PPTX file as downloadable attachment or error response
 */
export async function POST(request: NextRequest) {
  try {
    // REQUEST PARSING: Extract all slide generation parameters from request body
    // These parameters come from the slide builder workflow and contain all user inputs
    const {
      slideHtml,      // Generated HTML content from OpenAI (optional)
      description,    // User's original slide description (fallback for title)
      theme,          // Visual theme selection (Professional, Modern, Tech, etc.)
      researchData,   // Research insights from Tavily API (optional)
      userFeedback,   // User's refinement feedback (stored as slide notes)
      title,          // Explicit slide title (takes priority over description)
      subtitle        // Optional subtitle for the slide
    } = await request.json();

    // INPUT VALIDATION: Ensure we have enough content to create a meaningful slide
    // Either an explicit title or a description is required for slide generation
    if (!description && !title) {
      return NextResponse.json(
        { error: 'Title or description is required' },
        { status: 400 }
      );
    }

    // POWERPOINT INITIALIZATION: Create new presentation instance using PptxGenJS library
    // This library provides programmatic PowerPoint generation with full formatting control
    const pptx = new PptxGenJS();

    // PRESENTATION METADATA: Set document properties for professional appearance
    // These properties appear in PowerPoint's file properties and help with organization
    pptx.author = 'SlideFlip AI';
    pptx.company = 'SlideFlip';
    pptx.subject = 'AI Generated Presentation';
    pptx.title = title || description?.substring(0, 50) || 'AI Generated Slide';

    // SLIDE CREATION: Add new slide to presentation with theme-based styling
    // Each presentation contains exactly one slide matching the user's AI-generated content
    const slide = pptx.addSlide();

    // THEME APPLICATION: Load theme-specific colors, fonts, and styling configuration
    // This ensures the PowerPoint matches the visual style of the HTML preview
    const themeConfig = getThemeConfig(theme);

    // BACKGROUND STYLING: Apply theme-appropriate background (gradient or solid color)
    // Gradient backgrounds create visual depth, solid backgrounds provide clean minimalism
    if (themeConfig.background.type === 'gradient') {
      slide.background = {
        fill: {
          type: 'gradient',
          colors: themeConfig.background.colors,
          angle: themeConfig.background.angle || 45
        }
      };
    } else {
      slide.background = { fill: themeConfig.background.color };
    }

    // CONTENT EXTRACTION: Parse HTML slide content or create from structured data
    // Priority: HTML content > explicit title/subtitle > description-derived content
    // This ensures we capture the AI-generated content accurately in PowerPoint format
    const slideContent = extractContentFromHtml(slideHtml) || {
      title: title || description?.split('.')[0] || 'Generated Slide',
      subtitle: subtitle || 'AI Generated Content',
      bulletPoints: [],
      statistics: []
    };

    // CONTENT VALIDATION: Log extracted content structure for debugging and monitoring
    // Helps troubleshoot content extraction issues and verify data flow from HTML to PowerPoint
    console.log('Extracted slide content:', {
      title: slideContent.title,
      subtitle: slideContent.subtitle,
      bulletPointsCount: slideContent.bulletPoints.length,
      statisticsCount: slideContent.statistics.length
    });

    // ============================================================================
    // SLIDE CONTENT LAYOUT: Build PowerPoint slide with structured content sections
    // ============================================================================
    // The following sections create a professional slide layout with:
    // 1. Main title at the top
    // 2. Subtitle below the title
    // 3. Content points in the middle section
    // 4. Statistics visualization at the bottom
    // Each section uses theme-appropriate styling for visual consistency

    // TITLE SECTION: Main slide heading with prominent styling
    // Creates the primary title that captures audience attention immediately
    // Uses large font size and center alignment for maximum visual impact
    const titleOptions: any = {
      x: 1,          // Horizontal position: 1 inch from left edge (standard margin)
      y: 0.5,        // Vertical position: 0.5 inches from top (header area)
      w: 8,          // Width: 8 inches (spans most of slide width for centering)
      h: 1.5,        // Height: 1.5 inches (adequate space for large text)
      fontSize: 44,  // Font size: 44pt (large enough for presentation visibility)
      fontFace: themeConfig.fonts.title.family,  // Theme-specific font family
      color: themeConfig.fonts.title.color,      // Theme-specific text color
      bold: true,    // Bold weight for emphasis and hierarchy
      align: 'center' // Center alignment for professional appearance
    };

    // CONDITIONAL EFFECTS: Add text shadow only if theme supports it
    // Prevents errors when themes don't define shadow effects (like Modern theme)
    // Text shadows enhance readability on gradient backgrounds
    if (themeConfig.effects.textShadow) {
      titleOptions.shadow = themeConfig.effects.textShadow;
    }

    // Apply the title text with all formatting options to the slide
    slide.addText(slideContent.title, titleOptions);

    // SUBTITLE PLACEMENT: Add supporting subtitle text below main title (if available)
    // Provides additional context or key message in smaller, complementary styling
    if (slideContent.subtitle) {
      slide.addText(slideContent.subtitle, {
        x: 1,          // Aligned with title
        y: 2.2,        // Positioned below title with appropriate spacing
        w: 8,          // Same width as title for visual consistency
        h: 0.8,        // Smaller height than title
        fontSize: 24,  // Smaller font size to create hierarchy
        fontFace: themeConfig.fonts.subtitle.family,
        color: themeConfig.fonts.subtitle.color,
        align: 'center'
      });
    }

    // CONTENT POINTS: Add bullet points from HTML content or research data
    // Creates structured, scannable content that's easy for audiences to follow
    // Prioritizes extracted HTML content over research-derived points for accuracy
    if (researchData || slideContent.bulletPoints.length > 0) {
      const points = slideContent.bulletPoints.length > 0
        ? slideContent.bulletPoints
        : extractKeyPointsFromResearch(researchData);

      if (points.length > 0) {
        // Convert string array to properly formatted text for pptxgenjs
        const bulletText = points.map(point => `• ${point}`).join('\n');

        slide.addText(bulletText, {
          x: 1.5,        // Slightly indented from slide edges
          y: 3.5,        // Positioned in middle section of slide
          w: 7,          // Narrower than title to allow for bullet indentation
          h: 2.5,        // Sufficient height for multiple bullet points
          fontSize: 16,  // Readable body text size
          fontFace: themeConfig.fonts.body.family,
          color: themeConfig.fonts.body.color,
          lineSpacing: 24 // Generous line spacing for readability
        });
      }
    }

    // STATISTICS VISUALIZATION: Add data points in styled boxes for visual impact
    // Creates professional-looking metric displays that draw attention to key numbers
    // Each statistic gets its own rounded rectangle with consistent spacing
    if (slideContent.statistics.length > 0) {
      slideContent.statistics.forEach((stat, index) => {
        // POSITIONING: Calculate horizontal position for each statistic box
        // Distributes statistics evenly across the slide width
        const xPos = 2 + (index * 2.5);

        // STATISTIC CONTAINER: Create rounded rectangle background for each metric
        // Uses theme accent color with transparency for subtle visual emphasis
        slide.addShape('roundRect', {
          x: xPos,       // Calculated horizontal position
          y: 4.5,        // Fixed vertical position in lower section
          w: 2,          // 2 inches wide - compact but readable
          h: 1.2,        // 1.2 inches tall - enough for number and label
          fill: {
            color: themeConfig.colors.accent,
            transparency: 20  // 20% transparency for subtle background
          },
          line: {
            color: themeConfig.colors.accent,
            width: 1,
            transparency: 30  // Slightly more transparent border
          }
        });

        // STATISTIC TEXT: Add the actual number and label inside the container
        // Uses multi-part text with different formatting for number vs label
        slide.addText([
          { text: stat.value, options: { fontSize: 28, bold: true, color: themeConfig.fonts.stat.color } },
          { text: '\n' + stat.label, options: { fontSize: 12, color: themeConfig.fonts.statLabel.color } }
        ], {
          x: xPos,       // Same position as container
          y: 4.5,        // Same position as container
          w: 2,          // Same width as container
          h: 1.2,        // Same height as container
          align: 'center',
          valign: 'middle' // Center text vertically within container
        });
      });
    }

    // USER FEEDBACK PRESERVATION: Store user's refinement feedback as slide notes
    // This preserves the user's input for future reference without cluttering the slide
    // Notes are visible in PowerPoint's presenter view and notes pages
    if (userFeedback) {
      slide.addNotes(`User Feedback: ${userFeedback}`);
    }

    // PPTX GENERATION: Convert the slide definition into binary PowerPoint format
    // Uses 'nodebuffer' format for direct HTTP response without file system writes
    const pptxBuffer = await pptx.write('nodebuffer');

    // FILE DOWNLOAD RESPONSE: Return the PPTX file as an immediate download
    // Sets appropriate headers for browser to recognize and download the file
    // Filename includes timestamp to prevent conflicts with multiple downloads
    return new NextResponse(pptxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="slide-${Date.now()}.pptx"`,
        'Content-Length': pptxBuffer.length.toString()
      }
    });

  } catch (error) {
    // ERROR HANDLING: Log detailed error information for debugging
    // Provides both user-friendly error response and detailed logging for troubleshooting
    console.error('PPTX generation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json({
      error: 'Failed to generate PowerPoint file',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestData: {
        hasSlideHtml: !!slideHtml,
        hasDescription: !!description,
        theme: theme || 'not provided'
      }
    }, { status: 500 });
  }
}

// ============================================================================
// THEME CONFIGURATION SYSTEM
// ============================================================================
// Maps HTML slide themes to PowerPoint-compatible styling configurations
// Ensures visual consistency between web preview and downloaded PowerPoint
// ============================================================================

/**
 * Get theme-specific configuration for PowerPoint styling
 * 
 * Translates our web-based themes (Professional, Modern, Tech) into PowerPoint
 * formatting options including colors, fonts, backgrounds, and effects.
 * This ensures the downloaded PPTX matches the HTML preview appearance.
 * 
 * @param theme - Theme name from slide builder (Professional, Modern, Tech, etc.)
 * @returns Theme configuration object with PowerPoint-compatible styling
 */
function getThemeConfig(theme?: string) {
  // THEME DEFINITIONS: Complete styling configurations for each available theme
  // Each theme includes background, typography, colors, and effects that match HTML versions
  const themes = {
    // PROFESSIONAL THEME: Corporate gradient design with white text and glass effects
    // Matches the professional-gradient.html template styling
    'Professional': {
      background: {
        type: 'gradient',
        colors: ['667eea', '764ba2'], // Blue to purple gradient
        angle: 45
      },
      fonts: {
        title: { family: 'Segoe UI', color: 'FFFFFF' },      // White title for contrast
        subtitle: { family: 'Segoe UI', color: 'F0F0F0' },   // Light gray subtitle
        body: { family: 'Segoe UI', color: 'F0F0F0' },       // Light gray body text
        stat: { color: 'FFFFFF' },                           // White statistics numbers
        statLabel: { color: 'F0F0F0' }                       // Light gray stat labels
      },
      colors: {
        accent: 'FFFFFF' // White accent color for boxes and highlights
      },
      effects: {
        textShadow: { type: 'outer', blur: 3, offset: 2, angle: 45, color: '000000', opacity: 0.3 }
      }
    },
    // MODERN THEME: Clean minimalist design with white background and blue accents
    // Matches the modern-clean.html template styling for corporate presentations
    'Modern': {
      background: {
        type: 'solid',
        color: 'FFFFFF' // Pure white background for clean, minimal look
      },
      fonts: {
        title: { family: 'Inter', color: '1F2937' },    // Dark gray title for readability
        subtitle: { family: 'Inter', color: '6B7280' }, // Medium gray subtitle
        body: { family: 'Inter', color: '374151' },     // Dark gray body text
        stat: { color: '3B82F6' },                      // Blue statistics numbers
        statLabel: { color: '64748B' }                  // Gray stat labels
      },
      colors: {
        accent: '3B82F6' // Blue accent color for highlights and boxes
      },
      effects: {} // No special effects for clean, minimal appearance
    },
    // TECH THEME: Dark futuristic design with cyan accents and glowing effects
    // Matches the dark-tech.html template styling for technology presentations
    'Tech': {
      background: {
        type: 'gradient',
        colors: ['0F172A', '334155'], // Dark slate gradient for tech aesthetic
        angle: 135
      },
      fonts: {
        title: { family: 'Inter', color: 'F1F5F9' },    // Light gray title on dark background
        subtitle: { family: 'Inter', color: '94A3B8' }, // Medium gray subtitle
        body: { family: 'Inter', color: 'CBD5E1' },     // Light gray body text
        stat: { color: '10B981' },                      // Green statistics numbers (tech accent)
        statLabel: { color: '94A3B8' }                  // Gray stat labels
      },
      colors: {
        accent: '78DBFF' // Cyan accent color for tech/futuristic feel
      },
      effects: {
        textShadow: { type: 'outer', blur: 8, offset: 0, angle: 0, color: '78DBFF', opacity: 0.5 }
      }
    }
  };

  // THEME FALLBACK: Return Professional theme if requested theme doesn't exist
  // Ensures the function always returns valid configuration even with invalid input
  return themes[theme as keyof typeof themes] || themes.Professional;
}

// ============================================================================
// HTML CONTENT EXTRACTION UTILITIES
// ============================================================================
// Parses AI-generated HTML slides to extract structured content for PowerPoint
// Handles various HTML patterns and provides fallback for missing content
// ============================================================================

/**
 * Extract structured content from HTML slide for PowerPoint conversion
 * 
 * Parses the AI-generated HTML slide content to identify and extract:
 * - Main title (h1 elements)
 * - Subtitle (h2 elements) 
 * - Bullet points (ul/li elements)
 * - Statistics (elements with stat-number class)
 * 
 * Uses regex parsing for simplicity - in production, consider using a proper HTML parser
 * for more robust parsing of complex HTML structures.
 * 
 * @param html - HTML content from AI slide generation
 * @returns Structured content object or null if parsing fails
 */
function extractContentFromHtml(html?: string) {
  // EARLY EXIT: Handle missing or placeholder HTML content
  if (!html || html === 'cat-slide-placeholder') return null;

  try {
    // HTML PARSING: Use regex patterns to extract different content types
    // These patterns match the HTML structure generated by our OpenAI slide creation
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);           // Main slide title
    const subtitleMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/i);        // Subtitle or key message
    const listMatch = html.match(/<ul[^>]*>(.*?)<\/ul>/is);           // Bullet point lists
    const statMatches = html.match(/<span class="stat-number"[^>]*>(.*?)<\/span>/g); // Statistics

    // CONTENT EXTRACTION: Clean HTML tags and extract plain text content
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : null;
    const subtitle = subtitleMatch ? subtitleMatch[1].replace(/<[^>]*>/g, '') : null;

    // BULLET POINTS EXTRACTION: Parse unordered lists into array of strings
    let bulletPoints: string[] = [];
    if (listMatch) {
      const liMatches = listMatch[1].match(/<li[^>]*>(.*?)<\/li>/g);
      if (liMatches) {
        bulletPoints = liMatches.map(li => li.replace(/<[^>]*>/g, '').trim());
      }
    }

    // STATISTICS EXTRACTION: Find numeric statistics with labels
    // Creates structured data for PowerPoint statistic boxes
    let statistics: Array<{ value: string, label: string }> = [];
    if (statMatches) {
      statMatches.forEach(match => {
        const value = match.replace(/<[^>]*>/g, '').trim();
        statistics.push({ value, label: 'Metric' }); // Generic label - could be enhanced
      });
    }

    // RETURN STRUCTURED DATA: Package all extracted content for PowerPoint generation
    return {
      title,
      subtitle,
      bulletPoints,
      statistics
    };
  } catch (error) {
    // ERROR HANDLING: Log parsing errors and return null for graceful fallback
    console.error('Error parsing HTML content:', error);
    return null;
  }
}

/**
 * Extract key points from research data for bullet points
 * 
 * Converts research text from Tavily API into presentation-friendly bullet points
 * that work well in PowerPoint format. Filters sentences by length to ensure
 * they fit well on slides and are meaningful to audiences.
 * 
 * @param researchData - Research insights text from Tavily API
 * @returns Array of bullet point strings suitable for PowerPoint
 */
function extractKeyPointsFromResearch(researchData?: string): string[] {
  // EARLY EXIT: Handle missing research data
  if (!researchData) return [];

  try {
    // SENTENCE PROCESSING: Break research into digestible bullet points
    // Filters for optimal length - not too short (meaningless) or too long (overwhelming)
    const sentences = researchData
      .split(/[.!?]+/)                    // Split on sentence endings
      .map(s => s.trim())                 // Remove whitespace
      .filter(s => s.length > 20 && s.length < 150) // Optimal length for slides
      .slice(0, 4);                       // Limit to 4 points for readability

    // FALLBACK HANDLING: Provide meaningful content even if processing fails
    return sentences.length > 0 ? sentences : ['Key insights from research data'];
  } catch (error) {
    // ERROR HANDLING: Log errors and provide fallback content
    console.error('Error extracting key points:', error);
    return ['Research data available'];
  }
}