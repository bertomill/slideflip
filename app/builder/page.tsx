"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UploadStep } from "@/components/builder/upload-step";
import { ThemeStep } from "@/components/builder/theme-step";
import { ResearchStep } from "@/components/builder/research-step";
import { PreviewStep } from "@/components/builder/preview-step";
import { DownloadStep } from "@/components/builder/download-step";
import { BackendStatus } from "@/components/backend-status";
import { useWebSocket } from "@/hooks/use-websocket";

// Type definition for research options that can be customized by users
export type ResearchOptions = {
  maxResults: number;       // Number of search results to return (1-10)
  includeImages: boolean;   // Whether to include images in results
  includeAnswer: 'basic' | 'advanced'; // Level of AI-generated answer
  timeRange: 'day' | 'week' | 'month' | 'year' | 'all'; // Time range for search
  excludeSocial: boolean;   // Whether to exclude social media sites
};

// Type definition for slide data that flows through the builder steps
export type SlideData = {
  documents: File[];        // User-uploaded files for slide content
  description: string;      // User's description of what the slide should contain
  selectedTheme: string;    // Visual theme choice for the presentation
  wantsResearch: boolean;   // Whether user wants additional research performed
  researchOptions?: ResearchOptions; // Customizable research parameters
  researchData?: string;    // Optional research results from external sources
  slideHtml?: string;       // Generated HTML content for the slide
  pptFilePath?: string;     // Path to the generated PPT file for download
  userFeedback?: string;    // User's feedback for slide refinements
  isGenerating?: boolean;   // Whether slide generation is in progress
  generationStatus?: string; // Current status message from backend
  generationError?: string; // Error message if generation fails
};

// Configuration for the multi-step slide builder process
const steps = [
  { id: 1, name: "Upload", description: "Upload documents & describe your slide" },
  { id: 2, name: "Theme", description: "Choose a visual theme" },
  { id: 3, name: "Research", description: "Additional research options" },
  { id: 4, name: "Preview", description: "Review and refine your slide" },
  { id: 5, name: "Download", description: "Export your presentation" },
];

/**
 * Main SlideBuilder component that orchestrates the multi-step slide creation process
 * Manages state flow between upload, theme selection, research, preview, and download steps
 */
export default function SlideBuilder() {
  // State Management: Track current position in the 5-step builder workflow
  const [currentStep, setCurrentStep] = useState(1);
  
  // Use useRef to ensure client ID is stable across re-renders and avoid hydration issues
  const clientIdRef = useRef<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Generate client ID only on the client side to avoid hydration issues
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = `client_${Date.now()}`;
      setClientId(clientIdRef.current);
    }
  }, []);

  // WebSocket connection for backend communication
  const { 
    isConnected, 
    connectionStatus, 
    lastMessage, 
    ping,
    sendFileUpload,
    sendSlideDescription,
    sendGenerateSlide
  } = useWebSocket({
    clientId: clientId || 'temp_client',
    onMessage: (message) => {
      console.log('Builder received:', message);
      
      // Handle slide generation messages
      if (message.type === 'slide_generation_started') {
        console.log('Slide generation started');
        updateSlideData({ isGenerating: true, generationError: undefined });
      } else if (message.type === 'slide_generation_status') {
        console.log('Slide generation status:', message.data.message);
        updateSlideData({ generationStatus: message.data.message });
      } else if (message.type === 'slide_generation_complete') {
        console.log('Slide generation completed');
        updateSlideData({ 
          slideHtml: message.data.slide_html, 
          pptFilePath: message.data.ppt_file_path,
          isGenerating: false, 
          generationError: undefined,
          generationStatus: undefined 
        });
      } else if (message.type === 'slide_generation_error') {
        console.error('Slide generation error:', message.data.error);
        updateSlideData({ 
          isGenerating: false, 
          generationError: message.data.error 
        });
      }
    }
  });

  // State Management: Centralized storage for all slide data that accumulates across steps
  // Initialized with empty values that get populated as user progresses
  const [slideData, setSlideData] = useState<SlideData>({
    documents: [],
    description: "",
    selectedTheme: "",
    wantsResearch: false,
  });

  // Data Flow: Helper function to update slide data from child step components
  // Uses partial updates to preserve existing data while adding new information
  const updateSlideData = (updates: Partial<SlideData>) => {
    setSlideData(prev => ({ ...prev, ...updates }));
  };

  // Navigation: Move forward to the next step in the builder sequence
  // Includes bounds checking to prevent going beyond the final step
  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Navigation: Move backward to the previous step in the builder sequence
  // Includes bounds checking to prevent going before the first step
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Navigation: Jump directly to a specific step with validation
  // Prevents users from skipping ahead to incomplete steps, maintaining data integrity
  const goToStep = (stepId: number) => {
    // Security: Only allow navigation to completed or current steps
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
    }
  };

  // Component Rendering: Dynamic step component selection based on current workflow position
  // Each step receives slideData for context and callbacks for navigation and data updates
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <UploadStep 
            slideData={slideData} 
            updateSlideData={updateSlideData} 
            onNext={nextStep}
            isConnected={isConnected}
            connectionStatus={connectionStatus}
            sendFileUpload={sendFileUpload}
            sendSlideDescription={sendSlideDescription}
            lastMessage={lastMessage}
          />
        );
      case 2:
        return <ThemeStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 3:
        return <ResearchStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} sendGenerateSlide={sendGenerateSlide} />;
      case 4:
        return <PreviewStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} sendGenerateSlide={sendGenerateSlide} />;
      case 5:
        return <DownloadStep slideData={slideData} onPrev={prevStep} />;
      default:
        return null;
    }
  };

  // Don't render until client ID is generated to avoid hydration issues
  if (!clientId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar with branding and theme toggle */}
      <Navigation variant="premium">
        <NavigationBrand>
          <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
            <div className="h-3 w-3 bg-background rounded-sm"></div>
          </div>
          <span className="font-semibold text-foreground">
            SlideFlip Builder
          </span>
        </NavigationBrand>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </Navigation>

      <div className="container mx-auto px-4 py-8">
        {/* Progress indicator showing all steps and current position */}
        <Card variant="glass" className="mb-8">
          <CardContent className="p-6">
            {/* Horizontal step progress bar with clickable navigation */}
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  {/* Clickable step container - allows navigation to completed/current steps only */}
                  <button
                    onClick={() => goToStep(step.id)}
                    disabled={step.id > currentStep}
                    className={`flex items-center transition-premium ${step.id <= currentStep ? "cursor-pointer" : "cursor-not-allowed"
                      } ${step.id < currentStep ? "hover:scale-105" : ""}`}
                  >
                    {/* Circular step number indicator with visual state based on completion */}
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-premium ${currentStep >= step.id
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground text-muted-foreground"
                        }`}
                    >
                      {step.id}
                    </div>
                    {/* Step details - responsive text that hides on mobile screens */}
                    <div className="ml-3 hidden sm:block text-left">
                      <p className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                        }`}>
                        {step.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </button>
                  {/* Connecting line between steps */}
                  {index < steps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-4 ${currentStep > step.id ? "bg-primary" : "bg-muted"
                      }`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main content area for the current step */}
        <div className="max-w-4xl mx-auto">
          {renderStep()}
        </div>

        {/* Backend Status (for testing) */}
        {/* <div className="fixed bottom-4 right-4">
          <BackendStatus 
            clientId={clientId}
            isConnected={isConnected}
            connectionStatus={connectionStatus}
            lastMessage={lastMessage}
            onPing={ping}
          />
        </div> */}
      </div>
    </div>
  );
}