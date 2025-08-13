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
  const [isCreating, setIsCreating] = useState(false);

  const loadPresentations = async () => {
    try {
      const response = await fetch('/api/presentations');
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      } else {
        console.error('Failed to load presentations');
      }
    } catch (error) {
      console.error('Error loading presentations:', error);
    }
  };

  const handleCreatePresentation = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/presentations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Presentation',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newPresentation = data.presentation;
        
        // Add the new presentation to the list
        setItems(prev => [{
          id: newPresentation.id,
          title: newPresentation.title,
          description: 'New presentation',
          createdAt: newPresentation.created_at,
          status: newPresentation.status,
          slideHtml: null,
        }, ...prev]);
        
        // Navigate to build page with the presentation ID
        window.location.href = `/build?presentation_id=${newPresentation.id}`;
      } else {
        console.error('Failed to create presentation');
      }
    } catch (error) {
      console.error('Error creating presentation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    loadPresentations();
  }, []);

  return (
    <div className="min-h-screen builder-background flex overflow-x-hidden">
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
          <div className="flex-1 w-full flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">My Presentations</h1>
                <p className="text-muted-foreground mt-2">
                  Manage and view all your presentation projects
                </p>
              </div>
              <Button onClick={handleCreatePresentation} disabled={isCreating}>
                <FileText className="h-4 w-4 mr-2" />
                {isCreating ? 'Creating...' : 'New presentation'}
              </Button>
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
                <Button onClick={handleCreatePresentation} disabled={isCreating}>
                  <FileText className="h-4 w-4 mr-2" />
                  {isCreating ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}