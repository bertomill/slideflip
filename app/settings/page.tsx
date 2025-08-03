"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation, NavigationBrand } from "@/components/ui/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { Settings, Sun, Moon, Monitor } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

export default function SettingsPage() {
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

  return (
    <div className="min-h-screen gradient-dark-blue flex">
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
      <div className="flex-1 transition-all duration-300">
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
                SlideFlip
              </span>
            </Link>
          </NavigationBrand>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </Navigation>

        <div className="px-4 py-8">
          <div className="flex-1 w-full flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-2">
                  Manage your account preferences and app settings
                </p>
              </div>
            </div>

            {/* Theme Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Theme</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose your preferred theme for the application
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => setTheme("light")}
                    >
                      <Sun className="h-6 w-6" />
                      <span>Light</span>
                    </Button>
                    
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => setTheme("dark")}
                    >
                      <Moon className="h-6 w-6" />
                      <span>Dark</span>
                    </Button>
                    
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => setTheme("system")}
                    >
                      <Monitor className="h-6 w-6" />
                      <span>System</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Email</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Change
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Password</h3>
                    <p className="text-sm text-muted-foreground">Last changed 30 days ago</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Update
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Coming Soon Section */}
            <Card>
              <CardHeader>
                <CardTitle>More Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Additional settings and preferences will be available soon.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 