# Supabase Integration Guide - OptiMow v3

## Overview
OptiMow v3 uses Supabase as its backend with Edge Functions for data collection and PostgreSQL for data storage. This guide explains the complete data flow and how to work with the system.

## Architecture Overview

```
Husqvarna API → Supabase Edge Functions → PostgreSQL Database → Frontend
```

### Key Principles
1. **Server-First**: All Husqvarna API calls via Supabase Edge Functions only
2. **Single Source of Truth**: All data flows through Supabase database
3. **No Client-Side API Calls**: Frontend only reads from database
4. **Automated Collection**: Cron jobs handle scheduled data collection

## Database Schema

### Core Tables

#### `auth_sessions`
Stores secure authentication tokens for Husqvarna API access.
```sql
- session_id (uuid, PK)
- user_email (text)
- access_token (text)
- refresh_token (text) 
- expires_at (timestamptz)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `mower_profiles`  
Stores mower information linked to authenticated sessions.
```sql
- id (uuid, PK)
- session_id (uuid, FK to auth_sessions)
- husqvarna_id (text, unique)
- name (text)
- model (text)
- created_at (timestamptz)
```

#### `epos_data_snapshots`
**The main data table** - stores EPOS mower data snapshots collected every 5 minutes.
```sql
- id (uuid, PK)
- mower_id (text, FK to mower_profiles.husqvarna_id)
- activity (text) - Current activity: MOWING, CHARGING, GOING_HOME, etc.
- mode (text) - Mower mode
- state (text) - Mower state
- battery_level (integer) - Battery percentage (0-100)
- error_code (integer) - Current error code (0 = no error)
- work_areas (jsonb) - Array of work areas with progress
- total_cutting_time (integer) - Cumulative cutting time in seconds
- total_running_time (integer) - Total running time in seconds
- total_charging_time (integer) - Total charging time in seconds
- latitude (numeric) - GPS latitude
- longitude (numeric) - GPS longitude
- collected_at (timestamptz) - When data was collected from API
- api_response_time_ms (integer) - API response time for monitoring
- collection_method (text) - 'scheduled' or 'manual'
- created_at (timestamptz)
- status_timestamp (bigint) - UTC timestamp for last status update from Husqvarna
- last_error_timestamp (bigint) - Timestamp for last error from Husqvarna
- current_work_area_id (integer) - ID of work area currently being worked on
```

### Work Areas Structure (JSON)
The `work_areas` field contains an array of work area objects:
```json
[
  {
    "id": 22768,
    "name": "Framsida",
    "enabled": true,
    "progress": 7,
    "cutting_height": 37,
    "lastTimeCompleted": null
  }
]
```

## Edge Functions

### 1. `mower-discovery` (Primary Data Collection)
**Location**: `supabase/functions/mower-discovery/index.ts`
**Purpose**: Collects all mower data from Husqvarna API and stores snapshots

#### What it does:
1. Authenticates with stored session tokens
2. Calls Husqvarna Connect API `/v1/mowers`
3. Maps API response to our database schema
4. Stores snapshot in `epos_data_snapshots`
5. Updates mower profiles if needed

#### Key API Fields Collected:
- `mower.activity` → `activity`
- `mower.workAreaId` → `current_work_area_id` (CRITICAL for showing active area)
- `battery.batteryPercent` → `battery_level`
- `workAreas[]` → `work_areas` (with `lastTimeCompleted` for area timing)
- `metadata.statusTimestamp` → `status_timestamp`

#### Manual Trigger:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/mower-discovery" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "collectionMethod": "manual"}'
```

### 2. `scheduled-collection` (Cron Trigger)
**Location**: `supabase/functions/scheduled-collection/index.ts`  
**Purpose**: Wrapper that calls `mower-discovery` automatically

## Automated Data Collection

### Cron Job Configuration
Data is collected automatically every 5 minutes via PostgreSQL cron:

```sql
SELECT cron.schedule(
  'final-working-collection',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/mower-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'YOUR_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'sessionId', 'AUTO',
      'collectionMethod', 'scheduled'
    )
  );
  $$
);
```

### Monitoring Cron Jobs
```sql
-- Check active cron jobs
SELECT jobname, schedule, active FROM cron.job;

-- Check recent job runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
```

## Data Flow Examples

### Getting Latest Mower Data
```sql
SELECT 
  collected_at,
  activity,
  battery_level,
  current_work_area_id,
  work_areas
FROM epos_data_snapshots 
WHERE mower_id = 'YOUR_MOWER_ID'
ORDER BY collected_at DESC 
LIMIT 1;
```

### Finding Active Work Area
```sql
SELECT 
  wa.value->>'name' as area_name,
  wa.value->>'progress' as progress
FROM epos_data_snapshots e,
     jsonb_array_elements(e.work_areas) wa
WHERE e.mower_id = 'YOUR_MOWER_ID'
  AND (wa.value->>'id')::integer = e.current_work_area_id
ORDER BY e.collected_at DESC 
LIMIT 1;
```

## Frontend Integration

### React Query Setup
The frontend uses React Query to fetch data from Supabase:

```typescript
// Fetch recent snapshots
const { data: snapshots } = useQuery({
  queryKey: ['epos-snapshots', mowerId, timeRange],
  queryFn: async () => {
    const { startDate, endDate } = getDateRange()
    return eposService.getSnapshotsInRange(mowerId, startDate, endDate)
  },
  refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
})
```

### Data Service Layer
**Location**: `src/services/epos.ts`

```typescript
export class EposService {
  async getSnapshotsInRange(
    mowerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EposDataSnapshotWithWorkAreas[]> {
    const { data, error } = await supabase
      .from('epos_data_snapshots')
      .select('*')
      .eq('mower_id', mowerId)
      .gte('collected_at', startDate.toISOString())
      .lte('collected_at', endDate.toISOString())
      .order('collected_at', { ascending: false })

    if (error) throw error

    return data.map(snapshot => ({
      ...snapshot,
      work_areas: Array.isArray(snapshot.work_areas) 
        ? (snapshot.work_areas as unknown as WorkArea[]) 
        : []
    }))
  }
}
```

## Adding New Data Points

### Step 1: Update Husqvarna API Interface
Add new fields to the TypeScript interface in Edge Function:

```typescript
interface HusqvarnaMower {
  attributes: {
    mower: {
      // existing fields...
      newField?: string; // Add new field here
    };
  };
}
```

### Step 2: Update Database Schema
Add column to `epos_data_snapshots`:

```sql
ALTER TABLE epos_data_snapshots 
ADD COLUMN new_field_name TYPE_HERE NULL 
COMMENT 'Description of the new field';
```

### Step 3: Update Edge Function Mapping
In `mower-discovery/index.ts`, add to `snapshotData`:

```typescript
const snapshotData = {
  // existing fields...
  new_field_name: mower.attributes.mower?.newField || null,
}
```

### Step 4: Update TypeScript Types
In `src/lib/database.types.ts`:

```typescript
export interface Database {
  public: {
    Tables: {
      epos_data_snapshots: {
        Row: {
          // existing fields...
          new_field_name: string | null
        }
      }
    }
  }
}
```

### Step 5: Deploy Edge Function
```bash
supabase functions deploy mower-discovery
```

## Troubleshooting

### Common Issues

#### Data Not Collecting
1. Check cron job status:
```sql
SELECT * FROM cron.job WHERE jobname = 'final-working-collection';
```

2. Check Edge Function logs:
```sql
-- Via Supabase MCP
mcp__supabase__get_logs(service: "edge-function")
```

3. Check for authentication issues:
```sql
SELECT session_id, expires_at, expires_at < NOW() as is_expired 
FROM auth_sessions;
```

#### Database Errors
- **Column doesn't exist**: Update database schema before deploying Edge Function
- **Type mismatch**: Ensure TypeScript types match database schema
- **Constraint violations**: Check for duplicate prevention logic

### Data Quality Checks
```sql
-- Check data collection frequency
SELECT 
  DATE_TRUNC('hour', collected_at) as hour,
  COUNT(*) as snapshots_count
FROM epos_data_snapshots 
WHERE collected_at > NOW() - INTERVAL '24 hours'
GROUP BY 1 
ORDER BY 1 DESC;

-- Check for missing work area data
SELECT COUNT(*) as missing_work_areas
FROM epos_data_snapshots 
WHERE work_areas = '[]'::jsonb 
  AND collected_at > NOW() - INTERVAL '1 hour';
```

## Performance Considerations

### Database Indexing
Key indexes for optimal performance:

```sql
-- Primary indexes for data retrieval
CREATE INDEX idx_epos_mower_collected ON epos_data_snapshots(mower_id, collected_at DESC);
CREATE INDEX idx_epos_activity ON epos_data_snapshots(activity) WHERE activity = 'MOWING';
CREATE INDEX idx_epos_current_work_area ON epos_data_snapshots(current_work_area_id) WHERE current_work_area_id IS NOT NULL;
```

### Data Retention
Consider implementing data retention for older snapshots:

```sql
-- Clean up old snapshots (keep last 30 days)
DELETE FROM epos_data_snapshots 
WHERE collected_at < NOW() - INTERVAL '30 days';
```

## Security Notes

1. **Service Role Key**: Never expose in client code, only in Edge Functions
2. **Session Management**: Tokens expire and need refresh handling
3. **Rate Limiting**: Husqvarna API has rate limits, respect them
4. **Data Privacy**: All user data is properly isolated by session_id

## Next Phase: Session Detection

For implementing session detection and performance measurement:

1. **Use `lastTimeCompleted`** changes to detect area completions
2. **Track `current_work_area_id`** changes for session boundaries  
3. **Monitor `activity`** changes for start/stop detection
4. **Calculate performance metrics** from time differences

This foundation supports all advanced analytics and performance measurement needs.