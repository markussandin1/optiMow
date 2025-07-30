import { useState, useEffect } from 'react';
import { AutoResumeService } from '@/lib/database.service';

interface AutoResumeToggleProps {
  mowerId: string;
  className?: string;
}

interface AutoResumeSettings {
  enabled: boolean;
  manual_intervention_required: boolean;
  current_attempt_count: number;
  last_error_state: string | null;
}

export function AutoResumeToggle({ mowerId, className = '' }: AutoResumeToggleProps) {
  const [settings, setSettings] = useState<AutoResumeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [mowerId]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await AutoResumeService.getAutoResumeSettings(mowerId);
      setSettings(data || {
        enabled: false,
        manual_intervention_required: false,
        current_attempt_count: 0,
        last_error_state: null
      });
    } catch (err) {
      console.error('Failed to load auto-resume settings:', err);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!settings || isUpdating) return;

    try {
      setIsUpdating(true);
      setError(null);
      
      const newEnabled = !settings.enabled;
      await AutoResumeService.setAutoResumeEnabled(mowerId, newEnabled);
      
      setSettings({
        ...settings,
        enabled: newEnabled,
        // Reset intervention flag when enabling
        manual_intervention_required: newEnabled ? false : settings.manual_intervention_required
      });
    } catch (err) {
      console.error('Failed to toggle auto-resume:', err);
      setError('Failed to update setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetIntervention = async () => {
    if (!settings || isUpdating) return;

    try {
      setIsUpdating(true);
      setError(null);
      
      await AutoResumeService.resetManualIntervention(mowerId);
      
      setSettings({
        ...settings,
        manual_intervention_required: false,
        current_attempt_count: 0,
        last_error_state: null
      });
    } catch (err) {
      console.error('Failed to reset manual intervention:', err);
      setError('Failed to reset');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={`text-sm text-red-600 ${className}`}>
        Failed to load auto-resume settings
      </div>
    );
  }

  const getStatusText = () => {
    if (settings.manual_intervention_required) {
      return 'Manual intervention required';
    }
    if (settings.enabled && settings.current_attempt_count > 0) {
      return `Auto-resume active (${settings.current_attempt_count}/3 attempts)`;
    }
    return settings.enabled ? 'Auto-resume enabled' : 'Auto-resume disabled';
  };

  const getStatusColor = () => {
    if (settings.manual_intervention_required) {
      return 'text-red-600';
    }
    if (settings.enabled && settings.current_attempt_count > 0) {
      return 'text-yellow-600';
    }
    return settings.enabled ? 'text-green-600' : 'text-gray-500';
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Toggle Switch */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">Auto-Resume</span>
          <span className={`text-xs ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={isUpdating || settings.manual_intervention_required}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${settings.enabled 
              ? 'bg-orange-600' 
              : 'bg-gray-200'
            }
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* Manual Intervention Required */}
      {settings.manual_intervention_required && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 15c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-2 flex-1">
              <p className="text-xs text-red-800">
                A serious error was detected. Please check your mower manually before re-enabling auto-resume.
              </p>
              <button
                onClick={handleResetIntervention}
                disabled={isUpdating}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline disabled:opacity-50"
              >
                {isUpdating ? 'Resetting...' : 'Mark as resolved'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Text */}
      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        <p className="font-medium mb-1">How Auto-Resume Works:</p>
        <ul className="space-y-0.5 text-xs">
          <li>• Automatically attempts to resume after temporary errors</li>
          <li>• Tries up to 3 times with 5 minutes between attempts</li>
          <li>• Serious errors always require manual intervention</li>
          <li>• Resets attempt counter when mower recovers normally</li>
        </ul>
      </div>
    </div>
  );
}