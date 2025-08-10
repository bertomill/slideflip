"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Users, Lock } from "lucide-react";

interface PrivacyAgreementModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function PrivacyAgreementModal({ isOpen, onAccept, onDecline }: PrivacyAgreementModalProps) {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <div className="relative">
                <Users className="h-8 w-8 text-primary" />
                <Shield className="h-4 w-4 text-primary absolute -top-1 -right-1" />
              </div>
            </div>
            <CardTitle className="text-2xl">We take your privacy seriously</CardTitle>
            <CardDescription>
              We only collect the data we need to provide you with the best experience possible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground text-center">
              <p>
                Learn more in our{" "}
                <a href="#" className="text-primary hover:underline font-medium">
                  Terms of Use
                </a>
                ,{" "}
                <a href="#" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </a>
                , and{" "}
                <a href="#" className="text-primary hover:underline font-medium">
                  Data Processing Agreement
                </a>
                .
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Lock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Secure Data Handling</h4>
                  <p className="text-xs text-muted-foreground">
                    Your presentations and data are encrypted and stored securely
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Privacy First</h4>
                  <p className="text-xs text-muted-foreground">
                    We never sell your data or share it with third parties
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Transparency</h4>
                  <p className="text-xs text-muted-foreground">
                    Clear policies on how we collect and use your information
                  </p>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-start space-x-3">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  className="mt-1"
                />
                <label className="text-sm text-foreground cursor-pointer">
                  I agree to the Terms of Use, Privacy Policy, and Data Processing Agreement
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onDecline}
                className="flex-1"
              >
                Decline
              </Button>
              <Button
                onClick={onAccept}
                disabled={!agreed}
                className="flex-1"
              >
                Continue
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Signing up with your email address
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}