import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { emails, workspaceName, inviterName } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "Email addresses are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid email format: ${email}` },
          { status: 400 }
        );
      }
    }

    const supabase = createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const invitationResults = [];

    for (const email of emails) {
      try {
        // Check if user is already a member
        const { data: existingMember } = await supabase
          .from("workspace_members")
          .select("*")
          .eq("workspace_owner_id", user.id)
          .eq("member_id", (
            await supabase
              .from("auth.users")
              .select("id")
              .eq("email", email)
              .single()
          )?.data?.id)
          .single();

        if (existingMember) {
          invitationResults.push({
            email,
            status: "already_member",
            message: "User is already a workspace member"
          });
          continue;
        }

        // Check if there's already a pending invitation
        const { data: existingInvitation } = await supabase
          .from("workspace_invitations")
          .select("*")
          .eq("workspace_owner_id", user.id)
          .eq("email", email)
          .eq("status", "pending")
          .single();

        if (existingInvitation) {
          // Update the existing invitation to extend expiry
          const { error: updateError } = await supabase
            .from("workspace_invitations")
            .update({
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
              invited_at: new Date().toISOString()
            })
            .eq("id", existingInvitation.id);

          if (updateError) {
            console.error("Error updating invitation:", updateError);
            invitationResults.push({
              email,
              status: "error",
              message: "Failed to update existing invitation"
            });
            continue;
          }

          invitationResults.push({
            email,
            status: "resent",
            message: "Invitation resent successfully"
          });
        } else {
          // Create new invitation
          const { data: invitation, error: inviteError } = await supabase
            .from("workspace_invitations")
            .insert({
              workspace_owner_id: user.id,
              email: email,
              invited_by: user.id,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single();

          if (inviteError) {
            console.error("Error creating invitation:", inviteError);
            invitationResults.push({
              email,
              status: "error",
              message: "Failed to create invitation"
            });
            continue;
          }

          invitationResults.push({
            email,
            status: "sent",
            message: "Invitation sent successfully",
            invitation_id: invitation.id
          });
        }

        // TODO: Send email invitation
        // This would integrate with your email service (SendGrid, Resend, etc.)
        await sendInvitationEmail({
          to: email,
          inviterName: inviterName || user.email,
          workspaceName: workspaceName || "workspace",
          invitationToken: existingInvitation?.invitation_token || 
            (await supabase
              .from("workspace_invitations")
              .select("invitation_token")
              .eq("email", email)
              .eq("workspace_owner_id", user.id)
              .eq("status", "pending")
              .single()
            ).data?.invitation_token
        });

      } catch (error) {
        console.error(`Error processing invitation for ${email}:`, error);
        invitationResults.push({
          email,
          status: "error",
          message: "Failed to process invitation"
        });
      }
    }

    const successCount = invitationResults.filter(r => 
      r.status === "sent" || r.status === "resent"
    ).length;

    return NextResponse.json({
      message: `Processed ${emails.length} invitation(s). ${successCount} successful.`,
      results: invitationResults,
      success: successCount > 0
    });

  } catch (error) {
    console.error("Error in invite-members API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Email sending function (placeholder - integrate with your email service)
async function sendInvitationEmail({
  to,
  inviterName,
  workspaceName,
  invitationToken
}: {
  to: string;
  inviterName: string;
  workspaceName: string;
  invitationToken: string;
}) {
  // TODO: Replace with your email service integration
  // Example with Resend, SendGrid, or other email service
  
  const invitationUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/accept?token=${invitationToken}`;
  
  console.log(`
    🔔 INVITATION EMAIL (Demo Mode)
    ================================
    To: ${to}
    From: ${inviterName}
    Subject: You're invited to join ${workspaceName} on Slideo
    
    Click here to accept: ${invitationUrl}
    
    This invitation expires in 7 days.
  `);

  // Uncomment and configure for production:
  /*
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@yourdomain.com',
        to: [to],
        subject: `You're invited to join ${workspaceName} on Slideo`,
        html: `
          <h2>You're invited!</h2>
          <p>${inviterName} has invited you to collaborate on ${workspaceName}.</p>
          <a href="${invitationUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Accept Invitation
          </a>
          <p><small>This invitation expires in 7 days.</small></p>
        `,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send email');
    }
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
  */
}