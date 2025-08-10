"use client";

// React hooks for state management and lifecycle
import { useState, useEffect } from "react";
// UI components for layout and interaction
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { SlideoLogo } from "@/components/slideo-logo";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { Input } from "@/components/ui/input";
// Supabase client for authentication
import { createClient } from "@/lib/supabase/client";
// Lucide icons for UI elements
import { Plus, Eye, ChevronRight, Sparkles, Zap, Star, ArrowRight, Play, FileText, Sun, Moon } from "lucide-react";
// Next.js Link component for navigation
import Link from "next/link";

// Mock data for presentation templates
const presentationTemplates = [
  {
    id: 'create-new',
    title: 'Create New',
    description: 'Start from scratch',
    type: 'create',
    image: null
  },
  {
    id: 'pitch-deck',
    title: 'Pitch Deck',
    description: 'Perfect for startups and funding',
    type: 'template',
    image: '/api/placeholder/300/200'
  },
  {
    id: 'business-plan',
    title: 'Business Plan',
    description: 'Comprehensive business overview',
    type: 'template',
    image: '/api/placeholder/300/200'
  },
  {
    id: 'quarterly-review',
    title: 'Quarterly Review',
    description: 'Performance and metrics report',
    type: 'template',
    image: '/api/placeholder/300/200'
  },
  {
    id: 'product-launch',
    title: 'Product Launch',
    description: 'Introduce your new product',
    type: 'template',
    image: '/api/placeholder/300/200'
  },
  {
    id: 'sales-deck',
    title: 'Sales Deck',
    description: 'Convert prospects to customers',
    type: 'template',
    image: '/api/placeholder/300/200'
  }
];

// Demo slides pulled from public/samples/slides
const slideExamples = [
  { id: 1, title: "Uber Problem", image: "/samples/slides/uber_slide_1.png" },
  { id: 2, title: "DoorDash Performance", image: "/samples/slides/doordash_slide_1.png" },
  { id: 3, title: "Facebook Platform", image: "/samples/slides/facebook_slide_1.png" },
  { id: 4, title: "YouTube Purpose", image: "/samples/slides/youtube_side_1.png" },
  { id: 5, title: "JPM Financial Highlights", image: "/samples/slides/jpm_slide_1.png" },
  { id: 6, title: "RBC Client Assets", image: "/samples/slides/rbc_slide_1.png" },
  { id: 7, title: "BMO Performance", image: "/samples/slides/bmo_slide_1.png" },
  { id: 8, title: "P&G FY 2025", image: "/samples/slides/pg_slide_1.png" },
  { id: 9, title: "Research Concrete", image: "/samples/slides/research-concrete.png" },
  { id: 10, title: "Research Grey", image: "/samples/slides/research-grey.png" },
  { id: 11, title: "Example Black", image: "/samples/slides/example-black.png" },
  { id: 12, title: "Cat Slide", image: "/samples/slides/cat_slide_1.png" },
];

// Example prompts for quick-start
const examplePrompts: string[] = [
  "Executive summary for quarterly results with KPIs",
  "Product launch overview with three key features and benefits",
  "Market analysis: TAM/SAM/SOM with a simple chart",
  "Team presentation: introduce 5 team members with roles",
  "Sales report: pipeline by stage and next steps",
  "Strategy plan: 3 objectives, 5 initiatives, 90‑day roadmap",
  "Investor deck: problem, solution, traction, ask",
  "Project update: timeline, risks, and blockers",
  "Brand guide: typography, colors, and tone of voice",
  "Case study: client challenge, solution, results"
];

/**
 * Home Page Component - Main landing page and authenticated dashboard
 * 
 * This component serves dual purposes:
 * 1. Landing page for unauthenticated users with marketing content and sign-up flow
 * 2. Dashboard for authenticated users with presentation gallery and creation tools
 * 
 * Features:
 * - Authentication state management with Supabase
 * - Responsive sidebar navigation for authenticated users
 * - Sample slide gallery showcasing different presentation styles
 * - Theme switching between light and dark modes
 * - Mobile-responsive design with collapsible navigation
 */
export default function Home() {
  // Authentication state - stores current user information from Supabase
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: { full_name?: string } } | null>(null);

  // UI state management for responsive navigation
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop sidebar collapse state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);     // Mobile menu visibility state

  // Landing page interactive elements
  const [promptText, setPromptText] = useState(""); // User input for demo prompt functionality

  // Theme management hook from next-themes
  const { setTheme, theme } = useTheme();

  // Authentication lifecycle management
  // Sets up Supabase auth listener and loads initial user state
  useEffect(() => {
    const supabase = createClient();

    // Load initial user session on component mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for authentication state changes (login/logout/session refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Cleanup subscription on component unmount
    return () => subscription.unsubscribe();
  }, []);

  // If user is authenticated, show dashboard
  // AUTHENTICATED USER DASHBOARD: Show full dashboard interface for logged-in users
  if (user) {
    return (
      <div className="min-h-screen gradient-dark-blue flex overflow-x-hidden">
        {/* THEME TOGGLE: Fixed position theme switcher in top-right corner */}
        {/* Positioned above all other content with high z-index for easy access */}
        <div className="fixed top-4 right-4 z-50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-background/90"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {/* ICON ANIMATION: Sun and moon icons with smooth transitions between light/dark modes */}
            {/* Sun icon: visible in light mode, hidden in dark mode with rotation animation */}
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            {/* Moon icon: hidden in light mode, visible in dark mode with rotation animation */}
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            {/* ACCESSIBILITY: Screen reader text for theme toggle functionality */}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
        
        {/* Collapsible sidebar with user profile and navigation */}
        <Sidebar
          user={user}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          isOpen={mobileMenuOpen}
          onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Main content area that adjusts based on sidebar state */}
        <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
          {/* Top navigation bar with branding */}
          <Navigation variant="premium">
            <NavigationBrand>
              {/* Mobile menu toggle button - only visible on small screens */}
              <MobileMenuButton
                isOpen={mobileMenuOpen}
                onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="mr-2"
              />
              {/* App logo and brand name */}
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <SlideoLogo className="h-6 w-6" />
                <span className="font-semibold text-foreground text-sm sm:text-base">
                  Slideo
                </span>
              </Link>
            </NavigationBrand>
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Theme toggle removed - using fixed one in top right corner */}
            </div>
          </Navigation>

          {/* Main dashboard content with responsive padding */}
          <div className="py-4 px-2 sm:py-8 sm:px-8 overflow-x-hidden">
            <div>
              {/* Welcome Header - personalized greeting for authenticated users */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Welcome! 👋
                </h1>
                    <p className="text-muted-foreground">
                      This is your Slideo dashboard. Explore tools to build your presentations & create stunning slides.
                </p>
              </div>

              {/* Presentations Section - horizontal scrollable gallery of templates and user presentations */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Presentations</h2>
                    <p className="text-muted-foreground">
                      Create, edit, share & track the progress of your presentation decks.
                    </p>
                  </div>
                  <Button variant="ghost" className="text-primary hover:text-primary/80">
                    View More
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                {/* Horizontal Scrollable Gallery */}
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-4 min-w-max">
                    {presentationTemplates.map((template) => (
                      <div key={template.id} className="flex-shrink-0 w-64">
                        {template.type === 'create' ? (
                          /* Create New Card */
                          <Link href={user ? "/build" : "/auth/sign-up"}>
                            <Card className="h-48 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all cursor-pointer group">
                              <CardContent className="flex flex-col items-center justify-center h-full p-6">
                                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                  <Plus className="h-6 w-6 text-primary-foreground" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-2">{template.title}</h3>
                                <p className="text-sm text-muted-foreground text-center">{template.description}</p>
                              </CardContent>
                            </Card>
                          </Link>
                        ) : (
                          /* Template Preview Card */
                          <Card className="h-48 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                            <div className="h-32 bg-gradient-to-br from-muted to-muted/80 relative overflow-hidden">
                              {/* Placeholder for template preview */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-20 h-16 bg-foreground/10 rounded border border-foreground/20 flex items-center justify-center">
                                  <div className="text-xs text-muted-foreground">Preview</div>
                                </div>
                              </div>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold text-foreground text-sm mb-1">{template.title}</h3>
                              <p className="text-xs text-muted-foreground">{template.description}</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pitch Decks */}
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
                    Pitch Decks
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Uber Slide - First Card */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full relative">
                        <img
                          src="/samples/slides/uber_slide_1.png"
                          alt="Uber Problem Slide"
                          className="w-full h-full object-contain bg-gray-100 dark:bg-gray-800"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                        <div className="absolute bottom-2 left-2">
                          <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1">
                            <div className="text-xs font-medium text-foreground">Uber Problem</div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* DoorDash Slide - Second Card */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full relative">
                        <img
                          src="/samples/slides/doordash_slide_1.png"
                          alt="DoorDash Delivery Time Slide"
                          className="w-full h-full object-contain bg-gray-100 dark:bg-gray-800"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                        <div className="absolute bottom-2 left-2">
                          <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1">
                            <div className="text-xs font-medium text-foreground">DoorDash Performance</div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* Facebook Slide - Third Card */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full relative">
                        <img
                          src="/samples/slides/facebook_slide_1.png"
                          alt="Facebook Platform Introduction Slide"
                          className="w-full h-full object-contain bg-gray-100 dark:bg-gray-800"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                        <div className="absolute bottom-2 left-2">
                          <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1">
                            <div className="text-xs font-medium text-foreground">Facebook Platform</div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* YouTube Slide - Fourth Card */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full relative">
                        <img
                          src="/samples/slides/youtube_side_1.png"
                          alt="YouTube Company Purpose Slide"
                          className="w-full h-full object-contain bg-gray-100 dark:bg-gray-800"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                        <div className="absolute bottom-2 left-2">
                          <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1">
                            <div className="text-xs font-medium text-foreground">YouTube Purpose</div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Corporate */}
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
                    Corporate
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* JPMorgan Chase Financial Highlights */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full bg-gray-100 dark:bg-gray-800 relative">
                        <img
                          src="/samples/slides/jpm_slide_1.png"
                          alt="JPMorgan Chase Financial Highlights"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* RBC Client Assets and Activity */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full bg-gray-100 dark:bg-gray-800 relative">
                        <img
                          src="/samples/slides/rbc_slide_1.png"
                          alt="RBC Client Assets and Activity"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* BMO Performance Metrics */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full bg-gray-100 dark:bg-gray-800 relative">
                        <img
                          src="/samples/slides/bmo_slide_1.png"
                          alt="BMO Performance Metrics"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* P&G FY 2025 Results */}
                    <Card className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="h-full bg-gray-100 dark:bg-gray-800 relative">
                        <img
                          src="/samples/slides/pg_slide_1.png"
                          alt="P&G FY 2025 Results"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Landing page for unauthenticated users
  return (
    <div className="min-h-screen gradient-dark-blue">
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
      
      {/* Navigation bar with logo and authentication buttons */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto border-b border-border/50">
        {/* Logo and brand name */}
        <div className="flex items-center gap-2">
          <SlideoLogo className="h-8 w-8" />
          <span className="text-xl font-bold text-foreground">Slideo</span>
        </div>

        {/* Authentication buttons */}
        <div className="flex items-center gap-4">
          <Link href="/auth/login">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
          </Link>
          <Link href="/">
            <Button
              className="text-white shadow-lg transition-colors rounded-full px-6 bg-gradient-to-r from-[hsl(var(--old-lavender-light))] to-[hsl(var(--old-lavender))] hover:from-[hsl(var(--old-lavender))] hover:to-[hsl(var(--old-lavender))]"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6">
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center gap-12 py-20">
          {/* Left Side - Content */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-200 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                The AI presentation maker for the workplace
              </span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight animate-in fade-in slide-in-from-bottom-2 duration-700">
              It&apos;s{" "}
              <span className="bg-gradient-to-r from-zinc-200 to-zinc-400 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
                stunning
              </span>{" "}
              what you can do with a little{" "}
              <span className="bg-gradient-to-r from-zinc-200 to-zinc-400 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">AI.</span>
            </h1>

            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0">
              Create professional presentations in minutes, not hours. Let AI transform your ideas into stunning slides that captivate your audience.
            </p>

            {/* CTA Section */}
            <div className="mb-8">
              <Link href="/build">
                <Button
                  size="lg"
                  className="shadow-xl text-lg px-8 py-6 rounded-full text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 bg-gradient-to-r from-[hsl(var(--old-lavender-light))] to-[hsl(var(--old-lavender))] hover:from-[hsl(var(--old-lavender))] hover:to-[hsl(var(--old-lavender))] border-0 font-medium"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Creating Now
                </Button>
              </Link>
            </div>

            {/* Prompt Input Demo */}
            <div className="max-w-2xl mx-auto lg:mx-0">
              <div className="flex gap-3 items-center">
                <Input
                  placeholder="Try a prompt to create your own slide..."
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="flex-1 py-4 text-lg rounded-xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-500 bg-white/50 dark:bg-zinc-900/40 backdrop-blur-sm"
                  style={{ fontStyle: promptText ? 'normal' : 'italic' }}
                />
                <Button
                  className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-xl px-6 h-[60px] text-lg"
                  onClick={() => window.location.href = '/auth/sign-up'}
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </div>

              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto px-0 py-0 text-sm font-normal flex items-center gap-1 hover:text-foreground">
                      <Zap className="h-4 w-4" />
                      Try an example
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[340px]">
                    {examplePrompts.map((p, i) => (
                      <DropdownMenuItem key={i} className="whitespace-normal text-sm leading-snug"
                        onClick={() => setPromptText(p)}
                      >
                        {p}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span>•</span>
                <span>A quote by Albert Einstein about the universe</span>
              </div>
            </div>
          </div>

          {/* Right Side - Slide Grid */}
          <div className="flex-1 max-w-2xl">
            <div className="grid grid-cols-3 gap-3 transform rotate-3 hover:rotate-0 transition-transform duration-700">
              {slideExamples.map((slide, index) => (
                <Card
                  key={slide.id}
                  className={`aspect-[16/9] overflow-hidden hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl ${index % 4 === 0 ? 'transform -rotate-2' :
                    index % 4 === 1 ? 'transform rotate-1' :
                      index % 4 === 2 ? 'transform -rotate-1' : 'transform rotate-2'
                    } animate-in fade-in slide-in-from-bottom-4 duration-500`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="h-full relative group bg-background/40 dark:bg-zinc-900/40">
                    <img src={slide.image} alt={slide.title} className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Features Section (stacked preview like Umbrel) */}
        <div className="relative py-28">
          {/* Ambient gradient background accents */}
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 40% at 15% 10%, hsl(var(--plantation)/0.25) 0%, transparent 60%), radial-gradient(50% 35% at 85% 20%, hsl(var(--old-lavender)/0.25) 0%, transparent 60%)",
            }}
          />

          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-foreground">Why choose Slideo?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Powerful AI meets intuitive design to transform how you create presentations
            </p>
          </div>

          {/* Stacked preview: three floating cards with parallax-like offsets */}
          <div className="relative max-w-5xl mx-auto mt-8">
            <div className="relative h-[420px]">
              {/* back-left */}
              <div className="absolute -left-10 top-10 w-[46%] h-[320px] rounded-2xl bg-gradient-to-br from-[hsl(var(--charade))] to-[hsl(var(--baltic-sea))] shadow-2xl border border-border/40 rotate-[-4deg] opacity-95 overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative p-6">
                  <div className="text-sm text-foreground/70 mb-2">Creation</div>
                  <div className="text-xl font-semibold mb-2 text-foreground">AI-Powered Creation</div>
                  <p className="text-sm text-foreground/80">Transform ideas into slides instantly with contextual layouts.</p>
                </div>
                <div className="absolute bottom-0 right-0 w-40 h-40 rounded-tl-3xl"
                     style={{ background: "linear-gradient(135deg, hsl(var(--old-lavender-light)), transparent)" }}></div>
              </div>

              {/* front-center */}
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[56%] h-[360px] rounded-2xl bg-gradient-to-br from-[hsl(var(--plantation))] to-[hsl(var(--charade))] shadow-[0_20px_60px_rgba(0,0,0,0.45)] border border-border/50 rotate-[1deg] overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-black/25" />
                <div className="relative p-6">
                  <div className="text-sm text-foreground/70 mb-2">Enterprise</div>
                  <div className="text-xl font-semibold mb-2 text-foreground">Enterprise Ready</div>
                  <p className="text-sm text-foreground/80">SSO, RBAC, and audit logs tailored for teams.</p>
                </div>
                <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full blur-2xl"
                     style={{ background: "radial-gradient(closest-side, hsl(var(--old-lavender-light)), transparent)" }} />
              </div>

              {/* back-right */}
              <div className="absolute -right-10 top-16 w-[46%] h-[320px] rounded-2xl bg-gradient-to-br from-[hsl(var(--pale-sky))] to-[hsl(var(--manatee))] shadow-2xl border border-border/40 rotate-[5deg] opacity-95 overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative p-6">
                  <div className="text-sm text-foreground/70 mb-2">Insights</div>
                  <div className="text-xl font-semibold mb-2 text-foreground">Smart Analytics</div>
                  <p className="text-sm text-foreground/80">Engagement metrics and exportable reports built-in.</p>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 rounded-bl-3xl"
                     style={{ background: "linear-gradient(135deg, hsl(var(--manatee)), transparent)" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Ready to transform your presentations?
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
              Join thousands of professionals who create stunning slides with AI
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/sign-up">
                <Button
                  size="lg"
                  className="shadow-xl text-lg px-8 py-6 rounded-full text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 bg-gradient-to-r from-[hsl(var(--old-lavender-light))] to-[hsl(var(--old-lavender))] hover:from-[hsl(var(--old-lavender))] hover:to-[hsl(var(--old-lavender))] border-0 font-medium"
                >
                  <Star className="h-5 w-5 mr-2" />
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="text-lg px-8 py-4 rounded-full border-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <FileText className="h-5 w-5 mr-2" />
                  View Examples
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-white/30 dark:bg-zinc-900/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <SlideoLogo className="h-6 w-6" />
              <span className="text-lg font-bold text-foreground">Slideo</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm">
              © 2025 Slideo. All rights reserved.
            </div>
          </div>
        </div>
      </footer>


    </div>
  );
}