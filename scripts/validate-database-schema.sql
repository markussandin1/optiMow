-- Database Schema Validation Script
-- Run this to check if the auth_sessions table exists and has the correct structure

-- Check if auth_sessions table exists
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename = 'auth_sessions';

-- Check table structure and constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'auth_sessions' 
ORDER BY ordinal_position;

-- Check indexes on auth_sessions table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'auth_sessions';

-- Check constraints
SELECT 
    constraint_name,
    constraint_type,
    table_name,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'auth_sessions';

-- Test basic insert capability (will be rolled back)
BEGIN;
INSERT INTO auth_sessions (
    user_email,
    access_token,
    refresh_token,
    expires_at
) VALUES (
    'test@example.com',
    'test_access_token',
    'test_refresh_token',
    NOW() + INTERVAL '1 hour'
);
ROLLBACK;

-- Check current sessions count
SELECT COUNT(*) as total_sessions FROM auth_sessions;

-- Check for any existing sessions
SELECT 
    session_id,
    user_email,
    expires_at,
    created_at,
    LENGTH(access_token) as access_token_length,
    LENGTH(refresh_token) as refresh_token_length
FROM auth_sessions 
ORDER BY created_at DESC 
LIMIT 5;