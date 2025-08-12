import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SlideDefinition } from '@/lib/slide-types';
import { sampleThemes } from '@/lib/sample-slides-json';

/**
 * Fix contrast issues in generated slides
 */
function ensureGoodContrast(slide: SlideDefinition): SlideDefinition {
  const fixedSlide = { ...slide };
  
  fixedSlide.objects = slide.objects.map(obj => {
    if (obj.type === 'text') {
      const textObj = { ...obj };
      
      // Fix common bad color combinations
      const color = obj.options.color;
      const bgColor = slide.background?.color || 'ffffff';
      
      // If text color is too light on white/light background
      if (isLightBackground(bgColor) && isLightText(color)) {
        console.log(`Fixing light text on light background: ${color} -> 333333`);
        textObj.options.color = '333333'; // Dark grey for good contrast
      }
      
      // If text color is too dark on dark background
      if (isDarkBackground(bgColor) && isDarkText(color)) {
        console.log(`Fixing dark text on dark background: ${color} -> ffffff`);
        textObj.options.color = 'ffffff'; // White for good contrast
      }
      
      return textObj;
    }
    return obj;
  });
  
  return fixedSlide;
}

function isLightBackground(color: string | undefined): boolean {
  if (!color) return true; // Default white
  const hex = color.replace('#', '');
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  
  // Calculate luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.7; // Light background
}

function isDarkBackground(color: string | undefined): boolean {
  return !isLightBackground(color);
}

function isLightText(color: string | undefined): boolean {
  if (!color) return false;
  const hex = color.replace('#', '');
  
  // Common light colors that cause contrast issues
  const lightColors = [
    'ffffff', 'f8f9fa', 'e9ecef', 'dee2e6', 'ced4da', 'adb5bd',
    'cccccc', 'dddddd', 'eeeeee', 'f0f0f0', 'f5f5f5', 'fafafa',
    '999999', 'aaaaaa', 'bbbbbb'
  ];
  
  if (lightColors.includes(hex.toLowerCase())) {
    return true;
  }
  
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6; // Light text
}

function isDarkText(color: string | undefined): boolean {
  if (!color) return true; // Default is dark
  return !isLightText(color);
}

function hexToRgb(hex: string) {
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * API endpoint for generating slides in PptxGenJS-compatible JSON format
 */
export async function POST(request: NextRequest) {
  try {
    const { description, theme, researchData, contentPlan, userFeedback, documents } = await request.json();

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

    // Get theme colors
    const themeKey = theme?.toLowerCase() || 'professional';
    const themeConfig = sampleThemes[themeKey] || sampleThemes.professional;

    // Build comprehensive prompt for JSON generation
    let prompt = `Create a professional slide in PptxGenJS JSON format based on the following requirements:

SLIDE DESCRIPTION: ${description}

THEME: ${theme || 'Professional'}
THEME COLORS:
- Primary: ${themeConfig.colors.primary}
- Secondary: ${themeConfig.colors.secondary}
- Background: ${themeConfig.colors.background}
- Text: ${themeConfig.colors.text}
- Text Light: ${themeConfig.colors.textLight}

`;

    if (contentPlan) {
      prompt += `CONTENT PLAN:
${contentPlan}

`;
    }

    if (userFeedback) {
      prompt += `USER FEEDBACK:
${userFeedback}

`;
    }

    if (researchData) {
      prompt += `RESEARCH DATA:
${researchData}

`;
    }

    if (documents && documents.length > 0) {
      prompt += `DOCUMENTS:\n`;
      documents.forEach((doc: any, index: number) => {
        if (doc.success && doc.content) {
          prompt += `Document ${index + 1} (${doc.filename}):\n${doc.content.substring(0, 1000)}...\n\n`;
        }
      });
    }

    prompt += `REQUIREMENTS:
1. Return a valid JSON object that matches PptxGenJS slide format
2. Use the provided theme colors consistently
3. Position elements using inches (PptxGenJS coordinates):
   - Slide dimensions: 10" wide × 5.625" tall (16:9 aspect ratio)
   - x: horizontal position from left edge
   - y: vertical position from top edge
   - w: width in inches
   - h: height in inches

4. Include a mix of text objects and simple shapes if appropriate
5. Use proper font sizes (title: 36-48pt, body: 18-24pt, captions: 14-16pt)
6. Ensure good visual hierarchy and spacing
7. CRITICAL: Use dark text colors for readability - NEVER use light grey (#cccccc, #999999) or similar light colors on light backgrounds
8. For text on white/light backgrounds, use dark colors: #333333, #1a1a1a, or the provided theme primary color
9. Ensure high contrast ratios for accessibility compliance

EXAMPLE JSON STRUCTURE:
{
  "id": "generated-slide",
  "background": { "color": "${themeConfig.colors.background}" },
  "objects": [
    {
      "type": "text",
      "text": "Your Title Here",
      "options": {
        "x": 0.5,
        "y": 1,
        "w": 9,
        "h": 1,
        "fontSize": 44,
        "fontFace": "${themeConfig.fonts.title}",
        "color": "${themeConfig.colors.primary}",
        "bold": true,
        "align": "center"
      }
    }
  ]
}

Return ONLY the JSON object, no markdown formatting or explanations.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert presentation designer who creates slides in PptxGenJS JSON format. You return only valid JSON objects that can be directly parsed, with precise positioning and proper theme application. CRITICAL: You NEVER use light grey text colors (#cccccc, #999999, #aaaaaa) on white or light backgrounds. You always ensure high contrast for accessibility - use dark text (#333333, #1a1a1a) on light backgrounds and light text (#ffffff) on dark backgrounds. Always use the exact theme colors provided and ensure professional layout with excellent readability."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    let slideJsonString = completion.choices[0]?.message?.content;

    if (!slideJsonString) {
      throw new Error('No slide content generated');
    }

    // Clean up response - remove markdown formatting
    slideJsonString = slideJsonString.trim();
    if (slideJsonString.startsWith('```json')) {
      slideJsonString = slideJsonString.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (slideJsonString.startsWith('```')) {
      slideJsonString = slideJsonString.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse JSON to validate
    let slideJson: SlideDefinition;
    try {
      slideJson = JSON.parse(slideJsonString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', slideJsonString);
      
      // Return a fallback slide
      slideJson = {
        id: 'fallback-slide',
        background: { color: themeConfig.colors.background },
        objects: [
          {
            type: 'text',
            text: description,
            options: {
              x: 0.5,
              y: 2,
              w: 9,
              h: 1.5,
              fontSize: 44,
              fontFace: themeConfig.fonts.title,
              color: themeConfig.colors.primary,
              bold: true,
              align: 'center',
              valign: 'middle'
            }
          },
          {
            type: 'text',
            text: 'AI-Generated Content',
            options: {
              x: 0.5,
              y: 3.5,
              w: 9,
              h: 0.75,
              fontSize: 24,
              fontFace: themeConfig.fonts.body,
              color: themeConfig.colors.textLight,
              align: 'center'
            }
          }
        ]
      };
    }

    console.log('Generated slide JSON:', JSON.stringify(slideJson, null, 2));
    
    // Validate and fix contrast issues
    slideJson = ensureGoodContrast(slideJson);

    return NextResponse.json({
      success: true,
      slideJson: slideJson,
      message: 'Slide generated successfully'
    });

  } catch (error) {
    console.error('Slide generation error:', error);
    
    // Return fallback slide on error
    const fallbackSlide: SlideDefinition = {
      id: 'error-fallback',
      background: { color: 'ffffff' },
      objects: [
        {
          type: 'text',
          text: 'Slide Generation Error',
          options: {
            x: 1,
            y: 2,
            w: 8,
            h: 1,
            fontSize: 36,
            fontFace: 'Arial',
            color: '333333',
            bold: true,
            align: 'center'
          }
        },
        {
          type: 'text',
          text: 'Please try again or contact support',
          options: {
            x: 1,
            y: 3,
            w: 8,
            h: 0.5,
            fontSize: 18,
            fontFace: 'Arial',
            color: '666666',
            align: 'center'
          }
        }
      ]
    };

    return NextResponse.json({
      success: true, // Return success with fallback
      slideJson: fallbackSlide,
      message: 'Generated fallback slide due to error'
    });
  }
}