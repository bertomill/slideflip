"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Image, FileText, Loader2 } from 'lucide-react';

interface PptxImportDialogProps {
  onImport: (slideJson: any) => void;
}

/**
 * Enhanced PPTX Import Dialog
 * 
 * Provides multiple import options:
 * 1. Upload PPTX for text extraction (current implementation)
 * 2. Upload screenshot/image of slide (perfect visual)
 * 3. Instructions for exporting from PowerPoint
 */
export function PptxImportDialog({ onImport }: PptxImportDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [importMode, setImportMode] = useState<'extract' | 'image'>('image');
  
  const handlePptxUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const endpoint = importMode === 'extract' 
        ? '/api/convert-pptx-to-png'
        : '/api/upload-slide-image';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      if (result.slideJson) {
        onImport(result.slideJson);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Import PowerPoint Slide</h2>
      
      <div className="space-y-6">
        {/* Option 1: Image Import (Recommended) */}
        <div className={`border rounded-lg p-4 ${importMode === 'image' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
          <div className="flex items-start space-x-3">
            <Image className="w-6 h-6 text-blue-600 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Import as Image (Recommended)</h3>
              <p className="text-sm text-gray-600 mb-3">
                Export your slide from PowerPoint as an image for perfect visual fidelity.
              </p>
              
              <div className="bg-gray-100 rounded p-3 mb-3">
                <p className="text-xs font-semibold mb-1">How to export from PowerPoint:</p>
                <ol className="text-xs text-gray-600 space-y-1">
                  <li>1. Open your presentation in PowerPoint</li>
                  <li>2. Go to File → Export → Change File Type</li>
                  <li>3. Select "PNG" or "JPEG"</li>
                  <li>4. Choose "Just This One" for single slide</li>
                  <li>5. Upload the exported image here</li>
                </ol>
              </div>
              
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportMode('image');
                    handlePptxUpload(file);
                  }
                }}
                className="hidden"
                id="image-upload"
                disabled={isUploading}
              />
              <label htmlFor="image-upload">
                <Button 
                  variant={importMode === 'image' ? 'default' : 'outline'}
                  disabled={isUploading}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    {isUploading && importMode === 'image' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Image
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </div>
        
        {/* Option 2: PPTX Text Extraction */}
        <div className={`border rounded-lg p-4 ${importMode === 'extract' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
          <div className="flex items-start space-x-3">
            <FileText className="w-6 h-6 text-orange-600 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Extract Text from PPTX</h3>
              <p className="text-sm text-gray-600 mb-3">
                Upload a PPTX file to extract text and basic shapes. Layout may not be exact.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ Note: This extracts text content but may not preserve exact visual layout
                </p>
              </div>
              
              <input
                type="file"
                accept=".pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportMode('extract');
                    handlePptxUpload(file);
                  }
                }}
                className="hidden"
                id="pptx-upload"
                disabled={isUploading}
              />
              <label htmlFor="pptx-upload">
                <Button 
                  variant={importMode === 'extract' ? 'default' : 'outline'}
                  disabled={isUploading}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    {isUploading && importMode === 'extract' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload PPTX
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </div>
        
        {/* Alternative: Take Screenshot */}
        <div className="border-t pt-4">
          <p className="text-sm text-gray-500">
            <strong>Quick tip:</strong> You can also take a screenshot of your slide 
            (Windows: Win+Shift+S, Mac: Cmd+Shift+4) and upload it as an image.
          </p>
        </div>
      </div>
    </div>
  );
}