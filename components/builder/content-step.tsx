"use client";

// React hooks for component state and lifecycle management
import { useState, useEffect } from "react";
// UI components for building the content planning interface
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
export function ContentStep({ slideData, updateSlideData, onNext, onPrev }: ContentStepProps) {
  // ============================================================================
  // COMPONENT STATE: Manages content planning workflow and user interactions
  // ============================================================================

  // LOADING STATES: Track async operations for proper UI feedback
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false); // Shows spinner during AI content plan generation

  // CONTENT PLAN MANAGEMENT: Handles AI-generated and user-modified content plans
  const [contentPlan, setContentPlan] = useState<string>("");           // Original AI-generated content plan (read-only reference)
  const [editableContentPlan, setEditableContentPlan] = useState<string>(""); // User-editable version of content plan (working copy)

  // USER INPUT: Collects additional feedback and requirements
  const [userFeedback, setUserFeedback] = useState<string>("");         // User's refinement feedback and additional requirements

  // WORKFLOW STATE: Controls component behavior and UI visibility
  const [planGenerated, setPlanGenerated] = useState(false);            // Flag indicating AI plan generation is complete

  // UNUSED STATE: These variables are declared but not currently used in the component
  const [isEditingPlan, setIsEditingPlan] = useState(false);           // Edit mode toggle (reserved for future inline editing feature)

  // ============================================================================
  // CONTENT PLAN GENERATION: AI-powered analysis and planning
  // ============================================================================

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
  const generateContentPlan = async () => {
    // SET LOADING STATE: Show spinner and disable interactions during AI processing
    setIsGeneratingPlan(true);

    try {
      // CONTEXT PREPARATION: Compile all user inputs for AI analysis
      // This comprehensive context ensures the AI has all necessary information
      // to create a relevant and personalized content plan
      const planningContext = {
        description: slideData.description,           // User's slide description and requirements
        selectedTheme: slideData.selectedTheme,       // Visual theme choice (Professional, Modern, etc.)
        hasResearch: slideData.wantsResearch,         // Boolean flag for research inclusion
        researchData: slideData.researchData,         // External research insights from Tavily API
        documentCount: slideData.documents.length,    // Number of uploaded files for context
      };

      // API REQUEST: Send planning context to AI content planning service
      // The /api/plan-content endpoint analyzes all inputs and generates
      // a structured content plan with recommendations and suggestions
      const response = await fetch('/api/plan-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planningContext),
      });

      // RESPONSE VALIDATION: Ensure API request was successful before processing
      if (!response.ok) {
        throw new Error('Content planning request failed');
      }

      const data = await response.json();

      // SUCCESS HANDLING: Process successful AI content plan generation
      if (data.success) {
        // DUAL STATE MANAGEMENT: Store both original and editable versions
        setContentPlan(data.contentPlan);              // Original AI plan (reference copy)
        setEditableContentPlan(data.contentPlan);      // Editable copy for user modifications
        setPlanGenerated(true);                        // Enable user review interface
      } else {
        throw new Error(data.error || 'Content planning failed');
      }
    } catch (error) {
      // ERROR HANDLING: Graceful fallback when AI planning fails
      console.error('Content planning error:', error);

      // FALLBACK STRATEGY: Generate local plan to ensure workflow continuity
      const fallbackPlan = generateFallbackPlan();
      setContentPlan(fallbackPlan);                    // Set fallback as original
      setEditableContentPlan(fallbackPlan);            // Set fallback as editable
      setPlanGenerated(true);                          // Allow user to proceed
    } finally {
      // CLEANUP: Always clear loading state regardless of success/failure
      setIsGeneratingPlan(false);
    }
  };

  /**
   * Generate fallback content plan when AI service is unavailable
   * 
   * FALLBACK STRATEGY:
   * - Uses available slide data to create basic content structure
   * - Ensures user workflow continues even when AI planning fails
   * - Provides reasonable default recommendations based on user inputs
   * - Maintains consistent format with AI-generated plans
   * 
   * CONTENT STRUCTURE:
   * - Main content section based on user description
   * - Research integration (if applicable)
   * - Theme-appropriate visual design notes
   * - User feedback solicitation
   */
  const generateFallbackPlan = (): string => {
    // BUILD FALLBACK PLAN: Create structured content plan using available user data
    // This ensures users can continue their workflow even when AI services are unavailable
    let plan = `Based on your description: "${slideData.description}"\n\n`;
    plan += `I'm planning to create a slide with the following structure:\n\n`;

    // MAIN CONTENT SECTION: Core slide structure based on user inputs
    plan += `📋 **Main Content:**\n`;
    plan += `• Title based on your description\n`;
    plan += `• Key points extracted from your uploaded documents\n`;
    plan += `• Supporting details and context\n\n`;

    // CONDITIONAL RESEARCH SECTION: Only include if user requested research
    if (slideData.wantsResearch && slideData.researchData) {
      plan += `🔍 **Research Integration:**\n`;
      plan += `• Industry insights and trends\n`;
      plan += `• Supporting statistics and data\n`;
      plan += `• Best practice recommendations\n\n`;
    }

    // VISUAL DESIGN SECTION: Theme-appropriate styling recommendations
    plan += `🎨 **Visual Design:**\n`;
    plan += `• ${slideData.selectedTheme} theme styling\n`;
    plan += `• Professional layout and typography\n`;
    plan += `• Balanced content hierarchy\n\n`;

    // USER FEEDBACK PROMPT: Encourage user input for plan refinement
    plan += `Is there anything specific you'd like me to add, remove, or modify?`;

    return plan;
  };

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
      generateContentPlan();
    }
  }, []);

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
            Let's review what will go on your slide and gather any additional input
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ========================================================================
          LOADING STATE: AI content plan generation progress indicator
          ========================================================================
          - Only visible while AI is analyzing user data
          - Shows spinning loader and progress steps for user feedback
          - Provides transparency about what AI is processing
          - Uses glass card variant for subtle appearance during loading
          ======================================================================== */}
      {isGeneratingPlan && (
        <Card variant="glass">
          <CardContent className="p-6">
            {/* LOADING HEADER: Spinner and status message */}
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <h3 className="font-semibold">Analyzing Your Content</h3>
            </div>

            {/* PROCESS DESCRIPTION: Explains what AI is doing */}
            <p className="text-sm text-muted-foreground mb-4">
              AI is reviewing your documents, description, theme choice, and research data to create a comprehensive content plan...
            </p>

            {/* PROGRESS STEPS: Visual indicators of processing stages */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Processing uploaded documents...
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Integrating research findings...
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Creating content structure...
              </div>
            </div>
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
                  Here's what I'm planning to include on your slide based on all the information gathered
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
              {/* DOCUMENTS SOURCE INDICATOR */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">Documents</div>
                  <div className="text-xs text-muted-foreground">
                    {slideData.documents.length} file{slideData.documents.length !== 1 ? 's' : ''} uploaded
                  </div>
                </div>
              </div>

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
              Is there anything you'd like to add, remove, or modify in the planned content?
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
              Leave blank if you're satisfied with the proposed content plan above.
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
  // CONTENT PARSING: Convert plain text content plan into structured sections for better display
  const parseContent = (text: string) => {
    const lines = text.split('\n');
    const sections: Array<{ type: 'text' | 'header' | 'list' | 'bold'; content: string; level?: number }> = [];

    // PARSE EACH LINE: Identify content type and structure for appropriate rendering
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue; // Skip empty lines

      // MARKDOWN HEADERS: Detect **bold text** as secondary headers
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        sections.push({
          type: 'header',
          content: trimmed.slice(2, -2), // Remove ** markers
          level: 2
        });
      }
      // BULLET POINTS: Detect various bullet point formats (•, -, *)
      else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        sections.push({
          type: 'list',
          content: trimmed.substring(1).trim() // Remove bullet character
        });
      }
      // EMOJI HEADERS: Detect lines starting with emojis as primary section headers
      // Matches common presentation emojis used in AI-generated content plans
      else if (/^[📋🔍🎨💡📊🚀✨🎯📈🔧⚡🌟💼🎪🎭🎨🎯📝💻🔥⭐🎊🎉]\s/.test(trimmed)) {
        sections.push({
          type: 'header',
          content: trimmed,
          level: 1 // Primary header level for emoji sections
        });
      }
      // REGULAR TEXT: Default case for paragraph content
      else {
        sections.push({
          type: 'text',
          content: trimmed
        });
      }
    }

    return sections;
  };

  // PARSE CONTENT: Convert raw text into structured sections for rendering
  const sections = parseContent(content);

  return (
    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
      {sections.map((section, index) => {
        switch (section.type) {
          case 'header':
            return (
              <div
                key={index}
                className={`font-semibold ${section.level === 1
                  ? 'text-base text-primary mb-2'
                  : 'text-sm text-foreground mt-4 mb-1'
                  }`}
              >
                {section.content}
              </div>
            );
          case 'list':
            return (
              <div key={index} className="flex items-start gap-2 text-sm text-foreground ml-4">
                <span className="text-primary mt-1">•</span>
                <span className="leading-relaxed">{section.content}</span>
              </div>
            );
          case 'text':
            return (
              <div key={index} className="text-sm text-foreground leading-relaxed">
                {section.content}
              </div>
            );
          default:
            return null;
        }
      })}
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
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[300px] p-4 text-sm leading-relaxed resize-none bg-primary/5 border-primary/20"
        placeholder="Edit your content plan here..."
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Use ** for headers, • for bullet points. Changes will be applied to your slide generation.
        </div>
        <Button
          onClick={onSave}
          size="sm"
          className="flex items-center gap-2"
        >
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