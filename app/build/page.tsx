"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { UploadStep } from "@/components/builder/upload-step";
import { ThemeStep } from "@/components/builder/theme-step";
import { ResearchStep } from "@/components/builder/research-step";
import { ContentStep } from "@/components/builder/content-step";
import { PreviewStep } from "@/components/builder/preview-step";
import { DownloadStep } from "@/components/builder/download-step";
import { createClient } from "@/lib/supabase/client";

// ============================================================================
// TYPE DEFINITIONS: Data structures for the slide builder workflow
// ============================================================================

/**
 * Research configuration options that users can customize
 * Controls how external research is conducted via Tavily API
 */
export type ResearchOptions = {
  maxResults: number;       // Number of search results to return (1-10)
  includeImages: boolean;   // Whether to include images in results
  includeAnswer: 'basic' | 'advanced'; // Level of AI-generated answer
  timeRange: 'day' | 'week' | 'month' | 'year' | 'all'; // Time range for search
  excludeSocial: boolean;   // Whether to exclude social media sites
};

// Type definition for parsed document content
export type ParsedDocument = {
  filename: string;
  content: string;
  success: boolean;
  id?: string;
};

/**
 * Core data structure that flows through all builder steps
 * Accumulates user inputs and AI-generated content as user progresses
 */
export type SlideData = {
  documents: File[];        // User-uploaded files for slide content
  parsedDocuments?: ParsedDocument[]; // Extracted text content from uploaded documents
  sessionId?: string;       // Session ID for tracking document uploads
  description: string;      // User's description of what the slide should contain
  selectedTheme: string;    // Visual theme choice for the presentation
  wantsResearch: boolean;   // Whether user wants additional research performed
  researchOptions?: ResearchOptions; // Customizable research parameters
  researchData?: string;    // Optional research results from external sources
  contentPlan?: string;     // AI-generated content plan for user review
  userFeedback?: string;    // User's feedback and additional requirements
  slideHtml?: string;       // Generated HTML content for the slide
};

// Configuration for the multi-step slide builder process
const steps = [
  { id: 1, name: "Upload", description: "Upload & describe" },
  { id: 2, name: "Theme", description: "Choose theme" },
  { id: 3, name: "Research", description: "Research options" },
  { id: 4, name: "Content", description: "Plan content" },
  { id: 5, name: "Preview", description: "Review & refine" },
  { id: 6, name: "Download", description: "Export slide" },
];

/**
 * Main SlideBuilder component that orchestrates the multi-step slide creation process
 * Manages state flow between upload, theme selection, research, preview, and download steps
 */
export default function Build() {
  // ============================================================================
  // STATE MANAGEMENT: Core component state for workflow and UI control
  // ============================================================================

  // Workflow state - tracks current position in the 6-step builder process
  const [currentStep, setCurrentStep] = useState(1);

  // Authentication state - stores current user information from Supabase
  const [user, setUser] = useState<{
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } | null>(null);

  // UI state management for responsive navigation
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop sidebar collapse state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);     // Mobile menu visibility state

  // State Management: Centralized storage for all slide data that accumulates across steps
  // Initialized with empty values that get populated as user progresses
  const [slideData, setSlideData] = useState<SlideData>({
    documents: [],
    description: "",
    selectedTheme: "",
    wantsResearch: false,
  });

  // Effect: Load user authentication state on component mount
  useEffect(() => {
    const supabase = createClient();

    // Get initial user session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
        return <UploadStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} />;
      case 2:
        return <ThemeStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 3:
        return <ResearchStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 4:
        return <ContentStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 5:
        return <PreviewStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 6:
        return <DownloadStep slideData={slideData} onPrev={prevStep} onComplete={() => setCurrentStep(1)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen gradient-dark-blue flex">
      {/* Sidebar with user profile */}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main content area */}
      <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {/* Top navigation bar with branding and theme toggle */}
        <Navigation variant="premium">
          <NavigationBrand>
            <MobileMenuButton
              isOpen={mobileMenuOpen}
              onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mr-2"
            />
            <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
              <div className="h-3 w-3 bg-background rounded-sm"></div>
            </div>
            <span className="font-semibold text-foreground text-sm sm:text-base">
              SlideFlip Builder
            </span>
          </NavigationBrand>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
          </div>
        </Navigation>

        {/* MAIN CONTAINER: Full-width container with responsive padding and minimum height */}
        {/* - min-h-screen: 🔧 CRITICAL for sticky positioning - ensures enough height to scroll */}
        {/* - Responsive padding: Smaller on mobile (px-2 py-2), larger on desktop (px-4 py-8) */}
        <div className="w-full px-2 sm:px-4 py-2 sm:py-8 min-h-screen">
          {/* ============================================================================
              MAIN LAYOUT: Two-column responsive layout for slide builder interface
              ============================================================================
              - Mobile: Single column with progress sidebar below main content
              - Desktop: Two columns with main content (flex-1) and fixed-width sidebar (320px)
              - Sidebar is sticky positioned to remain visible during scrolling
              - relative: 🔧 Creates positioning context to support sticky behavior
              ============================================================================ */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 relative">

            {/* ========================================================================
                PRIMARY CONTENT AREA: Dynamic step component rendering
                ========================================================================
                - flex-1: Takes remaining space after sidebar allocation
                - min-w-0: Prevents flex item from overflowing container
                - Contains the active step component (Upload, Theme, Research, etc.)
                ======================================================================== */}
            <div className="flex-1 min-w-0">
              {renderStep()}
            </div>

            {/* ========================================================================
                PROGRESS SIDEBAR: Vertical step navigation and progress tracking
                ========================================================================
                - Fixed width (320px) on desktop, full width on mobile
                - flex-shrink-0: Prevents sidebar from shrinking when content is large
                - Sticky positioning wrapper keeps sidebar visible during scrolling
                - Glass card variant provides subtle background with blur effect
                ======================================================================== */}
            <div className="w-full lg:w-80 flex-shrink-0">
              {/* 🔧 STICKY POSITIONING IMPLEMENTATION: This div makes the sidebar sticky! */}
              {/* - lg:sticky: Enables sticky positioning only on large screens (≥1024px) */}
              {/* - lg:top-8: Sets 2rem (32px) offset from viewport top when sticky */}
              {/* - On mobile: Normal scroll behavior (no sticky) for better UX */}
              {/* - This keeps the progress tracker visible while scrolling through content */}
              <div className="lg:sticky lg:top-8">
                {/* PROGRESS CARD: Glass-effect container for step navigation */}
                <Card variant="glass">
                  <CardContent className="p-4 sm:p-6">
                    {/* Progress section header */}
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Progress</h3>

                    {/* ================================================================
                      VERTICAL STEP NAVIGATION: Interactive progress indicator
                      ================================================================
                      - Displays all 5 steps with visual completion status
                      - Allows navigation to completed/current steps only
                      - Shows connecting lines between steps for visual flow
                      ================================================================ */}
                    <div className="space-y-4">
                      {steps.map((step, index) => (
                        <div key={step.id} className="flex items-start">
                          {/* ========================================================
                            STEP BUTTON: Clickable navigation to specific steps
                            ========================================================
                            - Disabled for future steps (step.id > currentStep)
                            - Hover effects only for accessible steps
                            - Full width button for better touch targets
                            ======================================================== */}
                          <button
                            onClick={() => goToStep(step.id)}
                            disabled={step.id > currentStep}
                            className={`flex items-start w-full text-left transition-premium ${step.id <= currentStep ? "cursor-pointer" : "cursor-not-allowed"
                              } ${step.id < currentStep ? "hover:scale-[1.02]" : ""}`}
                          >
                            {/* ====================================================
                              STEP INDICATOR COLUMN: Number badge and connector
                              ====================================================
                              - Circular numbered badge with completion styling
                              - Vertical connecting line to next step
                              - Fixed width to maintain alignment
                              ==================================================== */}
                            <div className="flex flex-col items-center mr-3 flex-shrink-0">
                              {/* Step number badge with completion state styling */}
                              <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-premium ${currentStep >= step.id
                                  ? "bg-primary border-primary text-primary-foreground"  // Completed/current: filled with primary color
                                  : "border-muted-foreground text-muted-foreground"      // Future: outlined with muted color
                                  } text-sm font-medium`}
                              >
                                {step.id}
                              </div>
                              {/* Vertical connecting line between steps (except for last step) */}
                              {index < steps.length - 1 && (
                                <div
                                  className={`w-0.5 h-8 mt-2 ${currentStep > step.id ? "bg-primary" : "bg-muted"  // Completed connections use primary color
                                    }`}
                                />
                              )}
                            </div>
                            {/* ====================================================
                              STEP DETAILS COLUMN: Name, description, and status
                              ====================================================
                              - Step name with completion-based text color
                              - Description text for additional context
                              - Current step indicator with dot and label
                              ==================================================== */}
                            <div className="flex-1 min-w-0 pt-1">
                              {/* Step name with dynamic color based on completion status */}
                              <p className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                                }`}>
                                {step.name}
                              </p>
                              {/* Step description for additional context */}
                              <p className="text-xs text-muted-foreground mt-1">
                                {step.description}
                              </p>
                              {/* Current step indicator - only shown for active step */}
                              {currentStep === step.id && (
                                <div className="flex items-center mt-2">
                                  <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                                  <span className="text-xs text-primary font-medium">Current step</span>
                                </div>
                              )}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}