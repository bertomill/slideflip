"use client";

// ============================================================================
// IMPORTS: Dependencies for the multi-step slide builder interface
// ============================================================================

// React hooks for component state management and lifecycle
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// UI components for layout, navigation, and user interface elements
import { Card, CardContent } from "@/components/ui/card";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { Button } from "@/components/ui/button";

// Lucide icons for navigation and progress indicators
import { ChevronLeft, ChevronRight, Wifi, Database } from "lucide-react";

// Step components that make up the slide builder workflow
import { UploadStep } from "@/components/builder/upload-step";      // Step 1: Document upload and description
import { ThemeStep } from "@/components/builder/theme-step";        // Step 2: Visual theme selection
import { ResearchStep } from "@/components/builder/research-step";  // Step 3: Research options and data gathering
// import { ContentStep } from "@/components/builder/content-step";    // Step 4: Content planning and user feedback (removed)
import { PreviewStep } from "@/components/builder/preview-step-fabric"; // Step 5: AI slide generation and preview with Fabric.js
// import { DownloadStep } from "@/components/builder/download-step";  // Step 6: Removed - export now happens in Preview step

// Supabase client for user authentication and session management
import { createClient } from "@/lib/supabase/client";

// WebSocket hook for backend communication
import { useWebSocket } from "@/hooks/use-websocket";

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
  title: string;            // Presentation title
  documents: File[];        // User-uploaded files for slide content
  parsedDocuments?: ParsedDocument[]; // Extracted text content from uploaded documents
  sessionId?: string;       // Session ID for tracking document uploads
  description: string;      // User's description of what the slide should contain
  selectedTheme: string;    // Visual theme choice for the presentation
  selectedPalette?: string[]; // Hex colors chosen/generated for this slide
  wantsResearch: boolean;   // Whether user wants additional research performed
  researchOptions?: ResearchOptions; // Customizable research parameters
  researchData?: string;    // Optional research results from external sources
  contentPlan?: string;     // AI-generated content plan for user review
  userFeedback?: string;    // User's feedback and additional requirements
  slideHtml?: string;       // Generated HTML content for the slide (legacy)
  slideJson?: any;          // Generated JSON slide definition for Fabric.js/PptxGenJS
};

// Configuration for the multi-step slide builder process
const steps = [
  { id: 1, name: "Upload", description: "Upload & describe" },
  { id: 2, name: "Research", description: "Research options" },
  { id: 3, name: "Theme", description: "Choose theme" },
  { id: 4, name: "Preview", description: "Review & export" },
];

/**
 * Main SlideBuilder component that orchestrates the multi-step slide creation process
 * Manages state flow between upload, theme selection, research, preview, and download steps
 */
function BuildInner() {
  // ============================================================================
  // STATE MANAGEMENT: Core component state for workflow and UI control
  // ============================================================================

  // Get URL parameters
  const searchParams = useSearchParams();
  const presentationId = searchParams.get('presentation_id');

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
    title: "",               // Presentation title
    documents: [],           // User-uploaded files for slide content
    description: "",         // User's description of desired slide content
    selectedTheme: "",       // Visual theme choice (Professional, Modern, etc.)
    wantsResearch: false,    // Whether to include external research data
  });

  // ============================================================================
  // WEBSOCKET INTEGRATION: Real-time backend communication for slide generation
  // ============================================================================
  // Generate unique client ID for WebSocket connection
  const [clientId] = useState(() => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Initialize WebSocket connection to FastAPI backend
  const {
    isConnected,
    connectionStatus,
    lastMessage,
    sendFileUpload,
    sendSlideDescription,
    sendGenerateSlide,
    sendGenerateSlideRequest,
    sendThemeSelection,
    sendProcessSlide,
  } = useWebSocket({
    clientId,
    onMessage: (message) => {
      console.log('Received message from backend:', message);
      
      // Handle different message types from backend
      if (message.type === 'processing_complete') {
        // Update slide HTML when generation is complete
        if (message.data?.slide_data?.content) {
          updateSlideData({ slideHtml: message.data.slide_data.content });
        }
      } else if (message.type === 'processing_status') {
        // Log processing status updates
        console.log('Processing status:', message.data.status, message.data.message);
      } else if (message.type === 'file_upload_success') {
        console.log('File uploaded successfully:', message.data.filename);
      } else if (message.type === 'connection_established') {
          console.log('Connected to Slideo Backend:', message.data.message);
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
    onClose: () => {
      console.log('Disconnected from backend');
    },
    onOpen: () => {
      console.log('Connected to backend successfully');
    }
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

    // Test database connectivity
    const checkDbConnection = async () => {
      try {
        // Simple query to test database connection
        const { error } = await supabase
          .from('presentations')
          .select('id')
          .limit(1);
        setIsDbConnected(!error);
      } catch (err) {
        setIsDbConnected(false);
      }
    };
    
    checkDbConnection();
    
    // Check database connection periodically
    const dbCheckInterval = setInterval(checkDbConnection, 30000); // Every 30 seconds

    // Cleanup: Remove auth listener when component unmounts to prevent memory leaks
    return () => {
      subscription.unsubscribe();
      clearInterval(dbCheckInterval);
    };
  }, []);

  // ============================================================================
  // PRESENTATION MANAGEMENT: Load and update presentation data
  // ============================================================================
  // Load presentation data if presentation_id is provided
  useEffect(() => {
    if (presentationId) {
      const loadPresentation = async () => {
        const supabase = createClient();
        
        // Load presentation data
        const { data: presentation, error } = await supabase
          .from('presentations')
          .select('*')
          .eq('id', presentationId)
          .single();
          
        if (error) {
          console.error('Error loading presentation:', error);
          return;
        }
          
        if (presentation) {
          console.log('✅ Loading presentation data from database:', presentation);
          
          // Restore documents from database (convert from serialized format back to File objects)
          const restoredDocuments = presentation.documents ? 
            presentation.documents.map((doc: any) => {
              // Create a placeholder File object since we can't restore the actual File
              const blob = new Blob(['[File content not available - original was uploaded]'], { 
                type: doc.type || 'text/plain' 
              });
              return new File([blob], doc.name, {
                type: doc.type,
                lastModified: doc.lastModified || Date.now()
              });
            }) : [];
          
          // Update slideData with all restored data
          setSlideData(prev => ({
            ...prev,
            title: presentation.title || '',
            description: presentation.description || '',
            documents: restoredDocuments,
            parsedDocuments: presentation.parsed_documents || [],
            selectedTheme: presentation.selected_theme || '',
            selectedPalette: presentation.selected_palette || undefined,
            wantsResearch: presentation.wants_research || false,
            researchOptions: presentation.research_options || undefined,
            researchData: presentation.research_data || undefined,
            slideHtml: presentation.slide_html || undefined,
            slideJson: presentation.slide_json || undefined,
            selectedModel: presentation.selected_model || undefined
          }));
          
          // Update current step if we're further along
          if (presentation.current_step && presentation.current_step > 1) {
            setCurrentStep(presentation.current_step);
          }
          
          console.log('✅ Successfully restored presentation data');
        }
      };
      
      loadPresentation();
    }
  }, [presentationId]);

  // Update presentation title in Supabase with debouncing
  const updatePresentationTitle = useCallback(async (title: string) => {
    if (!presentationId) return;
    
    const supabase = createClient();
    await supabase
      .from('presentations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', presentationId);
  }, [presentationId]);

  // Debounce title updates to avoid too many API calls
  const [titleTimeout, setTitleTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  
  // Connection status for database
  const [isDbConnected, setIsDbConnected] = useState(false);
  
  // Backend test state
  const [backendTestResult, setBackendTestResult] = useState<string>('');
  
  const handleTitleChange = useCallback((title: string) => {
    updateSlideData({ title });
    
    // Clear existing timeout
    if (titleTimeout) {
      clearTimeout(titleTimeout);
    }
    
    // Show saving indicator when user starts typing
    setIsSavingTitle(true);
    
    // Set new timeout to update after 1 second of no typing
    const timeout = setTimeout(async () => {
      await updatePresentationTitle(title);
      setIsSavingTitle(false);
    }, 1000);
    
    setTitleTimeout(timeout);
  }, [titleTimeout, updatePresentationTitle]);

  // Database saving state
  const [isSavingData, setIsSavingData] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Data Flow: Helper function to update slide data from child step components
  // Uses partial updates to preserve existing data while adding new information
  // Now includes automatic database persistence
  const updateSlideData = useCallback(async (updates: Partial<SlideData>) => {
    setSlideData(prev => ({ ...prev, ...updates }));
    
    // Save to database if we have a presentation ID
    if (presentationId) {
      try {
        setIsSavingData(true);
        
        // Prepare the data for database
        const dbUpdates: any = {};
        
        // Map slideData fields to database columns
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.documents !== undefined) {
          // Serialize File objects for database storage
          dbUpdates.documents = updates.documents.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          }));
        }
        if (updates.parsedDocuments !== undefined) dbUpdates.parsed_documents = updates.parsedDocuments;
        if (updates.selectedTheme !== undefined) dbUpdates.selected_theme = updates.selectedTheme;
        if (updates.selectedPalette !== undefined) dbUpdates.selected_palette = updates.selectedPalette;
        if (updates.wantsResearch !== undefined) dbUpdates.wants_research = updates.wantsResearch;
        if (updates.researchOptions !== undefined) dbUpdates.research_options = updates.researchOptions;
        if (updates.researchData !== undefined) dbUpdates.research_data = updates.researchData;
        if (updates.slideHtml !== undefined) dbUpdates.slide_html = updates.slideHtml;
        if (updates.slideJson !== undefined) dbUpdates.slide_json = updates.slideJson;
        if ((updates as any).selectedModel !== undefined) dbUpdates.selected_model = (updates as any).selectedModel;
        
        // Update step timestamps
        const stepKey = `step_${currentStep}`;
        dbUpdates.step_timestamps = { [stepKey]: new Date().toISOString() };
        
        // Update current step and status
        dbUpdates.current_step = Math.max(currentStep, 1);
        if (currentStep > 1) dbUpdates.builder_status = 'in_progress';
        
        // Save to database
        const supabase = createClient();
        const { error } = await supabase
          .from('presentations')
          .update(dbUpdates)
          .eq('id', presentationId);
          
        if (error) {
          console.error('Error saving to database:', error);
        } else {
          setLastSaved(new Date());
          console.log('✅ Data saved to database:', Object.keys(dbUpdates));
        }
      } catch (error) {
        console.error('Error in updateSlideData:', error);
      } finally {
        setIsSavingData(false);
      }
    }
  }, [presentationId, currentStep]);

  // Simple backend test function
  const testBackendConnection = async () => {
    try {
      setBackendTestResult('Testing backend connection...');
      
      console.log('🧪 Backend Test Info:');
      console.log('- WebSocket connected:', isConnected);
      console.log('- Connection status:', connectionStatus);
      console.log('- Client ID:', clientId);
      console.log('- Expected WebSocket URL: ws://localhost:8000/ws/' + clientId);
      
      // Try sending a simple test message via WebSocket
      if (isConnected) {
        // If we have WebSocket connection, test it
        setBackendTestResult('✅ WebSocket connected! Backend is reachable at ws://localhost:8000');
        
        // You can also try sending a test message if your WebSocket supports it
        // sendTestMessage();
        
      } else {
        setBackendTestResult('❌ WebSocket not connected. Make sure backend is running at ws://localhost:8000');
      }
    } catch (error) {
      setBackendTestResult(`❌ Backend test failed: ${error}`);
    }
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
             lastMessage={lastMessage as any}
          />
        );
      case 2:
        return (
          <ResearchStep 
            slideData={slideData} 
            updateSlideData={updateSlideData} 
            onNext={nextStep} 
             onPrev={prevStep}
            sendGenerateSlide={sendGenerateSlide}
          />
        );
      case 3:
        return (
          <ThemeStep 
            slideData={slideData} 
            updateSlideData={updateSlideData} 
            onNext={nextStep} 
            onPrev={prevStep}
            sendGenerateSlide={sendGenerateSlide}
          />
        );
      case 4:
        return (
          <PreviewStep 
            slideData={slideData} 
            updateSlideData={updateSlideData} 
            onNext={nextStep} 
            onPrev={prevStep}
            isConnected={isConnected}
            connectionStatus={connectionStatus}
            sendGenerateSlideRequest={sendGenerateSlideRequest}
            lastMessage={lastMessage}
          />
        );
      // case 5: Content step removed - users go directly from Theme to Preview
      default:
        return null;
    }
  };

  // Progress Sidebar Component - Collapsible right sidebar for step navigation
  const ProgressSidebar = () => (
    <div
      className={`fixed right-0 top-0 z-30 h-screen transform bg-background border-l border-border transition-all duration-300 ease-in-out ${progressSidebarCollapsed ? "w-16" : "w-64"
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
                    className={`step-indicator w-8 h-8 ${currentStep >= step.id
                      ? "step-indicator-active"
                      : "step-indicator-inactive"
                      }`}
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
                        className={`step-indicator w-8 h-8 ${currentStep >= step.id
                          ? "step-indicator-active"
                          : "step-indicator-inactive"
                          }`}
                      >
                        {step.id}
                      </div>
                      {/* Connecting line */}
                      {index < steps.length - 1 && (
                        <div
                          className={`w-0.5 h-8 mt-2 ${currentStep > step.id ? "step-connector-active" : "step-connector-inactive"
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
    <div className="min-h-screen builder-background flex">
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
        } ${progressSidebarCollapsed ? 'lg:mr-16' : 'lg:mr-64'
        }`}>
        {/* ====================================================================
            MINIMAL HEADER: Mobile menu, connection status, and theme toggle
            ====================================================================
            - Mobile menu toggle for responsive navigation
            - Connection status indicators for backend and database
            - Theme toggle for light/dark mode switching
            ==================================================================== */}
        <div className="flex justify-between items-center p-4">
          {/* Mobile menu toggle - only visible on small screens */}
          <MobileMenuButton
            isOpen={mobileMenuOpen}
            onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden"
          />
          
          {/* Connection status indicators - center */}
          <div className="flex items-center gap-3">
            {/* Backend connection status */}
            <div className="flex items-center gap-1.5" title={`Backend: ${isConnected ? 'Connected' : 'Disconnected'}`}>
              <Wifi className={`h-3.5 w-3.5 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            
            {/* Database connection status */}
            <div className="flex items-center gap-1.5" title={`Database: ${isDbConnected ? 'Connected' : 'Disconnected'}`}>
              <Database className={`h-3.5 w-3.5 ${isDbConnected ? 'text-green-500' : 'text-red-500'}`} />
              <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            
          </div>
          
          {/* Theme toggle */}
          <ThemeToggle />
        </div>

        {/* MAIN CONTAINER: Full-width container with responsive padding */}
        <div className="w-full px-2 sm:px-4 py-2 sm:py-4 min-h-screen">
          {/* ============================================================================
              PRESENTATION TITLE INPUT: Notion-style title field
              ============================================================================
              - Appears at the top of the builder interface
              - Allows users to name their presentation
              - Transparent background with focus styling
              ============================================================================ */}
          <div className="w-full max-w-4xl mx-auto mb-6">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={slideData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled Presentation"
                className="flex-1 px-4 py-4 text-3xl md:text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50 focus:placeholder:text-muted-foreground/30 transition-colors leading-tight"
                style={{
                  caretColor: 'currentColor',
                  lineHeight: '1.2',
                }}
              />
              {isSavingTitle && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50 shadow-sm">
                  <div className="animate-spin w-3 h-3 border border-muted-foreground border-t-transparent rounded-full"></div>
                  <span>Saving...</span>
                </div>
              )}
            </div>
          </div>

          {/* Backend test result display */}
          {backendTestResult && (
            <div className="w-full max-w-4xl mx-auto mb-4">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-mono">{backendTestResult}</p>
              </div>
            </div>
          )}

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
                              className={`step-indicator w-8 h-8 ${currentStep >= step.id
                                ? "step-indicator-active"
                                : "step-indicator-inactive"
                                }`}
                            >
                              {step.id}
                            </div>
                            {index < steps.length - 1 && (
                              <div
                                className={`w-0.5 h-8 mt-2 ${currentStep > step.id ? "step-connector-active" : "step-connector-inactive"
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

export default function Build() {
  return (
    <Suspense fallback={<div className="min-h-screen builder-background flex items-center justify-center">Loading...</div>}>
      <BuildInner />
    </Suspense>
  );
}