// lib/presentations-db.ts
// Database operations for presentations with integrated builder flow data

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SlideData, ParsedDocument, ResearchOptions } from '@/app/build/page';
import { SlideDefinition } from '@/lib/slide-types';

// Types for the enhanced presentations table
export interface PresentationRecord {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  
  // Basic presentation metadata
  title?: string;
  description?: string;
  status: string;
  thumbnail_url?: string;
  
  // Builder flow data
  current_step: number;
  builder_status: 'draft' | 'in_progress' | 'completed' | 'archived';
  
  // Step data
  documents: any[];
  parsed_documents: ParsedDocument[];
  selected_model: string;
  content_plan?: string;
  user_feedback?: string;
  wants_research: boolean;
  research_options: ResearchOptions;
  research_data?: string;
  selected_theme?: string;
  selected_palette: string[];
  theme_customizations: Record<string, any>;
  palette_mode?: 'logo' | 'ai' | 'manual';
  slide_html?: string;
  slide_json?: SlideDefinition;
  generation_prompt?: string;
  generation_metadata: Record<string, any>;
  download_history: any[];
  share_links: any[];
  
  // Timestamps
  content_plan_generated_at?: string;
  research_completed_at?: string;
  slide_generated_at?: string;
  exports_completed_at?: string;
  
  // Tracking
  step_timestamps: Record<string, string>;
  error_logs: any[];
  total_generation_time: number;
  api_calls_made: Record<string, number>;
}

export interface PresentationUpdate {
  title?: string;
  description?: string;
  current_step?: number;
  builder_status?: 'draft' | 'in_progress' | 'completed' | 'archived';
  documents?: any[];
  parsed_documents?: ParsedDocument[];
  selected_model?: string;
  content_plan?: string;
  user_feedback?: string;
  wants_research?: boolean;
  research_options?: ResearchOptions;
  research_data?: string;
  selected_theme?: string;
  selected_palette?: string[];
  theme_customizations?: Record<string, any>;
  palette_mode?: 'logo' | 'ai' | 'manual';
  slide_html?: string;
  slide_json?: SlideDefinition;
  generation_prompt?: string;
  generation_metadata?: Record<string, any>;
  download_history?: any[];
  share_links?: any[];
  step_timestamps?: Record<string, string>;
  error_logs?: any[];
  total_generation_time?: number;
  api_calls_made?: Record<string, number>;
  last_accessed_at?: string;
}

class PresentationsDB {
  private supabase = createClientComponentClient();

  /**
   * Create a new presentation with builder flow initialization
   */
  async createPresentation(slideData: SlideData, userId?: string): Promise<PresentationRecord | null> {
    try {
      // Get current user if not provided
      if (!userId) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        userId = user.id;
      }

      const presentationData: Partial<PresentationRecord> = {
        user_id: userId,
        title: slideData.title || 'Untitled Presentation',
        description: slideData.description,
        status: 'active',
        builder_status: 'draft',
        current_step: 1,
        
        // Step 1 data
        documents: this.serializeDocuments(slideData.documents || []),
        parsed_documents: slideData.parsedDocuments || [],
        selected_model: (slideData as any).selectedModel || 'gpt-4',
        
        // Initialize other fields with defaults
        wants_research: slideData.wantsResearch || false,
        research_options: slideData.researchOptions || {
          maxResults: 4,
          includeImages: true,
          includeAnswer: 'advanced',
          timeRange: 'month',
          excludeSocial: true
        },
        selected_palette: slideData.selectedPalette || [],
        theme_customizations: {},
        generation_metadata: {},
        download_history: [],
        share_links: [],
        step_timestamps: { step_1: new Date().toISOString() },
        error_logs: [],
        total_generation_time: 0,
        api_calls_made: {
          content_planning: 0,
          research: 0,
          slide_generation: 0,
          color_generation: 0
        },
        last_accessed_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('presentations')
        .insert(presentationData)
        .select()
        .single();

      if (error) {
        console.error('Error creating presentation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createPresentation:', error);
      return null;
    }
  }

  /**
   * Update an existing presentation with new builder data
   */
  async updatePresentation(presentationId: string, updates: PresentationUpdate): Promise<PresentationRecord | null> {
    try {
      // Add step timestamp if current_step is being updated
      if (updates.current_step) {
        const stepKey = `step_${updates.current_step}`;
        updates.step_timestamps = {
          ...updates.step_timestamps,
          [stepKey]: new Date().toISOString()
        };
      }

      // Always update last_accessed_at
      updates.last_accessed_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('presentations')
        .update(updates)
        .eq('id', presentationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating presentation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updatePresentation:', error);
      return null;
    }
  }

  /**
   * Get a presentation by ID
   */
  async getPresentation(presentationId: string): Promise<PresentationRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('presentations')
        .select('*')
        .eq('id', presentationId)
        .single();

      if (error) {
        console.error('Error getting presentation:', error);
        return null;
      }

      // Update last accessed time
      await this.supabase
        .from('presentations')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', presentationId);

      return data;
    } catch (error) {
      console.error('Error in getPresentation:', error);
      return null;
    }
  }

  /**
   * Get all presentations for current user
   */
  async getUserPresentations(userId?: string): Promise<PresentationRecord[]> {
    try {
      let query = this.supabase.from('active_presentations').select('*');
      
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        console.error('Error getting user presentations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserPresentations:', error);
      return [];
    }
  }

  /**
   * Convert SlideData to presentation updates for a specific step
   */
  getStepUpdates(step: number, slideData: SlideData): PresentationUpdate {
    const updates: PresentationUpdate = {
      current_step: step,
      builder_status: step === 4 ? 'completed' : 'in_progress'
    };

    switch (step) {
      case 1: // Upload step
        updates.documents = this.serializeDocuments(slideData.documents || []);
        updates.parsed_documents = slideData.parsedDocuments || [];
        updates.selected_model = (slideData as any).selectedModel || 'gpt-4';
        updates.description = slideData.description;
        updates.title = slideData.title || updates.title;
        break;

      case 2: // Research step
        updates.wants_research = slideData.wantsResearch;
        updates.research_options = slideData.researchOptions;
        updates.research_data = slideData.researchData;
        if (slideData.researchData) {
          updates.research_completed_at = new Date().toISOString();
        }
        break;

      case 3: // Theme step
        updates.selected_theme = slideData.selectedTheme;
        updates.selected_palette = slideData.selectedPalette || [];
        break;

      case 4: // Preview step
        updates.slide_html = slideData.slideHtml;
        updates.slide_json = (slideData as any).slideJson;
        if (slideData.slideHtml || (slideData as any).slideJson) {
          updates.slide_generated_at = new Date().toISOString();
        }
        break;
    }

    return updates;
  }

  /**
   * Convert PresentationRecord back to SlideData format
   */
  presentationToSlideData(presentation: PresentationRecord): SlideData {
    return {
      // Basic fields
      title: presentation.title || '',
      description: presentation.description || '',
      documents: this.deserializeDocuments(presentation.documents),
      parsedDocuments: presentation.parsed_documents,
      
      // Research fields  
      wantsResearch: presentation.wants_research,
      researchOptions: presentation.research_options,
      researchData: presentation.research_data,
      
      // Theme fields
      selectedTheme: presentation.selected_theme || '',
      selectedPalette: presentation.selected_palette,
      
      // Generated content
      slideHtml: presentation.slide_html,
      
      // Extended fields
      ...(presentation.slide_json && { slideJson: presentation.slide_json }),
      ...(presentation.selected_model && { selectedModel: presentation.selected_model })
    } as SlideData;
  }

  /**
   * Log an error for a presentation
   */
  async logError(presentationId: string, step: number, error: string): Promise<void> {
    try {
      const presentation = await this.getPresentation(presentationId);
      if (!presentation) return;

      const errorLog = {
        step,
        error,
        timestamp: new Date().toISOString()
      };

      await this.updatePresentation(presentationId, {
        error_logs: [...presentation.error_logs, errorLog]
      });
    } catch (err) {
      console.error('Error logging error:', err);
    }
  }

  /**
   * Track API call for analytics
   */
  async trackAPICall(presentationId: string, apiType: keyof PresentationRecord['api_calls_made']): Promise<void> {
    try {
      const presentation = await this.getPresentation(presentationId);
      if (!presentation) return;

      const updatedCalls = {
        ...presentation.api_calls_made,
        [apiType]: (presentation.api_calls_made[apiType] || 0) + 1
      };

      await this.updatePresentation(presentationId, {
        api_calls_made: updatedCalls
      });
    } catch (error) {
      console.error('Error tracking API call:', error);
    }
  }

  /**
   * Helper to serialize File objects for storage
   */
  private serializeDocuments(files: File[]): any[] {
    return files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }));
  }

  /**
   * Helper to deserialize file metadata
   */
  private deserializeDocuments(serialized: any[]): File[] {
    // Note: We can't recreate actual File objects from metadata
    return [];
  }
}

// Export singleton instance
export const presentationsDB = new PresentationsDB();
export default presentationsDB;