-- Table to store curated PPTX/HTML example pairs with normalized schema
CREATE TABLE IF NOT EXISTS pptx_html_examples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id TEXT NOT NULL, -- e.g., 'imported-02'
  name TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  aspect_ratio TEXT DEFAULT '16:9',
  html TEXT NOT NULL,                -- 1:1 HTML preview content
  schema_json JSONB NOT NULL,        -- normalized schema (our TemplateSchema extension)
  pptx_url TEXT,                     -- optional: link to PPTX in storage
  preview_url TEXT,                  -- optional: PNG/JPG preview in storage
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pptx_html_examples_template_id ON pptx_html_examples(template_id);
CREATE INDEX IF NOT EXISTS idx_pptx_html_examples_tags ON pptx_html_examples USING GIN(tags);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column_examples()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pptx_html_examples_updated_at
  BEFORE UPDATE ON pptx_html_examples
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column_examples();

