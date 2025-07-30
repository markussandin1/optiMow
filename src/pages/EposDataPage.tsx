import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/stores/authStore'
import { useMowerStore, useMowerActions } from '@/stores/mowerStore'
import { EposService } from '@/services/epos'
import { EposChart } from '@/components/ui/EposChart'
import { EposMetrics } from '@/components/ui/EposMetrics'
import { LoadingSpinner } from '@/components/ui/LoadingSkeleton'
import type { EposDataSnapshotWithWorkAreas } from '@/lib/database.types'

export function EposDataPage() {
  const { user, session } = useAuth()
  const mowerStore = useMowerStore()
  const { mowers, isLoading: mowersLoading, hasDiscovered } = mowerStore
  const { discoverMowers, loadMowers } = useMowerActions()
  const [selectedMowerId, setSelectedMowerId] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h')
  const [isInitialDiscovery, setIsInitialDiscovery] = useState(false)
  
  const eposService = new EposService()

  // Load mowers from database if not already loaded (no API calls)
  useEffect(() => {
    if (session?.session_id && !hasDiscovered && !mowersLoading && !isInitialDiscovery && mowers.length === 0) {
      setIsInitialDiscovery(true)
      loadMowers(session.session_id)
        .then(() => {
          setIsInitialDiscovery(false)
        })
        .catch(error => {
          console.error('Initial mower loading failed:', error)
          setIsInitialDiscovery(false)
        })
    }
  }, [session?.session_id, hasDiscovered, mowersLoading, isInitialDiscovery, mowers.length])

  // Auto-select first mower if available
  useEffect(() => {
    if (mowers.length > 0 && !selectedMowerId) {
      setSelectedMowerId(mowers[0].husqvarna_id)
    }
  }, [mowers, selectedMowerId])

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date()
    const startDate = new Date()
    
    switch (timeRange) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1)
        break
      case '6h':
        startDate.setHours(startDate.getHours() - 6)
        break
      case '24h':
        startDate.setDate(startDate.getDate() - 1)
        break
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
    }
    
    return { startDate, endDate }
  }

  // Fetch EPOS data
  const { 
    data: snapshots = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['epos-snapshots', selectedMowerId, timeRange],
    queryFn: async () => {
      if (!selectedMowerId) return []
      const { startDate, endDate } = getDateRange()
      return eposService.getSnapshotsInRange(selectedMowerId, startDate, endDate)
    },
    enabled: !!selectedMowerId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  // Fetch collection stats
  const { data: stats } = useQuery({
    queryKey: ['epos-stats', selectedMowerId],
    queryFn: async () => {
      if (!selectedMowerId) return null
      return eposService.getCollectionStats(selectedMowerId)
    },
    enabled: !!selectedMowerId,
  })

  const selectedMower = mowers.find(m => m.husqvarna_id === selectedMowerId)

  // Show loading while discovering mowers
  if ((mowersLoading || isInitialDiscovery) && mowers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-2xl shadow-sm border border-gray-200">
            <LoadingSpinner size="md" />
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900">
                Discovering Your Mowers
              </h2>
              <p className="text-sm text-gray-600">
                Fetching your mower information for EPOS analytics
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mowers.length === 0 && hasDiscovered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Mowers Available</h3>
          <p className="text-gray-600 mb-4">We couldn't find any mowers in your account.</p>
          <button
            onClick={() => session?.session_id && discoverMowers(session.session_id)}
            disabled={mowersLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-all duration-200"
          >
            {mowersLoading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Discover Mowers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221.5%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />
        
        <div className="relative">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <a
                  href="/dashboard"
                  className="flex items-center justify-center w-10 h-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </a>
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white">
                    EPOS Data Analytics
                  </h1>
                  <p className="text-slate-300">
                    Real-time mower performance and efficiency tracking
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {stats && (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">
                      {stats.totalSnapshots} data points
                    </span>
                  </div>
                )}
                <button
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-emerald-500/20 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Mower Selection */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Mower:</label>
            <select
              value={selectedMowerId || ''}
              onChange={(e) => setSelectedMowerId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {mowers.map(mower => (
                <option key={mower.husqvarna_id} value={mower.husqvarna_id}>
                  {mower.name} ({mower.model})
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Selection */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Time Range:</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    timeRange === range
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error instanceof Error ? error.message : 'An unknown error occurred'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {stats && selectedMower && (
          <div className="mb-6 bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {selectedMower.name} - Collection Status
              </h2>
              {stats.lastCollection && (
                <div className="text-sm text-gray-600">
                  Last updated: {new Date(stats.lastCollection).toLocaleString()}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.totalSnapshots}</div>
                <div className="text-sm text-gray-600">Total Records</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-700">{stats.scheduledSnapshots}</div>
                <div className="text-sm text-gray-600">Scheduled</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{stats.manualSnapshots}</div>
                <div className="text-sm text-gray-600">Manual</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">
                  {snapshots.length}
                </div>
                <div className="text-sm text-gray-600">In Range</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <EposMetrics snapshots={snapshots} />
          
          {/* Activity Timeline */}
          <EposChart 
            snapshots={snapshots} 
            title={`Activity Timeline (${timeRange})`}
          />
        </div>

        {/* Phase indicator */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <div className="w-2 h-2 bg-emerald-600 rounded-full mr-2 animate-pulse"></div>
            <span>Phase 2.1: EPOS Data Collection - Active ✅</span>
          </div>
        </div>
      </div>
    </div>
  )
}