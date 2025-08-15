"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrivacyAgreementModal } from "@/components/privacy-agreement-modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const router = useRouter();

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    // Show privacy modal before proceeding with sign up
    setShowPrivacyModal(true);
  };

  const handlePrivacyAccept = async () => {
    setShowPrivacyModal(false);
    setIsLoading(true);
    
    const supabase = createClient();
    
    // Debug: Check if Supabase client is created properly
    console.log('Supabase client created:', !!supabase);
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Supabase auth object:', !!supabase.auth);

    try {
      console.log('Attempting to sign up user:', email);
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            email_confirmed: true, // Try to bypass email confirmation
          }
        },
      });
      
      if (signUpError) {
        console.error('Sign up error raw:', signUpError);
        console.error('Sign up error stringified:', JSON.stringify(signUpError, null, 2));
        console.error('Sign up error details:', {
          message: signUpError.message || 'No message',
          status: signUpError.status || 'No status',
          name: signUpError.name || 'No name',
          stack: signUpError.stack || 'No stack',
        });
        
        // Check for specific error types
        if (signUpError.message && signUpError.message.includes('Database error')) {
          setError("Database error saving new user. This might be a configuration issue. Please check the console for details.");
          console.error('Database configuration issue. Run the debug SQL commands to diagnose.');
        } else if (signUpError.message && signUpError.message.includes('User already registered')) {
          setError("This email is already registered. Please sign in instead.");
        } else if (signUpError.message && signUpError.message.includes('Failed to fetch')) {
          setError("Network error: Unable to connect to authentication service. Please check your internet connection.");
        } else {
          setError(signUpError.message || "An unknown error occurred during sign up");
        }
        return;
      }
      
      console.log('Sign up response:', signUpData);
      
      // If we have a session, user is logged in
      if (signUpData.session) {
        console.log('User signed up and logged in successfully');
        router.push("/");
        return;
      }
      
      // If no session but user was created, try to sign in
      if (signUpData.user) {
        console.log('User created but no session, attempting sign in...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          console.error('Sign in after sign up failed:', signInError);
          // Don't throw error - user was created successfully
          setError("Account created successfully! Please check your email to verify your account, then sign in.");
          return;
        }
        
        if (signInData.session) {
          console.log('Successfully signed in after sign up');
          router.push("/");
        }
      }
      
    } catch (error: unknown) {
      console.error('Unexpected error during sign up:', error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivacyDecline = () => {
    setShowPrivacyModal(false);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google sign-in button */}
          <Button 
            type="button"
            variant="outline" 
            className="w-full h-12 bg-white border-gray-300 hover:bg-gray-50 hover:text-gray-900 text-gray-900 font-medium mb-6"
            disabled={isLoading}
            onClick={async () => {
              setIsLoading(true);
              setError(null);
              
              try {
                const supabase = createClient();
                const { data, error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                      access_type: 'offline',
                      prompt: 'consent',
                    }
                  }
                });
                
                if (error) throw error;
              } catch (error: unknown) {
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

          {/* Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-gray-500">or</span>
            </div>
          </div>

          <form onSubmit={handleSignUpSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating an account..." : "Sign up"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <PrivacyAgreementModal
        isOpen={showPrivacyModal}
        onAccept={handlePrivacyAccept}
        onDecline={handlePrivacyDecline}
      />
    </div>
  );
}
