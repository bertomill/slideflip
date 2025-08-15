-- Run these queries one by one to diagnose the issue

-- 1. CHECK IF YOUR EMAIL ALREADY EXISTS
SELECT id, email, created_at, email_confirmed_at, last_sign_in_at
FROM auth.users
WHERE email = 'robertvincentmill@gmail.com';

-- 2. CHECK RECENT SIGNUP ERRORS (MOST IMPORTANT!)
SELECT 
    created_at,
    payload->>'email' as email,
    payload->>'error' as error,
    payload->>'error_code' as error_code,
    payload->>'msg' as message,
    payload->>'status' as status
FROM auth.audit_log_entries 
WHERE (payload->>'action' = 'signup' OR payload->>'action' = 'user_signup')
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- 3. CHECK ALL RECENT AUTH EVENTS
SELECT 
    created_at,
    payload->>'action' as action,
    payload->>'email' as email,
    payload->>'error' as error
FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 20;

-- 4. SEE WHO CAN SUCCESSFULLY SIGN UP
SELECT email, created_at, email_confirmed_at
FROM auth.users
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;