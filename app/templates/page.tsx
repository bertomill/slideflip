"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { Layers, Sun, Moon, Plus, Edit2 } from "lucide-react";
import Link from "next/link";
import type { SlideDefinition } from "@/lib/slide-types";
import { Canvas } from "fabric";
import { createSlideCanvas, calculateOptimalScale } from "@/lib/slide-to-fabric";

// Small Fabric.js preview for a template's slide_json
function FabricThumb({ slide }: { slide: SlideDefinition }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = (width * 9) / 16; // keep 16:9
    const scale = calculateOptimalScale(width, height);
    if (!initializedRef.current) {
      const c = createSlideCanvas(canvasRef.current, slide, scale);
      setCanvas(c);
      initializedRef.current = true;
    } else if (canvas) {
      import("@/lib/slide-to-fabric").then((m) => m.renderSlideOnCanvas(canvas, slide, scale));
    }
    return () => {
      if (canvas) {
        canvas.dispose();
        setCanvas(null);
        initializedRef.current = false;
      }
    };
  }, [slide]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ paddingBottom: "56.25%" }}>
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// HTML fallback preview for legacy templates
function HtmlThumb({ html }: { html: string }) {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <div
          className="absolute inset-0 bg-white"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
        />
      </div>
    </div>
  );
}

type TemplateRow = {
  id: string;
  name: string;
  description: string;
  theme: string;
  created_at: string;
  slide_json?: SlideDefinition | null;
  html_content?: string | null;
};

export default function TemplatesPage() {
  const [user, setUser] = useState<{
    email?: string;
    user_metadata?: { avatar_url?: string; full_name?: string };
  } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { setTheme, theme } = useTheme();

  // Load authenticated user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        window.location.href = "/auth/login";
        return;
      }
      setUser(user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        window.location.href = "/auth/login";
        return;
      }
      setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const [slideoTemplates, setSlideoTemplates] = useState<TemplateRow[]>([]);

  // Load both Slideo curated templates and user templates
  useEffect(() => {
    const loadTemplates = async () => {
      const supabase = createClient();
      
      // Load user templates from database
      const { data: userTemplates } = await supabase
        .from("slide_templates")
        .select("id,name,description,theme,created_at,slide_json,html_content")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(24);
      setTemplates((userTemplates as any) || []);

      // Load Slideo curated templates from filesystem
      try {
        const response = await fetch('/api/examples/list');
        const data = await response.json();
        const slideoTemplatesFormatted = (data.examples || []).map((ex: any) => ({
          id: ex.id,
          name: ex.name,
          description: ex.description,
          theme: 'Curated',
          created_at: new Date().toISOString(), // Not applicable for file-based templates
          slide_json: ex.slide_json,
          html_content: null,
        }));
        setSlideoTemplates(slideoTemplatesFormatted);
      } catch (error) {
        console.error('Failed to load Slideo templates:', error);
        setSlideoTemplates([]);
      }
    };
    loadTemplates();
  }, []);

  return (
    <div className="min-h-screen builder-background flex overflow-x-hidden">
      {/* Fixed theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-background/90"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      {/* Sidebar */}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main content area */}
      <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? "md:ml-16" : "md:ml-64"}`}>
        {/* Minimal header with mobile menu and spacing */}
        <div className="flex justify-between items-center p-4">
          {/* Mobile menu toggle - only visible on small screens */}
          <MobileMenuButton
            isOpen={mobileMenuOpen}
            onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden"
          />
          <div className="hidden md:block" /> {/* Spacer for desktop */}
        </div>

        {/* MAIN CONTAINER: Full-width container with increased horizontal padding for better spacing */}
        <div className="w-full px-6 sm:px-8 lg:px-12 py-2 sm:py-8 min-h-screen">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Templates</h1>
              <p className="text-muted-foreground mt-2">Browse and manage your slide templates</p>
            </div>
            <div className="flex gap-2">
              <Link href="/template-editor">
                <Button variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </Link>
            </div>
          </div>

          {/* Slideo Curated Templates Section */}
          {slideoTemplates.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 bg-primary/10 rounded-sm flex items-center justify-center">
                  <div className="h-3 w-3 bg-primary rounded-sm" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Slideo Templates</h2>
                <Badge variant="secondary" className="text-xs">Curated</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {slideoTemplates.map((t) => (
                  <Card key={t.id} className="group hover:shadow-md transition-all duration-200 border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                    <div className="p-0">
                      {/* Image Preview on Top */}
                      <div className="relative overflow-hidden rounded-t-lg">
                        {t.slide_json ? (
                          <FabricThumb slide={t.slide_json as SlideDefinition} />
                        ) : (
                          <div className="relative w-full bg-muted/30 flex items-center justify-center text-muted-foreground/50" style={{ paddingBottom: "56.25%" }}>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Layers className="h-8 w-8" />
                            </div>
                          </div>
                        )}
                        {/* Actions overlay - different for Slideo templates */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <Button variant="secondary" size="sm" className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border-0 shadow-sm hover:bg-background/90" title="Customize & Save">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Content Section */}
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-1.5">
                          <h3 className="font-medium text-foreground/90 text-xs truncate flex-1">{t.name}</h3>
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0.5 border-primary/30 text-primary/80 hidden sm:inline-flex">Slideo</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-2 leading-tight mb-2">{t.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* User Templates Section */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 bg-secondary/10 rounded-sm flex items-center justify-center">
                <div className="h-3 w-3 bg-secondary rounded-sm" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">My Templates</h2>
              <Badge variant="outline" className="text-xs">{templates.length}</Badge>
            </div>
            
            {templates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {templates.map((t) => (
                  <Card key={t.id} className="group hover:shadow-md transition-all duration-200 border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                    <div className="p-0">
                      {/* Image Preview on Top */}
                      <div className="relative overflow-hidden rounded-t-lg">
                        {t.slide_json ? (
                          <FabricThumb slide={t.slide_json as SlideDefinition} />
                        ) : t.html_content ? (
                          <HtmlThumb html={t.html_content} />
                        ) : (
                          <div className="relative w-full bg-muted/30 flex items-center justify-center text-muted-foreground/50" style={{ paddingBottom: "56.25%" }}>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Layers className="h-8 w-8" />
                            </div>
                          </div>
                        )}
                        {/* Edit button overlay */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/template-editor?id=${t.id}`}>
                            <Button variant="secondary" size="sm" className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border-0 shadow-sm hover:bg-background/90">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                      
                      {/* Content Section */}
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-1.5">
                          <h3 className="font-medium text-foreground/90 text-xs truncate flex-1">{t.name}</h3>
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0.5 border-muted-foreground/20 text-muted-foreground/70 hidden sm:inline-flex">{t.theme}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-1 leading-tight mb-2">{t.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(t.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted-foreground/20 rounded-lg">
                <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No custom templates yet</h3>
                <p className="text-muted-foreground mb-4">Create your own templates or customize Slideo templates.</p>
                <Link href="/template-editor">
                  <Button variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


