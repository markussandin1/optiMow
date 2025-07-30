# Edge Function Authentication from Database Functions

## Problem
Database functions calling Supabase Edge Functions via HTTP extension were failing with `HTTP 401 - Invalid JWT` when using anon key.

## Root Cause
- **Anon key** is designed for client-side authentication with limited privileges
- **Database functions** are server-side and need **service role key** for full access
- Missing proper headers for Edge Function authentication

## Solution 1: Service Role Key Authentication

### Get Your Service Role Key
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (not anon key)
3. This key has full database access and can call Edge Functions

### Update Database Function
```sql
-- Correct authentication headers for database → Edge Function calls
SELECT content FROM http((
  'POST',
  'https://YOUR_PROJECT_ID.supabase.co/functions/v1/your-function',
  ARRAY[
    http_header('Content-Type', 'application/json'),
    http_header('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
    http_header('apikey', 'YOUR_SERVICE_ROLE_KEY')
  ],
  'application/json',
  '{"your": "payload"}'
));
```

### Security Best Practices
- Store service role key in secure configuration table (see migration `20250726000006_secure_edge_function_auth.sql`)
- Use `SECURITY DEFINER` functions to control access
- Enable RLS on configuration tables

## Solution 2: Alternative Architectures

### Option A: Direct Database Operations (Recommended)
Instead of Edge Function calls, implement data collection logic directly in database:

```sql
-- Direct database approach - no HTTP calls needed
CREATE OR REPLACE FUNCTION collect_mower_data_direct(session_id TEXT)
RETURNS void AS $$
BEGIN
  -- Implement data collection logic directly in SQL
  -- Use stored session tokens to make API calls via pl/pgsql
  -- Insert results directly into database tables
END;
$$ LANGUAGE plpgsql;
```

### Option B: Webhook Architecture
- Set up external webhook service (Vercel, Netlify Functions)
- Trigger webhooks from cron jobs
- Webhooks call Edge Functions with proper authentication

### Option C: Edge Function Cron
- Move cron logic into Edge Functions themselves
- Use Supabase Cron to call a "coordinator" Edge Function
- Coordinator calls other Edge Functions internally

## Current Implementation Status

### Fixed Files
- `/supabase/migrations/20250726000004_setup_automated_collection.sql` - Updated with placeholder for service key
- `/supabase/migrations/20250726000006_secure_edge_function_auth.sql` - Secure authentication approach

### Required Actions
1. Get your actual service role key from Supabase dashboard
2. Update the `edge_function_config` table with your real service key:
   ```sql
   UPDATE edge_function_config 
   SET key_value = 'YOUR_ACTUAL_SERVICE_ROLE_KEY' 
   WHERE key_name = 'service_role_key';
   ```
3. Run the migration to update your cron job

### Authentication Headers Reference
```typescript
// Correct headers for Edge Function calls
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${serviceRoleKey}`,
  'apikey': serviceRoleKey
};
```

## Testing Authentication

### Test Edge Function Call
```sql
-- Test the authentication in SQL
SELECT 
  status,
  content,
  headers
FROM http((
  'GET',
  'https://jodjyhhxvirpzhmubyxq.supabase.co/functions/v1/mower-discovery',
  ARRAY[
    http_header('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
    http_header('apikey', 'YOUR_SERVICE_ROLE_KEY')
  ],
  NULL,
  NULL
));
```

Expected result: `status = 200` or appropriate response from your function.

## Key Differences: Anon vs Service Role

| Key Type | Use Case | Privileges | Edge Function Access |
|----------|----------|------------|---------------------|
| Anon Key | Client-side | Limited RLS | Limited |
| Service Role | Server-side | Full database | Full access |

**Important**: Never expose service role key in client-side code - it has full database access.