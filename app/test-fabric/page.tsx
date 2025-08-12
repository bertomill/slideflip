"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SlideDefinition } from "@/lib/slide-types";
import { Canvas } from "fabric";
import { createSlideCanvas, calculateOptimalScale } from "@/lib/slide-to-fabric";

type Example = {
  id: string;
  name: string;
  description: string;
  aspect_ratio: string;
  html?: string;
  slide_json?: SlideDefinition | null;
};

function JsonPreview({ slide }: { slide: SlideDefinition }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 360;
    const s = calculateOptimalScale(width, height);
    if (!initializedRef.current) {
      const c = createSlideCanvas(canvasRef.current, slide, s);
      setCanvas(c);
      initializedRef.current = true;
    } else if (canvas) {
      import("@/lib/slide-to-fabric").then((m) => m.renderSlideOnCanvas(canvas, slide, s));
    }
    return () => {
      // Dispose on unmount to avoid "already initialized" errors in dev/StrictMode
      if (canvas) {
        canvas.dispose();
        setCanvas(null);
        initializedRef.current = false;
      }
    };
  }, [slide]);
  return (
    <div ref={containerRef} className="relative w-full aspect-[16/9] bg-white rounded-md">
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function HtmlPreview({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const width = ref.current.clientWidth;
      setScale(width / 960);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return (
    <div ref={ref} className="relative w-full aspect-[16/9] bg-white rounded-md">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: 960, height: 540, transform: `scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export default function TestFabricTemplates() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [active, setActive] = useState<number>(0);
  const current = examples[active];

  const load = async () => {
    const res = await fetch("/api/examples/list", { cache: "no-store" });
    const data = await res.json();
    setExamples(data.examples || []);
    setActive(0);
    console.log("examples:", data.examples);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fabric Template Test</h1>
        <Button onClick={load} variant="outline">Reload</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {examples.map((ex, idx) => (
                <button
                  key={ex.id}
                  className={`w-full text-left px-3 py-2 rounded border transition ${idx === active ? "bg-accent" : "hover:bg-muted"}`}
                  onClick={() => setActive(idx)}
                >
                  <div className="text-sm font-medium">{ex.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{ex.description}</div>
                </button>
              ))}
              {examples.length === 0 && (
                <div className="text-sm text-muted-foreground">No templates returned from API.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {current ? (
              current.slide_json ? (
                <JsonPreview slide={current.slide_json} />
              ) : current.html ? (
                <HtmlPreview html={current.html} />
              ) : (
                <div className="text-sm text-muted-foreground">Template has neither slide_json nor html.</div>
              )
            ) : (
              <div className="text-sm text-muted-foreground">Select a template.</div>
            )}

            {current?.slide_json && (
              <pre className="bg-gray-100 rounded p-3 text-xs overflow-auto max-h-80">{JSON.stringify(current.slide_json, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


