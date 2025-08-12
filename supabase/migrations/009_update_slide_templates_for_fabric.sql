-- Update slide_templates schema to support Fabric.js/PptxGenJS JSON templates

-- 1) Add JSONB column for slide definition (non-breaking; keep html_content for legacy)
ALTER TABLE IF EXISTS slide_templates
ADD COLUMN IF NOT EXISTS slide_json JSONB;

-- 2) Helpful GIN index for querying by keys (optional, safe if column empty)
CREATE INDEX IF NOT EXISTS idx_slide_templates_slide_json ON slide_templates USING GIN (slide_json);

-- 3) Ensure is_active defaults to true for new records
ALTER TABLE IF EXISTS slide_templates
ALTER COLUMN is_active SET DEFAULT true;

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


