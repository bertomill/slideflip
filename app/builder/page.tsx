"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { Sparkles, ArrowLeft, ArrowRight } from "lucide-react";
import { UploadStep } from "@/components/builder/upload-step";
import { ThemeStep } from "@/components/builder/theme-step";
import { ResearchStep } from "@/components/builder/research-step";
import { PreviewStep } from "@/components/builder/preview-step";
import { DownloadStep } from "@/components/builder/download-step";

export type SlideData = {
  documents: File[];
  description: string;
  selectedTheme: string;
  wantsResearch: boolean;
  researchData?: string;
  slideHtml?: string;
  userFeedback?: string;
};

const steps = [
  { id: 1, name: "Upload", description: "Upload documents & describe your slide" },
  { id: 2, name: "Theme", description: "Choose a visual theme" },
  { id: 3, name: "Research", description: "Additional research options" },
  { id: 4, name: "Preview", description: "Review and refine your slide" },
  { id: 5, name: "Download", description: "Export your presentation" },
];

export default function SlideBuilder() {
  const [currentStep, setCurrentStep] = useState(1);
  const [slideData, setSlideData] = useState<SlideData>({
    documents: [],
    description: "",
    selectedTheme: "",
    wantsResearch: false,
  });

  const updateSlideData = (updates: Partial<SlideData>) => {
    setSlideData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <UploadStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} />;
      case 2:
        return <ThemeStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 3:
        return <ResearchStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 4:
        return <PreviewStep slideData={slideData} updateSlideData={updateSlideData} onNext={nextStep} onPrev={prevStep} />;
      case 5:
        return <DownloadStep slideData={slideData} onPrev={prevStep} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation variant="premium">
        <NavigationBrand>
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            SlideFlip Builder
          </span>
        </NavigationBrand>
      </Navigation>

      <div className="container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <Card variant="glass" className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-premium ${
                    currentStep >= step.id 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : "border-muted-foreground text-muted-foreground"
                  }`}>
                    {step.id}
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p className={`text-sm font-medium ${
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {step.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-4 ${
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Step Content */}
        <div className="max-w-4xl mx-auto">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}