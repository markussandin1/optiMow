# Edge Functions Overview - OptiMow v3

## Function Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Cron Job      │───▶│ scheduled-       │───▶│ mower-discovery     │
│   (every 5min)  │    │ collection       │    │ (main data func)    │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                                           │
                                                           ▼
                                                ┌─────────────────────┐
                                                │ PostgreSQL          │
                                                │ epos_data_snapshots │
                                                └─────────────────────┘
```

## Function Details

### 1. `mower-discovery` 
**File**: `supabase/functions/mower-discovery/index.ts`  
**Status**: ✅ Active & Working  
**Purpose**: Primary data collection function

#### What it does:
1. **Authentication**: Uses session from `auth_sessions` table
2. **API Call**: Fetches all mower data from Husqvarna Connect API
3. **Data Mapping**: Transforms API response to our database schema
4. **Storage**: Inserts snapshot into `epos_data_snapshots`
5. **Profile Updates**: Updates mower profiles if needed

#### Key API Endpoints Used:
- `GET /v1/mowers` - Main mower data endpoint

#### Critical Data Mappings:
```typescript
// Husqvarna API → Database Field
mower.activity                    → activity
mower.workAreaId                 → current_work_area_id  ⭐ CRITICAL
battery.batteryPercent           → battery_level
workAreas[]                      → work_areas (JSON)
workAreas[].lastTimeCompleted    → work_areas[].lastTimeCompleted ⭐ CRITICAL
metadata.statusTimestamp         → status_timestamp
statistics.totalCuttingTime      → total_cutting_time
```

#### Trigger Methods:
```bash
# Manual trigger (for testing)
curl -X POST "https://jodjyhhxvirpzhmubyxq.supabase.co/functions/v1/mower-discovery" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "AUTO", "collectionMethod": "manual"}'

# Automated trigger (via cron)
# Happens automatically every 5 minutes
```

#### Error Handling:
- **401 Unauthorized**: Token expired, function logs error
- **400 Bad Request**: API call failed, logs Husqvarna error
- **Database Errors**: Logged but don't break the main flow
- **Duplicates**: Handled via PostgreSQL unique constraints

### 2. `scheduled-collection`
**File**: `supabase/functions/scheduled-collection/index.ts`  
**Status**: ✅ Active (calls mower-discovery)  
**Purpose**: Cron job wrapper function

#### What it does:
1. **Validates Environment**: Checks Supabase configuration
2. **Delegates**: Calls `mower-discovery` function
3. **Logging**: Provides structured logging for cron monitoring

#### Cron Configuration:
```sql
-- Runs every 5 minutes
SELECT cron.schedule(
  'final-working-collection',
  '*/5 * * * *',
  'SELECT net.http_post(...)'
);
```

### 3. `auto-resume-monitor`
**File**: `supabase/functions/auto-resume-monitor/index.ts`  
**Status**: ✅ Active (separate feature)  
**Purpose**: Monitors mower errors and auto-resumes mowing

#### What it does:
1. **Error Detection**: Checks for mower error states
2. **Auto-Resume**: Attempts to resume mowing when appropriate
3. **Tracking**: Logs attempts in `auto_resume_attempts` table

### 4. `husqvarna-oauth-exchange`
**File**: `supabase/functions/husqvarna-oauth-exchange/index.ts`  
**Status**: ✅ Active (authentication)  
**Purpose**: Handles OAuth token exchange for Husqvarna API

### 5. `husqvarna-token-refresh`
**File**: `supabase/functions/husqvarna-token-refresh/index.ts`  
**Status**: ✅ Active (authentication)  
**Purpose**: Refreshes expired Husqvarna API tokens

## Deployment & Management

### Deploy Single Function
```bash
supabase functions deploy mower-discovery
```

### Deploy All Functions
```bash
supabase functions deploy
```

### View Function Logs
```typescript
// Via Supabase MCP (preferred in Claude)
mcp__supabase__get_logs(service: "edge-function")

// Via CLI
supabase functions logs mower-discovery
```

### Function Status Check
```sql
-- Check if functions are being called
SELECT 
  event_message,
  timestamp,
  status_code
FROM (
  -- Query function logs via MCP
) 
WHERE event_message LIKE '%mower-discovery%'
ORDER BY timestamp DESC 
LIMIT 5;
```

## Data Collection Flow

### Successful Collection
```
1. Cron triggers scheduled-collection every 5 minutes
2. scheduled-collection calls mower-discovery
3. mower-discovery:
   - Gets valid session from auth_sessions
   - Calls Husqvarna API /v1/mowers
   - Maps response to database schema
   - Inserts into epos_data_snapshots
   - Updates mower_profiles if needed
4. Frontend refetches data every 5 minutes
5. UI updates with new snapshot data
```

### Error Scenarios
```
Authentication Error:
├── Token expired → Logs error, waits for manual refresh
├── Invalid session → Uses fallback session lookup
└── API rate limit → Backs off, logs warning

Database Error:
├── Duplicate snapshot → Handled gracefully (23505 error)
├── Missing column → Function crashes, needs schema update
└── Connection error → Retries, logs error

API Error:
├── 401 Unauthorized → Token refresh needed
├── 400 Bad Request → Invalid request, logs details
├── 429 Rate Limited → Backs off, retries later
└── 500 Server Error → Husqvarna API issue, retries
```

## Function Development Patterns

### Adding New Data Collection
```typescript
// 1. Update interface
interface HusqvarnaMower {
  attributes: {
    newSection?: {
      newField: string;
    };
  };
}

// 2. Add to snapshot data
const snapshotData = {
  // existing fields...
  new_field: mower.attributes.newSection?.newField || null,
}

// 3. Update database schema first!
ALTER TABLE epos_data_snapshots ADD COLUMN new_field text;

// 4. Deploy function
supabase functions deploy mower-discovery
```

### Error Handling Pattern
```typescript
try {
  const { error } = await supabase.from('table').insert(data)
  if (error) {
    if (error.code === '23505') {
      console.log('Duplicate, skipping...')
    } else {
      console.error('Unexpected error:', error)
    }
  } else {
    console.log('✅ Success')
  }
} catch (error) {
  console.error('Critical error:', error)
  // Don't throw - continue with other processing
}
```

### Logging Best Practices
```typescript
// Structured logging
console.log(`Attempting to store EPOS snapshot for mower ${mower.id}:`, {
  mower_name: mower.attributes.system.name,
  activity: snapshotData.activity,
  work_areas_count: snapshotData.work_areas.length,
  current_work_area_id: snapshotData.current_work_area_id,
  collection_method: snapshotData.collection_method
})

// Success/failure indicators
console.log(`✅ Successfully stored EPOS snapshot for mower: ${name}`)
console.error(`❌ Failed to store snapshot for mower ${id}:`, error)
```

## Critical Dependencies

### Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `HUSQVARNA_CLIENT_ID` - Husqvarna API client ID

### Database Dependencies
- `auth_sessions` table - For API authentication
- `mower_profiles` table - For mower information
- `epos_data_snapshots` table - Primary data storage

### External APIs
- **Husqvarna Connect API**: `https://api.amc.husqvarna.dev/v1/mowers`
  - Rate limits: Respect API limits
  - Authentication: OAuth2 Bearer tokens
  - Response format: JSON API specification

## Monitoring & Alerts

### Health Checks
```sql
-- Data freshness check
SELECT 
  mower_id,
  MAX(collected_at) as last_collection,
  NOW() - MAX(collected_at) as minutes_since_last
FROM epos_data_snapshots 
GROUP BY mower_id
HAVING NOW() - MAX(collected_at) > INTERVAL '10 minutes';

-- Function success rate
SELECT 
  date_trunc('hour', start_time) as hour,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful_runs,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'succeeded')::numeric / COUNT(*) * 100, 
    2
  ) as success_rate_percent
FROM cron.job_run_details 
WHERE start_time > NOW() - INTERVAL '24 hours'
GROUP BY 1 
ORDER BY 1 DESC;
```

### Performance Metrics
```sql
-- API response times
SELECT 
  AVG(api_response_time_ms) as avg_response_ms,
  MAX(api_response_time_ms) as max_response_ms,
  COUNT(*) as sample_size
FROM epos_data_snapshots 
WHERE collected_at > NOW() - INTERVAL '1 hour';
```

## Next AI Session Checklist

When working with Edge Functions:

1. ✅ **Check current status**: Use health check queries
2. ✅ **Review recent logs**: Use `mcp__supabase__get_logs`
3. ✅ **Understand data flow**: Reference this document
4. ✅ **Test changes carefully**: Always test database schema changes first
5. ✅ **Monitor after deployment**: Check logs for errors
6. ✅ **Maintain backwards compatibility**: Don't break existing data collection

**Key Files to Reference:**
- `supabase/functions/mower-discovery/index.ts` - Main logic
- `src/lib/database.types.ts` - TypeScript definitions
- `docs/supabase-integration-guide.md` - Complete architecture
- `docs/quick-reference.md` - Common operations