import { MowerService, type MowerWithStatus } from '@/services/mower';
import { StatusBadge } from './StatusIndicator';
import { BatteryCard } from './BatteryIndicator';
import { AutoResumeToggle } from './AutoResumeToggle';

interface MowerCardProps {
  mower: MowerWithStatus;
  isSelected?: boolean;
  onSelect?: () => void;
}

const mowerService = new MowerService();

export function MowerCard({ mower, isSelected = false, onSelect }: MowerCardProps) {
  const { current_status } = mower;

  return (
    <div 
      className={`
        group relative overflow-hidden border rounded-2xl cursor-pointer transition-all duration-300 
        hover:scale-[1.02] hover:shadow-xl
        ${isSelected 
          ? 'border-orange-400 bg-gradient-to-br from-orange-50 via-white to-orange-50 shadow-xl ring-2 ring-orange-200/50' 
          : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-lg hover:bg-gradient-to-br hover:from-gray-50 hover:to-white'
        }
      `}
      onClick={onSelect}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600" />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {/* Mower icon */}
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-gray-900 truncate">{mower.name}</h3>
                <p className="text-sm text-gray-500 truncate">{mower.model || 'Unknown Model'}</p>
              </div>
            </div>
          </div>
          {current_status && (
            <div className="flex-shrink-0 ml-4">
              <StatusBadge activity={current_status.activity} size="sm" />
            </div>
          )}
        </div>

        {current_status ? (
          <div className="space-y-3">
            {/* Battery Section */}
            <BatteryCard 
              batteryPercent={current_status.battery_percent}
              size="sm"
            />

            {/* Mode Section */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-sm font-medium text-gray-700">Mode</span>
              </div>
              <span className="text-sm font-bold text-gray-900">
                {mowerService.formatMowerMode(current_status.mode)}
              </span>
            </div>

            {/* Error Alert */}
            {current_status.error_code !== 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                  <svg className="w-full h-full text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-800">Error Detected</p>
                  <p className="text-xs text-red-600 mt-1">Code: {current_status.error_code}</p>
                </div>
              </div>
            )}

            {/* Work Areas */}
            {current_status.work_areas && current_status.work_areas.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">Work Areas</span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-500">{current_status.work_areas.length}</span>
                </div>
                
                <div className="space-y-2">
                  {current_status.work_areas.slice(0, 2).map(area => (
                    <div key={area.workAreaId} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${area.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className={`text-sm font-medium truncate ${area.enabled ? 'text-gray-700' : 'text-gray-400'}`}>
                          {area.name}
                        </span>
                      </div>
                      {area.progress !== undefined && (
                        <span className="text-xs font-bold text-gray-600 ml-2">{area.progress}%</span>
                      )}
                    </div>
                  ))}
                  {current_status.work_areas.length > 2 && (
                    <div className="text-center py-2">
                      <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        +{current_status.work_areas.length - 2} more
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Auto-Resume Toggle */}
            <div className="border-t border-gray-100 pt-3">
              <AutoResumeToggle mowerId={mower.husqvarna_id} />
            </div>

            {/* Data Freshness */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                {(() => {
                  const dataAge = (() => {
                    if (!current_status.data_collected_at) {
                      return Infinity;
                    }
                    try {
                      const collectedAt = new Date(current_status.data_collected_at);
                      if (isNaN(collectedAt.getTime())) {
                        return Infinity;
                      }
                      const now = new Date();
                      const diffMs = now.getTime() - collectedAt.getTime();
                      const diffMinutes = Math.floor(diffMs / (1000 * 60));
                      return diffMinutes;
                    } catch {
                      return Infinity;
                    }
                  })();

                  if (dataAge === Infinity) {
                    return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
                  } else if (dataAge < 5) {
                    return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
                  } else if (dataAge < 30) {
                    return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
                  } else {
                    return <div className="w-2 h-2 bg-red-500 rounded-full" />;
                  }
                })()}
                <span className="text-xs font-medium text-gray-600">Data updated</span>
              </div>
              <span className="text-xs font-bold text-gray-900">
                {(() => {
                  if (!current_status.data_collected_at) {
                    return 'Unknown';
                  }
                  try {
                    const collectedAt = new Date(current_status.data_collected_at);
                    if (isNaN(collectedAt.getTime())) {
                      return 'Invalid';
                    }
                    const now = new Date();
                    const diffMs = now.getTime() - collectedAt.getTime();
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));
                    
                    if (diffMinutes < 1) {
                      return 'Just now';
                    } else if (diffMinutes < 60) {
                      return `${diffMinutes}m ago`;
                    } else if (diffMinutes < 1440) {
                      const diffHours = Math.floor(diffMinutes / 60);
                      return `${diffHours}h ago`;
                    } else {
                      const diffDays = Math.floor(diffMinutes / 1440);
                      return `${diffDays}d ago`;
                    }
                  } catch (error) {
                    console.error('Error formatting data collection time:', error);
                    return 'Error';
                  }
                })()}
              </span>
            </div>

            {/* Last Position */}
            {current_status.last_position && (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  <span className="text-xs font-medium text-gray-600">Last seen</span>
                </div>
                <span className="text-xs font-bold text-gray-900">
                  {(() => {
                    const timestamp = current_status.last_position.timestamp;
                    if (!timestamp || timestamp <= 0) {
                      return 'Unknown';
                    }
                    
                    try {
                      const date = new Date(timestamp * 1000);
                      if (isNaN(date.getTime())) {
                        return 'Invalid';
                      }
                      
                      const now = new Date();
                      const diffMs = now.getTime() - date.getTime();
                      const diffMinutes = Math.floor(diffMs / (1000 * 60));
                      
                      if (diffMinutes < 1) {
                        return 'Just now';
                      } else if (diffMinutes < 60) {
                        return `${diffMinutes}m ago`;
                      } else if (diffMinutes < 1440) { // 24 hours
                        const diffHours = Math.floor(diffMinutes / 60);
                        return `${diffHours}h ago`;
                      } else {
                        const diffDays = Math.floor(diffMinutes / 1440);
                        return `${diffDays}d ago`;
                      }
                    } catch (error) {
                      console.error('Error formatting timestamp:', error);
                      return 'Error';
                    }
                  })()}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Status Unavailable</p>
            <p className="text-xs text-gray-500">Mower data not synced yet</p>
          </div>
        )}
      </div>
    </div>
  );
}