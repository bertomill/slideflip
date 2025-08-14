-- Check for ANY recent auth errors in the audit log
SELECT 
    created_at,
    payload->>'action' as action,
    payload->>'email' as email,
    payload->>'error' as error,
    payload->>'error_code' as error_code,
    payload->>'error_description' as error_desc,
    payload->>'msg' as message,
    payload->>'status' as status,
    payload::text as full_payload
FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '2 hours'
AND (
    payload->>'error' IS NOT NULL 
    OR payload->>'error_code' IS NOT NULL
    OR payload->>'status' = 'error'
    OR payload->>'action' LIKE '%signup%'
    OR payload->>'action' LIKE '%sign_up%'
)
ORDER BY created_at DESC
LIMIT 30;

-- Also check for ANY events with your email
SELECT 
    created_at,
    payload->>'action' as action,
    payload->>'error' as error,
    payload::text as full_payload
FROM auth.audit_log_entries 
WHERE payload::text LIKE '%robertvincentmill@gmail.com%'
ORDER BY created_at DESC
LIMIT 10;