"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X, Mail, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName?: string;
}

export function InviteMembersModal({ isOpen, onClose, workspaceName }: InviteMembersModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage("Please enter a valid email address");
      return;
    }

    if (inviteEmails.includes(email)) {
      setMessage("This email is already added");
      return;
    }

    setInviteEmails([...inviteEmails, email]);
    setEmailInput("");
    setMessage("");
  };

  const removeEmail = (emailToRemove: string) => {
    setInviteEmails(inviteEmails.filter(email => email !== emailToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  };

  const sendInvitations = async () => {
    if (inviteEmails.length === 0) {
      setMessage("Please add at least one email address");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setMessage("You must be logged in to send invitations");
        setIsLoading(false);
        return;
      }

      // Send invitations via API
      const response = await fetch("/api/invite-members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: inviteEmails,
          workspaceName: workspaceName || "workspace",
          inviterName: user.user_metadata?.full_name || user.email,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`Successfully sent ${inviteEmails.length} invitation(s)!`);
        setInviteEmails([]);
        setTimeout(() => {
          onClose();
          setMessage("");
        }, 2000);
      } else {
        setMessage(result.error || "Failed to send invitations");
      }
    } catch (error) {
      console.error("Error sending invitations:", error);
      setMessage("Failed to send invitations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmailInput("");
    setInviteEmails([]);
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite members to {workspaceName || "workspace"}
          </DialogTitle>
          <DialogDescription>
            Invite people to collaborate on your presentations and templates. They'll receive an email invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email addresses</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                onClick={addEmail}
                variant="outline"
                size="sm"
                disabled={!emailInput.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Added Emails */}
          {inviteEmails.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                People to invite ({inviteEmails.length})
              </Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {inviteEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {email}
                    <button
                      onClick={() => removeEmail(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`text-sm p-2 rounded ${
              message.includes("Successfully") 
                ? "bg-green-50 text-green-700 border border-green-200" 
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={sendInvitations} 
            disabled={inviteEmails.length === 0 || isLoading}
          >
            {isLoading ? "Sending..." : `Send ${inviteEmails.length} invitation${inviteEmails.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}