-- Create table for storing parsed document content
CREATE TABLE IF NOT EXISTS slide_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient session-based queries
CREATE INDEX IF NOT EXISTS idx_slide_documents_session_id ON slide_documents(session_id);

-- Create index for filename searches
CREATE INDEX IF NOT EXISTS idx_slide_documents_filename ON slide_documents(filename);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE slide_documents ENABLE ROW LEVEL SECURITY;

-- Optional: Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_slide_documents_updated_at 
    BEFORE UPDATE ON slide_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();