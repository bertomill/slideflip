-- Simple diagnostic queries for Supabase auth issue
-- Run these one by one to identify the problem

-- 1. Check if auth schema exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'auth'
) as auth_schema_exists;

-- 2. Check if users table exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
) as users_table_exists;

-- 3. Check basic table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
AND column_name IN ('id', 'email', 'encrypted_password', 'created_at')
ORDER BY column_name;

-- 4. Check if you can query the table (permission test)
SELECT COUNT(*) as user_count FROM auth.users;

-- 5. Check current user and permissions
SELECT current_user, current_database();

-- 6. Check if email provider is enabled (may need dashboard access)
-- This checks if there are any auth settings
SELECT COUNT(*) FROM auth.schema_migrations;

-- 7. Try to check Supabase project settings
-- Note: Email confirmation settings are in Dashboard > Authentication > Email Auth
-- Check if "Confirm email" is enabled/disabled

-- 8. Test if we can see error logs
SELECT id, created_at, ip_address, payload->>'error' as error_message
FROM auth.audit_log_entries 
WHERE payload->>'error' IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 9. Check for any custom database functions that might interfere
SELECT proname, pronamespace::regnamespace 
FROM pg_proc 
WHERE pronamespace::regnamespace::text = 'auth'
AND proname LIKE '%user%'
LIMIT 10;