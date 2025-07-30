# Database Debugging Guide for Supabase Edge Functions

## Overview
This guide helps you debug "Failed to create session in database" errors in your Supabase Edge Functions.

## Common Causes and Solutions

### 1. Database Schema Issues

**Check if migration was applied:**
```bash
# Start Supabase locally
supabase start

# Check migration status
supabase db reset

# Or apply specific migration
supabase db reset --schema-only
```

**Validate schema manually:**
```sql
-- Run the validation script
\i scripts/validate-database-schema.sql
```

### 2. Database Connection Issues

**Verify environment variables:**
- `SUPABASE_URL` - Should point to your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Should be the service role key, not anon key

**Test connection in Edge Function:**
```javascript
// Add this test in your function
const { data: testData, error: testError } = await supabase
  .from('auth_sessions')
  .select('count(*)');

console.log('Connection test:', { testData, testError });
```

### 3. Permission Issues

**Service Role Key Issues:**
- Ensure you're using the service role key, not the anon key
- Service role key bypasses RLS policies
- Check that the key has proper permissions

**Row Level Security (RLS):**
If RLS is enabled on auth_sessions table, it might block inserts:
```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'auth_sessions';

-- Disable RLS for testing (not recommended for production)
ALTER TABLE auth_sessions DISABLE ROW LEVEL SECURITY;
```

### 4. Data Validation Issues

**Common data problems:**
- `user_email` is null or empty
- `access_token` or `refresh_token` are null
- `expires_at` is not a valid timestamp
- Tokens are too long for TEXT fields (unlikely but possible)

### 5. Unique Constraint Violations

**Handling duplicate sessions:**
The updated code now checks for existing sessions and updates them instead of creating duplicates.

## Debugging Steps

### Step 1: Check Logs
With the enhanced error logging, check your Edge Function logs for:
- Database error codes (23505, 23502, 42501, 42P01)
- Detailed error messages
- Data validation information

### Step 2: Test Database Connection
```bash
# Connect to local database
supabase db connect

# Or use psql directly
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

### Step 3: Manual Data Testing
```sql
-- Test manual insert
INSERT INTO auth_sessions (
    user_email,
    access_token,
    refresh_token,
    expires_at
) VALUES (
    'debug@test.com',
    'debug_access_token_' || gen_random_uuid(),
    'debug_refresh_token_' || gen_random_uuid(),
    NOW() + INTERVAL '1 hour'
);
```

### Step 4: Check Service Role Permissions
```sql
-- Check current role and permissions
SELECT current_user, current_database();

-- Test table access
SELECT * FROM auth_sessions LIMIT 1;
```

## Error Code Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| 23505 | Unique constraint violation | Handle existing sessions |
| 23502 | Not null constraint violation | Validate required fields |
| 42501 | Insufficient privilege | Check service role key |
| 42P01 | Undefined table | Apply database migrations |
| 08003 | Connection not available | Check database connection |

## Testing Your Fixes

### 1. Test Edge Function Locally
```bash
# Serve functions locally
supabase functions serve

# Test OAuth exchange
curl -X POST http://127.0.0.1:54321/functions/v1/husqvarna-oauth-exchange \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"code":"test_code"}'
```

### 2. Monitor Database
```sql
-- Watch for new sessions
SELECT * FROM auth_sessions ORDER BY created_at DESC LIMIT 5;

-- Check for errors in logs
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

## Prevention

### 1. Robust Error Handling
The updated code includes:
- Detailed error logging
- Specific error messages
- Graceful handling of duplicate sessions

### 2. Data Validation
Always validate:
- Required fields are present
- Data types match schema
- String lengths are within limits

### 3. Connection Pooling
For production, consider:
- Connection pooling settings
- Timeout configurations
- Retry logic for transient failures

## Next Steps

1. Deploy the updated Edge Function code
2. Test with the enhanced error logging
3. Run the database validation script
4. Monitor logs for specific error details
5. Apply fixes based on the specific error codes you receive

The enhanced error logging will now give you much more specific information about what's causing the database insertion to fail.