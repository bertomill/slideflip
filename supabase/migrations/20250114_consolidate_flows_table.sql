-- Migration: Consolidate all flow tables into comprehensive flows table
-- Date: 2025-01-14
-- Description: Replace multiple flow tables with one definitive flows table that captures all builder step data

BEGIN;

-- Drop all the fragmented flow tables (backup data first if needed!)
DROP TABLE IF EXISTS flow_content_plans CASCADE;
DROP TABLE IF EXISTS flow_documents CASCADE;  
DROP TABLE IF EXISTS flow_downloads CASCADE;
DROP TABLE IF EXISTS flow_events CASCADE;
DROP TABLE IF EXISTS flow_previews CASCADE;
DROP TABLE IF EXISTS flow_research_runs CASCADE;
DROP TABLE IF EXISTS flow_steps CASCADE;
DROP TABLE IF EXISTS flow_theme_choices CASCADE;

-- If the flows table already exists, drop it to recreate with new schema
DROP TABLE IF EXISTS flows CASCADE;

-- Create the comprehensive flows table
CREATE TABLE flows (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Flow metadata  
  title TEXT,
  description TEXT NOT NULL, -- User's slide description from upload step
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
  current_step INTEGER DEFAULT 1, -- Track progress: 1=upload, 2=content, 3=research, 4=theme, 5=preview, 6=download
  
  -- STEP 1: Upload & Documents Data
  documents JSONB DEFAULT '[]'::jsonb, -- [{"name": "file.pdf", "size": 1024, "type": "pdf"}]
  parsed_documents JSONB DEFAULT '[]'::jsonb, -- [{"filename": "file.pdf", "content": "...", "success": true}]
  selected_model TEXT DEFAULT 'gpt-4', -- 'gpt-4' | 'gpt-5-2025-08-07'
  
  -- STEP 2: Content Planning Data
  content_plan TEXT, -- AI-generated content structure and recommendations  
  user_feedback TEXT, -- User's additional requirements and modifications
  content_plan_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- STEP 3: Research Data
  wants_research BOOLEAN DEFAULT false, -- User chose to include research
  research_options JSONB DEFAULT '{
    "maxResults": 4,
    "includeImages": true, 
    "includeAnswer": "advanced",
    "timeRange": "month",
    "excludeSocial": true
  }'::jsonb,
  research_data TEXT, -- Raw research results from Tavily API
  research_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- STEP 4: Theme & Design Data  
  selected_theme TEXT, -- Template ID from examples or user templates
  selected_palette JSONB DEFAULT '[]'::jsonb, -- ["#980000", "#111111", "#333333", "#b3b3b3", "#ffffff"]
  theme_customizations JSONB DEFAULT '{}'::jsonb, -- Any additional theme mods
  palette_mode TEXT CHECK (palette_mode IN ('logo', 'ai', 'manual')), -- How palette was generated
  
  -- STEP 5: Generated Content Data
  slide_html TEXT, -- Generated HTML (legacy support)
  slide_json JSONB, -- Generated Fabric.js slide definition (primary format)
  generation_prompt TEXT, -- Debug: exact prompt sent to AI model
  generation_metadata JSONB DEFAULT '{
    "model_used": null,
    "tokens_consumed": 0, 
    "generation_time_ms": 0,
    "api_version": null
  }'::jsonb,
  slide_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- STEP 6: Output & Sharing Data
  download_history JSONB DEFAULT '[]'::jsonb, -- [{"type": "pptx", "downloaded_at": "2025-01-14T10:00:00Z"}]
  share_links JSONB DEFAULT '[]'::jsonb, -- [{"url": "https://...", "created_at": "..."}]
  exports_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Workflow & Performance Tracking
  step_timestamps JSONB DEFAULT '{}'::jsonb, -- {"step_1": "2025-01-14T10:00:00Z", "step_2": "..."}
  error_logs JSONB DEFAULT '[]'::jsonb, -- [{"step": 2, "error": "...", "timestamp": "..."}]
  total_generation_time INTEGER DEFAULT 0, -- Total time in milliseconds
  api_calls_made JSONB DEFAULT '{
    "content_planning": 0,
    "research": 0, 
    "slide_generation": 0,
    "color_generation": 0
  }'::jsonb,
  
  -- Validation constraints
  CONSTRAINT valid_step CHECK (current_step >= 1 AND current_step <= 6),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'in_progress', 'completed', 'archived'))
);

-- Create indexes for performance
CREATE INDEX idx_flows_user_id ON flows(user_id);
CREATE INDEX idx_flows_status ON flows(status);
CREATE INDEX idx_flows_created_at ON flows(created_at DESC);
CREATE INDEX idx_flows_current_step ON flows(current_step);
CREATE INDEX idx_flows_updated_at ON flows(updated_at DESC);
CREATE INDEX idx_flows_title_search ON flows USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '')));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_flows_updated_at 
    BEFORE UPDATE ON flows 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own flows
CREATE POLICY "Users can view own flows" 
    ON flows FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flows" 
    ON flows FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flows" 
    ON flows FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flows" 
    ON flows FOR DELETE 
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON flows TO authenticated;
GRANT ALL ON flows TO service_role;

-- Create a view for easier querying of active flows
CREATE VIEW active_flows AS
SELECT 
  id,
  user_id,
  title,
  description,
  status,
  current_step,
  created_at,
  updated_at,
  -- Extract some useful computed fields
  (documents->0->>'name') as first_document_name,
  jsonb_array_length(COALESCE(documents, '[]'::jsonb)) as document_count,
  (step_timestamps->>'step_' || current_step::text) as current_step_completed_at,
  CASE 
    WHEN status = 'completed' THEN 100
    WHEN current_step = 6 THEN 90
    WHEN current_step = 5 THEN 75
    WHEN current_step = 4 THEN 60
    WHEN current_step = 3 THEN 45
    WHEN current_step = 2 THEN 30
    ELSE 15
  END as progress_percentage
FROM flows 
WHERE status != 'archived';

-- Grant access to the view
GRANT SELECT ON active_flows TO authenticated;
GRANT SELECT ON active_flows TO service_role;

COMMIT;