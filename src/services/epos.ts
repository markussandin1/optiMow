import { supabase } from '@/lib/supabase'
import type { EposDataSnapshot, EposDataSnapshotWithWorkAreas, WorkArea } from '@/lib/database.types'

export class EposService {
  /**
   * Fetch recent EPOS data snapshots for a specific mower
   */
  async getRecentSnapshots(
    mowerId: string, 
    limit: number = 50
  ): Promise<EposDataSnapshotWithWorkAreas[]> {
    const { data, error } = await supabase
      .from('epos_data_snapshots')
      .select('*')
      .eq('mower_id', mowerId)
      .order('collected_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching EPOS snapshots:', error)
      throw error
    }

    // Transform work_areas from JSON to typed array
    return data.map(snapshot => ({
      ...snapshot,
      work_areas: Array.isArray(snapshot.work_areas) ? (snapshot.work_areas as unknown as WorkArea[]) : []
    }))
  }

  /**
   * Fetch EPOS data snapshots within a date range
   */
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
      .order('collected_at', { ascending: true })

    if (error) {
      console.error('Error fetching EPOS snapshots in range:', error)
      throw error
    }

    return data.map(snapshot => ({
      ...snapshot,
      work_areas: Array.isArray(snapshot.work_areas) ? (snapshot.work_areas as unknown as WorkArea[]) : []
    }))
  }

  /**
   * Get collection statistics for a mower
   */
  async getCollectionStats(mowerId: string): Promise<{
    totalSnapshots: number
    scheduledSnapshots: number
    manualSnapshots: number
    lastCollection: string | null
    collectionMethods: { method: string; count: number }[]
  }> {
    // Get total count
    const { count: totalSnapshots, error: countError } = await supabase
      .from('epos_data_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('mower_id', mowerId)

    if (countError) {
      console.error('Error fetching snapshot count:', countError)
      throw countError
    }

    // Get counts by collection method
    const { data: methodStats, error: methodError } = await supabase
      .from('epos_data_snapshots')
      .select('collection_method')
      .eq('mower_id', mowerId)

    if (methodError) {
      console.error('Error fetching collection method stats:', methodError)
      throw methodError
    }

    // Count methods
    const methodCounts = methodStats.reduce((acc, snapshot) => {
      const method = snapshot.collection_method || 'unknown'
      acc[method] = (acc[method] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const collectionMethods = Object.entries(methodCounts).map(([method, count]) => ({
      method,
      count
    }))

    const scheduledSnapshots = methodCounts['scheduled'] || 0
    const manualSnapshots = methodCounts['manual'] || 0

    // Get last collection time
    const { data: lastSnapshot, error: lastError } = await supabase
      .from('epos_data_snapshots')
      .select('collected_at')
      .eq('mower_id', mowerId)
      .order('collected_at', { ascending: false })
      .limit(1)
      .single()

    if (lastError && lastError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching last collection time:', lastError)
      throw lastError
    }

    return {
      totalSnapshots: totalSnapshots || 0,
      scheduledSnapshots,
      manualSnapshots,
      lastCollection: lastSnapshot?.collected_at || null,
      collectionMethods
    }
  }

  /**
   * Calculate EPOS performance metrics
   */
  calculatePerformanceMetrics(snapshots: EposDataSnapshotWithWorkAreas[]): {
    totalClockTime: number
    effectiveMowingTime: number
    cuttingEfficiency: number
    averageBatteryLevel: number
    mowingCycles: number
    chargingCycles: number
  } {
    if (snapshots.length === 0) {
      return {
        totalClockTime: 0,
        effectiveMowingTime: 0,
        cuttingEfficiency: 0,
        averageBatteryLevel: 0,
        mowingCycles: 0,
        chargingCycles: 0
      }
    }

    // Sort by collection time
    const sortedSnapshots = [...snapshots].sort((a, b) => 
      new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime()
    )

    const firstSnapshot = sortedSnapshots[0]
    const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1]

    // Calculate total clock time (time between first and last snapshot)
    const totalClockTime = (
      new Date(lastSnapshot.collected_at).getTime() - 
      new Date(firstSnapshot.collected_at).getTime()
    ) / (1000 * 60) // Convert to minutes

    // Calculate effective mowing time (time spent in MOWING state)
    let effectiveMowingTime = 0
    let mowingCycles = 0
    let chargingCycles = 0
    let inMowingCycle = false
    let inChargingCycle = false

    for (let i = 1; i < sortedSnapshots.length; i++) {
      const prevSnapshot = sortedSnapshots[i - 1]
      const currentSnapshot = sortedSnapshots[i]
      
      const timeDiff = (
        new Date(currentSnapshot.collected_at).getTime() - 
        new Date(prevSnapshot.collected_at).getTime()
      ) / (1000 * 60) // Convert to minutes

      // Count mowing time
      if (prevSnapshot.activity === 'MOWING') {
        effectiveMowingTime += timeDiff
        
        if (!inMowingCycle) {
          mowingCycles++
          inMowingCycle = true
        }
      } else {
        inMowingCycle = false
      }

      // Count charging cycles
      if (prevSnapshot.activity === 'CHARGING') {
        if (!inChargingCycle) {
          chargingCycles++
          inChargingCycle = true
        }
      } else {
        inChargingCycle = false
      }
    }

    // Calculate cutting efficiency (progress per minute of mowing)
    const cuttingEfficiency = effectiveMowingTime > 0 
      ? (effectiveMowingTime / totalClockTime) * 100 
      : 0

    // Calculate average battery level
    const averageBatteryLevel = snapshots.reduce((sum, snapshot) => 
      sum + snapshot.battery_level, 0
    ) / snapshots.length

    return {
      totalClockTime: Math.round(totalClockTime),
      effectiveMowingTime: Math.round(effectiveMowingTime),
      cuttingEfficiency: Math.round(cuttingEfficiency * 100) / 100,
      averageBatteryLevel: Math.round(averageBatteryLevel),
      mowingCycles,
      chargingCycles
    }
  }

  /**
   * Format time in minutes to human readable format
   */
  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`
    }
    
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
    }
    
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  /**
   * Format activity for display
   */
  formatActivity(activity: string): string {
    const activityMap: Record<string, string> = {
      'MOWING': 'Mowing',
      'GOING_HOME': 'Going Home',
      'CHARGING': 'Charging',
      'LEAVING': 'Leaving',
      'PARKED_IN_CS': 'Parked',
      'IN_OPERATION': 'Operating',
      'RESTRICTED': 'Restricted',
      'ERROR': 'Error',
      'STOPPED': 'Stopped',
      'OFF': 'Off'
    }
    
    return activityMap[activity] || activity
  }
}