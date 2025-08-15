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
import { FileText, Calendar, MoreVertical, Sun, Moon, Edit2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [presentationToDelete, setPresentationToDelete] = useState<{ id: string; title: string } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [presentationToRename, setPresentationToRename] = useState<{ id: string; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');

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

  const handleEditPresentation = (presentationId: string) => {
    window.location.href = `/build?presentation_id=${presentationId}`;
  };

  const handleRenamePresentation = (presentationId: string) => {
    const presentation = items.find(item => item.id === presentationId);
    if (presentation) {
      setPresentationToRename({ id: presentation.id, title: presentation.title });
      setNewTitle(presentation.title);
      setRenameDialogOpen(true);
    }
  };

  const confirmRenamePresentation = async () => {
    if (!presentationToRename || !newTitle.trim()) return;

    try {
      // Call the API to rename the presentation
      const response = await fetch('/api/presentations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: presentationToRename.id,
          title: newTitle.trim(),
        }),
      });

      if (response.ok) {
        // Update the title in UI on successful rename
        setItems(prev => prev.map(item => 
          item.id === presentationToRename.id 
            ? { ...item, title: newTitle.trim() }
            : item
        ));
      } else {
        console.error('Failed to rename presentation');
        // Could add toast notification here
      }
    } catch (error) {
      console.error('Error renaming presentation:', error);
      // Could add toast notification here
    } finally {
      setRenameDialogOpen(false);
      setPresentationToRename(null);
      setNewTitle('');
    }
  };

  const handleDeletePresentation = (presentationId: string) => {
    const presentation = items.find(item => item.id === presentationId);
    if (presentation) {
      setPresentationToDelete({ id: presentation.id, title: presentation.title });
      setDeleteDialogOpen(true);
    }
  };

  const confirmDeletePresentation = async () => {
    if (!presentationToDelete) return;

    try {
      // Call the API to delete the presentation
      const response = await fetch(`/api/presentations?id=${presentationToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from UI on successful deletion
        setItems(prev => prev.filter(item => item.id !== presentationToDelete.id));
      } else {
        console.error('Failed to delete presentation');
        // Could add toast notification here
      }
    } catch (error) {
      console.error('Error deleting presentation:', error);
      // Could add toast notification here
    } finally {
      setDeleteDialogOpen(false);
      setPresentationToDelete(null);
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((project) => (
                <Card 
                  key={project.id} 
                  className="group hover:shadow-md transition-all duration-200 border-0 shadow-sm bg-card/50 backdrop-blur-sm cursor-pointer overflow-hidden"
                  onClick={() => handleEditPresentation(project.id)}
                >
                  {/* Preview Image at Top */}
                  {project.slideHtml ? (
                    <div className="border-b border-gray-800 bg-black">
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <div
                          className="absolute inset-0 bg-black"
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
                    <div className="border-b border-gray-800 bg-black" style={{ paddingBottom: '56.25%', position: 'relative' }}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-gray-400">No preview available</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Content Below */}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold line-clamp-2 mb-1">
                          {project.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 ml-2 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="rounded-xl border-0 bg-gray-800 shadow-2xl min-w-[140px]"
                        >
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenamePresentation(project.id);
                            }}
                            className="rounded-lg mx-1 my-0.5 px-3 py-2 text-gray-200 hover:bg-gray-700 focus:bg-gray-700"
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePresentation(project.id);
                            }}
                            className="rounded-lg mx-1 my-0.5 px-3 py-2 text-red-400 hover:bg-red-900/20 focus:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                      <Badge
                        variant={project.status === 'completed' ? 'default' : 'secondary'}
                        className="capitalize text-xs"
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-800 border-0 rounded-2xl max-w-md p-6" showCloseButton={false}>
          <DialogHeader className="text-center space-y-3">
            <DialogTitle className="text-xl font-medium text-white">
              Delete presentation?
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-sm leading-relaxed">
              "{presentationToDelete?.title}" will be permanently deleted.
              <br />
              Deletion can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1 rounded-full border-2 border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:border-gray-500"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDeletePresentation}
              className="flex-1 rounded-full bg-white text-gray-900 hover:bg-gray-100 font-medium"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Confirmation Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-gray-800 border-0 rounded-2xl max-w-md p-6" showCloseButton={false}>
          <DialogHeader className="text-center space-y-3">
            <DialogTitle className="text-xl font-medium text-white">
              Rename presentation
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-sm">
              Enter a new name for "{presentationToRename?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="my-4">
            <Input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Presentation name"
              className="w-full bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  confirmRenamePresentation();
                }
                if (e.key === 'Escape') {
                  setRenameDialogOpen(false);
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="flex-row gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setRenameDialogOpen(false)}
              className="flex-1 rounded-full border-2 border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:border-gray-500"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmRenamePresentation}
              disabled={!newTitle.trim()}
              className="flex-1 rounded-full bg-white text-gray-900 hover:bg-gray-100 font-medium disabled:bg-gray-600 disabled:text-gray-400"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}