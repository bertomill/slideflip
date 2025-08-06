"use client";

// ============================================================================
// IMPORTS: Dependencies for the multi-step slide builder interface
// ============================================================================

// React hooks for component state management and lifecycle
import { useState, useEffect } from "react";

// UI components for layout, navigation, and user interface elements
import { Card, CardContent } from "@/components/ui/card";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { Button } from "@/components/ui/button";

// Lucide icons for navigation and progress indicators
import { ChevronLeft, ChevronRight } from "lucide-react";

// Step components that make up the slide builder workflow
import { UploadStep } from "@/components/builder/upload-step";      // Step 1: Document upload and description
import { ThemeStep } from "@/components/builder/theme-step";        // Step 2: Visual theme selection
import { ResearchStep } from "@/components/builder/research-step";  // Step 3: Research options and data gathering
import { ContentStep } from "@/components/builder/content-step";    // Step 4: Content planning and user feedback
import { PreviewStep } from "@/components/builder/preview-step";    // Step 5: AI slide generation and preview
import { DownloadStep } from "@/components/builder/download-step";  // Step 6: Final export and download

// Supabase client for user authentication and session management
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

  // ============================================================================
  // UI STATE MANAGEMENT: Controls responsive navigation and sidebar visibility
  // ============================================================================
  // These state variables manage the various collapsible UI elements in the builder
  // to provide optimal user experience across different screen sizes and preferences

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);         // Main navigation sidebar collapse state (desktop)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);             // Mobile hamburger menu visibility toggle
  const [progressSidebarCollapsed, setProgressSidebarCollapsed] = useState(false); // Progress tracker sidebar collapse state (reserved for future enhancement)

  // ============================================================================
  // SLIDE DATA MANAGEMENT: Centralized storage for all user inputs and AI outputs
  // ============================================================================
  // This state object accumulates data as users progress through the 6-step workflow:
  // 1. Upload: documents[], description
  // 2. Theme: selectedTheme
  // 3. Research: wantsResearch, researchOptions, researchData
  // 4. Content: contentPlan, userFeedback
  // 5. Preview: slideHtml (AI-generated)
  // 6. Download: Final PPTX export

  const [slideData, setSlideData] = useState<SlideData>({
    documents: [],           // User-uploaded files for slide content
    description: "",         // User's description of desired slide content
    selectedTheme: "",       // Visual theme choice (Professional, Modern, etc.)
    wantsResearch: false,    // Whether to include external research data
  });

  // ============================================================================
  // AUTHENTICATION LIFECYCLE: Load and monitor user authentication state
  // ============================================================================
  // Sets up Supabase auth listener and loads initial user state on component mount
  // Ensures the slide builder is only accessible to authenticated users
  useEffect(() => {
    const supabase = createClient();

    // Load initial user session when component first mounts
    // This provides immediate access to user data for the builder interface
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Set up real-time listener for authentication state changes
    // Handles login/logout events, session refresh, and token updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Cleanup: Remove auth listener when component unmounts to prevent memory leaks
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

  // Progress Sidebar Component - Collapsible right sidebar for step navigation
  const ProgressSidebar = () => (
    <div
      className={`fixed right-0 top-0 z-30 h-screen transform bg-background border-l border-border transition-all duration-300 ease-in-out ${progressSidebarCollapsed ? "w-16" : "w-80"
        }`}
    >
      <div className="flex flex-col h-full">
        {/* Header with collapse button */}
        <div className="p-4 border-b border-border relative flex items-center justify-between">
          {!progressSidebarCollapsed && (
            <h3 className="text-lg font-semibold text-foreground">Progress</h3>
          )}

          {/* Collapse button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 rounded-full border border-border bg-background shadow-md hover:bg-accent p-0"
            onClick={() => setProgressSidebarCollapsed(!progressSidebarCollapsed)}
          >
            {progressSidebarCollapsed ? (
              <ChevronLeft className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Progress content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {progressSidebarCollapsed ? (
            // Collapsed view - just step numbers
            <div className="space-y-3">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(step.id)}
                  disabled={step.id > currentStep}
                  className={`w-full flex justify-center transition-premium ${step.id <= currentStep ? "cursor-pointer" : "cursor-not-allowed"
                    } ${step.id < currentStep ? "hover:scale-[1.02]" : ""}`}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-premium ${currentStep >= step.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground text-muted-foreground"
                      } text-sm font-medium`}
                  >
                    {step.id}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Expanded view - full step details
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-start">
                  <button
                    onClick={() => goToStep(step.id)}
                    disabled={step.id > currentStep}
                    className={`flex items-start w-full text-left transition-premium ${step.id <= currentStep ? "cursor-pointer" : "cursor-not-allowed"
                      } ${step.id < currentStep ? "hover:scale-[1.02]" : ""}`}
                  >
                    {/* Step indicator column */}
                    <div className="flex flex-col items-center mr-3 flex-shrink-0">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-premium ${currentStep >= step.id
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground text-muted-foreground"
                          } text-sm font-medium`}
                      >
                        {step.id}
                      </div>
                      {/* Connecting line */}
                      {index < steps.length - 1 && (
                        <div
                          className={`w-0.5 h-8 mt-2 ${currentStep > step.id ? "bg-primary" : "bg-muted"
                            }`}
                        />
                      )}
                    </div>

                    {/* Step details column */}
                    <div className="flex-1 min-w-0 pt-1">
                      <p className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                        }`}>
                        {step.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.description}
                      </p>
                      {/* Current step indicator */}
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
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN COMPONENT RENDER: Multi-step slide builder interface
  // ============================================================================
  // Renders a full-screen layout with collapsible sidebars and dynamic step content
  // Layout adapts responsively between desktop (dual sidebars) and mobile (single column)
  return (
    <div className="min-h-screen gradient-dark-blue flex">
      {/* ========================================================================
          LEFT SIDEBAR: User profile and main navigation
          ========================================================================
          - Collapsible sidebar with user authentication info
          - Navigation links to other app sections (presentations, settings)
          - Mobile-responsive with overlay behavior on small screens
          ======================================================================== */}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* ========================================================================
          RIGHT SIDEBAR: Progress tracker (Desktop only)
          ========================================================================
          - Shows step-by-step progress through the slide builder workflow
          - Allows direct navigation to completed steps
          - Hidden on mobile devices to save screen space
          ======================================================================== */}
      <div className="hidden lg:block">
        <ProgressSidebar />
      </div>

      {/* ========================================================================
          MAIN CONTENT AREA: Dynamic step rendering with responsive margins
          ========================================================================
          - Adjusts margins based on sidebar collapse states
          - Contains the active step component and top navigation
          - Responsive design adapts to different screen sizes
          ======================================================================== */}
      <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        } ${progressSidebarCollapsed ? 'lg:mr-16' : 'lg:mr-80'
        }`}>
        {/* ====================================================================
            TOP NAVIGATION: Branding and controls
            ====================================================================
            - Mobile menu toggle for responsive navigation
            - SlideFlip Builder branding with logo
            - Theme toggle for light/dark mode switching
            ==================================================================== */}
        <Navigation variant="premium">
          <NavigationBrand>
            {/* Mobile menu toggle - only visible on small screens */}
            <MobileMenuButton
              isOpen={mobileMenuOpen}
              onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mr-2"
            />
            {/* App logo - simple geometric design */}
            <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
              <div className="h-3 w-3 bg-background rounded-sm"></div>
            </div>
            {/* App name with responsive text sizing */}
            <span className="font-semibold text-foreground text-sm sm:text-base">
              SlideFlip Builder
            </span>
          </NavigationBrand>
          {/* Right side controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
          </div>
        </Navigation>

        {/* MAIN CONTAINER: Full-width container with responsive padding */}
        <div className="w-full px-2 sm:px-4 py-2 sm:py-8 min-h-screen">
          {/* ============================================================================
              MAIN LAYOUT: Single column layout with fixed sidebars
              ============================================================================
              - Desktop: Content area adjusts between left and right sidebars
              - Mobile: Full width with mobile progress card below content
              ============================================================================ */}
          <div className="flex flex-col lg:block">
            {/* ========================================================================
                PRIMARY CONTENT AREA: Dynamic step component rendering
                ========================================================================
                - Full width on mobile, constrained by sidebars on desktop
                - Contains the active step component (Upload, Theme, Research, etc.)
                ======================================================================== */}
            <div className="w-full">
              {renderStep()}
            </div>

            {/* ========================================================================
                MOBILE PROGRESS CARD: Only visible on mobile devices
                ========================================================================
                - Shows below main content on mobile
                - Hidden on desktop where right sidebar is used instead
                ======================================================================== */}
            <div className="lg:hidden mt-8">
              <Card variant="glass">
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Progress</h3>
                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <div key={step.id} className="flex items-start">
                        <button
                          onClick={() => goToStep(step.id)}
                          disabled={step.id > currentStep}
                          className={`flex items-start w-full text-left transition-premium ${step.id <= currentStep ? "cursor-pointer" : "cursor-not-allowed"
                            } ${step.id < currentStep ? "hover:scale-[1.02]" : ""}`}
                        >
                          <div className="flex flex-col items-center mr-3 flex-shrink-0">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-premium ${currentStep >= step.id
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground text-muted-foreground"
                                } text-sm font-medium`}
                            >
                              {step.id}
                            </div>
                            {index < steps.length - 1 && (
                              <div
                                className={`w-0.5 h-8 mt-2 ${currentStep > step.id ? "bg-primary" : "bg-muted"
                                  }`}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <p className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                              }`}>
                              {step.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {step.description}
                            </p>
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
  );
}