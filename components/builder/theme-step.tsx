"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Sparkles, Image as ImageIcon } from "lucide-react";
import { SlideData } from "@/app/build/page";

/**
 * Props interface for the ThemeStep component
 * Handles theme selection in the slide builder workflow
 */
interface ThemeStepProps {
<<<<<<< HEAD
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
  onNext: () => void;
  onPrev: () => void;
  sendThemeSelection?: (themeData: any) => boolean;
=======
  slideData: SlideData;                                    // Current slide data from parent component
  updateSlideData: (updates: Partial<SlideData>) => void; // Callback to update slide data
  onNext: () => void;                                      // Navigate to next step
  onPrev: () => void;                                      // Navigate to previous step
>>>>>>> origin/main
}

// legacy image-based cards removed in favor of curated/code templates

<<<<<<< HEAD
export function ThemeStep({ slideData, updateSlideData, onNext, onPrev, sendThemeSelection }: ThemeStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const selectTheme = async (themeId: string) => {
    setIsGenerating(true);
    
    // Find the selected theme data
    const selectedTheme = themes.find(theme => theme.id === themeId);
    
    if (selectedTheme && sendThemeSelection) {
      try {
        // Send theme data to backend
        const themeData = {
          theme_id: selectedTheme.id,
          theme_name: selectedTheme.name,
          theme_description: selectedTheme.description,
          color_palette: selectedTheme.colors,
          preview_text: selectedTheme.preview
        };
        
        const success = sendThemeSelection(themeData);
        if (success) {
          console.log('Theme selection sent to backend');
        } else {
          console.error('Failed to send theme selection to backend');
        }
      } catch (error) {
        console.error('Error sending theme selection:', error);
      }
    }
    
    updateSlideData({ selectedTheme: themeId });
    
    // Simulate AI theme generation
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsGenerating(false);
=======
// Old predefined theme cards removed; we now focus on palette selection methods.

/**
 * ThemeStep Component - Second step in the slide builder workflow
 * Allows users to select visual themes and preview template styles
 */
export function ThemeStep({ slideData, updateSlideData, onNext, onPrev }: ThemeStepProps) {
  // Loading state for theme selection animation
  // reserved for future async operations (unused for now)
  // const [isGenerating] = useState(false);
  const [examples, setExamples] = useState<Array<{id:string;name:string;theme:string;description:string;aspect_ratio:string;html:string}>>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);
  const [paletteMode, setPaletteMode] = useState<'logo' | 'ai' | 'manual'>('logo');
  const [manualColors, setManualColors] = useState<string[]>(['#980000', '#111111', '#333333', '#b3b3b3', '#ffffff']);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string>('modern, professional, trustworthy');
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);
  const pasteZoneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingExamples(true);
        const exRes = await fetch('/api/examples/list');
        const exData = await exRes.json();
        // Show only our fully built example. Prefer 'imported-02', else the first available.
        const curated: Array<{id:string;name:string;theme:string;description:string;aspect_ratio:string;html:string}> = (exData.examples || []);
        const onlyOne = curated.find((e) => e.id === 'imported-02') || curated[0];
        setExamples(onlyOne ? [onlyOne] : []);
      } catch {
        setExamples([]);
      } finally {
        setLoadingExamples(false);
      }
    };
    load();
  }, []);

  /**
   * Handles theme selection and simulates AI processing
   * Updates the slide data with the selected theme ID
   */
  // selection handled inline via curated cards

  // Check if user can proceed to next step (theme must be selected)
  const canProceed = slideData.selectedTheme !== "";

  // Responsive 16:9 live preview that scales the 960x540 slide to fill the card
  const SlidePreview = ({ html }: { html: string }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(0.6);
    useEffect(() => {
      const update = () => {
        if (!ref.current) return;
        const width = ref.current.clientWidth; // container width
        const s = width / 960; // scale to fit native slide width
        setScale(s);
      };
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }, []);
    return (
      <div ref={ref} className="relative w-full aspect-[16/9] overflow-hidden rounded-t-lg bg-white">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: '960px', height: '540px', transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
>>>>>>> origin/main
  };

  // Simple curated palettes for examples (can be extended or fetched later)
  const curatedPalettes: Record<string, string[]> = {
    'imported-02': ['#980000', '#111111', '#333333', '#b3b3b3', '#ffffff'],
  };

  const applyPalette = (id: string) => {
    const colors = curatedPalettes[id];
    if (!colors) return;
    setSelectedPaletteId(id);
    // Pass to parent (loosely typed to avoid breaking existing SlideData)
    // Palette is not part of SlideData yet; store on a generic key to avoid type errors
    updateSlideData({ ...( { } as Partial<SlideData>), ...( { selectedPalette: colors } as Partial<SlideData>) });
  };

  const applyCustomPalette = (colors: string[]) => {
    updateSlideData({ ...( { } as Partial<SlideData>), ...( { selectedPalette: colors } as Partial<SlideData>) });
  };

  // --- Helpers for palette extraction/generation ---
  const rgbToHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  const extractPaletteFromImage = async (file: File, k: number = 5) => {
    return new Promise<string[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setLogoPreview(url);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          const maxW = 128;
          const scale = Math.min(1, maxW / image.width);
          const w = Math.max(1, Math.floor(image.width * scale));
          const h = Math.max(1, Math.floor(image.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No canvas context')); return; }
          ctx.drawImage(image, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          // Build samples
          const samples: number[][] = [];
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a < 200) continue; // skip transparent
            samples.push([r, g, b]);
          }
          // K-means clustering (simple, few iterations)
          const clusters = Array.from({ length: k }, () => samples[Math.floor(Math.random() * samples.length)]);
          const assignments = new Array(samples.length).fill(0);
          const dist2 = (p: number[], c: number[]) => (p[0]-c[0])**2 + (p[1]-c[1])**2 + (p[2]-c[2])**2;
          for (let iter = 0; iter < 8; iter++) {
            // assign
            for (let si = 0; si < samples.length; si++) {
              let best = 0, bestD = Infinity;
              for (let ci = 0; ci < k; ci++) {
                const d = dist2(samples[si], clusters[ci]);
                if (d < bestD) { bestD = d; best = ci; }
              }
              assignments[si] = best;
            }
            // update
            const sums = Array.from({ length: k }, () => [0,0,0,0]);
            for (let si = 0; si < samples.length; si++) {
              const c = assignments[si];
              sums[c][0] += samples[si][0];
              sums[c][1] += samples[si][1];
              sums[c][2] += samples[si][2];
              sums[c][3] += 1;
            }
            for (let ci = 0; ci < k; ci++) {
              const cnt = Math.max(1, sums[ci][3]);
              clusters[ci] = [Math.round(sums[ci][0]/cnt), Math.round(sums[ci][1]/cnt), Math.round(sums[ci][2]/cnt)];
            }
          }
          // Sort by prominence (count)
          const counts = Array(k).fill(0);
          for (const a of assignments) counts[a]++;
          const order = counts.map((c, i) => ({i, c})).sort((a,b) => b.c - a.c).map(o => o.i);
          const palette = order.map(i => rgbToHex(clusters[i][0], clusters[i][1], clusters[i][2])).slice(0, k);
          resolve(palette);
        };
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = url;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  const handlePasteImage = async (e: ReactClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type && it.type.startsWith('image/')) {
        const blob = it.getAsFile();
        if (blob) {
          const file = new File([blob], 'pasted-image.png', { type: blob.type });
          const colors = await extractPaletteFromImage(file, 5);
          setManualColors(colors);
          applyCustomPalette(colors);
          setLogoPreview(URL.createObjectURL(blob));
        }
        break;
      }
    }
  };

  const generatePaletteFromPrompt = (prompt: string): string[] => {
    const p = prompt.toLowerCase();
    if (p.includes('modern')) return ['#0F172A', '#3B82F6', '#22D3EE', '#E2E8F0', '#FFFFFF'];
    if (p.includes('corporate') || p.includes('professional')) return ['#1F2937', '#3B82F6', '#64748B', '#E5E7EB', '#FFFFFF'];
    if (p.includes('warm')) return ['#DC2626', '#F97316', '#F59E0B', '#FDE68A', '#FFFFFF'];
    if (p.includes('tech')) return ['#0B1220', '#78DBFF', '#10B981', '#334155', '#FFFFFF'];
    // fallback: use manualColors
    return manualColors;
  };

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

      {/* Curated Examples from Supabase */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-2">Curated Examples</h3>
        <p className="text-sm text-muted-foreground mb-6">Verified 1:1 PPTX/HTML pairs stored in Supabase.</p>
        {loadingExamples ? (
          <div className="text-sm text-muted-foreground">Loading examples…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {examples.map((ex) => {
              const isSelected = slideData.selectedTheme === ex.id;
              return (
                <Card
                  key={ex.id}
                  variant={isSelected ? 'premium' : 'glass'}
                  className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}`}
                  onClick={() => updateSlideData({ selectedTheme: ex.id })}
                >
                  <SlidePreview html={ex.html} />
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">{ex.name}</h4>
                      <Badge variant="outline" className="text-xs">Curated</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{ex.description}</p>
                    {/* Palette selector */}
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground mb-2">Primary colors</div>
                      <div className="flex items-center gap-2">
                        {(curatedPalettes[ex.id] || []).map((colorHexVal) => (
                          <div key={colorHexVal} className="w-5 h-5 rounded-full border" style={{ backgroundColor: colorHexVal }} title={colorHexVal} />
                        ))}
                        <Button size="sm" variant="outline" className="ml-2" onClick={() => applyPalette(ex.id)}>
                          Use palette
                        </Button>
                        {selectedPaletteId === ex.id && (
                          <span className="text-xs text-primary ml-2">Applied</span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-1 text-primary">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-xs font-medium">Selected</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Color Palette Options */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">Color Palette</h3>
        <p className="text-sm text-muted-foreground mb-6">Pick a palette in one of three ways: upload a logo, describe a style, or pick manually.</p>

        <div className="flex flex-wrap gap-3 mb-4">
          <Button variant={paletteMode === 'logo' ? 'default' : 'outline'} size="sm" onClick={() => setPaletteMode('logo')}>From Logo</Button>
          <Button variant={paletteMode === 'ai' ? 'default' : 'outline'} size="sm" onClick={() => setPaletteMode('ai')}>AI Suggestion</Button>
          <Button variant={paletteMode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setPaletteMode('manual')}>Manual</Button>
        </div>

        {paletteMode === 'logo' && (
          <Card variant="glass" className="p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files && e.target.files[0];
                      if (!f) return;
                      const colors = await extractPaletteFromImage(f, 5);
                      setManualColors(colors);
                      applyCustomPalette(colors);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Upload a logo or paste an image (Cmd/Ctrl+V) to extract a 5‑color palette.</p>
              </div>
              {logoPreview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="logo preview" className="h-16 w-auto rounded border" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/70 text-white text-xs"
                    onClick={() => setLogoPreview(null)}
                  >
                    ×
                  </button>
                </div>
              )}
              {/* Paste target */}
              <div
                ref={pasteZoneRef}
                onPaste={handlePasteImage}
                className="ml-auto rounded border border-dashed px-3 py-2 text-xs text-muted-foreground"
                title="Click here and press Cmd/Ctrl+V to paste an image"
                contentEditable={false}
              >
                Click here and press Cmd/Ctrl+V to paste an image
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {manualColors.map((colorHexVal, idx) => (
                  <div key={`${colorHexVal}-${idx}`} className="w-6 h-6 rounded-full border" style={{ backgroundColor: colorHexVal }} title={colorHexVal} />
                ))}
              </div>
            </div>
          </Card>
        )}

        {paletteMode === 'ai' && (
          <Card variant="glass" className="p-4 space-y-3">
            <input
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              placeholder="Describe the style (e.g., modern tech with clean blue accents)"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <div className="flex items-center gap-2">
              {generatePaletteFromPrompt(aiPrompt).map((c, i) => (
                <div key={i} className="w-6 h-6 rounded-full border" style={{ backgroundColor: c }} title={c} />
              ))}
              <Button
                size="sm"
                disabled={isPaletteLoading}
                onClick={async () => {
                  setIsPaletteLoading(true);
                  try {
                    const res = await fetch('/api/color-palette/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt: aiPrompt })
                    });
                    const data = await res.json();
                    const colors: string[] = data.colors || [];
                    if (colors.length) {
                      setManualColors(colors);
                      applyCustomPalette(colors);
                    }
                  } catch {
                    // fallback to local heuristic
                    applyCustomPalette(generatePaletteFromPrompt(aiPrompt));
                  } finally {
                    setIsPaletteLoading(false);
                  }
                }}
              >
                {isPaletteLoading ? 'Generating…' : 'Generate colors'}
              </Button>
            </div>
          </Card>
        )}

        {paletteMode === 'manual' && (
          <Card variant="glass" className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {manualColors.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const next = [...manualColors];
                    next[i] = e.target.value.toUpperCase();
                    setManualColors(next);
                    applyCustomPalette(next);
                  }}
                  className="w-10 h-10 rounded border p-0"
                />
              ))}
              <Button size="sm" variant="outline" onClick={() => { const next = [...manualColors, '#FFFFFF']; setManualColors(next); applyCustomPalette(next); }}>+ Add Color</Button>
            </div>
          </Card>
        )}
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
        
<<<<<<< HEAD
        {/* Show progress when generating slide */}
        {slideData.isGenerating ? (
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {slideData.generationStatus || "Generating slide..."}
            </div>
            <div className="w-32 bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${slideData.generationProgress || 0}%` }}
              />
            </div>
          </div>
        ) : (
          <Button 
            variant="engineering" 
            size="lg" 
            onClick={onNext}
            disabled={!canProceed}
          >
            Continue to Research
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
=======
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
>>>>>>> origin/main
      </div>
    </div>
  );
}