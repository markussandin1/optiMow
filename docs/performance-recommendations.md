# Performance and Data Quality Recommendations

## **Data Collection Strategy**

### **Fixed Collection Intervals**
The current system uses a simplified approach with fixed 5-minute intervals:
- **All states**: 5 minutes (300 seconds)
- **Automated collection**: Handled by cron job
- **Manual collection**: On-demand via frontend

### **Gap Detection**
```typescript
const detectDataGaps = async (mowerId: string, hours: number = 24) => {
  // Check for missing data points in expected 5-minute intervals
  const expectedInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Query for gaps longer than 10 minutes (2 missed intervals)
  const gaps = await supabase
    .from('epos_data_snapshots')
    .select('collected_at')
    .eq('mower_id', mowerId)
    .gte('collected_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    .order('collected_at', { ascending: true });
    
  // Identify gaps between data points
  const dataGaps = [];
  for (let i = 1; i < gaps.data.length; i++) {
    const timeDiff = new Date(gaps.data[i].collected_at).getTime() - 
                     new Date(gaps.data[i-1].collected_at).getTime();
    if (timeDiff > expectedInterval * 2) {
      dataGaps.push({
        start: gaps.data[i-1].collected_at,
        end: gaps.data[i].collected_at,
        duration: timeDiff / (1000 * 60) // minutes
      });
    }
  }
  
  return dataGaps;
};
```

## **Database Performance Optimization**

### **Indexing Strategy**
```sql
-- Composite indexes for common queries
CREATE INDEX idx_epos_data_mower_time ON epos_data_snapshots(mower_id, collected_at DESC);
CREATE INDEX idx_epos_data_activity_time ON epos_data_snapshots(mower_id, activity, collected_at DESC);

-- GIN indexes for JSONB data
CREATE INDEX idx_work_areas_gin ON epos_data_snapshots USING gin(work_areas);

-- Index for auto-resume functionality
CREATE INDEX idx_auto_resume_mower ON auto_resume_tracking(mower_id, enabled);
```

### **Data Archival Strategy**
```typescript
// Archive old data to maintain performance
const archiveOldData = async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days of detailed data
  
  // Archive old EPOS snapshots
  const oldSnapshots = await supabase
    .from('epos_data_snapshots')
    .select('*')
    .lt('collected_at', cutoffDate.toISOString());
    
  if (oldSnapshots.data && oldSnapshots.data.length > 0) {
    // Create archive table if it doesn't exist
    await supabase.rpc('create_archive_table_if_not_exists');
    
    // Move data to archive
    await supabase.from('epos_data_snapshots_archive').insert(oldSnapshots.data);
    
    // Delete from main table
    await supabase
      .from('epos_data_snapshots')
      .delete()
      .lt('collected_at', cutoffDate.toISOString());
  }
};
```

## **Data Quality Monitoring**

### **Basic Quality Checks**
```typescript
const validateDataQuality = (snapshot: EposDataSnapshot, previousSnapshot?: EposDataSnapshot) => {
  const issues: string[] = [];
  
  // Battery logic validation
  if (previousSnapshot && snapshot.activity === 'MOWING') {
    if (snapshot.battery_level > previousSnapshot.battery_level + 5) {
      issues.push('BATTERY_INCREASE_DURING_MOWING');
    }
  }
  
  // Work area progress validation
  if (previousSnapshot && snapshot.activity === 'MOWING') {
    const hasProgressIncrease = snapshot.work_areas.some((area, index) => {
      const prevArea = previousSnapshot.work_areas[index];
      return prevArea && area.progress > prevArea.progress + 10;
    });
    
    if (hasProgressIncrease) {
      issues.push('PROGRESS_INCREASE_DURING_MOWING');
    }
  }
  
  // Timing validation (5-minute intervals expected)
  if (previousSnapshot) {
    const timeDiff = new Date(snapshot.collected_at).getTime() - 
                     new Date(previousSnapshot.collected_at).getTime();
    const expectedInterval = 5 * 60 * 1000; // 5 minutes
    
    if (Math.abs(timeDiff - expectedInterval) > expectedInterval * 0.5) {
      issues.push('IRREGULAR_TIMING');
    }
  }
  
  return { 
    isValid: issues.length === 0, 
    issues 
  };
};
```

### **Automated Monitoring**
```typescript
const monitorDataCollection = async () => {
  // Check for recent data collection gaps
  const gaps = await detectDataGaps('mower_id', 1); // Check last hour
  
  if (gaps.length > 0) {
    const criticalGaps = gaps.filter(gap => gap.duration > 15); // Gaps > 15 minutes
    if (criticalGaps.length > 0) {
      console.warn('Critical data collection gaps detected:', criticalGaps);
      // Could send alert to monitoring system
    }
  }
  
  // Check if cron job is running (no data in last 10 minutes)
  const lastSnapshot = await supabase
    .from('epos_data_snapshots')
    .select('collected_at')
    .eq('collection_method', 'scheduled')
    .order('collected_at', { ascending: false })
    .limit(1);
    
  if (lastSnapshot.data && lastSnapshot.data.length > 0) {
    const lastCollectionTime = new Date(lastSnapshot.data[0].collected_at);
    const timeSinceLastCollection = Date.now() - lastCollectionTime.getTime();
    
    if (timeSinceLastCollection > 10 * 60 * 1000) { // 10 minutes
      console.warn('Automated data collection may have stopped');
    }
  }
};
```

## **Current Architecture Performance**

### **Data Collection Performance**
The current simplified system provides excellent performance:

```typescript
// Performance characteristics of current system:
// - Fixed 5-minute collection intervals
// - Direct SQL function calls (no Edge Function overhead)
// - Simple EPOS data snapshots table
// - Automatic mower discovery and updates

const performanceMetrics = {
  collectionInterval: '5 minutes',
  dataLatency: '< 5 minutes',
  storageOverhead: 'Minimal (one table)',
  queryPerformance: 'Fast (simple indexes)',
  maintainability: 'High (simple architecture)'
};
```

## **Performance Targets**

1. **Data Collection**: 99.5% success rate (5-minute intervals)
2. **Gap Detection**: Detect gaps within 2 collection cycles (10 minutes)
3. **Query Performance**: < 500ms for dashboard queries
4. **Data Quality**: No critical validation failures
5. **Storage Efficiency**: < 500KB per mower per day
6. **System Uptime**: 99.9% automated collection availability