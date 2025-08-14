-- Simple migration: Just add the essential columns we need
BEGIN;

-- Add just the essential builder columns
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS builder_status TEXT DEFAULT 'draft';
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS slide_html TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS slide_json JSONB;

-- Add basic JSONB columns with simple defaults
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS step_timestamps JSONB DEFAULT '{}';

-- Add additional builder state columns
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS parsed_documents JSONB DEFAULT '[]';
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS selected_theme TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS selected_palette JSONB;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS wants_research BOOLEAN DEFAULT false;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS research_options JSONB;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS research_data TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS selected_model TEXT DEFAULT 'gpt-4';

COMMIT;