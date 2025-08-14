"use client";

// React hooks for component state and lifecycle management
import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MarkdownWysiwyg from "@/components/markdown-wysiwyg";
// UI components for building the content planning interface
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
// Lucide icons for visual elements and user interface
import { ArrowLeft, ArrowRight, MessageSquare, Brain, FileText, Lightbulb, Edit3, CheckCircle, ChevronDown, ChevronRight, Eye, Save, X } from "lucide-react";
// Type definitions from the main build page component
import { SlideData, ParsedDocument } from "@/app/build/page";

/**
 * Props interface for the ContentStep component
 * Defines the contract for data flow and navigation callbacks
 */
interface ContentStepProps {
  slideData: SlideData;                                    // Current slide data from parent component
  updateSlideData: (updates: Partial<SlideData>) => void; // Callback to update slide data in parent
  onNext: () => void;                                      // Navigation callback to proceed to next step
  onPrev: () => void;                                      // Navigation callback to return to previous step
  isConnected?: boolean;                                   // WebSocket connection status
  connectionStatus?: string;                               // Connection status string
  sendContentPlanning?: (description: string, documents: any[], researchData?: string, userFeedback?: string, theme?: string) => boolean; // WebSocket function to send content planning request
  lastMessage?: any;                                       // Last message from backend
}

/**
 * ContentStep Component - Fourth step in the slide builder workflow
 * 
 * MAIN PURPOSE:
 * - Generates AI-powered content plan based on all user inputs
 * - Displays proposed slide structure for user review
 * - Collects user feedback for final slide refinements
 * - Acts as collaborative bridge between data collection and slide generation
 * 
 * WORKFLOW POSITION:
 * Previous: ResearchStep (research data collection)
 * Next: PreviewStep (actual slide generation and preview)
 * 
 * KEY FEATURES:
 * - AI content analysis of uploaded documents
 * - Integration of research data into content planning
 * - Theme-aware content structuring
 * - User feedback collection for iterative improvements
 * - Document content preview for transparency
 */
export function ContentStep({ slideData, updateSlideData, onNext, onPrev, isConnected = false, connectionStatus = 'disconnected', sendContentPlanning, lastMessage }: ContentStepProps) {
  // ============================================================================
  // COMPONENT STATE: Manages content planning workflow and user interactions
  // ============================================================================

  // LOADING STATES: Track async operations for proper UI feedback
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false); // Shows spinner during AI content plan generation
  const [isSlideGenerating, setIsSlideGenerating] = useState(false); // Shows when slides are being generated in background
  const [slideGenerationProgress, setSlideGenerationProgress] = useState<{progress: number, message: string} | null>(null);
  const [contentPlanningProgress, setContentPlanningProgress] = useState<{progress: number, message: string} | null>(null);

  // CONTENT PLAN MANAGEMENT: Handles AI-generated and user-modified content plans
  const [contentPlan, setContentPlan] = useState<string>("");           // Original AI-generated content plan (read-only reference)
  const [editableContentPlan, setEditableContentPlan] = useState<string>(""); // User-editable version of content plan (working copy)

  // USER INPUT: Collects additional feedback and requirements
  const [userFeedback, setUserFeedback] = useState<string>("");         // User's refinement feedback and additional requirements

  // WORKFLOW STATE: Controls component behavior and UI visibility
  const [planGenerated, setPlanGenerated] = useState(false);            // Flag indicating AI plan generation is complete

  // UNUSED STATE: These variables are declared but not currently used in the component
  const [isEditingPlan, setIsEditingPlan] = useState(false);           // Edit mode toggle (reserved for future inline editing feature)

  // DOCUMENT DIALOG STATE: Controls the documents modal and selected document view
  const [isDocsDialogOpen, setIsDocsDialogOpen] = useState(false);
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null);

  // ============================================================================
  // CONTENT PLAN GENERATION: AI-powered analysis and planning
  // ============================================================================

  // Generate fallback plan when backend fails
  const generateFallbackPlan = useCallback(() => {
    let fallbackPlan = `Based on your description: "${slideData.description}"\n\n`;
    fallbackPlan += `I'm planning to create a slide with the following structure:\n\n`;
    fallbackPlan += `📋 **Main Content:**\n`;
    fallbackPlan += `• Title based on your description\n`;
    fallbackPlan += `• Key points extracted from your uploaded documents\n`;
    fallbackPlan += `• Supporting details and context\n\n`;
    if (slideData.wantsResearch && slideData.researchData) {
      fallbackPlan += `🔍 **Research Integration:**\n`;
      fallbackPlan += `• Industry insights and trends\n`;
      fallbackPlan += `• Supporting statistics and data\n`;
      fallbackPlan += `• Best practice recommendations\n\n`;
    }
    fallbackPlan += `🎨 **Visual Design:**\n`;
    fallbackPlan += `• ${slideData.selectedTheme || 'Professional'} theme styling\n`;
    fallbackPlan += `• Clean, readable layout\n`;
    fallbackPlan += `• Consistent color scheme\n\n`;
    fallbackPlan += `This plan will ensure your slide effectively communicates your message!`;

    setContentPlan(fallbackPlan);
    setEditableContentPlan(fallbackPlan);
    setPlanGenerated(true);
  }, [slideData]);

  // Handle backend messages
  useEffect(() => {
    if (lastMessage) {
      console.log('Content step received message from backend:', lastMessage);
      console.log('Message type:', lastMessage.type);
      console.log('Message data:', lastMessage.data);
      
      if (lastMessage.type === 'content_planning_complete') {
        console.log('Processing content planning completion message');
        setIsGeneratingPlan(false);
        
        // Update content plan with backend response
        if (lastMessage.data.content_plan) {
          const plan = lastMessage.data.content_plan;
          setContentPlan(plan);
          setEditableContentPlan(plan);
          setPlanGenerated(true);
          console.log('Content plan updated from backend');
        }
      } else if (lastMessage.type === 'content_planning_error') {
        console.log('Processing content planning error message');
        setIsGeneratingPlan(false);
        console.error('Content planning error from backend:', lastMessage.data.error);
        
        // Generate fallback plan
        generateFallbackPlan();
      } else if (lastMessage.type === 'content_planning_progress') {
        // Handle progress updates if needed
        console.log('Content planning progress:', lastMessage.data);
      } else if (lastMessage.type === 'progress_update' && lastMessage.data.step === 'slide_generation') {
        // Handle slide generation progress updates
        console.log('Processing slide generation progress update in content step:', lastMessage.data.progress, lastMessage.data.message);
        
        setIsSlideGenerating(lastMessage.data.progress < 100);
        setSlideGenerationProgress({
          progress: lastMessage.data.progress,
          message: lastMessage.data.message
        });
        
        // Clear progress when complete
        if (lastMessage.data.progress >= 100) {
          setTimeout(() => {
            setSlideGenerationProgress(null);
          }, 2000);
        }
      } else if (lastMessage.type === 'slide_generation_complete') {
        // Slide generation completed
        console.log('Processing slide generation completion in content step');
        setIsSlideGenerating(false);
        setSlideGenerationProgress(null);
        console.log('Slide generation completed in background');
      } else {
        console.log('Unhandled message type in content step:', lastMessage.type);
      }
    }
  }, [lastMessage, generateFallbackPlan]);

  /**
   * Generate comprehensive AI content plan based on all collected user data
   * 
   * ANALYSIS INPUTS:
   * - User's slide description and requirements
   * - Selected visual theme preferences
   * - Research data from external sources (if requested)
   * - Uploaded document count and content
   * 
   * PROCESS:
   * 1. Compile all available context into planning request
   * 2. Send to AI content planning API endpoint
   * 3. Receive structured content plan with recommendations
   * 4. Handle errors gracefully with fallback planning
   * 
   * OUTPUT:
   * - Detailed content structure proposal
   * - Integration strategy for research and documents
   * - Theme-appropriate styling recommendations
   * - User feedback solicitation for refinements
   */
  /**
   * Generate comprehensive AI content plan based on all collected user data
   * 
   * ANALYSIS INPUTS:
   * - User's slide description and requirements
   * - Selected visual theme preferences
   * - Research data from external sources (if requested)
   * - Uploaded document count and content
   * 
   * PROCESS:
   * 1. Compile all available context into planning request
   * 2. Send to AI content planning API endpoint
   * 3. Receive structured content plan with recommendations
   * 4. Handle errors gracefully with fallback planning
   * 
   * OUTPUT:
   * - Detailed content structure proposal
   * - Integration strategy for research and documents
   * - Theme-appropriate styling recommendations
   * - User feedback solicitation for refinements
   */
  const generateContentPlan = useCallback(async () => {
    // SET LOADING STATE: Show spinner and disable interactions during AI processing
    setIsGeneratingPlan(true);

    try {
      // CONTEXT PREPARATION: Compile all user inputs for AI analysis
      // This comprehensive context ensures the AI has all necessary information
      // to create a relevant and personalized content plan
  const planningContext: {
    description: string;
    selectedTheme: string | undefined;
    hasResearch: boolean;
    researchData: unknown;
    documentCount: number;
    model?: string;
  } = {
        description: slideData.description,           // User's slide description and requirements
        selectedTheme: slideData.selectedTheme,       // Visual theme choice (Professional, Modern, etc.)
        hasResearch: slideData.wantsResearch,         // Boolean flag for research inclusion
        researchData: slideData.researchData,         // External research insights from Tavily API
        documentCount: slideData.documents.length,    // Number of uploaded files for context
    model: (slideData as unknown as { selectedModel?: string }).selectedModel || undefined,
      };

      // Check if backend is connected
      if (!isConnected || !sendContentPlanning) {
        throw new Error('Backend not connected or sendContentPlanning not available');
      }

      // Send content planning request to backend via WebSocket
      const success = sendContentPlanning(
        slideData.description,
        slideData.parsedDocuments || slideData.documents,
        slideData.researchData,
        userFeedback,
        slideData.selectedTheme
      );

      if (success) {
        console.log('Content planning request sent to backend successfully');
        // The response will be handled in the useEffect hook
        return; // Exit early, response handled in useEffect
      } else {
        throw new Error('Failed to send content planning request to backend');
      }
    } catch (error) {
      // ERROR HANDLING: Graceful fallback when AI planning fails
      console.error('Content planning error:', error);

      // FALLBACK STRATEGY: Generate local plan to ensure workflow continuity
      let fallbackPlan = `Based on your description: "${slideData.description}"\n\n`;
      fallbackPlan += `I'm planning to create a slide with the following structure:\n\n`;
      fallbackPlan += `📋 **Main Content:**\n`;
      fallbackPlan += `• Title based on your description\n`;
      fallbackPlan += `• Key points extracted from your uploaded documents\n`;
      fallbackPlan += `• Supporting details and context\n\n`;
      if (slideData.wantsResearch && slideData.researchData) {
        fallbackPlan += `🔍 **Research Integration:**\n`;
        fallbackPlan += `• Industry insights and trends\n`;
        fallbackPlan += `• Supporting statistics and data\n`;
        fallbackPlan += `• Best practice recommendations\n\n`;
      }
      fallbackPlan += `🎨 **Visual Design:**\n`;
      fallbackPlan += `• ${slideData.selectedTheme} theme styling\n`;
      fallbackPlan += `• Professional layout and typography\n`;
      fallbackPlan += `• Balanced content hierarchy\n\n`;
      fallbackPlan += `Is there anything you'd like me to add, remove, or modify?`;
      setContentPlan(fallbackPlan);                    // Set fallback as original
      setEditableContentPlan(fallbackPlan);            // Set fallback as editable
      setPlanGenerated(true);                          // Allow user to proceed
    } finally {
      // CLEANUP: Always clear loading state regardless of success/failure
      setIsGeneratingPlan(false);
    }
  }, [slideData, userFeedback, isConnected, sendContentPlanning]);

  // Fallback plan generator removed; logic is inlined in generateContentPlan error handler.

  /**
   * Handle user feedback submission and proceed to slide generation
   * 
   * SUBMISSION PROCESS:
   * 1. Validates and processes user feedback input
   * 2. Stores both AI content plan and user modifications in parent state
   * 3. Triggers navigation to PreviewStep for actual slide generation
   * 
   * DATA FLOW:
   * - contentPlan: AI-generated structure and recommendations
   * - userFeedback: User's additional requirements and modifications
   * - Both pieces of data are passed to slide generation API
   */
  /**
   * Handle user feedback submission and proceed to slide generation
   * 
   * SUBMISSION PROCESS:
   * 1. Validates and processes user feedback input
   * 2. Stores both AI content plan and user modifications in parent state
   * 3. Triggers navigation to PreviewStep for actual slide generation
   * 
   * DATA FLOW:
   * - editableContentPlan: User-modified version of AI-generated content plan
   * - userFeedback: User's additional requirements and modifications
   * - Both pieces of data are passed to slide generation API for final slide creation
   */
  const handleFeedbackSubmit = () => {
    // DATA PERSISTENCE: Store planning results in parent component state
    // This data will be used by the slide generation API in the next step
    updateSlideData({
      // CONTENT PLAN SELECTION: Use the editable version that may contain user modifications
      // This ensures any manual edits to the AI-generated plan are preserved and used
      contentPlan: editableContentPlan,                   // User-edited content plan (takes precedence over original AI plan)
      userFeedback: userFeedback.trim() || undefined     // User's additional requirements (optional feedback for further refinement)
    });

    // NAVIGATION: Proceed to PreviewStep for actual slide generation
    // The next step will use both the content plan and feedback to generate the final slide
    onNext();
  };

  // ============================================================================
  // COMPONENT LIFECYCLE: Auto-trigger content plan generation
  // ============================================================================

  /**
   * Auto-generate content plan when component mounts
   * 
   * TRIGGER CONDITIONS:
   * - Component has just mounted (first render)
   * - No plan has been generated yet
   * - No generation process is currently running
   * 
   * This ensures users immediately see AI analysis without manual action
   */
  useEffect(() => {
    if (!planGenerated && !isGeneratingPlan) {
      void generateContentPlan();
    }
  }, [planGenerated, isGeneratingPlan, generateContentPlan]);

  // ============================================================================
  // EFFECTS: Handle side effects and external data changes
  // ============================================================================

  // Update content planning progress when slideData changes
  useEffect(() => {
    if (slideData.contentPlanningProgress) {
      setContentPlanningProgress(slideData.contentPlanningProgress);
    }
  }, [slideData.contentPlanningProgress]);

  // Handle slide generation progress updates from WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'progress_update' && lastMessage.data.step === 'slide_generation') {
      setSlideGenerationProgress({
        progress: lastMessage.data.progress,
        message: lastMessage.data.message
      });
      setIsSlideGenerating(true);
    } else if (lastMessage?.type === 'slide_generation_complete') {
      setIsSlideGenerating(false);
      setSlideGenerationProgress(null);
    }
  }, [lastMessage]);

  // ============================================================================
  // NAVIGATION LOGIC: Control when user can proceed to next step
  // ============================================================================

  // User can proceed once AI has generated a content plan for review
  // No additional validation required - feedback is optional
  const canProceed = planGenerated;

  return (
    <div className="space-y-6">
      {/* ========================================================================
          STEP HEADER: Introduction and context for content planning phase
          ========================================================================
          - Explains the purpose of this step in the workflow
          - Sets user expectations for AI content analysis
          - Uses elevated card variant for visual prominence
          ======================================================================== */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Content Planning
          </CardTitle>
          <CardDescription>
            Let&#39;s review what will go on your slide and gather any additional input
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ========================================================================
          CONTENT PLANNING PROGRESS: Shows progress during AI content planning
          ========================================================================
          - Displays when backend is processing content planning request
          - Shows real-time progress updates from WebSocket
          - Uses glass card variant for subtle appearance during loading
          ======================================================================== */}
      {isGeneratingPlan && contentPlanningProgress && (
        <Card variant="glass">
          <CardContent className="p-6">
            {/* LOADING HEADER: Spinner and status message */}
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <h3 className="font-semibold">Generating Content Plan</h3>
            </div>

            {/* PROGRESS BAR: Visual progress indicator */}
            <div className="w-full bg-muted rounded-full h-2 mb-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${contentPlanningProgress.progress}%` }}
              />
            </div>

            {/* PROGRESS TEXT: Current step and percentage */}
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{contentPlanningProgress.progress}%</span>
            </div>

            {/* CURRENT STEP: What's happening now */}
            <p className="text-sm text-muted-foreground">
              {contentPlanningProgress.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================
          SLIDE GENERATION PROGRESS: Shows progress during slide generation
          ========================================================================
          - Displays when backend is generating slides in background
          - Shows real-time progress updates from WebSocket
          - Uses glass card variant for subtle appearance during loading
          ======================================================================== */}
      {isSlideGenerating && slideGenerationProgress && (
        <Card variant="glass">
          <CardContent className="p-6">
            {/* LOADING HEADER: Spinner and status message */}
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <h3 className="font-semibold">Generating Your Slides</h3>
            </div>

            {/* PROGRESS BAR: Visual progress indicator */}
            <div className="w-full bg-muted rounded-full h-2 mb-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${slideGenerationProgress.progress}%` }}
              />
            </div>

            {/* PROGRESS TEXT: Current step and percentage */}
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{slideGenerationProgress.progress}%</span>
            </div>

            {/* CURRENT STEP: What's happening now */}
            <p className="text-sm text-muted-foreground">
              {slideGenerationProgress.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================
          AI CONTENT PLAN DISPLAY: Main content planning results
          ========================================================================
          - Shows AI-generated content structure and recommendations
          - Only visible after successful plan generation
          - Uses premium card variant to highlight importance
          - Includes source summary for transparency
          ======================================================================== */}
      {planGenerated && contentPlan && (
        <Card variant="premium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Proposed Slide Content
                </CardTitle>
                <CardDescription>
                  Here&#39;s what I&#39;m planning to include on your slide based on all the information gathered
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingPlan(!isEditingPlan)}
                className="flex items-center gap-2"
              >
                {isEditingPlan ? (
                  <>
                    <X className="h-4 w-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CONTENT PLAN DISPLAY/EDIT */}
            {isEditingPlan ? (
              <EditableContentPlan
                content={editableContentPlan}
                onChange={setEditableContentPlan}
                onSave={() => setIsEditingPlan(false)}
              />
            ) : (
              <FormattedContentPlan content={editableContentPlan} />
            )}

            {/* INFORMATION SOURCES SUMMARY */}
            {/* Visual summary of data sources used in content planning */}
            {/* Helps users understand what information influenced the AI's recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* DOCUMENTS SOURCE INDICATOR (clickable) */}
              <button
                type="button"
                onClick={() => {
                  setIsDocsDialogOpen(true);
                  setSelectedDocIndex(0);
                }}
                className="flex w-full items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors text-left"
                aria-label="View uploaded documents"
              >
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">Documents</div>
                  <div className="text-xs text-muted-foreground">
                    {slideData.documents.length} file{slideData.documents.length !== 1 ? "s" : ""} uploaded
                  </div>
                </div>
              </button>

              {/* RESEARCH SOURCE INDICATOR */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Lightbulb className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">Research</div>
                  <div className="text-xs text-muted-foreground">
                    {slideData.wantsResearch ? 'AI research included' : 'Document-based only'}
                  </div>
                </div>
              </div>

              {/* THEME SOURCE INDICATOR */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <CheckCircle className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">Theme</div>
                  <div className="text-xs text-muted-foreground">
                    {slideData.selectedTheme || 'Default'} styling
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DOCUMENTS DIALOG: List uploaded docs and preview extracted text */}
      <Dialog open={isDocsDialogOpen} onOpenChange={setIsDocsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Uploaded Documents</DialogTitle>
            <DialogDescription>
              Click a document to preview the extracted text used in planning.
            </DialogDescription>
          </DialogHeader>

          {/* Two-column layout: list on the left, preview on the right */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Document list */}
            <div className="sm:col-span-1 border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Documents</div>
              <div className="max-h-72 overflow-y-auto">
                {(slideData.parsedDocuments && slideData.parsedDocuments.length > 0
                  ? slideData.parsedDocuments
                  : []).map((doc, idx) => (
                  <button
                    key={doc.filename}
                    type="button"
                    onClick={() => setSelectedDocIndex(idx)}
                    className={`w-full px-3 py-2 text-left border-b last:border-b-0 hover:bg-muted/40 transition-colors ${
                      selectedDocIndex === idx ? "bg-muted/30" : ""
                    }`}
                    aria-label={`View ${doc.filename}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm">{doc.filename}</div>
                      <Badge variant={doc.success ? "default" : "destructive"} className="text-[10px]">
                        {doc.success ? "Parsed" : "Failed"}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {doc.content.length.toLocaleString()} chars
                    </div>
                  </button>
                ))}

                {/* Fallback list if no parsedDocuments yet */}
                {(!slideData.parsedDocuments || slideData.parsedDocuments.length === 0) && (
                  <div className="p-3 text-xs text-muted-foreground">
                    Parsed content not available yet. {slideData.documents.length} file
                    {slideData.documents.length !== 1 ? "s" : ""} uploaded.
                  </div>
                )}
              </div>
            </div>

            {/* Preview panel */}
            <div className="sm:col-span-2 border rounded-lg p-3 min-h-48">
              {slideData.parsedDocuments &&
              slideData.parsedDocuments.length > 0 &&
              selectedDocIndex !== null ? (
                <div className="space-y-2 h-full">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm truncate">
                      {slideData.parsedDocuments[selectedDocIndex].filename}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {slideData.parsedDocuments[selectedDocIndex].content.length.toLocaleString()} characters
                    </div>
                  </div>
                  <div className="border rounded-md bg-muted/20 p-2 h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                    {slideData.parsedDocuments[selectedDocIndex].success
                      ? slideData.parsedDocuments[selectedDocIndex].content
                      : "Failed to extract content from this document."}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Select a document to preview its extracted text.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================
          DOCUMENT PREVIEW SECTION: Show parsed document content for transparency
          ========================================================================
          - Only visible after content plan is generated and documents exist
          - Allows users to verify what content the AI is working with
          - Expandable interface to review extracted text from uploaded files
          - Helps users understand the source material for slide generation
          ======================================================================== */}
      {planGenerated && slideData.parsedDocuments && slideData.parsedDocuments.length > 0 && (
        <DocumentPreviewSection parsedDocuments={slideData.parsedDocuments} />
      )}


      {/* ========================================================================
          USER FEEDBACK SECTION: Collect additional requirements and modifications
          ========================================================================
          - Allows users to refine AI-generated content plan
          - Optional input - users can proceed without feedback
          - Feedback is passed to slide generation API for customization
          - Uses glass card variant for subtle, non-intrusive appearance
          ======================================================================== */}
      {planGenerated && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" />
              Your Input
            </CardTitle>
            <CardDescription>
              Is there anything you&#39;d like to add, remove, or modify in the planned content?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* FEEDBACK TEXTAREA: Multi-line input for user modifications */}
            {/* FEEDBACK TEXTAREA: Multi-line input for user modifications */}
            <Textarea
              placeholder="Optional: Add any specific requirements, corrections, or additional information you'd like included in your slide..."
              value={userFeedback}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUserFeedback(e.target.value)}
              className="min-h-[100px] resize-none"
            />

            {/* USAGE INSTRUCTIONS: Clarifies that feedback is optional */}
            <div className="text-xs text-muted-foreground">
              Leave blank if you&#39;re satisfied with the proposed content plan above.
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================
          STEP NAVIGATION: Workflow control buttons
          ========================================================================
          - Back button: Returns to ResearchStep for data modification
          - Generate button: Proceeds to PreviewStep with content plan and feedback
          - Generate button disabled until AI content plan is ready
          - Uses engineering variant for primary action emphasis
          ======================================================================== */}
      <div className="flex justify-between">
        {/* BACK NAVIGATION: Return to previous step */}
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Research
        </Button>

        {/* FORWARD NAVIGATION: Proceed to slide generation */}
        <Button
          variant="engineering"
          size="lg"
          onClick={handleFeedbackSubmit}
          disabled={!canProceed}
        >
          Generate Slide
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/**
 * FormattedContentPlan Component
 * 
 * PURPOSE:
 * - Displays the content plan with proper formatting and visual hierarchy
 * - Parses markdown-like content into structured sections
 * - Provides better readability than plain text display
 * - Uses consistent styling with the rest of the application
 */
function FormattedContentPlan({ content }: { content: string }) {
  // MARKDOWN NORMALIZATION: Convert common unicode bullets to Markdown dashes
  const normalizeMarkdownContent = (text: string) =>
    text.replace(/^\s*[•]\s?/gm, "- ");

  const normalized = normalizeMarkdownContent(content || "");

  return (
    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
      <ReactMarkdown
        remarkPlugins={[remarkGfm as unknown as never]}
        components={{
          h1: ({ ...props }: Record<string, unknown>) => (
            <h1 className="text-lg font-semibold text-primary mb-2" {...props} />
          ),
          h2: ({ ...props }: Record<string, unknown>) => (
            <h2 className="text-base font-semibold text-foreground mt-4 mb-1" {...props} />
          ),
          h3: ({ ...props }: Record<string, unknown>) => (
            <h3 className="text-sm font-semibold text-foreground mt-3 mb-1" {...props} />
          ),
          p: ({ ...props }: Record<string, unknown>) => (
            <p className="text-sm text-foreground leading-relaxed" {...props} />
          ),
          li: ({ ...props }: Record<string, unknown>) => (
            <li className="ml-5 list-disc text-sm leading-relaxed" {...props} />
          ),
          ul: ({ ...props }: Record<string, unknown>) => (
            <ul className="space-y-1" {...props} />
          ),
          ol: ({ ...props }: Record<string, unknown>) => (
            <ol className="space-y-1 list-decimal ml-5" {...props} />
          ),
          code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => (
            <code
              className={`rounded bg-muted px-1.5 py-0.5 text-xs ${className || ""}`}
              {...props}
            >
              {children}
            </code>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

/**
 * EditableContentPlan Component
 * 
 * PURPOSE:
 * - Provides an editable textarea for modifying the content plan
 * - Maintains the same visual styling as the formatted display
 * - Includes save functionality to apply changes
 * - Auto-resizes based on content length
 */
function EditableContentPlan({
  content,
  onChange,
  onSave
}: {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Edit using a formatted Markdown editor. Supports headings, lists, bold/italics, tables (GFM), and more.
      </div>

      <MarkdownWysiwyg value={content} onChange={onChange} height="360px" />

      <div className="flex items-center justify-end">
        <Button onClick={onSave} size="sm" className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

/**
 * DocumentPreviewSection Component
 * 
 * PURPOSE:
 * - Displays parsed documents with expandable content preview
 * - Allows users to verify what content the AI is working with
 * - Provides transparency into the document parsing process
 * - Shows success/failure status for each document
 * 
 * FEATURES:
 * - Collapsible document content with expand/collapse functionality
 * - Visual indicators for parsing success/failure
 * - Content statistics (character count, word count, line count)
 * - Scrollable content areas for long documents
 */
function DocumentPreviewSection({ parsedDocuments }: { parsedDocuments: ParsedDocument[] }) {
  // STATE: Track which documents are currently expanded for viewing
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  /**
   * Toggle the expanded state of a specific document
   * Manages the expand/collapse functionality for document content viewing
   */
  const toggleDocument = (filename: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(filename)) {
      newExpanded.delete(filename);
    } else {
      newExpanded.add(filename);
    }
    setExpandedDocs(newExpanded);
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Document Content
        </CardTitle>
        <CardDescription>
          Review the parsed content from your uploaded documents that will be used for slide generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {parsedDocuments.map((doc, index) => {
          const isExpanded = expandedDocs.has(doc.filename);

          return (
            <div key={index} className="border rounded-lg overflow-hidden">
              {/* DOCUMENT HEADER: Always visible summary with expand/collapse button */}
              <button
                onClick={() => toggleDocument(doc.filename)}
                className="w-full p-4 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between text-left"
              >
                {/* LEFT SECTION: Document info and status */}
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    {/* Document filename with truncation for long names */}
                    <div className="font-medium text-sm truncate">{doc.filename}</div>
                    {/* Status badges and metadata */}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={doc.success ? "default" : "destructive"} className="text-xs">
                        {doc.success ? "Parsed Successfully" : "Parse Failed"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {doc.content.length} characters
                      </span>
                    </div>
                  </div>
                </div>
                {/* RIGHT SECTION: Expand/collapse controls */}
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Document Content - Expandable */}
              {isExpanded && (
                <div className="p-4 border-t bg-background">
                  {doc.success ? (
                    <div className="space-y-3">
                      {/* Content Preview */}
                      <div className="p-3 rounded-lg bg-muted/20 border">
                        <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed max-h-96 overflow-y-auto">
                          {doc.content}
                        </div>
                      </div>

                      {/* Content Stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Characters: {doc.content.length.toLocaleString()}</span>
                        <span>Words: ~{Math.ceil(doc.content.split(/\s+/).length)}</span>
                        <span>Lines: {doc.content.split('\n').length}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">
                        Failed to extract content from this document. The AI will work with the filename and any available metadata.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Summary Footer */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {parsedDocuments.filter(doc => doc.success).length} of {parsedDocuments.length} documents parsed successfully
            </span>
            <span>
              Total content: {parsedDocuments.reduce((total, doc) => total + doc.content.length, 0).toLocaleString()} characters
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}