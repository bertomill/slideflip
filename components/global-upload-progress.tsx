"use client";

import { UploadProgressShelf } from '@/components/ui/upload-progress-shelf';
import { useUploadProgress } from '@/contexts/upload-progress-context';

export function GlobalUploadProgress() {
  const { uploadProgress, hideUploadProgress } = useUploadProgress();

  return (
    <UploadProgressShelf
      isOpen={uploadProgress.isOpen}
      fileName={uploadProgress.fileName}
      currentStep={uploadProgress.currentStep}
      error={uploadProgress.error}
      onClose={hideUploadProgress}
    />
  );
}