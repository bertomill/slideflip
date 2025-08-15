-- Add user_id column to slide_templates table
-- This allows templates to be associated with specific users

ALTER TABLE slide_templates 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create an index for better query performance
CREATE INDEX idx_slide_templates_user_id ON slide_templates(user_id);

-- Create an index for active user templates (most common query)
CREATE INDEX idx_slide_templates_user_active ON slide_templates(user_id, is_active) WHERE is_active = true;

-- Update existing templates to have NULL user_id (they will be "system" templates)
-- Or you could assign them to a specific user if needed
COMMENT ON COLUMN slide_templates.user_id IS 'User who created this template. NULL for system/shared templates.';