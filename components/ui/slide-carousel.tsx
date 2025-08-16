"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideCarouselProps {
  slides: string[];
  className?: string;
}

export function SlideCarousel({ slides, className }: SlideCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!slides || slides.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-muted rounded-lg", className)}>
        <p className="text-muted-foreground">No slides available</p>
      </div>
    );
  }

  if (slides.length === 1) {
    // Single slide - no navigation needed
    return (
      <div className={cn("w-full", className)}>
        <div className="w-full aspect-[16/9] overflow-hidden rounded-lg border bg-white">
          <div 
            dangerouslySetInnerHTML={{ __html: slides[0] }}
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Slide Display */}
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-lg border bg-white">
        <div 
          dangerouslySetInnerHTML={{ __html: slides[currentSlide] }}
          className="w-full h-full"
        />
        
        {/* Navigation Buttons */}
        <div className="absolute inset-y-0 left-0 flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            className="ml-2 h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="absolute inset-y-0 right-0 flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={goToNext}
            className="mr-2 h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Slide Counter */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {currentSlide + 1} / {slides.length}
        </div>
      </div>

      {/* Slide Thumbnails/Dots */}
      <div className="flex justify-center space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={cn(
              "w-3 h-3 rounded-full transition-colors",
              index === currentSlide 
                ? "bg-primary" 
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Slide Info */}
      <div className="text-center text-sm text-muted-foreground">
        Slide {currentSlide + 1} of {slides.length}
      </div>
    </div>
  );
}