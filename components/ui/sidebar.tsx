"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  FileText, 
  Crown, 
  LogOut,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Layers,
  ChevronDown,
  User,
  UserPlus,
  Plus,
  Edit,
  Clock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InviteMembersModal } from "@/components/ui/invite-members-modal";
import { SlideoLogo } from "@/components/slideo-logo";

interface RecentPresentation {
  id: string;
  title: string;
  current_step: number;
  status: string;
  updated_at: string;
  builder_status?: string;
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  user?: {
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } | null;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, user, collapsed = false, onCollapsedChange, isOpen = false, onToggle, ...props }, ref) => {
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);
    const [recentPresentations, setRecentPresentations] = React.useState<RecentPresentation[]>([]);
    const [loadingRecent, setLoadingRecent] = React.useState(false);

    // Fetch recent presentations
    React.useEffect(() => {
      const fetchRecentPresentations = async () => {
        if (!user) return;
        
        setLoadingRecent(true);
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('presentations')
            .select('id, title, current_step, status, updated_at, builder_status')
            .order('updated_at', { ascending: false })
            .limit(5);
            
          if (error) {
            console.error('Error fetching recent presentations:', error);
            return;
          }
          
          setRecentPresentations(data || []);
        } catch (error) {
          console.error('Error fetching recent presentations:', error);
        } finally {
          setLoadingRecent(false);
        }
      };
      
      fetchRecentPresentations();
    }, [user]);

    // Close dropdown when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
          setShowUserMenu(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    const logout = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
    };

    const getInitials = (email?: string, fullName?: string) => {
      if (fullName) {
        return fullName.split(' ').map(n => n[0]).join('').toUpperCase();
      }
      return email?.slice(0, 2).toUpperCase() || 'U';
    };

    const getStepName = (currentStep: number) => {
      switch (currentStep) {
        case 1: return 'Upload';
        case 2: return 'Theme';
        case 3: return 'Preview';
        default: return 'Draft';
      }
    };

    const getTimeAgo = (dateString: string) => {
      const now = new Date();
      const date = new Date(dateString);
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;
      
      return date.toLocaleDateString();
    };

    const toggleCollapsed = () => onCollapsedChange?.(!collapsed);

    return (
      <>

        {/* Overlay for mobile */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-40 md:hidden"
            onClick={onToggle}
          />
        )}

        {/* Sidebar */}
        <div
          ref={ref}
          className={cn(
            "fixed left-0 top-0 z-40 h-screen transform bg-background border-r border-border transition-all duration-300 ease-in-out",
            "md:translate-x-0 md:z-0 md:h-screen",
            collapsed ? "w-16" : "w-64",
            isOpen ? "translate-x-0" : "-translate-x-full",
            className
          )}
          {...props}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-border relative">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <SlideoLogo size={24} />
                {!collapsed && (
                  <span className="font-semibold text-foreground">Slideo</span>
                )}
              </Link>
              
              {/* Collapse button for desktop */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex absolute -right-3 top-6 h-6 w-6 rounded-full border border-border bg-background shadow-md hover:bg-accent z-50 p-0"
                onClick={toggleCollapsed}
              >
                {collapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronLeft className="h-3 w-3" />
                )}
              </Button>
            </div>

            {/* User Profile Section */}
            {user && (
              <div className="border-b border-border relative" ref={userMenuRef}>
                {collapsed ? (
                  <div className="p-3 flex justify-center">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary hover:opacity-80 transition-opacity"
                    >
                      {user.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt={user.user_metadata?.full_name || user.email || ""}
                          className="aspect-square h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                          {getInitials(user.email, user.user_metadata?.full_name)}
                        </div>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex-1 px-6 py-4 flex items-center gap-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="relative flex h-6 w-6 shrink-0 overflow-hidden rounded-full bg-primary">
                        {user.user_metadata?.avatar_url ? (
                          <img
                            src={user.user_metadata.avatar_url}
                            alt={user.user_metadata?.full_name || user.email || ""}
                            className="aspect-square h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                            {getInitials(user.email, user.user_metadata?.full_name)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">
                          {user.user_metadata?.full_name ? `${user.user_metadata.full_name.split(' ')[0]}'s Workspace` : "My Workspace"}
                        </p>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        showUserMenu && "rotate-180"
                      )} />
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-4 h-8 w-8 p-0 hover:bg-accent"
                      onClick={() => {
                        router.push("/build");
                        onToggle?.();
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className={cn(
                    "absolute z-50 mt-1 bg-background border border-border rounded-md shadow-lg min-w-48",
                    collapsed ? "left-0" : "left-4 right-4"
                  )}>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          router.push("/build");
                          setShowUserMenu(false);
                          onToggle?.();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <Layers className="h-4 w-4 mr-3" />
                        Build
                      </button>
                      <button
                        onClick={() => {
                          router.push("/settings");
                          setShowUserMenu(false);
                          onToggle?.();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <Settings className="h-4 w-4 mr-3" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          router.push("/profile");
                          setShowUserMenu(false);
                          onToggle?.();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <User className="h-4 w-4 mr-3" />
                        Profile
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Menu */}
            <nav className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-left",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                  onClick={() => {
                    router.push("/presentations");
                    onToggle?.();
                  }}
                >
                  <FileText className={cn("h-4 w-4", !collapsed && "mr-3")} />
                  {!collapsed && "Presentations"}
                </Button>

                {/* Recent Presentations */}
                {!collapsed && user && (
                  <div className="ml-2 mt-2 space-y-1">
                    {loadingRecent ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <div className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </div>
                    ) : recentPresentations.length > 0 ? (
                      recentPresentations.map((presentation) => (
                        <button
                          key={presentation.id}
                          onClick={() => {
                            router.push(`/build?presentation_id=${presentation.id}`);
                            onToggle?.();
                          }}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {presentation.title || 'Untitled'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Step {presentation.current_step || 1} - {getStepName(presentation.current_step || 1)}
                                </span>
                                <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
                                <span className="text-xs text-muted-foreground">
                                  {getTimeAgo(presentation.updated_at)}
                                </span>
                              </div>
                            </div>
                            <Clock className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No recent presentations
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-left",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                  onClick={() => {
                    router.push("/templates");
                    onToggle?.();
                  }}
                >
                  <Layers className={cn("h-4 w-4", !collapsed && "mr-3")} />
                  {!collapsed && "Templates"}
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-left",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                  onClick={() => {
                    router.push("/waitlist");
                    onToggle?.();
                  }}
                >
                  <QrCode className={cn("h-4 w-4", !collapsed && "mr-3")} />
                  {!collapsed && "Waitlist QR Code"}
                </Button>
              </div>
            </nav>

            {/* Invite Members */}
            <div className="p-4 border-t border-border">
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-left text-muted-foreground hover:text-foreground",
                  collapsed ? "justify-center px-2" : "justify-start"
                )}
                onClick={() => {
                  // Add invite members functionality here
                  console.log("Invite members clicked");
                }}
              >
                <UserPlus className={cn("h-4 w-4", !collapsed && "mr-3")} />
                {!collapsed && "Invite members"}
              </Button>
            </div>

          </div>
        </div>
      </>
    );
  }
);
Sidebar.displayName = "Sidebar";

export { Sidebar };