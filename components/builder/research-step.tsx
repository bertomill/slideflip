"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, ArrowRight, Brain, CheckCircle, XCircle, Lightbulb, Settings, Image, Clock, Shield, Globe, BarChart3, Mic, Volume2, Zap, TrendingUp, MessageSquare, Play } from "lucide-react";
import { SlideData, ResearchOptions } from "@/app/builder/page";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/**
 * Props interface for the ResearchStep component
 * Defines the contract for data flow and navigation callbacks
 */
interface ResearchStepProps {
  slideData: SlideData;                                    // Current slide data from parent component
  updateSlideData: (updates: Partial<SlideData>) => void; // Callback to update slide data in parent
  onNext: () => void;                                      // Navigation callback to proceed to next step
  onPrev: () => void;                                      // Navigation callback to return to previous step
  sendGenerateSlide?: (description: string, theme?: string, wantsResearch?: boolean) => boolean; // WebSocket function to send slide generation request
}

/**
 * ResearchStep Component - Third step in the slide builder workflow
 * Allows users to choose whether to enhance their slide with AI-powered research
 * Provides customizable research options and handles the research API integration
 */
export function ResearchStep({ slideData, updateSlideData, onNext, onPrev, sendGenerateSlide }: ResearchStepProps) {
  type ModelAwareSlideData = SlideData & { selectedModel?: string };
  const modelAwareSlideData = slideData as ModelAwareSlideData;
  // UI State Management: Track research process status
  const [isResearching, setIsResearching] = useState(false);        // Loading state during API call
  const [researchComplete, setResearchComplete] = useState(false);  // Success state after research completion

  // Research Configuration: Default options that provide good balance of quality and performance
  const [researchOptions, setResearchOptions] = useState<ResearchOptions>({
    maxResults: 4,              // Moderate number of results for comprehensive but focused research
    includeImages: true,        // Visual content enhances slide presentations
    includeAnswer: 'advanced',  // Detailed AI summaries provide better context
    timeRange: 'month',         // Recent data is most relevant for current presentations
    excludeSocial: true,        // Professional sources are preferred for business presentations
  });

  // Agent Enhancement Options: Control which AI agents are enabled
  const [agentOptions, setAgentOptions] = useState({
    webResearchAgent: false,    // Deep web research capability
    dataAnalystAgent: false,    // KPI insights with charts and plots
    narrationAgent: false,      // Speaker notes generation
    voiceAgent: false,          // Audio playback functionality
  });

  /**
   * Updates research configuration options and syncs with parent component
   * Ensures both local state and global slide data stay synchronized
   * @param updates - Partial research options to merge with current settings
   */
  const updateResearchOptions = (updates: Partial<ResearchOptions>) => {
    const newOptions = { ...researchOptions, ...updates };
    setResearchOptions(newOptions);                    // Update local component state
    updateSlideData({ researchOptions: newOptions }); // Sync with parent slide data
  };

  /**
   * Updates agent options and syncs with parent component
   * @param updates - Partial agent options to merge with current settings
   */
  const updateAgentOptions = (updates: Partial<typeof agentOptions>) => {
    const newOptions = { ...agentOptions, ...updates };
    setAgentOptions(newOptions);
    updateSlideData({ agentOptions: newOptions } as Partial<SlideData>);
  };

  /**
   * Handles user's choice about whether to include additional research
   * Updates the slide data and conditionally shows advanced options
   * @param wantsResearch - Boolean indicating if user wants AI research enhancement
   */
  const handleResearchChoice = (wantsResearch: boolean) => {
    // Store the user's research preference in the global slide data
    updateSlideData({ wantsResearch });
  };

  /**
   * Initiates the AI research process using the Tavily API
   * Handles the complete research workflow: API call, success/error handling, and UI updates
   * Separated from handleResearchChoice to allow users to configure options before starting
   */
  const startResearch = async () => {
    // Show loading state to provide user feedback during API call
    setIsResearching(true);
    
    try {
      // Build research query from user's slide description with fallback
      // Uses description as primary query since it contains the user's specific intent
      const query = slideData.description || "business presentation insights";
      
      // Make API call to research endpoint with user's query and customized options
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,                    // Primary search term
          description: slideData.description, // Additional context for research
          options: researchOptions,        // User-configured research parameters
        }),
      });

      // Check for HTTP-level errors (network issues, server errors, etc.)
      if (!response.ok) {
        throw new Error('Research request failed');
      }

      // Parse the JSON response from the research API
      const data = await response.json();
      
      // Handle successful research results
      if (data.success) {
        // Store research data in global slide state for use in slide generation
        updateSlideData({ researchData: data.researchData });
        // Mark research as complete to show results UI and enable next step
        setResearchComplete(true);
      } else {
        // Handle API-level errors (invalid query, rate limits, etc.)
        throw new Error(data.error || 'Research failed');
      }
    } catch (error) {
      // Log error details for debugging while providing user-friendly feedback
      console.error('Research error:', error);
      
      // Create graceful fallback message that allows user to continue without research
      // This ensures the slide builder workflow isn't completely blocked by research failures
      let fallbackData = `Research temporarily unavailable. 
      
Your slide will be created using the uploaded documents and description provided.`;

      // Provide specific guidance based on error type to help user resolve issues
      if (error instanceof Error) {
        if (error.message.includes('400')) {
          // Client-side error: likely invalid or insufficient query parameters
          fallbackData += `\n\nTip: Try providing a more detailed description for better research results.`;
        } else if (error.message.includes('500')) {
          // Server-side error: API service issues, rate limits, or configuration problems
          fallbackData += `\n\nThe research service is currently unavailable. Please try again later.`;
        } else {
          // Generic error: network issues, timeouts, or unexpected failures
          fallbackData += `\n\nFor enhanced content, please try the research option again later.`;
        }
      }
      
      // Store fallback message as research data so user can still proceed
      updateSlideData({ researchData: fallbackData });
      // Mark as complete even on error to allow workflow continuation
      setResearchComplete(true);
    } finally {
      // Always clear loading state regardless of success/failure
      // This ensures UI doesn't get stuck in loading state
      setIsResearching(false);
    }
  };

  // Navigation Logic: Determine if user can proceed to next step
  // User must make a choice about research before continuing
  const canProceed = slideData.wantsResearch !== undefined;

  // Handle slide generation when user clicks "Continue to Preview"
  const handleContinueToPreview = async () => {
    if (sendGenerateSlide) {
      try {
        console.log('Sending slide generation request before proceeding to preview');
        console.log('Generation parameters:', {
          description: slideData.description,
          theme: slideData.selectedTheme || "default",
          wantsResearch: slideData.wantsResearch || false
        });
        
        // Get theme details from slideData
        const selectedTheme = slideData.selectedTheme;
        const themeDetails = selectedTheme ? {
          theme_id: selectedTheme,
          // You can add more theme details here if needed
        } : undefined;
        
        const success = sendGenerateSlide(
          slideData.description,
          slideData.selectedTheme || "default",
          slideData.wantsResearch || false
        );
        
        if (!success) {
          console.error('Failed to send slide generation request');
        } else {
          console.log('Slide generation request sent successfully');
        }
        
        // Add a small delay to ensure the message is sent before proceeding
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error sending slide generation request:', error);
      }
    } else {
      console.error('sendGenerateSlide function is not available');
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Step Header: Introduces the research enhancement option */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Additional Research
          </CardTitle>
          <CardDescription>
            Would you like AI to conduct additional research to enhance your slide content?
          </CardDescription>
          {/* Inline AI model toggle for convenience */}
          <div className="mt-3 flex items-center gap-3">
            <Label className="text-xs">AI Model</Label>
            <Select
              value={modelAwareSlideData.selectedModel || "gpt-4"}
              onValueChange={(value) => updateSlideData({ selectedModel: value } as Partial<SlideData>)}
            >
              <SelectTrigger className="w-[220px] h-8 rounded-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4 (current)</SelectItem>
                <SelectItem value="gpt-5-2025-08-07">GPT-5 (2025-08-07)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Research Choice Cards: Two-option selection interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Enable AI Research Enhancement */}
        <Card
          variant={slideData.wantsResearch === true ? "premium" : "glass"}
          className={`cursor-pointer transition-premium hover:scale-[1.02] ${
            slideData.wantsResearch === true ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => !isResearching && handleResearchChoice(true)}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-accent">
                <CheckCircle className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Yes, enhance with research</CardTitle>
                {slideData.wantsResearch === true && (
                  <Badge variant="secondary" className="mt-1">
                    <Brain className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              AI will research relevant industry data, trends, and best practices to make your slide more compelling and data-driven.
            </CardDescription>
            <Accordion type="single" collapsible>
              <AccordionItem value="details-yes">
                <AccordionTrigger className="text-sm font-medium text-foreground/90 hover:underline">
                  Learn more
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Industry insights & trends
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Supporting statistics
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Best practice recommendations
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Option 2: Skip Research, Use Existing Content Only */}
        <Card
          variant={slideData.wantsResearch === false ? "premium" : "glass"}
          className={`cursor-pointer transition-premium hover:scale-[1.02] ${
            slideData.wantsResearch === false ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => !isResearching && handleResearchChoice(false)}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-secondary">
                <XCircle className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">No, use existing content</CardTitle>
                {slideData.wantsResearch === false && (
                  <Badge variant="secondary" className="mt-1">
                    <Brain className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Proceed with just the content from your uploaded documents. This is faster and works well when you have comprehensive source material.
            </CardDescription>
            <Accordion type="single" collapsible>
              <AccordionItem value="details-no">
                <AccordionTrigger className="text-sm font-medium text-foreground/90 hover:underline">
                  Learn more
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Faster processing time
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Focus on your specific content
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Maintain original context
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Agent Enhancement Options */}
      {slideData.wantsResearch === true && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              AI Agent Enhancements
            </CardTitle>
            <CardDescription>
              Enable specialized AI agents to enhance your slide with advanced capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Web Research Agent */}
              <Card
                variant={agentOptions.webResearchAgent ? "premium" : "glass"}
                className={`cursor-pointer transition-premium hover:scale-[1.02] ${
                  agentOptions.webResearchAgent ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
                onClick={() => updateAgentOptions({ webResearchAgent: !agentOptions.webResearchAgent })}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                      agentOptions.webResearchAgent 
                        ? "bg-blue-500 text-white" 
                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}>
                      <Globe className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Web Research Agent</CardTitle>
                      {agentOptions.webResearchAgent && (
                        <Badge variant="secondary" className="mt-1">
                          <Zap className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-3">
                    <strong>Deep Intelligence Gathering:</strong> Conducts comprehensive web research across multiple authoritative sources to uncover the latest industry insights, market trends, and competitive intelligence.
                  </CardDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-blue-500" />
                      Real-time market analysis & competitor insights
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Search className="h-3 w-3 text-blue-500" />
                      Multi-source verification & fact-checking
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Lightbulb className="h-3 w-3 text-blue-500" />
                      Industry-specific terminology & context
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Analyst Agent */}
              <Card
                variant={agentOptions.dataAnalystAgent ? "premium" : "glass"}
                className={`cursor-pointer transition-premium hover:scale-[1.02] ${
                  agentOptions.dataAnalystAgent ? "ring-2 ring-green-500 bg-green-50/50 dark:bg-green-950/20" : ""
                }`}
                onClick={() => updateAgentOptions({ dataAnalystAgent: !agentOptions.dataAnalystAgent })}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                      agentOptions.dataAnalystAgent 
                        ? "bg-green-500 text-white" 
                        : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    }`}>
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Data Analyst Agent</CardTitle>
                      {agentOptions.dataAnalystAgent && (
                        <Badge variant="secondary" className="mt-1">
                          <Zap className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-3">
                    <strong>Intelligent Data Storytelling:</strong> Transforms raw information into compelling visual narratives with automated KPI analysis, interactive charts, and data-driven insights that make complex information digestible.
                  </CardDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BarChart3 className="h-3 w-3 text-green-500" />
                      Auto-generated charts, graphs & infographics
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      KPI identification & performance metrics
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Brain className="h-3 w-3 text-green-500" />
                      Pattern recognition & predictive insights
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Narration Agent */}
              <Card
                variant={agentOptions.narrationAgent ? "premium" : "glass"}
                className={`cursor-pointer transition-premium hover:scale-[1.02] ${
                  agentOptions.narrationAgent ? "ring-2 ring-purple-500 bg-purple-50/50 dark:bg-purple-950/20" : ""
                }`}
                onClick={() => updateAgentOptions({ narrationAgent: !agentOptions.narrationAgent })}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                      agentOptions.narrationAgent 
                        ? "bg-purple-500 text-white" 
                        : "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    }`}>
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Narration Agent</CardTitle>
                      {agentOptions.narrationAgent && (
                        <Badge variant="secondary" className="mt-1">
                          <Zap className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-3">
                    <strong>Professional Presentation Coaching:</strong> Creates comprehensive speaker notes with talking points, transition phrases, and presentation flow guidance to help you deliver confident, engaging presentations.
                  </CardDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3 text-purple-500" />
                      Detailed talking points & key message emphasis
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Lightbulb className="h-3 w-3 text-purple-500" />
                      Smooth transitions & storytelling flow
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 text-purple-500" />
                      Timing cues & audience engagement tips
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Voice Agent */}
              <Card
                variant={agentOptions.voiceAgent ? "premium" : "glass"}
                className={`cursor-pointer transition-premium hover:scale-[1.02] ${
                  agentOptions.voiceAgent ? "ring-2 ring-orange-500 bg-orange-50/50 dark:bg-orange-950/20" : ""
                }`}
                onClick={() => updateAgentOptions({ voiceAgent: !agentOptions.voiceAgent })}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                      agentOptions.voiceAgent 
                        ? "bg-orange-500 text-white" 
                        : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                    }`}>
                      <Play className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Voice Agent</CardTitle>
                      {agentOptions.voiceAgent && (
                        <Badge variant="secondary" className="mt-1">
                          <Zap className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-3">
                    <strong>Interactive Audio Experience:</strong> Transforms your presentation into an immersive audio experience with natural voice narration of slide content, speaker notes, and contextual explanations.
                  </CardDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Volume2 className="h-3 w-3 text-orange-500" />
                      Natural voice synthesis & pronunciation
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Play className="h-3 w-3 text-orange-500" />
                      Interactive playback controls & timing
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Settings className="h-3 w-3 text-orange-500" />
                      Voice customization & speed control
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Research Options */}
      {slideData.wantsResearch === true && !isResearching && !researchComplete && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Configure Your Research
            </CardTitle>
            <CardDescription>
              Keep it simple: you can start right away, or expand advanced options if you want to fine‑tune.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Concise current settings summary */}
            <div className="text-sm text-muted-foreground">
              {researchOptions.maxResults} results • {researchOptions.timeRange} timeframe • {researchOptions.includeAnswer} AI summary
              {researchOptions.includeImages && ' • Images included'}
              {researchOptions.excludeSocial && ' • Social media excluded'}
            </div>

            {/* Advanced options hidden by default to reduce cognitive load */}
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger className="text-sm">Advanced options</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          Number of Results
                        </Label>
                        <Select
                          value={researchOptions.maxResults.toString()}
                          onValueChange={(value) => updateResearchOptions({ maxResults: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 results</SelectItem>
                            <SelectItem value="4">4 results</SelectItem>
                            <SelectItem value="6">6 results</SelectItem>
                            <SelectItem value="8">8 results</SelectItem>
                            <SelectItem value="10">10 results</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Time Range
                        </Label>
                        <Select
                          value={researchOptions.timeRange}
                          onValueChange={(value: 'day' | 'week' | 'month' | 'year' | 'all') =>
                            updateResearchOptions({ timeRange: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Past Day</SelectItem>
                            <SelectItem value="week">Past Week</SelectItem>
                            <SelectItem value="month">Past Month</SelectItem>
                            <SelectItem value="year">Past Year</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label className="flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          AI Summary Level
                        </Label>
                        <Select
                          value={researchOptions.includeAnswer}
                          onValueChange={(value: 'basic' | 'advanced') =>
                            updateResearchOptions({ includeAnswer: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic Summary</SelectItem>
                            <SelectItem value="advanced">Advanced Summary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          Include Images
                        </Label>
                        <Switch
                          checked={researchOptions.includeImages}
                          onCheckedChange={(checked) => updateResearchOptions({ includeImages: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Exclude Social Media
                        </Label>
                        <Switch
                          checked={researchOptions.excludeSocial}
                          onCheckedChange={(checked) => updateResearchOptions({ excludeSocial: checked })}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Primary action */}
            <div className="flex justify-center pt-2">
              <Button onClick={startResearch} size="xl" className="px-8">
                <Search className="h-4 w-4 mr-2" />
                Start Research
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Research Progress Indicator: Loading state with animated feedback */}
      {/* Shows detailed progress steps to keep user engaged during potentially long API call */}
      {/* Only visible while research API request is in progress */}
      {isResearching && (
        <Card variant="glass">
          <CardContent className="p-6">
            {/* Progress Header: Visual loading indicator with status message */}
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <h3 className="font-semibold">AI Research in Progress</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Searching the web for relevant industry data, trends, and insights using Tavily AI to enhance your slide content...
            </p>
            {/* Progress Steps: Animated indicators showing research phases */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Searching industry databases...
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Analyzing relevant sources...
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Extracting key insights...
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Research Results Display: Success state showing gathered insights */}
      {/* Only visible after successful research completion with valid data */}
      {/* Provides preview of research content that will enhance the slide */}
      {researchComplete && slideData.researchData && (
        <Card variant="premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Research Complete
            </CardTitle>
            <CardDescription>
              AI has gathered additional insights to enhance your slide
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Research Data Preview: Formatted display of gathered insights */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                {slideData.researchData}
              </div>
            </div>
            {/* Usage Context: Explains how research will be integrated */}
            <div className="mt-4 text-xs text-muted-foreground">
              This research data will be incorporated into your slide generation to provide more comprehensive and data-driven content.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Upload
        </Button>
        {/* Forward Navigation: Proceed to preview step */}
        {/* Disabled during active research or if user hasn't made research choice */}
        <Button 
          variant="engineering" 
          size="lg" 
          onClick={onNext}
          disabled={!canProceed || isResearching}
          className="bg-gradient-to-b from-[hsl(320,12%,62%)] to-[hsl(320,12%,52%)] hover:from-[hsl(320,12%,57%)] hover:to-[hsl(320,12%,47%)] text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 disabled:from-gray-400 disabled:to-gray-500"
        >
          Continue to Themes
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}