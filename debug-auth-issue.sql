-- Debug SQL commands for Supabase auth issue
-- Run these in your Supabase SQL Editor to diagnose the signup problem

-- ============================================
-- 1. CHECK AUTH SCHEMA AND TABLES
-- ============================================
SELECT 'Checking auth schema...' as step;
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'auth';

SELECT 'Checking auth.users table...' as step;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth' AND table_name = 'users';

-- ============================================
-- 2. CHECK AUTH.USERS TABLE STRUCTURE
-- ============================================
SELECT 'Auth.users table structure:' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- ============================================
-- 3. CHECK FOR CONSTRAINTS
-- ============================================
SELECT 'Checking constraints on auth.users:' as step;
SELECT 
    con.conname as constraint_name,
    con.contype as constraint_type,
    pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
JOIN pg_namespace nsp ON nsp.oid = con.connamespace
JOIN pg_class cls ON cls.oid = con.conrelid
WHERE nsp.nspname = 'auth' AND cls.relname = 'users';

-- ============================================
-- 4. CHECK TRIGGERS
-- ============================================
SELECT 'Checking triggers on auth.users:' as step;
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'auth' 
AND event_object_table = 'users';

-- ============================================
-- 5. CHECK RLS POLICIES
-- ============================================
SELECT 'Checking RLS policies:' as step;
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd, 
    qual,
    with_check 
FROM pg_policies 
WHERE schemaname = 'auth' AND tablename = 'users';

-- ============================================
-- 6. CHECK IF RLS IS ENABLED
-- ============================================
SELECT 'Checking if RLS is enabled:' as step;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'auth' AND tablename = 'users';

-- ============================================
-- 7. CHECK AUTH CONFIGURATION
-- ============================================
SELECT 'Checking auth configuration:' as step;
SELECT * FROM auth.config LIMIT 10;

-- ============================================
-- 8. CHECK FOR RECENT ERRORS (if you have access to logs)
-- ============================================
SELECT 'Recent auth errors (if accessible):' as step;
-- This might not work depending on your permissions
-- SELECT * FROM auth.audit_log_entries 
-- WHERE created_at > NOW() - INTERVAL '1 hour'
-- AND payload::text LIKE '%error%'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- ============================================
-- 9. TEST ANONYMOUS USER PERMISSIONS
-- ============================================
SELECT 'Testing current user permissions:' as step;
SELECT current_user, session_user, current_database();

-- ============================================
-- 10. CHECK IF EMAIL CONFIRMATION IS REQUIRED
-- ============================================
SELECT 'Checking email confirmation settings:' as step;
-- Check if email confirmation is enforced
-- This setting might be in your Supabase dashboard under Auth settings

-- ============================================
-- 11. MANUAL TEST (DO NOT RUN IN PRODUCTION)
-- ============================================
-- Uncomment and modify to test manual insert
-- BEGIN;
-- INSERT INTO auth.users (
--     id,
--     email,
--     encrypted_password,
--     email_confirmed_at,
--     created_at,
--     updated_at,
--     instance_id,
--     aud,
--     role
-- ) VALUES (
--     gen_random_uuid(),
--     'test_' || extract(epoch from now()) || '@example.com',
--     crypt('TestPassword123!', gen_salt('bf')),
--     NOW(), -- Set email as confirmed
--     NOW(),
--     NOW(),
--     '00000000-0000-0000-0000-000000000000',
--     'authenticated',
--     'authenticated'
-- );
-- ROLLBACK; -- Always rollback test transactions

-- ============================================
-- 12. CHECK SUPABASE PROJECT SETTINGS
-- ============================================
-- Note: Some settings can only be checked in the Supabase Dashboard:
-- 1. Go to Authentication > Providers and check if Email is enabled
-- 2. Go to Authentication > Email Templates and check settings
-- 3. Go to Authentication > URL Configuration and verify redirect URLs
-- 4. Check if "Enable email confirmations" is turned ON/OFF
-- 5. Check rate limiting settings

-- ============================================
-- OUTPUT SUMMARY
-- ============================================
SELECT 'Debug complete. Check results above for any issues.' as summary;