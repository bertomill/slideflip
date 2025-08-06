"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, ArrowLeft, ArrowRight, Sparkles, Image as ImageIcon, Briefcase, Zap, Heart } from "lucide-react";
import { SlideData } from "@/app/build/page";

/**
 * Props interface for the ThemeStep component
 * Handles theme selection in the slide builder workflow
 */
interface ThemeStepProps {
  slideData: SlideData;                                    // Current slide data from parent component
  updateSlideData: (updates: Partial<SlideData>) => void; // Callback to update slide data
  onNext: () => void;                                      // Navigate to next step
  onPrev: () => void;                                      // Navigate to previous step
}

/**
 * Available slide templates based on real company presentation styles
 * Each template includes sample images from the public/samples/slides directory
 */
const slideTemplates = [
  {
    id: "bmo",
    name: "BMO Style",
    description: "Professional banking presentation with clean corporate design",
    image: "/samples/slides/bmo_slide_1.png",
    category: "Corporate"
  },
  {
    id: "facebook",
    name: "Facebook Style",
    description: "Modern tech presentation with bold visual elements",
    image: "/samples/slides/facebook_slide_1.png",
    category: "Tech"
  },
  {
    id: "jpm",
    name: "JPM Style",
    description: "Investment banking presentation with sophisticated layout",
    image: "/samples/slides/jpm_slide_1.png",
    category: "Finance"
  },
  {
    id: "uber",
    name: "Uber Style",
    description: "Dynamic startup presentation with engaging visuals",
    image: "/samples/slides/uber_slide_1.png",
    category: "Startup"
  },
  {
    id: "doordash",
    name: "DoorDash Style",
    description: "Vibrant consumer-focused presentation design",
    image: "/samples/slides/doordash_slide_1.png",
    category: "Consumer"
  },
  {
    id: "youtube",
    name: "YouTube Style",
    description: "Creative media presentation with bold branding",
    image: "/samples/slides/youtube_side_1.png",
    category: "Media"
  },
  {
    id: "rbc",
    name: "RBC Style",
    description: "Traditional banking presentation with professional aesthetics",
    image: "/samples/slides/rbc_slide_1.png",
    category: "Banking"
  },
  {
    id: "pg",
    name: "P&G Style",
    description: "Consumer goods presentation with clean, approachable design",
    image: "/samples/slides/pg_slide_1.png",
    category: "Consumer Goods"
  },
  {
    id: "cat",
    name: "Caterpillar Style",
    description: "Industrial presentation with strong, reliable design elements",
    image: "/samples/slides/cat_slide_1.png",
    category: "Industrial"
  }
];

/**
 * Predefined theme configurations with colors, icons, and preview text
 * These themes provide different visual styles for slide generation
 */
const themes = [
  {
    id: "professional",
    name: "Professional",
    description: "Clean, corporate design perfect for business presentations",
    icon: Briefcase,
    colors: ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd"],
    preview: "Sophisticated layouts with emphasis on data and clarity"
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with bold colors and friendly layouts",
    icon: Sparkles,
    colors: ["#7c3aed", "#a855f7", "#c084fc", "#ddd6fe"],
    preview: "Fresh, engaging visuals that capture attention"
  },
  {
    id: "creative",
    name: "Creative",
    description: "Vibrant colors and friendly layouts that create connection",
    icon: Palette,
    colors: ["#dc2626", "#ef4444", "#f87171", "#fca5a5"],
    preview: "Bold, expressive designs that inspire and motivate"
  },
  {
    id: "energetic",
    name: "Energetic",
    description: "High-impact design for dynamic presentations",
    icon: Zap,
    colors: ["#ea580c", "#f97316", "#fb923c", "#fdba74"],
    preview: "Dynamic layouts that energize and engage your audience"
  },
  {
    id: "warm",
    name: "Warm",
    description: "Friendly, approachable design that builds trust",
    icon: Heart,
    colors: ["#be185d", "#e11d48", "#f43f5e", "#fb7185"],
    preview: "Welcoming designs that create emotional connections"
  }
];

/**
 * ThemeStep Component - Second step in the slide builder workflow
 * Allows users to select visual themes and preview template styles
 */
export function ThemeStep({ slideData, updateSlideData, onNext, onPrev }: ThemeStepProps) {
  // Loading state for theme selection animation
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Handles theme selection and simulates AI processing
   * Updates the slide data with the selected theme ID
   */
  const selectTheme = async (themeId: string) => {
    // Set loading state to show processing animation
    setIsGenerating(true);

    // Update parent component with selected theme
    updateSlideData({ selectedTheme: themeId });

    // Simulate AI theme generation processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Clear loading state
    setIsGenerating(false);
  };

  // Check if user can proceed to next step (theme must be selected)
  const canProceed = slideData.selectedTheme !== "";

  return (
    <div className="space-y-6">
      {/* Header section with instructions */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Choose Your Slide Template
          </CardTitle>
          <CardDescription>
            Select a slide template that matches your presentation style and industry
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Template selection grid - displays sample slides from real companies */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Professional Templates
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Choose from templates inspired by successful presentations from leading companies
        </p>

        {/* Grid layout for template cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slideTemplates.map((template) => {
            // Check if this template is currently selected
            const isSelected = slideData.selectedTheme === template.id;

            return (
              <Card
                key={template.id}
                variant={isSelected ? "premium" : "glass"}
                className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                onClick={() => selectTheme(template.id)}
              >
                {/* Template preview image */}
                <div className="aspect-[16/10] overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-800">
                  <img
                    src={template.image}
                    alt={`${template.name} template preview`}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Template information */}
                <CardContent className="p-4">
                  {/* Template name and category badge */}
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{template.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  {/* Template description */}
                  <p className="text-xs text-muted-foreground mb-3">
                    {template.description}
                  </p>

                  {/* Selection indicator - only shown when template is selected */}
                  {isSelected && (
                    <div className="flex items-center gap-1 text-primary">
                      <Sparkles className="h-3 w-3" />
                      <span className="text-xs font-medium">Selected</span>
                    </div>
                  )}

                  {/* Loading indicator during theme processing */}
                  {isGenerating && slideData.selectedTheme === template.id && (
                    <div className="flex items-center gap-2 text-sm text-primary mt-2">
                      <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                      <span className="text-xs">Processing template...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Theme style selection grid - abstract color themes */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Color Themes
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Select a color theme to customize your chosen template
        </p>

        {/* Grid layout for theme cards - 2 columns on medium screens and up */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {themes.map((theme) => {
            // Get the icon component for this theme
            const Icon = theme.icon;
            // Check if this theme is currently selected
            const isSelected = slideData.selectedTheme === theme.id;

            return (
              <Card
                key={theme.id}
                variant={isSelected ? "premium" : "glass"}
                className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected ? "ring-2 ring-primary" : ""
                  }`}
                onClick={() => selectTheme(theme.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Theme icon with gradient background */}
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{theme.name}</CardTitle>
                        {/* Selection badge - only shown when theme is selected */}
                        {isSelected && (
                          <Badge variant="secondary" className="mt-1">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Selected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Theme description */}
                  <CardDescription>{theme.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  {/* Color palette preview circles */}
                  <div className="flex gap-2 mb-4">
                    {theme.colors.map((color, index) => (
                      <div
                        key={index}
                        className="w-8 h-8 rounded-full border-2 border-background shadow-sm"
                        style={{ backgroundColor: color }}
                        title={`Color ${index + 1}: ${color}`}
                      />
                    ))}
                  </div>

                  {/* Theme preview description in a styled container */}
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm text-muted-foreground italic">
                      "{theme.preview}"
                    </p>
                  </div>

                  {/* Loading indicator for theme processing */}
                  {isGenerating && slideData.selectedTheme === theme.id && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      Generating theme suggestions...
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* AI suggestions panel - appears after theme selection */}
      {slideData.selectedTheme && (
        <Card variant="glass">
          <CardContent className="p-6">
            {/* AI suggestions header */}
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Theme Suggestions</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Based on your selected theme and document content, here are some AI-generated suggestions:
            </p>

            {/* Suggestion cards with actionable recommendations */}
            <div className="space-y-2">
              {/* Suggestion 1: Header design */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">• Use a clean header with your company logo and presentation title</p>
              </div>
              {/* Suggestion 2: Data visualization */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">• Include data visualizations with your selected color palette</p>
              </div>
              {/* Suggestion 3: Animations */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">• Add subtle animations for key points and transitions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons - back to upload, forward to research */}
      <div className="flex justify-between">
        {/* Back button - returns to previous step */}
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Upload
        </Button>
        
        {/* Continue button - disabled until theme is selected */}
        <Button
          variant="default"
          size="lg"
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue to Research
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}