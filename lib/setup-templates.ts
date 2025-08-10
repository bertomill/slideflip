// ============================================================================
// SLIDE TEMPLATE SETUP UTILITY
// ============================================================================
// This module provides functionality to initialize default slide templates
// in the Supabase database. It can be called from API routes, setup scripts,
// or run manually during application initialization.
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import { createSlideTemplate } from '@/lib/supabase/slide-templates';

// ============================================================================
// DEFAULT SLIDE TEMPLATE DEFINITION
// ============================================================================
// Professional gradient template with modern glass morphism design
// Features: gradient background, backdrop blur effects, responsive grid layout,
// accessibility-compliant high contrast text, and scoped CSS styling
// ============================================================================

const basicTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional Slide Template</title>
    <style>
        /* Main slide container - 16:9 aspect ratio (1920x1080) with gradient background */
        .slide-container {
            width: 1920px;
            height: 1080px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 80px;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }
        
        /* Glass morphism overlay effect - creates frosted glass appearance */
        .slide-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
        }
        
        /* Content wrapper - positioned above glass overlay with centered alignment */
        .slide-content {
            position: relative;
            z-index: 2;
            text-align: center;
            max-width: 1400px;
        }
        
        /* Main heading - large, bold title with text shadow for readability */
        .slide-container h1 {
            color: #ffffff;
            font-size: 4rem;
            font-weight: 700;
            margin-bottom: 2rem;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            line-height: 1.2;
        }
        
        /* Secondary heading - subtitle with lighter weight and color */
        .slide-container h2 {
            color: #f0f0f0;
            font-size: 2.5rem;
            font-weight: 400;
            margin-bottom: 3rem;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        
        /* Responsive grid layout for content cards - auto-fits based on available space */
        .slide-container .content-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 3rem;
            margin-top: 3rem;
        }
        
        /* Individual content cards with glass morphism effect */
        .slide-container .content-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 2.5rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        /* Content card headings - medium-sized titles for key points */
        .slide-container .content-card h3 {
            color: #ffffff;
            font-size: 1.8rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
        }
        
        /* Content card body text - readable size with proper line spacing */
        .slide-container .content-card p {
            color: #f0f0f0;
            font-size: 1.2rem;
            line-height: 1.6;
            margin-bottom: 1rem;
        }
        
        /* Highlighted statistic container - draws attention to key metrics */
        .slide-container .highlight-stat {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            padding: 1.5rem;
            margin: 2rem 0;
            border-left: 5px solid #ffffff;
        }
        
        /* Large statistic number - prominent display for key metrics */
        .slide-container .highlight-stat .stat-number {
            color: #ffffff;
            font-size: 3rem;
            font-weight: 700;
            display: block;
        }
        
        /* Statistic label - descriptive text below the number */
        .slide-container .highlight-stat .stat-label {
            color: #f0f0f0;
            font-size: 1.1rem;
            font-weight: 400;
        }
        
        /* Bullet point list styling - left-aligned with generous spacing */
        .slide-container ul {
            text-align: left;
            color: #f0f0f0;
            font-size: 1.3rem;
            line-height: 2;
        }
        
        /* Individual list items with custom spacing and positioning */
        .slide-container li {
            margin-bottom: 0.8rem;
            position: relative;
            padding-left: 2rem;
        }
        
        /* Custom bullet point using arrow symbol for visual appeal */
        .slide-container li::before {
            content: '▶';
            position: absolute;
            left: 0;
            color: #ffffff;
            font-size: 1rem;
        }
    </style>
</head>
<body>
    <!-- Main slide container with gradient background and glass morphism effects -->
    <div class="slide-container">
        <div class="slide-content">
            <!-- Primary slide title - replace with actual content -->
            <h1>Your Main Title Here</h1>
            <!-- Secondary subtitle or key message -->
            <h2>Subtitle or Key Message</h2>
            
            <!-- Highlighted statistic section for key metrics -->
            <div class="highlight-stat">
                <span class="stat-number">85%</span>
                <span class="stat-label">Key Statistic or Metric</span>
            </div>
            
            <!-- Responsive grid layout for main content points -->
            <div class="content-grid">
                <div class="content-card">
                    <h3>Key Point 1</h3>
                    <p>Supporting information and details that explain this important point.</p>
                </div>
                <div class="content-card">
                    <h3>Key Point 2</h3>
                    <p>Additional context and data that reinforces your message.</p>
                </div>
            </div>
            
            <!-- Bullet point list for additional key takeaways -->
            <ul>
                <li>Important bullet point with clear information</li>
                <li>Second key takeaway for your audience</li>
                <li>Final compelling point to remember</li>
            </ul>
        </div>
    </div>
</body>
</html>`;

// ============================================================================
// TEMPLATE SETUP FUNCTION
// ============================================================================
// Main function to initialize default slide templates in the database
// This creates the professional gradient template that serves as a foundation
// for AI-generated slides. Can be called during app initialization or manually.
// ============================================================================

/**
 * Sets up default slide templates in the Supabase database
 * Creates a professional gradient template with modern design elements
 * 
 * @returns Promise<SlideTemplate | null> - The created template or null if failed
 */
export async function setupSlideTemplates() {
  try {
    console.log('Setting up slide templates...');

    // Create the professional gradient template in the database
    // This template serves as a foundation for AI slide generation
    const template = await createSlideTemplate({
      name: 'Professional Gradient Template',
      description: 'A modern professional slide template with gradient background, glass morphism effects, and clean typography. Perfect for business presentations and data visualization.',
      theme: 'Professional',
      html_content: basicTemplate,
      css_scoped: true, // Ensures CSS won't affect parent page elements
      aspect_ratio: '16:9', // Standard presentation aspect ratio
      tags: ['professional', 'gradient', 'modern', 'business', 'glass-morphism'],
      is_active: true // Template is available for use
    });

    // Verify template creation was successful
    if (template) {
      console.log('✅ Successfully created slide template:', template.name);
      return template;
    } else {
      console.error('❌ Failed to create slide template');
      return null;
    }
  } catch (error) {
    // Log any errors that occur during setup
    console.error('Setup failed:', error);
    return null;
  }
}