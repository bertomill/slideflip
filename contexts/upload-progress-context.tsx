"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface UploadProgressState {
  isOpen: boolean;
  fileName: string;
  currentStep: string;
  error?: string;
}

interface UploadProgressContextType {
  uploadProgress: UploadProgressState;
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgressState>>;
  showUploadProgress: (fileName: string) => void;
  hideUploadProgress: () => void;
  updateUploadStep: (step: string, error?: string) => void;
}

const UploadProgressContext = createContext<UploadProgressContextType | undefined>(undefined);

export function UploadProgressProvider({ children }: { children: ReactNode }) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    isOpen: false,
    fileName: '',
    currentStep: 'upload',
    error: undefined
  });

  const showUploadProgress = (fileName: string) => {
    setUploadProgress({
      isOpen: true,
      fileName,
      currentStep: 'upload',
      error: undefined
    });
  };

  const hideUploadProgress = () => {
    setUploadProgress(prev => ({ 
      ...prev, 
      isOpen: false 
    }));
  };

  const updateUploadStep = (step: string, error?: string) => {
    setUploadProgress(prev => ({
      ...prev,
      currentStep: step,
      error
    }));
  };

  return (
    <UploadProgressContext.Provider
      value={{
        uploadProgress,
        setUploadProgress,
        showUploadProgress,
        hideUploadProgress,
        updateUploadStep
      }}
    >
      {children}
    </UploadProgressContext.Provider>
  );
}

export function useUploadProgress() {
  const context = useContext(UploadProgressContext);
  if (context === undefined) {
    throw new Error('useUploadProgress must be used within an UploadProgressProvider');
  }
  return context;
}