// lib/flows-db.ts
// Database operations for the comprehensive flows table

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SlideData, ParsedDocument, ResearchOptions } from '@/app/build/page';
import { SlideDefinition } from '@/lib/slide-types';

// Types for the flows table
export interface FlowRecord {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  
  // Metadata
  title?: string;
  description: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  current_step: number;
  
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

export interface FlowUpdate {
  current_step?: number;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
  title?: string;
  description?: string;
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
}

class FlowsDB {
  private supabase = createClientComponentClient();

  /**
   * Create a new flow from initial slide data
   */
  async createFlow(slideData: SlideData, userId?: string): Promise<FlowRecord | null> {
    try {
      // Get current user if not provided
      if (!userId) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        userId = user.id;
      }

      const flowData: Partial<FlowRecord> = {
        user_id: userId,
        description: slideData.description,
        status: 'draft',
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
        }
      };

      const { data, error } = await this.supabase
        .from('flows')
        .insert(flowData)
        .select()
        .single();

      if (error) {
        console.error('Error creating flow:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createFlow:', error);
      return null;
    }
  }

  /**
   * Update an existing flow with new data
   */
  async updateFlow(flowId: string, updates: FlowUpdate): Promise<FlowRecord | null> {
    try {
      // Add step timestamp if current_step is being updated
      if (updates.current_step) {
        const stepKey = `step_${updates.current_step}`;
        updates.step_timestamps = {
          ...updates.step_timestamps,
          [stepKey]: new Date().toISOString()
        };
      }

      const { data, error } = await this.supabase
        .from('flows')
        .update(updates)
        .eq('id', flowId)
        .select()
        .single();

      if (error) {
        console.error('Error updating flow:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateFlow:', error);
      return null;
    }
  }

  /**
   * Get a flow by ID
   */
  async getFlow(flowId: string): Promise<FlowRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('flows')
        .select('*')
        .eq('id', flowId)
        .single();

      if (error) {
        console.error('Error getting flow:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getFlow:', error);
      return null;
    }
  }

  /**
   * Get all flows for current user
   */
  async getUserFlows(userId?: string): Promise<FlowRecord[]> {
    try {
      let query = this.supabase.from('active_flows').select('*');
      
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        console.error('Error getting user flows:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserFlows:', error);
      return [];
    }
  }

  /**
   * Convert SlideData to flow updates for a specific step
   */
  getStepUpdates(step: number, slideData: SlideData): FlowUpdate {
    const updates: FlowUpdate = {
      current_step: step,
      status: step === 6 ? 'completed' : 'in_progress'
    };

    switch (step) {
      case 1: // Upload step
        updates.documents = this.serializeDocuments(slideData.documents || []);
        updates.parsed_documents = slideData.parsedDocuments || [];
        updates.selected_model = (slideData as any).selectedModel || 'gpt-4';
        updates.description = slideData.description;
        break;

      case 2: // Content step
        updates.content_plan = slideData.contentPlan;
        updates.user_feedback = slideData.userFeedback;
        if (slideData.contentPlan) {
          updates.content_plan_generated_at = new Date().toISOString();
        }
        break;

      case 3: // Research step
        updates.wants_research = slideData.wantsResearch;
        updates.research_options = slideData.researchOptions;
        updates.research_data = slideData.researchData;
        if (slideData.researchData) {
          updates.research_completed_at = new Date().toISOString();
        }
        break;

      case 4: // Theme step
        updates.selected_theme = slideData.selectedTheme;
        updates.selected_palette = slideData.selectedPalette || [];
        // You might want to capture how the palette was generated
        break;

      case 5: // Preview step
        updates.slide_html = slideData.slideHtml;
        updates.slide_json = (slideData as any).slideJson;
        if (slideData.slideHtml || (slideData as any).slideJson) {
          updates.slide_generated_at = new Date().toISOString();
        }
        break;

      case 6: // Download step
        updates.exports_completed_at = new Date().toISOString();
        break;
    }

    return updates;
  }

  /**
   * Convert FlowRecord back to SlideData format
   */
  flowToSlideData(flow: FlowRecord): SlideData {
    return {
      // Basic fields
      description: flow.description,
      documents: this.deserializeDocuments(flow.documents),
      parsedDocuments: flow.parsed_documents,
      
      // Content fields
      contentPlan: flow.content_plan,
      userFeedback: flow.user_feedback,
      
      // Research fields  
      wantsResearch: flow.wants_research,
      researchOptions: flow.research_options,
      researchData: flow.research_data,
      
      // Theme fields
      selectedTheme: flow.selected_theme || '',
      selectedPalette: flow.selected_palette,
      
      // Generated content
      slideHtml: flow.slide_html,
      
      // Extended fields
      ...(flow.slide_json && { slideJson: flow.slide_json }),
      ...(flow.selected_model && { selectedModel: flow.selected_model })
    } as SlideData;
  }

  /**
   * Log an error for a flow
   */
  async logError(flowId: string, step: number, error: string): Promise<void> {
    try {
      const flow = await this.getFlow(flowId);
      if (!flow) return;

      const errorLog = {
        step,
        error,
        timestamp: new Date().toISOString()
      };

      await this.updateFlow(flowId, {
        error_logs: [...flow.error_logs, errorLog]
      });
    } catch (err) {
      console.error('Error logging error:', err);
    }
  }

  /**
   * Track API call for analytics
   */
  async trackAPICall(flowId: string, apiType: keyof FlowRecord['api_calls_made']): Promise<void> {
    try {
      const flow = await this.getFlow(flowId);
      if (!flow) return;

      const updatedCalls = {
        ...flow.api_calls_made,
        [apiType]: (flow.api_calls_made[apiType] || 0) + 1
      };

      await this.updateFlow(flowId, {
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
   * Helper to deserialize file metadata (note: actual File objects can't be restored)
   */
  private deserializeDocuments(serialized: any[]): File[] {
    // Note: We can't recreate actual File objects from metadata
    // This is a limitation - you might need to handle this differently
    // depending on your use case
    return [];
  }
}

// Export singleton instance
export const flowsDB = new FlowsDB();
export default flowsDB;