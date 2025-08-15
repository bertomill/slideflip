-- Fix template name uniqueness to be per-user instead of global
-- This allows different users to have templates with the same name

-- First, drop the existing unique constraint on name
ALTER TABLE slide_templates DROP CONSTRAINT IF EXISTS slide_templates_name_key;

-- Create a new unique constraint on (user_id, name) combination
-- This allows same template names for different users, but prevents duplicates within a user's templates
ALTER TABLE slide_templates ADD CONSTRAINT unique_user_template_name 
UNIQUE (user_id, name);

-- Note: This will allow NULL user_id values to have duplicate names
-- If you want to prevent that, you could add a separate constraint for system templates