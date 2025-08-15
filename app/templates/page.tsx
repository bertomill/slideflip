"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { Layers, Sun, Moon, Plus, Edit2, Upload, FileText, MoreVertical, Trash2, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SlideDefinition } from "@/lib/slide-types";
import { Canvas } from "fabric";
import { createSlideCanvas, calculateOptimalScale } from "@/lib/slide-to-fabric";
import { useUploadProgress } from "@/contexts/upload-progress-context";

/**
 * Small Fabric.js preview component for rendering a template's slide_json
 * Uses Fabric.js to create an accurate visual representation of slide content
 */
function FabricThumb({ slide }: { slide: SlideDefinition }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    
    // Clean up any existing canvas first
    if (canvas) {
      canvas.dispose();
      setCanvas(null);
      initializedRef.current = false;
    }
    
    const width = containerRef.current.clientWidth;
    const height = (width * 9) / 16; // Maintain 16:9 aspect ratio for slide consistency
    const scale = calculateOptimalScale(width, height);
    
    // Create new canvas
    let c: Canvas | null = null;
    try {
      c = createSlideCanvas(canvasRef.current, slide, scale);
      setCanvas(c);
      initializedRef.current = true;
    } catch (error) {
      console.error('Error creating canvas:', error);
    }
    
    return () => {
      if (c) {
        c.dispose();
      }
      setCanvas(null);
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ paddingBottom: "56.25%" }}>
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

/**
 * HTML fallback preview for legacy templates that use HTML content
 * Scales down content to fit thumbnail view with proper aspect ratio
 */
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

// Template database row structure
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

  // Authentication state management - redirect to login if not authenticated
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

  // State for user-created templates from database
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  // State for Slideo curated templates from filesystem
  const [slideoTemplates, setSlideoTemplates] = useState<TemplateRow[]>([]);
  
  // PPTX upload functionality state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use global upload progress context
  const { showUploadProgress, hideUploadProgress, updateUploadStep } = useUploadProgress();
  
  // Template deletion state
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  
  // Success notification state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Section collapse state
  const [slideoTemplatesCollapsed, setSlideoTemplatesCollapsed] = useState(false);
  const [myTemplatesCollapsed, setMyTemplatesCollapsed] = useState(false);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    templateId: string;
    templateName: string;
  }>({
    open: false,
    templateId: "",
    templateName: ""
  });

  // Load both Slideo curated templates and user templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      const supabase = createClient();
      
      // Get current user first
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Load user templates from database (only if user is authenticated)
      if (currentUser) {
        const { data: userTemplates } = await supabase
          .from("slide_templates")
          .select("id,name,description,theme,created_at,slide_json,html_content")
          .eq("is_active", true)
          .eq("user_id", currentUser.id) // Only fetch current user's templates
          .order("created_at", { ascending: false })
          .limit(24);
        setTemplates((userTemplates as TemplateRow[]) || []);
      } else {
        setTemplates([]); // No templates if not authenticated
      }

      // Load Slideo curated templates from filesystem via API
      try {
        const response = await fetch('/api/examples/list');
        const data = await response.json();
        const slideoTemplatesFormatted = (data.examples || []).map((ex: { id: string; name: string; description: string; slide_json: SlideDefinition }) => ({
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

  /**
   * Handle PPTX file upload and conversion to slide template
   * Converts PPTX to slide_json format and saves as new template
   */
  const handlePptxUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setUploadError('Please select a PowerPoint (.pptx) file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    
    // Open progress shelf
    showUploadProgress(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Step 1: Upload and convert
      updateUploadStep('upload');
      
      const response = await fetch('/api/convert-pptx-to-png', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      // Step 2: Analyzing content
      updateUploadStep('convert');
      await new Promise(resolve => setTimeout(resolve, 800)); // Brief pause for visual feedback
      
      const result = await response.json();
      
      if (result.success && result.slideJson) {
        // Step 3: Processing design
        updateUploadStep('process');
        await new Promise(resolve => setTimeout(resolve, 600)); // Brief pause for visual feedback
        
        // Create a new template from the uploaded PPTX
        const baseTemplateName = file.name.replace('.pptx', '');
        const supabase = createClient();
        
        // Get current user for user_id
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          throw new Error('You must be logged in to create templates');
        }
        
        // Generate a unique template name by checking for existing names
        let templateName = baseTemplateName;
        let counter = 1;
        
        // Keep checking and incrementing until we find a unique name
        while (true) {
          const { data: existingTemplate } = await supabase
            .from('slide_templates')
            .select('id')
            .eq('name', templateName)
            .eq('user_id', currentUser.id) // Check within user's templates only
            .single();
            
          if (!existingTemplate) {
            // Name is unique, we can use it
            break;
          }
          
          // Name exists, try with a counter
          templateName = `${baseTemplateName} (${counter})`;
          counter++;
        }
        
        // Step 4: Saving to database
        updateUploadStep('save');
        
        // Prepare template data with user association
        const templateData = {
          name: templateName,
          description: `Imported from ${file.name}`,
          theme: 'Imported',
          html_content: '', // Required field, empty since we're using slide_json
          slide_json: result.slideJson,
          is_active: true,
          user_id: currentUser.id, // Associate template with current user
        };

        const { error } = await supabase
          .from('slide_templates')
          .insert(templateData)
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          throw new Error(`Failed to save template: ${error.message}`);
        }

        // Refresh templates list to show the new template
        const { data: userTemplates } = await supabase
          .from("slide_templates")
          .select("id,name,description,theme,created_at,slide_json,html_content")
          .eq("is_active", true)
          .eq("user_id", currentUser.id) // Only fetch user's templates
          .order("created_at", { ascending: false })
          .limit(24);
        setTemplates((userTemplates as TemplateRow[]) || []);
        
        // Show success notification
        setSuccessMessage(`Successfully imported "${templateName}" as a template!`);
        
        // Keep progress shelf open briefly to show completion
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Close progress shelf
        hideUploadProgress();
        
        // Auto-hide success message after 4 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 4000);
      } else {
        throw new Error(result.error || 'Failed to convert PPTX');
      }
    } catch (error) {
      console.error('PPTX upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      
      // Show error in progress shelf
      updateUploadStep('upload', errorMessage);
      
      // Close progress shelf after delay
      setTimeout(() => {
        hideUploadProgress();
      }, 3000);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle template deletion confirmation
  const handleDeleteTemplate = (templateId: string, templateName: string) => {
    setConfirmDialog({
      open: true,
      templateId,
      templateName
    });
  };

  // Perform actual deletion
  const performDeleteTemplate = async () => {
    const { templateId, templateName } = confirmDialog;
    setDeletingTemplateId(templateId);

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      // Refresh templates list by removing the deleted template
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      
      // Show success notification
      setSuccessMessage(`Template "${templateName}" has been deleted successfully.`);
      
      // Auto-hide success message after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (error) {
      console.error('Delete template error:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete template');
    } finally {
      setDeletingTemplateId(null);
      setConfirmDialog({ open: false, templateId: "", templateName: "" });
    }
  };

  return (
    <div className="min-h-screen builder-background flex overflow-x-hidden">
      {/* Fixed theme toggle button - positioned in top-right corner */}
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

      {/* Collapsible sidebar navigation */}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main content area - adjusts based on sidebar state */}
      <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? "md:ml-16" : "md:ml-64"}`}>
        {/* Minimal header with mobile menu toggle */}
        <div className="flex justify-between items-center p-4">
          {/* Mobile menu toggle - only visible on small screens */}
          <MobileMenuButton
            isOpen={mobileMenuOpen}
            onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden"
          />
          <div className="hidden md:block" /> {/* Spacer for desktop layout */}
        </div>

        {/* MAIN CONTAINER: Full-width container with responsive padding */}
        <div className="w-full px-6 sm:px-8 lg:px-12 py-2 sm:py-8 min-h-screen">
          {/* Page header with title and action buttons */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Templates</h1>
              <p className="text-muted-foreground mt-2">Browse and manage your slide templates</p>
            </div>
            <div className="flex gap-2">
              {/* Primary action: Create new template */}
              <Link href="/template-editor">
                <Button variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </Link>
              
              {/* Secondary action: Import PPTX file */}
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pptx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePptxUpload(file);
                      // Reset input so same file can be selected again
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button 
                  variant="outline" 
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import PPTX
                </Button>
              </>
            </div>
          </div>

          {/* Success notification for operations */}
          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="h-2 w-2 bg-white rounded-full" />
                </div>
                <span className="text-green-700 dark:text-green-400 text-sm font-medium">{successMessage}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSuccessMessage(null)}
                  className="ml-auto text-green-500 hover:text-green-700"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}

          {/* Error display for upload failures */}
          {uploadError && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-500" />
                <span className="text-red-700 dark:text-red-400 text-sm">{uploadError}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setUploadError(null)}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}

          {/* Slideo Curated Templates Section - Only shown if templates exist */}
          {slideoTemplates.length > 0 && (
            <div className="mt-8">
              <div 
                className="flex items-center gap-2 mb-4 group/header cursor-pointer"
                onClick={() => setSlideoTemplatesCollapsed(!slideoTemplatesCollapsed)}
              >
                {/* Collapsible triangle - shows on hover */}
                <div className="opacity-0 group-hover/header:opacity-100 transition-opacity duration-200">
                  <ChevronRight 
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      slideoTemplatesCollapsed ? 'transform rotate-0' : 'transform rotate-90'
                    }`} 
                  />
                </div>
                {/* Visual icon to distinguish section */}
                <div className="h-6 w-6 bg-primary/10 rounded-sm flex items-center justify-center">
                  <div className="h-3 w-3 bg-primary rounded-sm" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Slideo Templates</h2>
                <Badge variant="secondary" className="text-xs">Curated</Badge>
              </div>
              {/* Responsive grid layout for template cards - collapsible */}
              {!slideoTemplatesCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in slide-in-from-top-2 duration-300">
                  {slideoTemplates.map((t) => (
                  <Card key={t.id} className="group hover:shadow-md transition-all duration-200 border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                    <div className="p-0">
                      {/* Template preview thumbnail */}
                      <div className="relative overflow-hidden rounded-t-lg">
                        {t.slide_json ? (
                          <FabricThumb slide={t.slide_json as SlideDefinition} />
                        ) : (
                          /* Fallback for templates without slide_json */
                          <div className="relative w-full bg-muted/30 flex items-center justify-center text-muted-foreground/50" style={{ paddingBottom: "56.25%" }}>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Layers className="h-8 w-8" />
                            </div>
                          </div>
                        )}
                        {/* Hover overlay with actions - different for Slideo templates */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <Button variant="secondary" size="sm" className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border-0 shadow-sm hover:bg-background/90" title="Customize & Save">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Template metadata */}
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
              )}
            </div>
          )}

          {/* User Templates Section */}
          <div className="mt-8">
            <div 
              className="flex items-center gap-2 mb-4 group/header cursor-pointer"
              onClick={() => setMyTemplatesCollapsed(!myTemplatesCollapsed)}
            >
              {/* Collapsible triangle - shows on hover */}
              <div className="opacity-0 group-hover/header:opacity-100 transition-opacity duration-200">
                <ChevronRight 
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    myTemplatesCollapsed ? 'transform rotate-0' : 'transform rotate-90'
                  }`} 
                />
              </div>
              {/* Visual icon to distinguish from curated templates */}
              <div className="h-6 w-6 bg-secondary/10 rounded-sm flex items-center justify-center">
                <div className="h-3 w-3 bg-secondary rounded-sm" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">My Templates</h2>
              <Badge variant="outline" className="text-xs">{templates.length}</Badge>
            </div>
            
            {!myTemplatesCollapsed && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                {templates.length > 0 ? (
                  /* Grid of user templates */
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {templates.map((t) => (
                  <Card key={t.id} className="group hover:shadow-md transition-all duration-200 border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                    <div className="p-0">
                      {/* Template preview with multiple format support */}
                      <div className="relative overflow-hidden rounded-t-lg">
                        {t.slide_json ? (
                          <FabricThumb slide={t.slide_json as SlideDefinition} />
                        ) : t.html_content ? (
                          <HtmlThumb html={t.html_content} />
                        ) : (
                          /* Fallback for templates without preview content */
                          <div className="relative w-full bg-muted/30 flex items-center justify-center text-muted-foreground/50" style={{ paddingBottom: "56.25%" }}>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Layers className="h-8 w-8" />
                            </div>
                          </div>
                        )}
                        {/* Three-dot action menu - appears on hover */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border-0 shadow-sm hover:bg-background/90"
                                disabled={deletingTemplateId === t.id}
                              >
                                {deletingTemplateId === t.id ? (
                                  <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                                ) : (
                                  <MoreVertical className="h-3 w-3" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/template-editor?id=${t.id}`} className="flex items-center gap-2 cursor-pointer">
                                  <Edit2 className="h-4 w-4" />
                                  Edit Template
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteTemplate(t.id, t.name)}
                                className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                disabled={deletingTemplateId === t.id}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Template
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      {/* Template information card */}
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
              /* Empty state when no user templates exist */
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
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Template Deletion */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title="Delete Template"
        description={`Are you sure you want to delete "${confirmDialog.templateName}"? This action cannot be undone.`}
        onConfirm={performDeleteTemplate}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

    </div>
  );
}
