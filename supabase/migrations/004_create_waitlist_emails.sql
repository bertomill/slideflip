-- Simple table to collect early‑access emails
CREATE TABLE IF NOT EXISTS waitlist_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make emails unique to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unique_email ON waitlist_emails(email);

