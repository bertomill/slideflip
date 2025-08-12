"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { Layers, Sun, Moon } from "lucide-react";
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

  // Load templates from Supabase
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("slide_templates")
        .select("id,name,description,theme,created_at,slide_json,html_content")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(24);
      setTemplates((data as any) || []);
    };
    load();
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

      {/* Main */}
      <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? "md:ml-16" : "md:ml-64"}`}>
        <Navigation variant="premium">
          <NavigationBrand>
            <MobileMenuButton isOpen={mobileMenuOpen} onToggle={() => setMobileMenuOpen(!mobileMenuOpen)} className="mr-2" />
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
                <div className="h-3 w-3 bg-background rounded-sm" />
              </div>
              <span className="font-semibold text-foreground">Slideo</span>
            </Link>
          </NavigationBrand>
          <div className="flex items-center gap-2 sm:gap-4" />
        </Navigation>

        <div className="px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Templates</h1>
              <p className="text-muted-foreground mt-2">Browse and manage your slide templates</p>
            </div>
            <Link href="/test-fabric">
              <Button variant="outline">
                <Layers className="h-4 w-4 mr-2" />
                Open Template Tester
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {templates.map((t) => (
              <Card key={t.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold truncate">{t.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    </div>
                    <Badge variant="secondary" className="ml-2">{t.theme}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {t.slide_json ? (
                    <FabricThumb slide={t.slide_json as SlideDefinition} />
                  ) : t.html_content ? (
                    <HtmlThumb html={t.html_content} />
                  ) : (
                    <div className="text-xs text-muted-foreground mb-3">No preview available</div>
                  )}
                  <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    <span>{t.slide_json ? "Fabric" : t.html_content ? "HTML" : "Empty"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No templates yet</h3>
              <p className="text-muted-foreground">Use the Template Tester or Upsert endpoint to add templates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


