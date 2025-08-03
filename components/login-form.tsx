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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const [ssoError, setSsoError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Redirect to home page after successful login
      router.push("/");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSsoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSsoError(null);

    try {
      // Extract domain from email
      const domain = ssoEmail.split('@')[1];
      
      if (!domain) {
        throw new Error('Please enter a valid email address');
      }

      // Mock SSO validation - in real implementation, this would check if SSO is enabled for the domain
      const enabledDomains = ['company.com', 'bertomill.ca', 'corp.local', 'uwo.ca'];
      
      if (!enabledDomains.includes(domain)) {
        throw new Error(`SSO is not enabled for ${domain}. Try using another method to access SlideFlip.`);
      }

      // In a real implementation, this would redirect to the SSO provider
      // For now, we'll just simulate the process
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      
      // Redirect to SSO provider (mock)
      setSsoError('SSO redirect would happen here. For demo purposes, please use email login.');
      
    } catch (error: unknown) {
      setSsoError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Choose your login method below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="sso">Enterprise (SSO)</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="mt-6">
          <form onSubmit={handleLogin}>
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
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
            </TabsContent>
            <TabsContent value="sso" className="mt-6">
              <div className="flex flex-col gap-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your company's email domain to authenticate using single sign-on (SSO)
                  </p>
                </div>
                <form onSubmit={handleSsoLogin}>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Input
                        id="sso-email"
                        type="email"
                        placeholder="your.email@company.com"
                        required
                        value={ssoEmail}
                        onChange={(e) => {
                          setSsoEmail(e.target.value);
                          setSsoError(null);
                        }}
                        className="text-center"
                      />
                    </div>
                    
                    {ssoError && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                        <p className="text-sm text-destructive text-center">{ssoError}</p>
                      </div>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Checking..." : "Continue with SSO"}
                    </Button>
                  </div>
                </form>
                
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Not using SSO?</p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      // Switch back to email tab
                      const emailTab = document.querySelector('[value="email"]') as HTMLElement;
                      emailTab?.click();
                    }}
                    className="text-primary hover:text-primary/80 underline underline-offset-4"
                  >
                    Go back
                  </Button>
                </div>
                
                <div className="text-center text-xs text-muted-foreground">
                  <p>We will process your data as set forth in our</p>
                  <div className="flex justify-center gap-1 mt-1">
                    <Link href="#" className="text-primary hover:text-primary/80 underline">Terms of Use</Link>
                    <span>,</span>
                    <Link href="#" className="text-primary hover:text-primary/80 underline">Privacy Policy</Link>
                    <span>and</span>
                    <Link href="#" className="text-primary hover:text-primary/80 underline">Data Processing Agreement</Link>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
