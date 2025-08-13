"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, UserPlus, AlertCircle } from "lucide-react";

interface InvitationData {
  id: string;
  workspace_owner_id: string;
  email: string;
  status: string;
  expires_at: string;
  owner_name: string;
  owner_email: string;
}

function AcceptInvitationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from("pending_invitations_with_details")
        .select("*")
        .eq("invitation_token", token)
        .single();

      if (error || !data) {
        setError("Invitation not found or has expired");
        setLoading(false);
        return;
      }

      if (data.status !== "pending") {
        if (data.status === "accepted") {
          setError("This invitation has already been accepted");
        } else if (data.status === "expired") {
          setError("This invitation has expired");
        } else {
          setError("This invitation is no longer valid");
        }
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired");
        setLoading(false);
        return;
      }

      setInvitation(data);
    } catch (err) {
      console.error("Error loading invitation:", err);
      setError("Failed to load invitation");
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!invitation || !user) return;

    setProcessing(true);
    
    try {
      const supabase = createClient();

      // Check if user's email matches the invitation
      if (user.email !== invitation.email) {
        setError(`This invitation was sent to ${invitation.email}, but you're logged in as ${user.email}. Please log in with the correct email address.`);
        setProcessing(false);
        return;
      }

      // Start a transaction-like operation
      // 1. Update invitation status
      const { error: updateError } = await supabase
        .from("workspace_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString()
        })
        .eq("invitation_token", token);

      if (updateError) {
        throw new Error("Failed to accept invitation");
      }

      // 2. Add user as workspace member
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_owner_id: invitation.workspace_owner_id,
          member_id: user.id,
          role: "member",
          invited_by: invitation.workspace_owner_id
        });

      if (memberError) {
        // If adding member fails, revert invitation status
        await supabase
          .from("workspace_invitations")
          .update({ status: "pending" })
          .eq("invitation_token", token);
        
        throw new Error("Failed to join workspace");
      }

      // Success! Redirect to presentations
      router.push("/presentations?joined=true");

    } catch (err) {
      console.error("Error accepting invitation:", err);
      setError("Failed to accept invitation. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const declineInvitation = async () => {
    if (!invitation) return;

    setProcessing(true);
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from("workspace_invitations")
        .update({
          status: "declined",
          accepted_at: new Date().toISOString()
        })
        .eq("invitation_token", token);

      if (error) {
        throw new Error("Failed to decline invitation");
      }

      router.push("/presentations?declined=true");

    } catch (err) {
      console.error("Error declining invitation:", err);
      setError("Failed to decline invitation. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 animate-spin" />
              Loading invitation...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button 
              onClick={() => router.push("/presentations")} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Sign In Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You need to sign in to accept this workspace invitation.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)} 
                className="w-full"
              >
                Sign In
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push(`/auth/signup?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)} 
                className="w-full"
              >
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Workspace Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">
              {invitation?.owner_name || invitation?.owner_email} has invited you to collaborate!
            </p>
            <p className="text-muted-foreground">
              Join their workspace to collaborate on presentations and templates.
            </p>
          </div>

          {user.email !== invitation?.email && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-800">
                  This invitation was sent to <strong>{invitation?.email}</strong>
                </p>
                <p className="text-amber-700">
                  You're currently signed in as <strong>{user.email}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button 
              onClick={acceptInvitation}
              disabled={processing || user.email !== invitation?.email}
              className="w-full"
            >
              {processing ? "Accepting..." : "Accept Invitation"}
            </Button>
            <Button 
              variant="outline"
              onClick={declineInvitation}
              disabled={processing}
              className="w-full"
            >
              {processing ? "Declining..." : "Decline"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Invitation expires on {new Date(invitation?.expires_at || "").toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}> 
      <AcceptInvitationPageInner />
    </Suspense>
  );
}