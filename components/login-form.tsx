"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
// Removed unused Tabs and Select imports

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail]  = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Removed unused SSO demo state
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // First attempt to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // If sign in fails due to invalid credentials, provide helpful feedback
      if (signInError && signInError.message.includes('Invalid login credentials')) {
        console.log('Invalid login credentials');
        setError("Account not found with these credentials. Please check your email and password, or create an account if you're new.");
        return;
        
      } else if (signInError) {
        throw signInError;
      } else {
        // Successful sign in
        router.push("/");
      }
      
    } catch (error: unknown) {
      console.error('Authentication error:', error);
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Removed unused SSO demo handler

  return (
      <div className={cn("flex flex-col gap-6 text-foreground", className)} {...props}>
      {/* Language selector */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>English</span>
      </div>

      {/* Logo and title */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-10 flex items-center justify-center">
            <img 
              src="/slideo-logo-white.svg" 
              alt="Slideo Logo" 
              className="w-10 h-10"
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Sign in</h1>
      </div>

      {/* SSO buttons */}
      <div className="space-y-2">
        {/* Google sign-in button */}
        <Button 
          variant="outline" 
          className="w-full h-10 rounded-full bg-background text-foreground border border-border hover:bg-muted font-medium"
          disabled={isLoading}
          onClick={async () => {
            console.log('Google sign-in button clicked');
            setIsLoading(true);
            setError(null);
            
            try {
              const supabase = createClient();
              console.log('Attempting Google OAuth...');
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                  queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                  }
                }
              });
              
              if (error) {
                console.error('Google OAuth error:', error);
                throw error;
              }
              console.log('Google OAuth initiated successfully');
            } catch (error: unknown) {
              console.error('Google sign-in failed:', error);
              setError(error instanceof Error ? error.message : "Google sign-in failed");
              setIsLoading(false);
            }
          }}
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

      </div>

      {/* Separator */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-transparent text-muted-foreground">or</span>
        </div>
      </div>

      {/* Email/Password form */}
      <form onSubmit={handleLogin} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="hello@bertomill.ca"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-full border-border focus:border-[hsl(var(--old-lavender))] focus:ring-[hsl(var(--old-lavender))] bg-background text-foreground"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type="password"
              placeholder="••••••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-full border-border focus:border-[hsl(var(--old-lavender))] focus:ring-[hsl(var(--old-lavender))] bg-background text-foreground pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Forgot password link */}
        <div className="text-left">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-[hsl(var(--old-lavender))] hover:text-[hsl(var(--old-lavender))]/90 underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-md p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Sign in button */}
        <Button 
          type="submit" 
          className="w-full h-10 rounded-full text-white bg-gradient-to-r from-[hsl(var(--old-lavender-light))] to-[hsl(var(--old-lavender))] hover:from-[hsl(var(--old-lavender))] hover:to-[hsl(var(--old-lavender))] border-0 disabled:opacity-50"
          disabled={isLoading || !email || !password}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {/* Sign up link */}
      <div className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/sign-up"
          className="text-[hsl(var(--old-lavender))] hover:text-[hsl(var(--old-lavender))]/90 underline-offset-4 hover:underline font-medium"
        >
          Sign up
        </Link>
      </div>


      {/* Branding */}
      <div className="text-center mt-6">
        <div className="text-xl font-bold text-foreground mb-1">Slideo</div>
        <div className="text-xs text-muted-foreground">© 2025 Slideo Tech, Inc.</div>
      </div>
    </div>
  );
}
