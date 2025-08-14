// hooks/use-flow.ts
// React hook for managing flow state and database operations

import { useState, useEffect, useCallback } from 'react';
import { flowsDB, FlowRecord, FlowUpdate } from '@/lib/flows-db';
import { SlideData } from '@/app/build/page';

export interface UseFlowOptions {
  autoSave?: boolean; // Automatically save changes to database
  saveDelay?: number; // Debounce delay for auto-save (ms)
}

export interface UseFlowReturn {
  // State
  flow: FlowRecord | null;
  slideData: SlideData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Actions
  createFlow: (initialData: SlideData) => Promise<string | null>; // Returns flow ID
  loadFlow: (flowId: string) => Promise<void>;
  updateSlideData: (updates: Partial<SlideData>) => void;
  saveCurrentStep: (step: number) => Promise<void>;
  markStepComplete: (step: number) => Promise<void>;
  logError: (step: number, error: string) => Promise<void>;
  
  // Utilities
  getProgressPercentage: () => number;
  canProceedToStep: (step: number) => boolean;
}

export function useFlow(options: UseFlowOptions = {}): UseFlowReturn {
  const { autoSave = true, saveDelay = 1000 } = options;
  
  // State
  const [flow, setFlow] = useState<FlowRecord | null>(null);
  const [slideData, setSlideData] = useState<SlideData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Create a new flow
  const createFlow = useCallback(async (initialData: SlideData): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const newFlow = await flowsDB.createFlow(initialData);
      if (!newFlow) {
        setError('Failed to create flow');
        return null;
      }

      setFlow(newFlow);
      setSlideData(flowsDB.flowToSlideData(newFlow));
      return newFlow.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load an existing flow
  const loadFlow = useCallback(async (flowId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const loadedFlow = await flowsDB.getFlow(flowId);
      if (!loadedFlow) {
        setError('Flow not found');
        return;
      }

      setFlow(loadedFlow);
      setSlideData(flowsDB.flowToSlideData(loadedFlow));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update slide data locally and optionally save to database
  const updateSlideData = useCallback((updates: Partial<SlideData>) => {
    if (!slideData) return;

    const newSlideData = { ...slideData, ...updates };
    setSlideData(newSlideData);

    // Auto-save with debouncing
    if (autoSave && flow) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      const timeout = setTimeout(async () => {
        try {
          setIsSaving(true);
          const stepUpdates = flowsDB.getStepUpdates(flow.current_step, newSlideData);
          const updatedFlow = await flowsDB.updateFlow(flow.id, stepUpdates);
          if (updatedFlow) {
            setFlow(updatedFlow);
          }
        } catch (err) {
          console.error('Auto-save failed:', err);
        } finally {
          setIsSaving(false);
        }
      }, saveDelay);

      setSaveTimeout(timeout);
    }
  }, [slideData, flow, autoSave, saveDelay, saveTimeout]);

  // Save current step data to database
  const saveCurrentStep = useCallback(async (step: number): Promise<void> => {
    if (!flow || !slideData) return;

    try {
      setIsSaving(true);
      const updates = flowsDB.getStepUpdates(step, slideData);
      const updatedFlow = await flowsDB.updateFlow(flow.id, updates);
      if (updatedFlow) {
        setFlow(updatedFlow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [flow, slideData]);

  // Mark a step as complete and advance to next step
  const markStepComplete = useCallback(async (step: number): Promise<void> => {
    if (!flow || !slideData) return;

    try {
      setIsSaving(true);
      const updates: FlowUpdate = {
        ...flowsDB.getStepUpdates(step, slideData),
        current_step: Math.min(step + 1, 6),
        status: step === 6 ? 'completed' : 'in_progress'
      };

      const updatedFlow = await flowsDB.updateFlow(flow.id, updates);
      if (updatedFlow) {
        setFlow(updatedFlow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark step complete');
    } finally {
      setIsSaving(false);
    }
  }, [flow, slideData]);

  // Log an error for the current flow
  const logError = useCallback(async (step: number, errorMessage: string): Promise<void> => {
    if (!flow) return;
    await flowsDB.logError(flow.id, step, errorMessage);
  }, [flow]);

  // Get progress percentage
  const getProgressPercentage = useCallback((): number => {
    if (!flow) return 0;
    
    if (flow.status === 'completed') return 100;
    
    const stepPercentages = {
      1: 15, // Upload
      2: 30, // Content  
      3: 45, // Research
      4: 60, // Theme
      5: 75, // Preview
      6: 90  // Download
    };
    
    return stepPercentages[flow.current_step as keyof typeof stepPercentages] || 0;
  }, [flow]);

  // Check if user can proceed to a specific step
  const canProceedToStep = useCallback((targetStep: number): boolean => {
    if (!flow) return false;
    
    // Can always go back to previous steps
    if (targetStep <= flow.current_step) return true;
    
    // Can only proceed one step at a time
    return targetStep === flow.current_step + 1;
  }, [flow]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  return {
    // State
    flow,
    slideData,
    isLoading,
    isSaving,
    error,
    
    // Actions
    createFlow,
    loadFlow,
    updateSlideData,
    saveCurrentStep,
    markStepComplete,
    logError,
    
    // Utilities
    getProgressPercentage,
    canProceedToStep
  };
}