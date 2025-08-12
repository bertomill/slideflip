"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { FileText, Calendar, MoreVertical, Sun, Moon } from "lucide-react";
import Link from "next/link";

export default function PresentationsPage() {
  const [user, setUser] = useState<{
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        window.location.href = "/auth/login";
        return;
      }
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          window.location.href = "/auth/login";
          return;
        }
        setUser(session.user);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const [items, setItems] = useState<Array<{ id: string; title: string; description: string; createdAt: string; status: string; slideHtml?: string | null }>>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: flows } = await supabase
        .from('flows')
        .select('id, description, created_at, status')
        .order('created_at', { ascending: false })
        .limit(12);

      if (!flows || flows.length === 0) { setItems([]); return; }

      // For each flow, pull the latest preview (may contain slide_html from AI or be null in seeds)
      const ids = flows.map(f => f.id);
      const { data: previews } = await supabase
        .from('flow_previews')
        .select('flow_id, slide_html, created_at')
        .in('flow_id', ids)
        .order('created_at', { ascending: false });

      const latestHtml: Record<string, string | null> = {};
      previews?.forEach(p => { if (!(p.flow_id in latestHtml)) latestHtml[p.flow_id] = p.slide_html || null; });

      setItems(flows.map(f => ({
        id: f.id,
        title: f.description || 'Untitled',
        description: f.status === 'completed' ? 'Completed flow' : 'In progress',
        createdAt: f.created_at,
        status: f.status,
        slideHtml: latestHtml[f.id] ?? null,
      })));
    };
    load();
  }, []);

  return (
    <div className="min-h-screen gradient-dark-blue flex overflow-x-hidden">
      {/* Fixed theme toggle in top right corner */}
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

      {/* Sidebar with user profile */}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main content area */}
      <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {/* Top navigation bar with branding and theme toggle */}
        <Navigation variant="premium">
          <NavigationBrand>
            <MobileMenuButton
              isOpen={mobileMenuOpen}
              onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mr-2"
            />
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
                <div className="h-3 w-3 bg-background rounded-sm"></div>
              </div>
              <span className="font-semibold text-foreground">
                Slideo
              </span>
            </Link>
          </NavigationBrand>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme toggle removed - using fixed one in top right corner */}
          </div>
        </Navigation>

        <div className="px-4 py-8">
          <div className="flex-1 w-full flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">My Presentations</h1>
                <p className="text-muted-foreground mt-2">
                  Manage and view all your presentation projects
                </p>
              </div>
              <Link href="/build">
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  New presentation
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold line-clamp-2">
                          {project.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Visual preview: if slideHtml exists, render a safe scaled iframe-like div */}
                    {project.slideHtml ? (
                      <div className="border rounded-lg overflow-hidden shadow-sm mb-3">
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <div
                            className="absolute inset-0 bg-white"
                            dangerouslySetInnerHTML={{ __html: project.slideHtml }}
                            style={{
                              transform: 'scale(0.8)',
                              transformOrigin: 'top left',
                              width: '125%',
                              height: '125%'
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mb-3">No HTML preview stored. Generate to view.</div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge
                        variant={project.status === 'completed' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first presentation project to get started
                </p>
                <Link href="/build">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Create Project
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