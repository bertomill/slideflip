// ============================================================================
// SLIDE TEMPLATE MANAGEMENT SYSTEM
// ============================================================================
// This module provides database operations for managing slide templates that
// serve as examples for OpenAI slide generation. Templates help improve AI
// output quality by providing structural and styling patterns.
// ============================================================================

import { createClient } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * SlideTemplate interface defining the structure of slide templates stored in Supabase
 * These templates serve as examples for OpenAI to generate consistent, high-quality slides
 * 
 * @interface SlideTemplate
 * @property {string} id - Unique identifier for the template
 * @property {string} name - Human-readable name for the template (e.g., "Corporate Quarterly Report")
 * @property {string} description - Detailed description of the template's purpose and use case
 * @property {string} theme - Visual theme category (Professional, Modern, Creative, etc.)
 * @property {string} html_content - Complete HTML content including scoped CSS styles
 * @property {boolean} css_scoped - Whether CSS is properly scoped to prevent style conflicts
 * @property {string} aspect_ratio - Slide dimensions (e.g., "16:9", "4:3")
 * @property {string[]} tags - Searchable tags for categorization (e.g., ["finance", "charts", "corporate"])
 * @property {boolean} is_active - Whether template is available for use (soft delete flag)
 * @property {string} created_at - ISO timestamp of template creation
 * @property {string} updated_at - ISO timestamp of last template modification
 */
export interface SlideTemplate {
  id: string;
  name: string;
  description: string;
  theme: string;
  html_content: string;
  css_scoped: boolean;
  aspect_ratio: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TEMPLATE RETRIEVAL FUNCTIONS
// ============================================================================

/**
 * Fetch slide templates from Supabase database with optional filtering
 * 
 * This function retrieves templates that can be used as examples for OpenAI slide generation.
 * Templates are filtered by theme and/or tags to find the most relevant examples for the
 * user's specific slide requirements. Results are ordered by creation date (newest first)
 * to prioritize recently added, potentially higher-quality templates.
 * 
 * @param {string} [theme] - Optional theme filter (e.g., "Professional", "Modern")
 * @param {string[]} [tags] - Optional array of tags to match (e.g., ["finance", "charts"])
 * @param {number} [limit=3] - Maximum number of templates to return (default: 3)
 * @returns {Promise<SlideTemplate[]>} Array of matching slide templates
 * 
 * @example
 * // Get 3 professional templates with finance-related tags
 * const templates = await getSlideTemplates("Professional", ["finance", "charts"], 3);
 * 
 * // Get any 5 templates without filtering
 * const allTemplates = await getSlideTemplates(undefined, undefined, 5);
 */
export async function getSlideTemplates(
  theme?: string,
  tags?: string[],
  limit: number = 3
): Promise<SlideTemplate[]> {
  // Initialize Supabase client for database operations
  const supabase = createClient();
  
  // Build base query: select all active templates, ordered by newest first
  let query = supabase
    .from('slide_templates')
    .select('*')
    .eq('is_active', true)           // Only fetch active templates (soft delete)
    .order('created_at', { ascending: false })  // Newest templates first
    .limit(limit);                   // Limit results for performance

  // CONDITIONAL FILTERING: Apply theme filter if specified
  // This helps find templates that match the user's selected visual theme
  if (theme) {
    query = query.eq('theme', theme);
  }

  // CONDITIONAL FILTERING: Apply tag-based filtering if specified
  // Uses PostgreSQL array overlap operator to find templates with matching tags
  if (tags && tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  // Execute the database query
  const { data, error } = await query;

  // ERROR HANDLING: Log errors and return empty array to prevent crashes
  // This ensures the application continues to function even if template fetching fails
  if (error) {
    console.error('Error fetching slide templates:', error);
    return [];
  }

  // Return templates or empty array if no data found
  return data || [];
}

/**
 * Get a random template for the specified theme
 * Fallback to any template if theme-specific ones aren't available
 */
export async function getRandomTemplate(theme?: string): Promise<SlideTemplate | null> {
  const templates = await getSlideTemplates(theme, undefined, 5);
  
  if (templates.length === 0) {
    // Fallback to any available template
    const fallbackTemplates = await getSlideTemplates(undefined, undefined, 5);
    if (fallbackTemplates.length === 0) return null;
    return fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
  }
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Create a new slide template
 * Useful for adding more examples to improve AI generation
 */
export async function createSlideTemplate(template: Omit<SlideTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<SlideTemplate | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('slide_templates')
    .insert([template])
    .select()
    .single();

  if (error) {
    console.error('Error creating slide template:', error);
    return null;
  }

  return data;
}

/**
 * Format template for OpenAI prompt
 * Extracts key structural elements and styling patterns
 */
export function formatTemplateForPrompt(template: SlideTemplate): string {
  return `
EXAMPLE TEMPLATE: ${template.name}
Theme: ${template.theme}
Description: ${template.description}

HTML Structure:
${template.html_content}

Key Features:
- Aspect Ratio: ${template.aspect_ratio}
- CSS Scoped: ${template.css_scoped ? 'Yes' : 'No'}
- Tags: ${template.tags.join(', ')}
`;
}