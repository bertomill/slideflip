-- Add new columns to slide_templates table for Fabric.js support
ALTER TABLE slide_templates 
ADD COLUMN IF NOT EXISTS fabric_json JSONB,
ADD COLUMN IF NOT EXISTS preview_image TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_slide_templates_updated_at ON slide_templates(updated_at DESC);

-- Add comment explaining the columns
COMMENT ON COLUMN slide_templates.fabric_json IS 'Fabric.js native JSON format for re-editing templates';
COMMENT ON COLUMN slide_templates.slide_json IS 'PptxGenJS-compatible JSON format for PPTX export';
COMMENT ON COLUMN slide_templates.preview_image IS 'Base64 encoded PNG preview of the template';

-- Update existing templates to have updated_at
UPDATE slide_templates 
SET updated_at = created_at 
WHERE updated_at IS NULL;