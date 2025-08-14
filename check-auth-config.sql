-- Check specific auth configuration issues

-- 1. Check if the email you're trying already exists
SELECT email, created_at, last_sign_in_at, email_confirmed_at
FROM auth.users
WHERE email = 'robertvincentmill@gmail.com'
LIMIT 1;

-- 2. Check recent failed signup attempts
SELECT 
    created_at,
    ip_address,
    payload->>'email' as email,
    payload->>'error' as error,
    payload->>'error_code' as error_code,
    payload->>'msg' as message
FROM auth.audit_log_entries 
WHERE payload->>'action' = 'signup'
AND payload->>'error' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check all recent auth events for your email
SELECT 
    created_at,
    payload->>'action' as action,
    payload->>'error' as error,
    payload->>'msg' as message
FROM auth.audit_log_entries 
WHERE payload->>'email' = 'robertvincentmill@gmail.com'
OR payload->>'actor_username' = 'robertvincentmill@gmail.com'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if there are any unique constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass
AND contype = 'u';

-- 5. List all users created in last hour to see if ANY signups work
SELECT email, created_at, email_confirmed_at
FROM auth.users
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 6. Check auth settings (config table doesn't exist in this version)
-- Settings are managed in Supabase Dashboard > Authentication

-- 7. Try to manually insert a test user (ROLLBACK after test)
BEGIN;
-- Generate unique test email with timestamp
DO $$
DECLARE
    test_email text := 'test_' || extract(epoch from now())::text || '@example.com';
BEGIN
    RAISE NOTICE 'Attempting to insert user with email: %', test_email;
    
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        test_email,
        crypt('TestPassword123!', gen_salt('bf')),
        NOW(), -- confirm email immediately
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Insert successful for email: %', test_email;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting user: % - %', SQLSTATE, SQLERRM;
END $$;

-- Check if the test user was created
SELECT email, created_at 
FROM auth.users 
WHERE email LIKE 'test_%@example.com'
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK; -- Always rollback the test

-- 8. Final check - show Supabase version info
SELECT version();