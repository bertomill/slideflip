"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";

import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { createClient } from "@/lib/supabase/client";
import { Plus, Eye, ChevronRight, Sparkles, Zap, Star, ArrowRight, Play, FileText, Users, BarChart3, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

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

// Mock slide examples for the grid
const slideExamples = [
  { id: 1, title: "Corporate Pitch", color: "from-blue-500 to-blue-700" },
  { id: 2, title: "Product Launch", color: "from-purple-500 to-purple-700" },
  { id: 3, title: "Quarterly Review", color: "from-green-500 to-green-700" },
  { id: 4, title: "Market Analysis", color: "from-orange-500 to-orange-700" },
  { id: 5, title: "Team Presentation", color: "from-pink-500 to-pink-700" },
  { id: 6, title: "Sales Report", color: "from-teal-500 to-teal-700" },
  { id: 7, title: "Strategy Plan", color: "from-red-500 to-red-700" },
  { id: 8, title: "Project Update", color: "from-indigo-500 to-indigo-700" },
  { id: 9, title: "Brand Guide", color: "from-yellow-500 to-yellow-700" },
  { id: 10, title: "Investor Deck", color: "from-cyan-500 to-cyan-700" },
  { id: 11, title: "Training Material", color: "from-violet-500 to-violet-700" },
  { id: 12, title: "Case Study", color: "from-emerald-500 to-emerald-700" },
];

export default function Home() {
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: { full_name?: string } } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const supabase = createClient();
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // If user is authenticated, show dashboard
  if (user) {
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
        
        <Sidebar 
          user={user} 
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          isOpen={mobileMenuOpen}
          onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        
        <div className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
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
                <span className="font-semibold text-foreground text-sm sm:text-base">
                  SlideFlipper
                </span>
              </Link>
            </NavigationBrand>
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Theme toggle removed - using fixed one in top right corner */}
            </div>
          </Navigation>

          <div className="py-4 px-2 sm:py-8 sm:px-8 overflow-x-hidden">
            <div>
              {/* Welcome Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Welcome! 👋
                </h1>
                <p className="text-muted-foreground">
                  This is your SlideFlip dashboard. Explore tools to build your presentations & create stunning slides.
                </p>
              </div>

              {/* Presentations Section */}
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

                {/* General */}
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
                    General
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Card key={i} className="aspect-[16/10] overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                        <div className="h-full bg-gradient-to-br from-green-800 to-green-900 relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-10 bg-white/10 rounded border border-white/20 flex items-center justify-center">
                              <div className="text-xs text-white/60">Slide</div>
                            </div>
                          </div>
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <div className="h-4 w-4 bg-white rounded-sm"></div>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            SlideFlip
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/auth/login">
            <Button variant="ghost" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
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
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                The AI presentation maker for the workplace
              </span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
              It&apos;s{" "}
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                stunning
              </span>{" "}
              what you can do with a little{" "}
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                AI.
              </span>
            </h1>
            
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0">
              Create professional presentations in minutes, not hours. Let AI transform your ideas into stunning slides that captivate your audience.
            </p>

            {/* CTA Section */}
            <div className="mb-8">
              <Link href="/">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl text-lg px-8 py-4 rounded-xl">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Creating Now
                </Button>
              </Link>
            </div>

            {/* Prompt Input Demo */}
            <div className="max-w-2xl mx-auto lg:mx-0">
              <div className="relative">
                <Input
                  placeholder="Try a prompt to create your own slide..."
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="pr-32 py-4 text-lg rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
                  style={{ fontStyle: promptText ? 'normal' : 'italic' }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg px-4"
                    onClick={() => window.location.href = '/auth/sign-up'}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-4 text-sm text-slate-500 dark:text-slate-400">
                <button className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  <Zap className="h-4 w-4" />
                  Try an example
                </button>
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
                  className={`aspect-[4/3] overflow-hidden hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl ${
                    index % 4 === 0 ? 'transform -rotate-2' : 
                    index % 4 === 1 ? 'transform rotate-1' : 
                    index % 4 === 2 ? 'transform -rotate-1' : 'transform rotate-2'
                  }`}
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards'
                  }}
                >
                  <div className={`h-full bg-gradient-to-br ${slide.color} relative group`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-6 bg-white/20 rounded border border-white/30 flex items-center justify-center">
                        <div className="text-xs text-white/80 font-medium">AI</div>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="secondary" className="h-6 w-6 p-0 bg-white/90 hover:bg-white">
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="text-xs text-white/90 font-medium truncate bg-black/20 rounded px-2 py-1">
                        {slide.title}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Why choose{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                SlideFlip?
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Powerful AI meets intuitive design to transform how you create presentations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4">AI-Powered Creation</h3>
              <p className="text-slate-600 dark:text-slate-300">
                Transform your ideas into professional slides instantly with our advanced AI technology
              </p>
            </Card>

            <Card className="p-8 text-center hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4">Enterprise Ready</h3>
              <p className="text-slate-600 dark:text-slate-300">
                LDAP integration, SSO support, and enterprise-grade security for your organization
              </p>
            </Card>

            <Card className="p-8 text-center hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4">Smart Analytics</h3>
              <p className="text-slate-600 dark:text-slate-300">
                Track engagement, measure impact, and optimize your presentations with built-in analytics
              </p>
            </Card>
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
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl text-lg px-8 py-4 rounded-xl">
                  <Star className="h-5 w-5 mr-2" />
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="text-lg px-8 py-4 rounded-xl border-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <FileText className="h-5 w-5 mr-2" />
                  View Examples
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="h-6 w-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded flex items-center justify-center">
                <div className="h-3 w-3 bg-white rounded-sm"></div>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                SlideFlip
              </span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm">
              © 2025 SlideFlip. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}