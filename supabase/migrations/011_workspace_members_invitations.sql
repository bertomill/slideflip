-- ============================================================================
-- WORKSPACE MEMBERS & INVITATIONS SYSTEM
-- ============================================================================
-- This migration creates tables to support workspace collaboration features:
-- 1. workspace_members: Track members of each workspace
-- 2. workspace_invitations: Manage pending invitations
-- ============================================================================

-- Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Ensure unique workspace-member combinations
    UNIQUE(workspace_owner_id, member_id)
);

-- Create workspace_invitations table
CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invitation_token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique workspace-email combinations for pending invitations
    UNIQUE(workspace_owner_id, email, status) 
);

-- Create indexes for better query performance
CREATE INDEX idx_workspace_members_owner ON workspace_members(workspace_owner_id);
CREATE INDEX idx_workspace_members_member ON workspace_members(member_id);
CREATE INDEX idx_workspace_invitations_owner ON workspace_invitations(workspace_owner_id);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(invitation_token);
CREATE INDEX idx_workspace_invitations_status ON workspace_invitations(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace Members Policies
-- Users can see members of workspaces they own or are members of
CREATE POLICY "workspace_members_select_policy" ON workspace_members
    FOR SELECT USING (
        workspace_owner_id = auth.uid() OR 
        member_id = auth.uid()
    );

-- Only workspace owners can add new members
CREATE POLICY "workspace_members_insert_policy" ON workspace_members
    FOR INSERT WITH CHECK (
        workspace_owner_id = auth.uid()
    );

-- Only workspace owners can remove members
CREATE POLICY "workspace_members_delete_policy" ON workspace_members
    FOR DELETE USING (
        workspace_owner_id = auth.uid()
    );

-- Workspace Invitations Policies
-- Users can see invitations for workspaces they own or invitations sent to their email
CREATE POLICY "workspace_invitations_select_policy" ON workspace_invitations
    FOR SELECT USING (
        workspace_owner_id = auth.uid() OR 
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Only authenticated users can create invitations for their own workspaces
CREATE POLICY "workspace_invitations_insert_policy" ON workspace_invitations
    FOR INSERT WITH CHECK (
        workspace_owner_id = auth.uid() AND
        invited_by = auth.uid()
    );

-- Users can update invitations they received (to accept/decline)
CREATE POLICY "workspace_invitations_update_policy" ON workspace_invitations
    FOR UPDATE USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
        workspace_owner_id = auth.uid()
    );

-- Only workspace owners can delete invitations
CREATE POLICY "workspace_invitations_delete_policy" ON workspace_invitations
    FOR DELETE USING (
        workspace_owner_id = auth.uid()
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically add workspace owner as a member
CREATE OR REPLACE FUNCTION add_workspace_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user signs up, add them as owner of their own workspace
    INSERT INTO workspace_members (workspace_owner_id, member_id, role, invited_by)
    VALUES (NEW.id, NEW.id, 'owner', NEW.id)
    ON CONFLICT (workspace_owner_id, member_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically add new users as workspace owners
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION add_workspace_owner_as_member();

-- Function to clean up expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
    UPDATE workspace_invitations 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR EASIER QUERYING
-- ============================================================================

-- View to get workspace members with user details
CREATE OR REPLACE VIEW workspace_members_with_details AS
SELECT 
    wm.*,
    u.email as member_email,
    u.raw_user_meta_data->>'full_name' as member_name,
    u.raw_user_meta_data->>'avatar_url' as member_avatar,
    invited_by_user.email as invited_by_email,
    invited_by_user.raw_user_meta_data->>'full_name' as invited_by_name
FROM workspace_members wm
JOIN auth.users u ON wm.member_id = u.id
LEFT JOIN auth.users invited_by_user ON wm.invited_by = invited_by_user.id;

-- View to get pending invitations with workspace owner details
CREATE OR REPLACE VIEW pending_invitations_with_details AS
SELECT 
    wi.*,
    owner.email as owner_email,
    owner.raw_user_meta_data->>'full_name' as owner_name,
    invited_by_user.email as invited_by_email,
    invited_by_user.raw_user_meta_data->>'full_name' as invited_by_name
FROM workspace_invitations wi
JOIN auth.users owner ON wi.workspace_owner_id = owner.id
JOIN auth.users invited_by_user ON wi.invited_by = invited_by_user.id
WHERE wi.status = 'pending' AND wi.expires_at > NOW();

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_invitations TO authenticated;
GRANT SELECT ON workspace_members_with_details TO authenticated;
GRANT SELECT ON pending_invitations_with_details TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;