"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, ArrowLeft, ArrowRight, Sparkles, Briefcase, Zap, Heart } from "lucide-react";
import { SlideData } from "@/app/builder/page";

interface ThemeStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const themes = [
  {
    id: "professional",
    name: "Professional",
    description: "Clean, corporate design perfect for business presentations",
    icon: Briefcase,
    colors: ["#1e40af", "#3b82f6", "#60a5fa"],
    preview: "Modern typography with subtle gradients and professional spacing"
  },
  {
    id: "creative",
    name: "Creative",
    description: "Bold, vibrant design for creative and marketing presentations",
    icon: Sparkles,
    colors: ["#7c3aed", "#a855f7", "#c084fc"],
    preview: "Dynamic layouts with creative elements and engaging visuals"
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, focused design that lets your content shine",
    icon: Zap,
    colors: ["#374151", "#6b7280", "#9ca3af"],
    preview: "Plenty of whitespace with elegant typography and subtle accents"
  },
  {
    id: "warm",
    name: "Warm",
    description: "Friendly, approachable design perfect for team presentations",
    icon: Heart,
    colors: ["#ea580c", "#fb923c", "#fdba74"],
    preview: "Warm colors and friendly layouts that create connection"
  }
];

export function ThemeStep({ slideData, updateSlideData, onNext, onPrev }: ThemeStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const selectTheme = async (themeId: string) => {
    setIsGenerating(true);
    updateSlideData({ selectedTheme: themeId });
    
    // Simulate AI theme generation
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsGenerating(false);
  };

  const canProceed = slideData.selectedTheme !== "";

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Choose Your Theme
          </CardTitle>
          <CardDescription>
            Select a visual theme that matches your presentation style and audience
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isSelected = slideData.selectedTheme === theme.id;
          
          return (
            <Card 
              key={theme.id}
              variant={isSelected ? "premium" : "glass"}
              className={`cursor-pointer transition-premium hover:scale-[1.02] ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => selectTheme(theme.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{theme.name}</CardTitle>
                      {isSelected && (
                        <Badge variant="secondary" className="mt-1">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <CardDescription>{theme.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Color Palette Preview */}
                <div className="flex gap-2 mb-4">
                  {theme.colors.map((color, index) => (
                    <div
                      key={index}
                      className="w-8 h-8 rounded-full border-2 border-background shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                
                {/* Theme Preview */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground italic">
                    "{theme.preview}"
                  </p>
                </div>

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

      {slideData.selectedTheme && (
        <Card variant="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Theme Suggestions</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Based on your selected theme and document content, here are some AI-generated suggestions:
            </p>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">• Use a clean header with your company logo and presentation title</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">• Include data visualizations with your selected color palette</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">• Add subtle animations for key points and transitions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Upload
        </Button>
        <Button 
          variant="premium" 
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