"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, ArrowLeft, Palette, Layout } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SlideData } from "@/app/build/page";
import { useImprovedWebSocket } from "@/hooks/use-improved-websocket";
import { useUser } from "@/lib/supabase/client";

interface ImprovedThemeStepProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

// Predefined themes with better color palettes
const themes = [
  {
    id: "professional-blue",
    name: "Professional Blue",
    description: "Clean and corporate",
    colors: ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe", "#ffffff"]
  },
  {
    id: "modern-dark",
    name: "Modern Dark",
    description: "Sleek and contemporary",
    colors: ["#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#ffffff"]
  },
  {
    id: "vibrant-purple",
    name: "Vibrant Purple",
    description: "Creative and energetic",
    colors: ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e9d5ff", "#ffffff"]
  },
  {
    id: "nature-green",
    name: "Nature Green",
    description: "Organic and fresh",
    colors: ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#ffffff"]
  },
  {
    id: "warm-orange",
    name: "Warm Orange",
    description: "Friendly and approachable",
    colors: ["#ea580c", "#fb923c", "#fdba74", "#fed7aa", "#fef3e2", "#ffffff"]
  },
  {
    id: "elegant-gray",
    name: "Elegant Gray",
    description: "Minimalist and sophisticated",
    colors: ["#374151", "#6b7280", "#9ca3af", "#d1d5db", "#f3f4f6", "#ffffff"]
  }
];

export function ImprovedThemeStep({ slideData, updateSlideData, onNext, onPrevious }: ImprovedThemeStepProps) {
  const user = useUser();
  const clientId = user?.id || `anonymous_${Date.now()}`;
  
  // Use the improved WebSocket hook
  const {
    state,
    sendThemeSelection,
    isConnected
  } = useImprovedWebSocket({
    clientId,
    autoConnect: true,
    onProgress: (progress) => {
      console.log(`Theme step progress: ${progress.message}`);
    },
    onError: (error) => {
      console.error('Theme selection error:', error.error_message);
    }
  });

  const [selectedTheme, setSelectedTheme] = useState(slideData.theme || "professional-blue");
  const [slideCount, setSlideCount] = useState(slideData.slideCount || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update slide data when theme or count changes
  useEffect(() => {
    const theme = themes.find(t => t.id === selectedTheme);
    if (theme) {
      updateSlideData({
        theme: selectedTheme,
        slideCount,
        themeData: theme
      });
    }
  }, [selectedTheme, slideCount, updateSlideData]);

  // Handle theme selection and send to backend
  const handleThemeSelection = async (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = themes.find(t => t.id === themeId);
    
    if (theme && isConnected) {
      try {
        setIsSubmitting(true);
        await sendThemeSelection(theme.id, theme.name, theme.colors, slideCount);
        console.log('Theme selection sent to backend');
      } catch (error) {
        console.error('Failed to send theme selection:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle slide count change
  const handleSlideCountChange = async (count: number) => {
    setSlideCount(count);
    const theme = themes.find(t => t.id === selectedTheme);
    
    if (theme && isConnected) {
      try {
        await sendThemeSelection(theme.id, theme.name, theme.colors, count);
        console.log('Slide count updated in backend');
      } catch (error) {
        console.error('Failed to update slide count:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`p-2 rounded text-sm ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {isConnected ? '🟢 Connected to server' : '🟡 Connecting to server...'}
      </div>

      {/* Processing Status */}
      {state.isProcessing && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">{state.lastMessage}</p>
          {state.progress > 0 && (
            <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${state.progress}%` }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* Slide Count Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Number of Slides
          </CardTitle>
          <CardDescription>
            How many slides do you want to generate?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slide-count">Slides: {slideCount}</Label>
            <Slider
              id="slide-count"
              min={1}
              max={10}
              step={1}
              value={[slideCount]}
              onValueChange={(value) => handleSlideCountChange(value[0])}
              className="w-full"
              disabled={isSubmitting}
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>1 slide</span>
              <span>10 slides</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Selection with Accordion */}
      <Card className="card-contrast" variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Selection
          </CardTitle>
          <CardDescription>
            Choose a theme that matches your presentation style
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["templates", "colors"]} className="w-full">
            {/* Template Selection */}
            <AccordionItem value="templates">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  Template Selection
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                  {themes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`cursor-pointer border rounded-lg p-4 transition-all ${
                        selectedTheme === theme.id
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => handleThemeSelection(theme.id)}
                    >
                      <div className="space-y-2">
                        <h3 className="font-medium text-sm">{theme.name}</h3>
                        <p className="text-xs text-gray-600">{theme.description}</p>
                        
                        {/* Color Palette Preview */}
                        <div className="flex gap-1">
                          {theme.colors.slice(0, 4).map((color, index) => (
                            <div
                              key={index}
                              className="w-4 h-4 rounded border border-gray-300"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Color Palette Details */}
            <AccordionItem value="colors">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Color Palette
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-4">
                  {(() => {
                    const currentTheme = themes.find(t => t.id === selectedTheme);
                    if (!currentTheme) return null;
                    
                    return (
                      <div className="space-y-4">
                        <h4 className="font-medium">{currentTheme.name} Colors</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {currentTheme.colors.map((color, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded border border-gray-300 shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                              <div className="text-sm">
                                <div className="font-mono text-xs text-gray-600">{color}</div>
                                <div className="text-xs text-gray-500">
                                  {index === 0 && "Primary"}
                                  {index === 1 && "Secondary"}
                                  {index === 2 && "Accent"}
                                  {index === 3 && "Light"}
                                  {index === 4 && "Background"}
                                  {index === 5 && "Text"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Selected Theme Summary */}
      {selectedTheme && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-900">
                  {themes.find(t => t.id === selectedTheme)?.name}
                </h3>
                <p className="text-sm text-blue-700">
                  {slideCount} slide{slideCount !== 1 ? 's' : ''} • {themes.find(t => t.id === selectedTheme)?.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTheme || isSubmitting || !isConnected}
          className="flex items-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}