-- Update slide_templates schema to support Fabric.js/PptxGenJS JSON templates

-- 1) Add JSONB column for slide definition (non-breaking; keep html_content for legacy)
ALTER TABLE IF EXISTS slide_templates
ADD COLUMN IF NOT EXISTS slide_json JSONB;

-- 2) Helpful GIN index for querying by keys (optional, safe if column empty)
CREATE INDEX IF NOT EXISTS idx_slide_templates_slide_json ON slide_templates USING GIN (slide_json);

-- 3) Ensure is_active defaults to true for new records
ALTER TABLE IF EXISTS slide_templates
ALTER COLUMN is_active SET DEFAULT true;

-- 3b) Make name unique to support idempotent upserts by name
-- Use a partial unique index or constraint; attempt to add unique constraint on name if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'slide_templates' AND constraint_name = 'slide_templates_name_key'
  ) THEN
    ALTER TABLE slide_templates ADD CONSTRAINT slide_templates_name_key UNIQUE (name);
  END IF;
END
$$;

-- 4) Touch updated_at on modification
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_slide_templates_updated_at ON slide_templates;
CREATE TRIGGER trg_slide_templates_updated_at
BEFORE UPDATE ON slide_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


