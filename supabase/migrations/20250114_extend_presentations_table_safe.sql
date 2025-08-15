-- Migration: Extend presentations table to capture all builder flow data (SAFE VERSION)
-- Date: 2025-01-14
-- Description: Add all flow fields to presentations table instead of separate flows table

BEGIN;

-- Drop the flows table and view since we're consolidating into presentations
DROP VIEW IF EXISTS active_flows CASCADE;
DROP TABLE IF EXISTS flows CASCADE;

-- Add all builder flow fields to the presentations table (using IF NOT EXISTS)
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS builder_status TEXT DEFAULT 'draft';

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_current_step') THEN
    ALTER TABLE presentations ADD CONSTRAINT valid_current_step CHECK (current_step >= 1 AND current_step <= 4);
  END IF;
END $$;

-- Add constraint only if it doesn't exist  
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_builder_status') THEN
    ALTER TABLE presentations ADD CONSTRAINT valid_builder_status CHECK (builder_status IN ('draft', 'in_progress', 'completed', 'archived'));
  END IF;
END $$;

-- STEP 1: Upload & Documents Data
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS parsed_documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS selected_model TEXT DEFAULT 'gpt-4';

-- STEP 2: Content Planning Data (if you still use this step)
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS content_plan TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS user_feedback TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS content_plan_generated_at TIMESTAMP WITH TIME ZONE;

-- STEP 3: Research Data
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS wants_research BOOLEAN DEFAULT false;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS research_options JSONB DEFAULT '{
  "maxResults": 4,
  "includeImages": true, 
  "includeAnswer": "advanced",
  "timeRange": "month",
  "excludeSocial": true
}'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS research_data TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS research_completed_at TIMESTAMP WITH TIME ZONE;

-- STEP 4: Theme & Design Data  
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS selected_theme TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS selected_palette JSONB DEFAULT '[]'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS theme_customizations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS palette_mode TEXT;

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_palette_mode') THEN
    ALTER TABLE presentations ADD CONSTRAINT valid_palette_mode CHECK (palette_mode IN ('logo', 'ai', 'manual'));
  END IF;
END $$;

-- STEP 5: Generated Content Data
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS slide_html TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS slide_json JSONB;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS generation_prompt TEXT;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS generation_metadata JSONB DEFAULT '{
  "model_used": null,
  "tokens_consumed": 0, 
  "generation_time_ms": 0,
  "api_version": null
}'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS slide_generated_at TIMESTAMP WITH TIME ZONE;

-- STEP 6: Output & Sharing Data
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS download_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS share_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS exports_completed_at TIMESTAMP WITH TIME ZONE;

-- Workflow & Performance Tracking
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS step_timestamps JSONB DEFAULT '{}'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS error_logs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS total_generation_time INTEGER DEFAULT 0;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS api_calls_made JSONB DEFAULT '{
  "content_planning": 0,
  "research": 0, 
  "slide_generation": 0,
  "color_generation": 0
}'::jsonb;

-- Create additional indexes for the new fields (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_presentations_current_step ON presentations(current_step);
CREATE INDEX IF NOT EXISTS idx_presentations_builder_status ON presentations(builder_status);
CREATE INDEX IF NOT EXISTS idx_presentations_slide_generated_at ON presentations(slide_generated_at);
CREATE INDEX IF NOT EXISTS idx_presentations_wants_research ON presentations(wants_research);

-- Create a view for active presentations (non-archived with builder data)
CREATE OR REPLACE VIEW active_presentations AS
SELECT 
  id,
  user_id,
  title,
  description,
  status,
  current_step,
  builder_status,
  created_at,
  updated_at,
  last_accessed_at,
  -- Extract some useful computed fields
  (documents->0->>'name') as first_document_name,
  jsonb_array_length(COALESCE(documents, '[]'::jsonb)) as document_count,
  (step_timestamps->>'step_' || current_step::text) as current_step_completed_at,
  CASE 
    WHEN builder_status = 'completed' THEN 100
    WHEN current_step = 4 THEN 90
    WHEN current_step = 3 THEN 75
    WHEN current_step = 2 THEN 60
    WHEN current_step = 1 THEN 30
    ELSE 15
  END as progress_percentage,
  -- Check if slide has been generated
  CASE 
    WHEN slide_json IS NOT NULL OR slide_html IS NOT NULL THEN true
    ELSE false
  END as has_generated_content
FROM presentations 
WHERE status != 'archived' AND (builder_status != 'archived' OR builder_status IS NULL);

-- Grant permissions on the view
GRANT SELECT ON active_presentations TO authenticated;
GRANT SELECT ON active_presentations TO service_role;

-- Update existing presentations to have default builder values if they don't already
UPDATE presentations 
SET 
  current_step = COALESCE(current_step, 1),
  builder_status = COALESCE(builder_status, 'draft'),
  step_timestamps = COALESCE(step_timestamps, '{"step_1": "' || created_at || '"}')
WHERE current_step IS NULL OR builder_status IS NULL OR step_timestamps IS NULL;

COMMIT;