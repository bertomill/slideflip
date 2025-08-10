"use client";

import { useEffect, useMemo, useState } from "react";
// Removed dynamic QR; we now show the branded static QR image
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import Image from "next/image";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<{ email?: string; user_metadata?: { avatar_url?: string; full_name?: string }; } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    };
    loadUser();
  }, []);

  const waitlistUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/waitlist`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("waitlist_emails").insert({ email });
      if (error) throw error;
      toast.success("You're on the list! We'll be in touch soon.");
      setEmail("");
    } catch (err: unknown) {
      const message = typeof err === 'object' && err && 'message' in err ? (err as { message?: string }).message || "Could not join the waitlist" : "Could not join the waitlist";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-40 w-full bg-background/80 backdrop-blur border-b border-border flex items-center justify-between px-4 py-3">
        <MobileMenuButton isOpen={mobileMenuOpen} onToggle={() => setMobileMenuOpen((o) => !o)} />
        <div className="font-semibold">Waitlist</div>
        <div className="w-8" />
      </div>

      {/* Sidebar */}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen((o) => !o)}
      />

      {/* Content */}
      <main
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        } px-8 py-12`}
      >
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold">Join the Waitlist</h1>
            <p className="text-lg text-muted-foreground">
              Scan the QR code or enter your email below to get early access updates.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card variant="glass">
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-background p-6 rounded-xl border border-border shadow-inner">
                    <Image
                      src="/slideo-waitlist.png"
                      alt="Slideo waitlist QR"
                      width={420}
                      height={420}
                      className="rounded"
                      priority
                    />
                  </div>
                  <span className="text-sm md:text-base text-muted-foreground">Scan to join the waitlist</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-base">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={isSubmitting || !email} className="w-full text-base">
                    {isSubmitting ? "Joining..." : "Join Waitlist"}
                  </Button>
                   <Button
                    type="button"
                    variant="secondary"
                     size="lg"
                     className="w-full text-base"
                    onClick={() => {
                      if (!waitlistUrl) return;
                      navigator.clipboard.writeText(waitlistUrl);
                      toast.success("Link copied to clipboard");
                    }}
                  >
                    Copy Link
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

