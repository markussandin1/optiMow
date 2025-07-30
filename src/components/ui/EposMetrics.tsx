import type { EposDataSnapshotWithWorkAreas } from '@/lib/database.types'
import { EposService } from '@/services/epos'

interface EposMetricsProps {
  snapshots: EposDataSnapshotWithWorkAreas[]
  className?: string
}

export function EposMetrics({ snapshots, className = '' }: EposMetricsProps) {
  const eposService = new EposService()
  const metrics = eposService.calculatePerformanceMetrics(snapshots)

  const MetricCard = ({ 
    title, 
    value, 
    subtitle, 
    icon, 
    color = 'emerald',
    trend 
  }: {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ReactNode
    color?: 'emerald' | 'blue' | 'purple' | 'orange' | 'red'
    trend?: { value: number; label: string }
  }) => {
    const colorClasses = {
      emerald: 'from-emerald-50 to-emerald-100 border-emerald-200 bg-emerald-500',
      blue: 'from-blue-50 to-blue-100 border-blue-200 bg-blue-500',
      purple: 'from-purple-50 to-purple-100 border-purple-200 bg-purple-500',
      orange: 'from-orange-50 to-orange-100 border-orange-200 bg-orange-500',
      red: 'from-red-50 to-red-100 border-red-200 bg-red-500'
    }

    return (
      <div className={`bg-gradient-to-br ${colorClasses[color]} p-4 rounded-xl border`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-8 h-8 ${colorClasses[color].split(' ')[3]} rounded-lg flex items-center justify-center`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-800">{title}</div>
            {subtitle && (
              <div className="text-xs text-gray-600">{subtitle}</div>
            )}
          </div>
        </div>
        
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {trend && (
            <div className="text-xs text-gray-600">
              <span className={trend.value > 0 ? 'text-emerald-600' : 'text-red-600'}>
                {trend.value > 0 ? '↗' : '↘'} {Math.abs(trend.value)}%
              </span>
              <div>{trend.label}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (snapshots.length === 0) {
    return (
      <div className={`bg-white rounded-2xl p-6 border border-gray-200 ${className}`}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">📈</div>
          <p className="text-gray-600">No performance data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-2xl p-6 border border-gray-200 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        Performance Metrics
        <span className="text-sm font-normal text-gray-600 ml-2">
          ({snapshots.length} data points)
        </span>
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Clock Time */}
        <MetricCard
          title="Total Clock Time"
          subtitle="Time from first to last record"
          value={eposService.formatTime(metrics.totalClockTime)}
          color="blue"
          icon={
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* Effective Mowing Time */}
        <MetricCard
          title="Effective Mowing"
          subtitle="Time spent actually cutting"
          value={eposService.formatTime(metrics.effectiveMowingTime)}
          color="emerald"
          icon={
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
            </svg>
          }
        />

        {/* Cutting Efficiency */}
        <MetricCard
          title="Cutting Efficiency"
          subtitle="Mowing time / Total time"
          value={`${metrics.cuttingEfficiency}%`}
          color="purple"
          icon={
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        {/* Average Battery */}
        <MetricCard
          title="Average Battery"
          subtitle="Throughout the period"
          value={`${metrics.averageBatteryLevel}%`}
          color={metrics.averageBatteryLevel > 50 ? 'emerald' : 'orange'}
          icon={
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.5 11L14 9.5H12.5L13 11H14.5M9 2V4H15V2H9M11 19H13V16.5H11V19M15.67 4H14V6H10V4H8.33C7.6 4 7 4.6 7 5.33V20.67C7 21.4 7.6 22 8.33 22H15.67C16.4 22 17 21.4 17 20.67V5.33C17 4.6 16.4 4 15.67 4Z" />
            </svg>
          }
        />

        {/* Mowing Cycles */}
        <MetricCard
          title="Mowing Cycles"
          subtitle="Number of mowing sessions"
          value={metrics.mowingCycles}
          color="emerald"
          icon={
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />

        {/* Charging Cycles */}
        <MetricCard
          title="Charging Cycles"
          subtitle="Number of charging sessions"
          value={metrics.chargingCycles}
          color="blue"
          icon={
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
      </div>

      {/* Additional Insights */}
      {metrics.totalClockTime > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Insights</h4>
          <div className="space-y-2 text-sm text-gray-600">
            {metrics.cuttingEfficiency < 30 && (
              <div className="flex items-center gap-2 text-orange-700 bg-orange-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Low cutting efficiency - mower may need scheduling optimization
              </div>
            )}
            
            {metrics.averageBatteryLevel < 30 && (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Low average battery - consider checking charging station
              </div>
            )}
            
            {metrics.cuttingEfficiency > 70 && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Excellent cutting efficiency - mower is well optimized!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}