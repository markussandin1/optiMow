import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useMowerActions } from '@/stores/mowerStore';
import { useAuth } from '@/stores/authStore';

interface DataCollectionStats {
  lastCollection: string | null;
  totalSnapshots: number;
  scheduledSnapshots: number;
  manualSnapshots: number;
  minutesSinceLastCollection: number;
  isCollectionActive: boolean;
  cronJobStatus: 'active' | 'missing' | 'unknown';
}

export function DataCollectionControl() {
  const [stats, setStats] = useState<DataCollectionStats | null>(null);
  const [isManualCollecting, setIsManualCollecting] = useState(false);
  const [lastManualCollection, setLastManualCollection] = useState<string | null>(null);
  const { loadMowers } = useMowerActions();
  const { session } = useAuth();

  const fetchStats = async () => {
    try {
      // Get collection stats - try different approaches for data access
      let snapshots;
      let error;
      
      // First try: direct table access
      const result = await supabase
        .from('epos_data_snapshots')
        .select('collected_at, collection_method')
        .order('collected_at', { ascending: false });
        
      snapshots = result.data;
      error = result.error;
      
      if (error) {
        console.warn('Direct table access failed:', error);
        // Could try alternative approaches here if needed
        snapshots = [];
      }

      console.log(`📊 DataCollectionControl: Found ${snapshots?.length || 0} snapshots`);
      if (snapshots?.length > 0) {
        console.log('Recent snapshots:', snapshots.slice(0, 3));
      }

      const now = Date.now();
      const lastCollection = snapshots?.[0]?.collected_at || null;
      const minutesSinceLastCollection = lastCollection 
        ? Math.round((now - new Date(lastCollection).getTime()) / (1000 * 60))
        : 999;

      const scheduledSnapshots = snapshots?.filter(s => s.collection_method === 'scheduled').length || 0;
      const manualSnapshots = snapshots?.filter(s => s.collection_method === 'manual').length || 0;

      // Check if cron job exists (simple check)
      let cronJobStatus: 'active' | 'missing' | 'unknown' = 'unknown';
      try {
        // This is a simple heuristic: if we have recent scheduled data, assume cron is working
        const recentScheduled = snapshots?.find(s => 
          s.collection_method === 'scheduled' && 
          (now - new Date(s.collected_at).getTime()) < 8 * 60 * 1000 // within 8 minutes (5min + buffer)
        );
        cronJobStatus = recentScheduled ? 'active' : 'missing';
      } catch (error) {
        cronJobStatus = 'unknown';
      }

      setStats({
        lastCollection,
        totalSnapshots: snapshots?.length || 0,
        scheduledSnapshots,
        manualSnapshots,
        minutesSinceLastCollection,
        isCollectionActive: minutesSinceLastCollection < 10, // Active if collected within 10 minutes
        cronJobStatus
      });
    } catch (error) {
      console.error('Failed to fetch data collection stats:', error);
    }
  };

  const triggerManualCollection = async () => {
    setIsManualCollecting(true);
    try {
      if (!session?.session_id) {
        throw new Error('No active session found. Please login first.');
      }

      // Instead of using the missing RPC function, call the mower-discovery Edge Function
      // which does the same thing as manual collection
      const response = await supabase.functions.invoke('mower-discovery', {
        body: { 
          sessionId: session.session_id,
          collectionMethod: 'manual'
        }
      });
      
      if (response.error) throw response.error;
      
      console.log('Manual collection result:', response.data);
      setLastManualCollection(new Date().toISOString());
      
      // Refresh stats after collection
      setTimeout(fetchStats, 2000);
      
      // Also refresh mower status to show updated data
      if (session?.session_id) {
        setTimeout(() => loadMowers(session.session_id), 1000);
      }
      
      // Show success message
      alert('Manual data collection completed successfully!');
    } catch (error) {
      console.error('Manual collection failed:', error);
      alert(`Manual collection failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsManualCollecting(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const getStatusColor = () => {
    if (stats.isCollectionActive) return 'text-emerald-600';
    if (stats.minutesSinceLastCollection < 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusText = () => {
    if (stats.isCollectionActive) return 'Active';
    if (stats.minutesSinceLastCollection < 60) return 'Delayed';
    return 'Inactive';
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Data Collection Control</h3>
        <div className={`text-sm font-semibold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-xl font-bold text-gray-900">{stats.totalSnapshots}</div>
          <div className="text-xs text-gray-600">Total Records</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-xl font-bold text-blue-700">{stats.scheduledSnapshots}</div>
          <div className="text-xs text-gray-600">Scheduled</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-xl font-bold text-green-700">{stats.manualSnapshots}</div>
          <div className="text-xs text-gray-600">Manual</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className={`text-xl font-bold ${getStatusColor()}`}>
            {stats.minutesSinceLastCollection}m
          </div>
          <div className="text-xs text-gray-600">Since Last</div>
        </div>
      </div>

      {/* Last Collection Info */}
      {stats.lastCollection && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Last Collection:</span>
            <span className="text-sm font-semibold text-gray-900">
              {new Date(stats.lastCollection).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Automatic Collection Status */}
      <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${stats.isCollectionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="font-semibold text-blue-900">Automatic Collection</span>
          </div>
          <span className={`text-sm font-bold ${stats.isCollectionActive ? 'text-green-600' : 'text-gray-500'}`}>
            {stats.isCollectionActive ? 'ACTIVE' : 'MONITORING'}
          </span>
        </div>
        <div className="text-sm text-blue-700">
          ⏰ Runs every 5 minutes automatically when you're logged in<br/>
          📊 {stats.scheduledSnapshots} automatic collections completed<br/>
          🔧 Cron Status: <span className={`font-semibold ${
            stats.cronJobStatus === 'active' ? 'text-green-600' : 
            stats.cronJobStatus === 'missing' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {stats.cronJobStatus === 'active' ? '✅ Working' : 
             stats.cronJobStatus === 'missing' ? '❌ Not Running' : '❓ Unknown'}
          </span>
        </div>
      </div>

      {/* Manual Collection Button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={triggerManualCollection}
          disabled={isManualCollecting}
          className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isManualCollecting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Collecting Data...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Collect Data Now
            </>
          )}
        </button>
        
        <button
          onClick={fetchStats}
          className="px-4 py-3 border border-gray-300 shadow-sm text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Status Messages */}
      <div className="mt-4">
        {!stats.isCollectionActive && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Automatic collection appears inactive
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Use "Collect Data Now" to manually trigger data collection
                </p>
              </div>
            </div>
          </div>
        )}
        
        {lastManualCollection && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">
              Manual collection completed at {new Date(lastManualCollection).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}