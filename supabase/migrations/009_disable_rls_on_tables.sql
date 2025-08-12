-- Disable RLS on tables that should be unrestricted
-- This migration disables Row Level Security for development/testing purposes

-- Disable RLS on flow_theme_choices table
ALTER TABLE public.flow_theme_choices DISABLE ROW LEVEL SECURITY;

-- Disable RLS on flows table
ALTER TABLE public.flows DISABLE ROW LEVEL SECURITY;

-- Disable RLS on slide_documents table (if RLS was enabled)
ALTER TABLE public.slide_documents DISABLE ROW LEVEL SECURITY;

-- Note: The following tables already have RLS disabled in your screenshot:
-- - pptx_html_examples (already unrestricted)
-- - slide_templates (already unrestricted)
-- - waitlist_emails (already unrestricted)