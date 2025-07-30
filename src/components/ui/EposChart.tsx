import { useMemo } from 'react'
import type { EposDataSnapshotWithWorkAreas } from '@/lib/database.types'

interface EposChartProps {
  snapshots: EposDataSnapshotWithWorkAreas[]
  title: string
  className?: string
}

export function EposChart({ snapshots, title, className = '' }: EposChartProps) {
  // Process data for visualization with deduplication
  const chartData = useMemo(() => {
    if (snapshots.length === 0) return []
    
    // Deduplicate snapshots that are identical within the same minute
    const uniqueSnapshots = snapshots.filter((snapshot, index, array) => {
      const currentMinute = new Date(snapshot.collected_at).toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
      const isDuplicate = array.findIndex((other, otherIndex) => {
        if (otherIndex >= index) return false // Only check previous items
        const otherMinute = new Date(other.collected_at).toISOString().slice(0, 16)
        return currentMinute === otherMinute && 
               other.activity === snapshot.activity &&
               other.battery_level === snapshot.battery_level &&
               other.total_cutting_time === snapshot.total_cutting_time
      }) !== -1
      return !isDuplicate
    })
    
    return uniqueSnapshots.map(snapshot => {
      const collectedAt = new Date(snapshot.collected_at)
      
      // Find active work area using current_work_area_id from API, fallback to highest progress
      let activeArea = null
      if (snapshot.current_work_area_id) {
        // Use the work area ID provided by Husqvarna API (most accurate)
        activeArea = snapshot.work_areas.find(area => area.id === snapshot.current_work_area_id)
      }
      
      // Fallback: if no current_work_area_id or area not found, use highest progress among enabled areas
      if (!activeArea) {
        const enabledAreas = snapshot.work_areas.filter(area => area.enabled)
        activeArea = enabledAreas.length > 0 
          ? enabledAreas.reduce((max, area) => area.progress > max.progress ? area : max)
          : null
      }
      
      return {
        time: collectedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullTime: collectedAt.toLocaleString(),
        activity: snapshot.activity,
        battery: snapshot.battery_level,
        totalCuttingTime: Math.floor(snapshot.total_cutting_time / 60), // Convert to minutes
        totalRunningTime: Math.floor(snapshot.total_running_time / 60),
        activeWorkArea: activeArea
      }
    }).reverse() // Show chronologically (oldest first)
  }, [snapshots])

  const getActivityColor = (activity: string) => {
    switch (activity) {
      case 'MOWING': return 'bg-emerald-500'
      case 'CHARGING': return 'bg-blue-500'
      case 'GOING_HOME': return 'bg-yellow-500'
      case 'LEAVING': return 'bg-orange-500'
      case 'PARKED_IN_CS': return 'bg-gray-500'
      default: return 'bg-purple-500'
    }
  }

  const getActivityIcon = (activity: string) => {
    switch (activity) {
      case 'MOWING': 
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
          </svg>
        )
      case 'CHARGING':
        return (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'GOING_HOME':
        return (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        )
      default:
        return (
          <div className="w-2 h-2 bg-white rounded-full" />
        )
    }
  }

  if (chartData.length === 0) {
    return (
      <div className={`bg-white rounded-2xl p-6 border border-gray-200 ${className}`}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">📊</div>
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-2xl p-6 border border-gray-200 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      
      {/* Timeline View */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {chartData.map((point, index) => (
          <div key={`${point.fullTime}-${point.activity}-${point.battery}-${index}`} className="relative">
            {/* Timeline line */}
            {index < chartData.length - 1 && (
              <div className="absolute left-3 top-6 w-0.5 h-8 bg-gray-200" />
            )}
            
            {/* Data point */}
            <div className="flex items-center gap-4">
              {/* Activity indicator */}
              <div className={`w-6 h-6 rounded-full ${getActivityColor(point.activity)} flex items-center justify-center flex-shrink-0 relative z-10`}>
                {getActivityIcon(point.activity)}
              </div>
              
              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {point.time}
                    </div>
                    <div className="text-xs text-gray-600">
                      {point.activity.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    {point.activeWorkArea && point.activity === 'MOWING' && (
                      <div className="text-xs text-blue-600 mt-1">
                        {point.activeWorkArea.name} ({point.activeWorkArea.progress}%)
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs">
                    {/* Battery */}
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        {/* Battery body */}
                        <div className="w-4 h-2 border border-gray-400 rounded-sm bg-white">
                          <div className={`h-full rounded-sm ${
                            point.battery > 50 ? 'bg-emerald-500' : 
                            point.battery > 20 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} style={{ width: `${Math.max(point.battery, 0)}%` }} />
                        </div>
                        {/* Battery tip */}
                        <div className="absolute -right-0.5 top-0.5 w-0.5 h-1 bg-gray-400 rounded-r-sm" />
                      </div>
                      <span className="text-gray-600">{point.battery}%</span>
                    </div>
                    
                    
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            <span className="text-gray-600">Mowing</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span className="text-gray-600">Charging</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span className="text-gray-600">Going Home</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-500 rounded-full" />
            <span className="text-gray-600">Parked</span>
          </div>
        </div>
      </div>
    </div>
  )
}