// ============================================================================
// LOCAL TEMPLATE MANAGEMENT SYSTEM
// ============================================================================
// This module provides a fallback system for slide templates when Supabase is unavailable.
// It reads template metadata from a local JSON file and loads HTML content from template files.
// This ensures the slide generation system remains functional even without database connectivity.

import fs from 'fs';
import path from 'path';

/**
 * Interface defining the structure of a local slide template
 * Matches the Supabase template structure but includes local file references
 */
export interface LocalTemplate {
  id: string;                    // Unique identifier for the template
  name: string;                  // Display name (e.g., "Professional Gradient")
  description: string;           // Detailed description of the template's purpose
  theme: string;                 // Theme category (Professional, Modern, Creative, etc.)
  filename: string;              // HTML file name in the templates directory
  aspect_ratio: string;          // Slide dimensions (e.g., "16:9", "4:3")
  tags: string[];               // Searchable tags for categorization
  primary_colors: string[];     // Main color palette used in the template
  use_cases: string[];          // Recommended use cases (business, tech, etc.)
  html_content?: string;        // Loaded HTML content (optional, populated on demand)
}

// ============================================================================
// TEMPLATE METADATA LOADING
// ============================================================================

/**
 * Load template metadata from local JSON configuration file
 * 
 * Reads the templates.json file which contains metadata for all available templates.
 * This provides a fallback when Supabase database is unavailable or during development.
 * 
 * @returns Array of template metadata objects, empty array if file cannot be read
 */
export function getLocalTemplateMetadata(): LocalTemplate[] {
  try {
    // Construct path to the templates configuration file
    const templatesPath = path.join(process.cwd(), 'templates', 'templates.json');
    
    // Read and parse the JSON configuration file
    const templatesData = fs.readFileSync(templatesPath, 'utf8');
    const { templates } = JSON.parse(templatesData);
    
    return templates;
  } catch (error) {
    // Log error but don't crash - return empty array for graceful degradation
    console.error('Error loading local template metadata:', error);
    return [];
  }
}

// ============================================================================
// TEMPLATE CONTENT LOADING
// ============================================================================

/**
 * Load HTML content for a specific template file
 * 
 * Reads the actual HTML file from the templates directory and returns its content.
 * This is used to get the complete HTML structure that OpenAI will use as a reference
 * when generating new slides.
 * 
 * @param filename - Name of the HTML file in the templates directory
 * @returns HTML content as string, or null if file cannot be read
 */
export function getLocalTemplateContent(filename: string): string | null {
  try {
    // Construct full path to the template HTML file
    const templatePath = path.join(process.cwd(), 'templates', filename);
    
    // Read the HTML file content
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    // Log specific error but return null for graceful handling
    console.error(`Error loading template content for ${filename}:`, error);
    return null;
  }
}

// ============================================================================
// TEMPLATE RETRIEVAL WITH CONTENT
// ============================================================================

/**
 * Get local templates with HTML content loaded and ready for use
 * 
 * This is the main function for retrieving templates with their complete HTML content.
 * It combines metadata from the JSON file with actual HTML content from template files.
 * Used by the AI slide generation system to provide examples and structure references.
 * 
 * @param theme - Optional theme filter (Professional, Modern, Creative, etc.)
 * @param limit - Maximum number of templates to return (default: 3)
 * @returns Array of templates with HTML content loaded, filtered by theme and limit
 */
export function getLocalTemplatesWithContent(theme?: string, limit: number = 3): LocalTemplate[] {
  // Load all template metadata from the JSON configuration
  const metadata = getLocalTemplateMetadata();
  
  let filteredTemplates = metadata;
  
  // THEME FILTERING: Apply theme filter if specified by user
  if (theme) {
    filteredTemplates = metadata.filter(template => 
      template.theme.toLowerCase() === theme.toLowerCase()
    );
  }
  
  // RESULT LIMITING: Apply limit to prevent loading too many templates
  filteredTemplates = filteredTemplates.slice(0, limit);
  
  // CONTENT LOADING: Load HTML content for each template and filter out failed loads
  return filteredTemplates.map(template => ({
    ...template,
    html_content: getLocalTemplateContent(template.filename)
  })).filter(template => template.html_content !== null); // Remove templates that failed to load
}

// ============================================================================
// RANDOM TEMPLATE SELECTION
// ============================================================================

/**
 * Get a random local template for variety in AI generation
 * 
 * Selects a random template from available options to provide variety in slide generation.
 * This prevents the AI from always using the same template and creates more diverse outputs.
 * Useful when users don't specify a particular theme preference.
 * 
 * @param theme - Optional theme filter to randomize within a specific theme
 * @returns Random template with content loaded, or null if no templates available
 */
export function getRandomLocalTemplate(theme?: string): LocalTemplate | null {
  // Load up to 10 templates to choose from (good balance of variety vs performance)
  const templates = getLocalTemplatesWithContent(theme, 10);
  
  // Return null if no templates are available
  if (templates.length === 0) {
    return null;
  }
  
  // Select a random template from the available options
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
}

// ============================================================================
// AI PROMPT FORMATTING
// ============================================================================

/**
 * Format local template for OpenAI prompt inclusion
 * 
 * Converts a local template into a structured format that OpenAI can understand and use
 * as a reference when generating new slides. This formatting matches the Supabase version
 * to ensure consistency regardless of the template source.
 * 
 * @param template - Local template with HTML content loaded
 * @returns Formatted string ready for inclusion in OpenAI prompts
 */
export function formatLocalTemplateForPrompt(template: LocalTemplate): string {
  return `
EXAMPLE TEMPLATE: ${template.name}
Theme: ${template.theme}
Description: ${template.description}
Use Cases: ${template.use_cases.join(', ')}
Primary Colors: ${template.primary_colors.join(', ')}

HTML Structure:
${template.html_content}

Key Features:
- Aspect Ratio: ${template.aspect_ratio}
- Tags: ${template.tags.join(', ')}
- Design Style: ${template.description}
`;
}

// ============================================================================
// UNIFIED TEMPLATE RETRIEVAL WITH FALLBACK
// ============================================================================

/**
 * Get templates for AI prompt with intelligent fallback logic
 * 
 * This is the main entry point for the slide generation system. It implements a robust
 * fallback strategy: first attempts to use Supabase database templates (preferred),
 * then falls back to local file templates if database is unavailable.
 * 
 * This ensures the slide generation system remains functional regardless of:
 * - Database connectivity issues
 * - Development environment setup
 * - Supabase service availability
 * 
 * @param theme - Optional theme filter for template selection
 * @param limit - Maximum number of templates to include in prompt (default: 2)
 * @returns Formatted template content ready for OpenAI prompt inclusion
 */
export async function getTemplatesForAI(theme?: string, limit: number = 2): Promise<string> {
  try {
    // PRIMARY SOURCE: Attempt to use Supabase database templates first
    // Dynamic import prevents errors if Supabase modules are not available
    const { getSlideTemplates, formatTemplateForPrompt } = await import('./supabase/slide-templates');
    const supabaseTemplates = await getSlideTemplates(theme, undefined, limit);
    
    // Use Supabase templates if available
    if (supabaseTemplates.length > 0) {
      console.log(`Using ${supabaseTemplates.length} Supabase templates`);
      return supabaseTemplates.map(formatTemplateForPrompt).join('\n---\n');
    }
  } catch (error) {
    // Log the fallback reason for debugging purposes
    console.log('Supabase templates unavailable, using local templates:', error.message);
  }
  
  // FALLBACK SOURCE: Use local file templates when Supabase is unavailable
  const localTemplates = getLocalTemplatesWithContent(theme, limit);
  console.log(`Using ${localTemplates.length} local templates`);
  
  // Format and join templates with separators for clear prompt structure
  return localTemplates.map(formatLocalTemplateForPrompt).join('\n---\n');
}