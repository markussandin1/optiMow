import { useEffect, useState } from 'react';
import { useAuth } from '@/stores/authStore';
import { useMowerStore, useMowerActions } from '@/stores/mowerStore';
import { MowerCard } from '@/components/ui/MowerCard';
import { MowerService } from '@/services/mower';
import { DashboardHeaderSkeleton, MowerCardSkeleton, LoadingSpinner } from '@/components/ui/LoadingSkeleton';
import { DataCollectionControl } from '@/components/ui/DataCollectionControl';

export function DashboardPage() {
  const { user, session } = useAuth();
  // Use the store directly to ensure proper subscription
  const mowerStore = useMowerStore();
  const { mowers, selectedMowerId, isLoading, error, hasDiscovered } = mowerStore;
  const { discoverMowers, loadMowers, selectMower, clearError } = useMowerActions();
  const [isInitialDiscovery, setIsInitialDiscovery] = useState(false);

  // Calculate derived values
  const hasMowers = mowers.length > 0;
  const selectedMower = selectedMowerId ? mowers.find(m => m.id === selectedMowerId) || null : null;
  const mowerService = new MowerService();

  // Debug logging (removed - was causing render loop)


  // Load mowers from database on first visit (no API calls)
  useEffect(() => {
    if (session?.session_id && !hasDiscovered && !isLoading && !isInitialDiscovery) {
      setIsInitialDiscovery(true);
      loadMowers(session.session_id)
        .then(() => {
          setIsInitialDiscovery(false);
        })
        .catch(error => {
          console.error('Initial mower loading failed:', error);
          setIsInitialDiscovery(false);
        });
    }
  }, [session?.session_id, hasDiscovered, isLoading, isInitialDiscovery]);

  const handleDiscoverMowers = async () => {
    if (session?.session_id) {
      try {
        await discoverMowers(session.session_id);
      } catch (error) {
        console.error('Mower discovery failed:', error);
      }
    }
  };

  const handleRetry = () => {
    clearError();
    handleDiscoverMowers();
  };

  
  if (isLoading || isInitialDiscovery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <DashboardHeaderSkeleton />
        
        <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0">
            {/* Loading Content */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-2xl shadow-sm border border-gray-200">
                <LoadingSpinner size="md" />
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Discovering Your Mowers
                  </h2>
                  <p className="text-sm text-gray-600">
                    Fetching your mower information from Husqvarna
                  </p>
                </div>
              </div>
            </div>

            {/* Skeleton Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map(i => (
                <MowerCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Enhanced Header */}
      <div className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221.5%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />
        
        <div className="relative">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white mb-0.5">
                    OptiMow v3
                  </h1>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-300">
                      Welcome back, <span className="font-semibold text-orange-300">{user?.email?.split('@')[0]}</span>
                    </p>
                    <div className="hidden sm:flex items-center gap-1.5 text-emerald-400 text-xs">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="font-medium">Connected</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Compact Stats */}
                {hasMowers && (
                  <div className="hidden lg:flex items-center gap-4 mr-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{mowers.length}</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wide">Mowers</div>
                    </div>
                    <div className="w-px h-6 bg-slate-600" />
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-400">
                        {mowers.filter(m => m.current_status?.activity === 'MOWING').length}
                      </div>
                      <div className="text-xs text-slate-400 uppercase tracking-wide">Active</div>
                    </div>
                  </div>
                )}
                
                {/* EPOS Data Link */}
                {hasMowers && (
                  <a
                    href="/epos-data"
                    className="inline-flex items-center px-4 py-2 border border-emerald-500/20 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-emerald-600/80 to-emerald-700/80 hover:from-emerald-700 hover:to-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200 backdrop-blur-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    EPOS Data
                  </a>
                )}
                
                <button
                  onClick={handleDiscoverMowers}
                  disabled={isLoading}
                  className="inline-flex items-center px-6 py-3 border border-orange-500/20 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm"
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Refresh Mowers
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-4 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleRetry}
                      className="text-sm font-medium text-red-800 underline hover:text-red-900"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hasMowers && !error && hasDiscovered && (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Mowers Found</h3>
                <p className="text-gray-600 mb-8">
                  We couldn't find any mowers in your Husqvarna Connect account. Make sure your mowers are properly registered and connected.
                </p>
                <button
                  onClick={handleDiscoverMowers}
                  className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Search Again
                </button>
              </div>
            </div>
          )}

          {hasMowers && (
            <div className="space-y-6">
              {/* Data Collection Control Panel */}
              <DataCollectionControl />
              
              {/* Mowers Header - Compact Layout */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Your Mowers</h2>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-600">
                      {mowers.length} {mowers.length === 1 ? 'mower' : 'mowers'} connected
                    </p>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-emerald-700">Live</span>
                    </div>
                  </div>
                </div>
                
                {/* Compact Stats */}
                <div className="w-full sm:w-auto">
                  <div className="flex items-center justify-center sm:justify-start gap-4 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-center">
                      <div className="text-base font-bold text-emerald-600">
                        {mowers.filter(m => m.current_status?.activity === 'MOWING').length}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Mowing</div>
                    </div>
                    <div className="w-px h-5 bg-gray-200" />
                    <div className="text-center">
                      <div className="text-base font-bold text-blue-600">
                        {mowers.filter(m => m.current_status?.activity === 'CHARGING').length}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Charging</div>
                    </div>
                    <div className="w-px h-5 bg-gray-200" />
                    <div className="text-center">
                      <div className="text-base font-bold text-gray-600">
                        {mowers.filter(m => m.current_status?.activity === 'PARKED_IN_CS').length}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Parked</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mowers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mowers.map(mower => (
                  <MowerCard
                    key={mower.husqvarna_id || mower.id}
                    mower={mower}
                    isSelected={selectedMower?.id === mower.id}
                    onSelect={() => selectMower(mower.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {selectedMower && (
            <div className="mt-6 bg-white shadow-xl border border-gray-200 overflow-hidden rounded-3xl">
              {/* Enhanced Header */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221.5%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />
                
                <div className="relative px-6 py-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">
                          {selectedMower.name}
                        </h3>
                        <p className="text-slate-300">
                          {selectedMower.model || 'Unknown Model'} • Detailed Information
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {selectedMower.current_status && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl">
                          <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-sm font-semibold text-white">Live Data</span>
                        </div>
                      )}
                      <button
                        onClick={() => useMowerStore.setState({ selectedMowerId: null })}
                        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Content */}
              <div className="p-5">
                {selectedMower.current_status ? (
                  <div className="space-y-6">
                    {/* Status Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl border border-emerald-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-emerald-800">Current Activity</div>
                            <div className="text-xl font-bold text-emerald-900">
                              {mowerService.formatMowerActivity(selectedMower.current_status.activity)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14.5 11L14 9.5H12.5L13 11H14.5M9 2V4H15V2H9M11 19H13V16.5H11V19M15.67 4H14V6H10V4H8.33C7.6 4 7 4.6 7 5.33V20.67C7 21.4 7.6 22 8.33 22H15.67C16.4 22 17 21.4 17 20.67V5.33C17 4.6 16.4 4 15.67 4Z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-blue-800">Battery Level</div>
                            <div className="text-xl font-bold text-blue-900">
                              {selectedMower.current_status.battery_percent}%
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-purple-800">Operating Mode</div>
                            <div className="text-xl font-bold text-purple-900">
                              {mowerService.formatMowerMode(selectedMower.current_status.mode)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Information */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* System Information */}
                      <div className="space-y-4">
                        <h4 className="text-base font-bold text-gray-900 mb-3">System Information</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="font-medium text-gray-700">Husqvarna ID</span>
                            <span className="font-mono text-sm text-gray-900 bg-white px-3 py-1 rounded-lg border">
                              {selectedMower.husqvarna_id}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="font-medium text-gray-700">Added to Account</span>
                            <span className="font-semibold text-gray-900">
                              {new Date(selectedMower.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {selectedMower.current_status.data_collected_at && (
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                              <span className="font-medium text-emerald-700">Data Last Updated</span>
                              <span className="font-semibold text-emerald-900">
                                {new Date(selectedMower.current_status.data_collected_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {selectedMower.current_status.last_position && (
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="font-medium text-gray-700">GPS Position</span>
                              <span className="font-semibold text-gray-900">
                                {new Date(selectedMower.current_status.last_position.timestamp * 1000).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Work Areas */}
                      {selectedMower.current_status.work_areas && selectedMower.current_status.work_areas.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-base font-bold text-gray-900 mb-3">Work Areas</h4>
                          <div className="space-y-3">
                            {selectedMower.current_status.work_areas.map(area => (
                              <div key={area.workAreaId} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${area.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                    <span className={`font-medium ${area.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                                      {area.name}
                                    </span>
                                  </div>
                                  <span className={`text-sm px-2 py-1 rounded-full ${area.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {area.enabled ? 'Active' : 'Disabled'}
                                  </span>
                                </div>
                                {area.progress !== undefined && (
                                  <div className="mt-3">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                      <span className="text-gray-600">Progress</span>
                                      <span className="font-bold text-gray-900">{area.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-gradient-to-r from-emerald-500 to-green-500 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${area.progress}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Error Section */}
                    {selectedMower.current_status.error_code !== 0 && (
                      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-red-900 mb-2">Error Detected</h4>
                            <p className="text-red-800 mb-1">Error Code: {selectedMower.current_status.error_code}</p>
                            <p className="text-sm text-red-700">
                              This error requires manual intervention. Please check your mower and resolve the issue.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Get Live Data</h4>
                    <p className="text-gray-600 mb-4">
                      Click "Refresh Mowers" to fetch the latest status from your mower and start automatic data collection every 5 minutes.
                    </p>
                    <button
                      onClick={handleDiscoverMowers}
                      disabled={isLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Getting Live Data...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Get Live Data
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact Phase indicator */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <div className="w-2 h-2 bg-emerald-600 rounded-full mr-2 animate-pulse"></div>
              <span>Phase 1.2: Mower Discovery Complete</span>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Discovery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Monitoring</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-gray-400 rounded-full border-t-orange-500 animate-spin"></div>
                <span>Live Data</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}