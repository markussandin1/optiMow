# Quick Reference - OptiMow v3 Data Operations

## Common Tasks

### 🔍 Check Current Data Collection Status
```sql
-- Latest snapshots
SELECT 
  collected_at,
  activity,
  battery_level,
  current_work_area_id,
  collection_method
FROM epos_data_snapshots 
ORDER BY collected_at DESC 
LIMIT 5;

-- Data collection frequency check
SELECT 
  COUNT(*) as snapshots_last_hour,
  MAX(collected_at) as latest_collection
FROM epos_data_snapshots 
WHERE collected_at > NOW() - INTERVAL '1 hour';
```

### 🔧 Trigger Manual Data Collection
```bash
# Via curl (replace YOUR_PROJECT and YOUR_SERVICE_ROLE_KEY)
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/mower-discovery" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "AUTO", "collectionMethod": "manual"}'
```

### 📊 Current Mower Status
```sql
-- Get current mower status with active work area
SELECT 
  e.collected_at,
  e.activity,
  e.battery_level,
  e.current_work_area_id,
  wa.value->>'name' as active_area_name,
  (wa.value->>'progress')::integer as area_progress
FROM epos_data_snapshots e
LEFT JOIN LATERAL (
  SELECT value 
  FROM jsonb_array_elements(e.work_areas) 
  WHERE (value->>'id')::integer = e.current_work_area_id
) wa ON true
WHERE e.mower_id = 'YOUR_MOWER_ID'
ORDER BY e.collected_at DESC 
LIMIT 1;
```

### 🏠 Work Areas Overview
```sql
-- All work areas with latest progress
SELECT DISTINCT
  wa.value->>'name' as area_name,
  (wa.value->>'id')::integer as area_id,
  (wa.value->>'progress')::integer as progress,
  (wa.value->>'enabled')::boolean as enabled,
  wa.value->>'lastTimeCompleted' as last_completed
FROM epos_data_snapshots e,
     jsonb_array_elements(e.work_areas) wa
WHERE e.collected_at = (
  SELECT MAX(collected_at) 
  FROM epos_data_snapshots e2 
  WHERE e2.mower_id = e.mower_id
)
ORDER BY (wa.value->>'id')::integer;
```

### 🔄 Cron Job Management
```sql
-- Check cron job status
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname LIKE '%collection%';

-- Recent cron job runs
SELECT 
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;

-- Enable/disable cron job
SELECT cron.alter_job('final-working-collection', active := true);
SELECT cron.alter_job('final-working-collection', active := false);
```

### 📈 Performance Queries
```sql
-- Mowing session detection (basic)
SELECT 
  collected_at,
  activity,
  current_work_area_id,
  battery_level,
  LAG(activity) OVER (ORDER BY collected_at) as prev_activity
FROM epos_data_snapshots 
WHERE mower_id = 'YOUR_MOWER_ID'
  AND collected_at > NOW() - INTERVAL '24 hours'
ORDER BY collected_at;

-- Area completion tracking
SELECT 
  wa.value->>'name' as area_name,
  (wa.value->>'progress')::integer as progress,
  wa.value->>'lastTimeCompleted' as last_completed,
  e.collected_at
FROM epos_data_snapshots e,
     jsonb_array_elements(e.work_areas) wa
WHERE e.mower_id = 'YOUR_MOWER_ID'
  AND wa.value->>'lastTimeCompleted' IS NOT NULL
ORDER BY e.collected_at DESC;
```

## 🚨 Troubleshooting Commands

### Data Collection Issues
```sql
-- Check for authentication problems
SELECT 
  session_id,
  user_email,
  expires_at,
  expires_at < NOW() as is_expired,
  expires_at - NOW() as time_until_expiry
FROM auth_sessions;

-- Check for Edge Function errors
-- Use Supabase MCP: mcp__supabase__get_logs(service: "edge-function")

-- Check database constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'epos_data_snapshots'::regclass;
```

### Data Quality Issues
```sql
-- Find snapshots with missing data
SELECT 
  collected_at,
  activity,
  CASE WHEN work_areas = '[]'::jsonb THEN 'Missing work_areas' END as issue,
  CASE WHEN current_work_area_id IS NULL AND activity = 'MOWING' THEN 'Missing work_area_id' END as issue2
FROM epos_data_snapshots 
WHERE collected_at > NOW() - INTERVAL '1 hour'
  AND (work_areas = '[]'::jsonb OR (current_work_area_id IS NULL AND activity = 'MOWING'));

-- Check for data collection gaps
WITH time_series AS (
  SELECT generate_series(
    date_trunc('minute', NOW() - INTERVAL '1 hour'),
    date_trunc('minute', NOW()),
    INTERVAL '5 minutes'
  ) as expected_time
),
actual_collections AS (
  SELECT date_trunc('minute', collected_at) as actual_time
  FROM epos_data_snapshots 
  WHERE collected_at > NOW() - INTERVAL '1 hour'
)
SELECT ts.expected_time
FROM time_series ts
LEFT JOIN actual_collections ac ON ts.expected_time = ac.actual_time
WHERE ac.actual_time IS NULL
ORDER BY ts.expected_time;
```

## 🔧 Adding New Data Fields

### Template for Adding New API Field

1. **Update Edge Function Interface:**
```typescript
// In mower-discovery/index.ts
interface HusqvarnaMower {
  attributes: {
    mower: {
      // Add new field here
      newFieldName?: string;
    };
  };
}
```

2. **Add Database Column:**
```sql
ALTER TABLE epos_data_snapshots 
ADD COLUMN new_field_name text NULL 
COMMENT 'Description from Husqvarna API docs';
```

3. **Update Edge Function Mapping:**
```typescript
const snapshotData = {
  // existing fields...
  new_field_name: mower.attributes.mower?.newFieldName || null,
}
```

4. **Update TypeScript Types:**
```typescript
// In src/lib/database.types.ts
Row: {
  // existing fields...
  new_field_name: string | null
}
```

5. **Deploy and Test:**
```bash
supabase functions deploy mower-discovery
# Then check logs for any errors
```

## 📱 Frontend Data Access

### React Query Pattern
```typescript
// Get latest mower data
const { data: latestSnapshot } = useQuery({
  queryKey: ['latest-snapshot', mowerId],
  queryFn: () => eposService.getLatestSnapshot(mowerId),
  refetchInterval: 5 * 60 * 1000, // 5 minutes
})

// Get time-range data
const { data: snapshots } = useQuery({
  queryKey: ['epos-snapshots', mowerId, timeRange],
  queryFn: () => eposService.getSnapshotsInRange(mowerId, startDate, endDate),
  refetchInterval: 5 * 60 * 1000,
})
```

### Service Layer Pattern
```typescript
export class EposService {
  async getLatestSnapshot(mowerId: string) {
    const { data, error } = await supabase
      .from('epos_data_snapshots')
      .select('*')
      .eq('mower_id', mowerId)
      .order('collected_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error) throw error
    return this.transformSnapshot(data)
  }
  
  private transformSnapshot(snapshot: EposDataSnapshot): EposDataSnapshotWithWorkAreas {
    return {
      ...snapshot,
      work_areas: Array.isArray(snapshot.work_areas) 
        ? (snapshot.work_areas as unknown as WorkArea[]) 
        : []
    }
  }
}
```

## 🎯 Key Data Points for AI Understanding

- **Primary data table**: `epos_data_snapshots`
- **Collection frequency**: Every 5 minutes via cron job
- **Main Edge Function**: `mower-discovery`
- **Critical field for active area**: `current_work_area_id` 
- **Area completion tracking**: `work_areas[].lastTimeCompleted`
- **Authentication**: Via `auth_sessions` table
- **Data transformation**: JSON work_areas → TypeScript WorkArea[]

**Next AI Session Should Start With:**
1. Check data collection status with the queries above
2. Review latest snapshots to understand current system state  
3. Use this guide to understand the complete data flow
4. Reference `supabase-integration-guide.md` for detailed architecture