// hooks/use-presentation.ts
// React hook for managing presentation state and builder data

import { useState, useEffect, useCallback } from 'react';
import { presentationsDB, PresentationRecord, PresentationUpdate } from '@/lib/presentations-db';
import { SlideData } from '@/app/build/page';

export interface UsePresentationOptions {
  autoSave?: boolean; // Automatically save changes to database
  saveDelay?: number; // Debounce delay for auto-save (ms)
}

export interface UsePresentationReturn {
  // State
  presentation: PresentationRecord | null;
  slideData: SlideData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Actions
  createPresentation: (initialData: SlideData) => Promise<string | null>; // Returns presentation ID
  loadPresentation: (presentationId: string) => Promise<void>;
  updateSlideData: (updates: Partial<SlideData>) => void;
  saveCurrentStep: (step: number) => Promise<void>;
  markStepComplete: (step: number) => Promise<void>;
  logError: (step: number, error: string) => Promise<void>;
  
  // Utilities
  getProgressPercentage: () => number;
  canProceedToStep: (step: number) => boolean;
}

export function usePresentation(options: UsePresentationOptions = {}): UsePresentationReturn {
  const { autoSave = true, saveDelay = 1000 } = options;
  
  // State
  const [presentation, setPresentation] = useState<PresentationRecord | null>(null);
  const [slideData, setSlideData] = useState<SlideData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Create a new presentation
  const createPresentation = useCallback(async (initialData: SlideData): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const newPresentation = await presentationsDB.createPresentation(initialData);
      if (!newPresentation) {
        setError('Failed to create presentation');
        return null;
      }

      setPresentation(newPresentation);
      setSlideData(presentationsDB.presentationToSlideData(newPresentation));
      return newPresentation.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load an existing presentation
  const loadPresentation = useCallback(async (presentationId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const loadedPresentation = await presentationsDB.getPresentation(presentationId);
      if (!loadedPresentation) {
        setError('Presentation not found');
        return;
      }

      setPresentation(loadedPresentation);
      setSlideData(presentationsDB.presentationToSlideData(loadedPresentation));
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
    if (autoSave && presentation) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      const timeout = setTimeout(async () => {
        try {
          setIsSaving(true);
          const stepUpdates = presentationsDB.getStepUpdates(presentation.current_step, newSlideData);
          const updatedPresentation = await presentationsDB.updatePresentation(presentation.id, stepUpdates);
          if (updatedPresentation) {
            setPresentation(updatedPresentation);
          }
        } catch (err) {
          console.error('Auto-save failed:', err);
        } finally {
          setIsSaving(false);
        }
      }, saveDelay);

      setSaveTimeout(timeout);
    }
  }, [slideData, presentation, autoSave, saveDelay, saveTimeout]);

  // Save current step data to database
  const saveCurrentStep = useCallback(async (step: number): Promise<void> => {
    if (!presentation || !slideData) return;

    try {
      setIsSaving(true);
      const updates = presentationsDB.getStepUpdates(step, slideData);
      const updatedPresentation = await presentationsDB.updatePresentation(presentation.id, updates);
      if (updatedPresentation) {
        setPresentation(updatedPresentation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [presentation, slideData]);

  // Mark a step as complete and advance to next step
  const markStepComplete = useCallback(async (step: number): Promise<void> => {
    if (!presentation || !slideData) return;

    try {
      setIsSaving(true);
      const updates: PresentationUpdate = {
        ...presentationsDB.getStepUpdates(step, slideData),
        current_step: Math.min(step + 1, 4),
        builder_status: step === 4 ? 'completed' : 'in_progress'
      };

      const updatedPresentation = await presentationsDB.updatePresentation(presentation.id, updates);
      if (updatedPresentation) {
        setPresentation(updatedPresentation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark step complete');
    } finally {
      setIsSaving(false);
    }
  }, [presentation, slideData]);

  // Log an error for the current presentation
  const logError = useCallback(async (step: number, errorMessage: string): Promise<void> => {
    if (!presentation) return;
    await presentationsDB.logError(presentation.id, step, errorMessage);
  }, [presentation]);

  // Get progress percentage
  const getProgressPercentage = useCallback((): number => {
    if (!presentation) return 0;
    
    if (presentation.builder_status === 'completed') return 100;
    
    const stepPercentages = {
      1: 25, // Upload
      2: 50, // Research
      3: 75, // Theme
      4: 100 // Preview
    };
    
    return stepPercentages[presentation.current_step as keyof typeof stepPercentages] || 0;
  }, [presentation]);

  // Check if user can proceed to a specific step
  const canProceedToStep = useCallback((targetStep: number): boolean => {
    if (!presentation) return false;
    
    // Can always go back to previous steps
    if (targetStep <= presentation.current_step) return true;
    
    // Can only proceed one step at a time
    return targetStep === presentation.current_step + 1;
  }, [presentation]);

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
    presentation,
    slideData,
    isLoading,
    isSaving,
    error,
    
    // Actions
    createPresentation,
    loadPresentation,
    updateSlideData,
    saveCurrentStep,
    markStepComplete,
    logError,
    
    // Utilities
    getProgressPercentage,
    canProceedToStep
  };
}