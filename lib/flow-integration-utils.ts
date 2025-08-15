// lib/flow-integration-utils.ts
// Utilities to help integrate flows into existing builder components

import { SlideData } from '@/app/build/page';

/**
 * Helper functions to add flow saving to existing builder step components
 * Use these in your existing components to gradually add flow persistence
 */

// Utility to save flow data after API calls
export async function saveFlowAfterAPI(
  flowId: string | undefined,
  step: number,
  apiCallType: 'content_planning' | 'research' | 'slide_generation' | 'color_generation',
  slideDataUpdates: Partial<SlideData>,
  additionalUpdates: Record<string, any> = {}
) {
  if (!flowId) {
    console.warn('No flow ID provided, skipping save');
    return;
  }

  try {
    // Increment API call counter
    const apiCallUpdate = {
      [`api_calls_made.${apiCallType}`]: 1
    };

    // Prepare update payload
    const updatePayload = {
      current_step: step,
      ...convertSlideDataToFlowUpdates(step, slideDataUpdates),
      ...additionalUpdates,
      ...apiCallUpdate
    };

    // Save to database
    const response = await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    if (!response.ok) {
      throw new Error(`Failed to save flow: ${response.status}`);
    }

    const result = await response.json();
    console.log('Flow saved successfully:', result);
    return result.flow;

  } catch (error) {
    console.error('Error saving flow:', error);
    
    // Log error to flow
    if (flowId) {
      await logFlowError(flowId, step, `Save error: ${error}`);
    }
  }
}

// Convert SlideData updates to flow database updates
export function convertSlideDataToFlowUpdates(step: number, slideData: Partial<SlideData>): Record<string, any> {
  const updates: Record<string, any> = {};

  // Always update description if provided
  if (slideData.description !== undefined) {
    updates.description = slideData.description;
  }

  // Step-specific updates
  switch (step) {
    case 1: // Upload step
      if (slideData.documents !== undefined) {
        updates.documents = slideData.documents.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }));
      }
      if (slideData.parsedDocuments !== undefined) {
        updates.parsed_documents = slideData.parsedDocuments;
      }
      if ((slideData as any).selectedModel !== undefined) {
        updates.selected_model = (slideData as any).selectedModel;
      }
      break;

    case 2: // Content step  
      if (slideData.contentPlan !== undefined) {
        updates.content_plan = slideData.contentPlan;
        if (slideData.contentPlan) {
          updates.content_plan_generated_at = new Date().toISOString();
        }
      }
      if (slideData.userFeedback !== undefined) {
        updates.user_feedback = slideData.userFeedback;
      }
      break;

    case 3: // Research step
      if (slideData.wantsResearch !== undefined) {
        updates.wants_research = slideData.wantsResearch;
      }
      if (slideData.researchOptions !== undefined) {
        updates.research_options = slideData.researchOptions;
      }
      if (slideData.researchData !== undefined) {
        updates.research_data = slideData.researchData;
        if (slideData.researchData) {
          updates.research_completed_at = new Date().toISOString();
        }
      }
      break;

    case 4: // Theme step
      if (slideData.selectedTheme !== undefined) {
        updates.selected_theme = slideData.selectedTheme;
      }
      if (slideData.selectedPalette !== undefined) {
        updates.selected_palette = slideData.selectedPalette;
      }
      break;

    case 5: // Preview step
      if (slideData.slideHtml !== undefined) {
        updates.slide_html = slideData.slideHtml;
      }
      if ((slideData as any).slideJson !== undefined) {
        updates.slide_json = (slideData as any).slideJson;
        updates.slide_generated_at = new Date().toISOString();
      }
      break;
  }

  return updates;
}

// Log an error to the flow
export async function logFlowError(
  flowId: string,
  step: number,
  errorMessage: string
) {
  try {
    // Get current flow to append to error logs
    const response = await fetch(`/api/flows/${flowId}`);
    if (!response.ok) return;

    const { flow } = await response.json();
    
    const errorLog = {
      step,
      error: errorMessage,
      timestamp: new Date().toISOString()
    };

    const updatedErrorLogs = [...(flow.error_logs || []), errorLog];

    // Update flow with new error log
    await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_logs: updatedErrorLogs
      })
    });

  } catch (error) {
    console.error('Failed to log error to flow:', error);
  }
}

// Track API call for analytics
export async function trackFlowAPICall(
  flowId: string,
  apiType: 'content_planning' | 'research' | 'slide_generation' | 'color_generation'
) {
  if (!flowId) return;

  try {
    // Get current flow
    const response = await fetch(`/api/flows/${flowId}`);
    if (!response.ok) return;

    const { flow } = await response.json();
    
    const updatedApiCalls = {
      ...flow.api_calls_made,
      [apiType]: (flow.api_calls_made[apiType] || 0) + 1
    };

    // Update flow
    await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_calls_made: updatedApiCalls
      })
    });

  } catch (error) {
    console.error('Failed to track API call:', error);
  }
}

// Get flow ID from URL params or localStorage
export function getFlowId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // First try URL params
  const params = new URLSearchParams(window.location.search);
  const flowId = params.get('flow_id');
  
  if (flowId) {
    return flowId;
  }

  // Fallback to localStorage (for backward compatibility)
  return localStorage.getItem('currentFlowId');
}

// Save flow ID to localStorage for persistence
export function saveFlowId(flowId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('currentFlowId', flowId);
}

// Clear flow ID from localStorage
export function clearFlowId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('currentFlowId');
}

// Update step completion timestamp
export async function markFlowStepComplete(
  flowId: string,
  step: number,
  slideData: SlideData
) {
  if (!flowId) return;

  try {
    const updates = {
      ...convertSlideDataToFlowUpdates(step, slideData),
      current_step: Math.min(step + 1, 6),
      status: step === 6 ? 'completed' : 'in_progress'
    };

    const response = await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Failed to mark step complete: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error marking step complete:', error);
    await logFlowError(flowId, step, `Step completion error: ${error}`);
  }
}

// Example usage in existing components:
// 
// // In content-step.tsx, after content plan generation:
// const generateContentPlan = async () => {
//   const flowId = getFlowId();
//   // ... existing API call logic ...
//   
//   if (success && flowId) {
//     await saveFlowAfterAPI(flowId, 2, 'content_planning', {
//       contentPlan: data.contentPlan
//     });
//   }
// };
//
// // In research-step.tsx, after research completion:  
// const startResearch = async () => {
//   const flowId = getFlowId();
//   // ... existing research logic ...
//   
//   if (success && flowId) {
//     await saveFlowAfterAPI(flowId, 3, 'research', {
//       researchData: data.researchData
//     });
//   }
// };

export default {
  saveFlowAfterAPI,
  convertSlideDataToFlowUpdates,
  logFlowError,
  trackFlowAPICall,
  getFlowId,
  saveFlowId,
  clearFlowId,
  markFlowStepComplete
};