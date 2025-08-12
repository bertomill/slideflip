"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  FileText, 
  History, 
  Crown, 
  LogOut,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Layers
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
                <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
                  <div className="h-3 w-3 bg-background rounded-sm"></div>
                </div>
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
              <div className={cn("border-b border-border", collapsed ? "p-3" : "p-6")}>
                {collapsed ? (
                  <div className="flex justify-center">
                    <div className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary">
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
                  </div>
                ) : (
                  <Card variant="glass">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary">
                          {user.user_metadata?.avatar_url ? (
                            <img
                              src={user.user_metadata.avatar_url}
                              alt={user.user_metadata?.full_name || user.email || ""}
                              className="aspect-square h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                              {getInitials(user.email, user.user_metadata?.full_name)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {user.user_metadata?.full_name || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                          <Badge variant="secondary" className="mt-1 text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            Premium
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Navigation Menu */}
            <nav className="flex-1 p-4">
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
                  {!collapsed && "My Presentations"}
                </Button>
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
                  {!collapsed && "My Templates"}
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
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-left",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                  onClick={() => onToggle?.()}
                >
                  <History className={cn("h-4 w-4", !collapsed && "mr-3")} />
                  {!collapsed && "Recent"}
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-left",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                  onClick={() => {
                    router.push("/settings");
                    onToggle?.();
                  }}
                >
                  <Settings className={cn("h-4 w-4", !collapsed && "mr-3")} />
                  {!collapsed && "Settings"}
                </Button>
              </div>
            </nav>

            {/* Bottom Actions */}
            {user && (
              <div className="p-4 border-t border-border">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-left text-muted-foreground hover:text-foreground",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                  onClick={logout}
                >
                  <LogOut className={cn("h-4 w-4", !collapsed && "mr-3")} />
                  {!collapsed && "Sign Out"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
);
Sidebar.displayName = "Sidebar";

export { Sidebar };