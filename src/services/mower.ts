import { supabase } from '@/lib/supabase';

export interface MowerProfile {
  id: string;
  session_id: string;
  husqvarna_id: string;
  name: string;
  model: string | null;
  created_at: string;
}

export interface MowerStatus {
  activity: string;
  mode: string;
  state: string;
  battery_percent: number;
  error_code: number;
  last_position: {
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null;
  work_areas: Array<{
    workAreaId: number;
    name: string;
    cuttingHeight: number;
    enabled: boolean;
    progress?: number;
  }>;
  data_collected_at?: string;
}

export interface MowerWithStatus extends MowerProfile {
  current_status: MowerStatus | null;
}

export interface MowerDiscoveryResponse {
  success: boolean;
  mowers: MowerWithStatus[];
  count: number;
}

export class MowerService {
  private readonly MOWER_DISCOVERY_FUNCTION = 'mower-discovery';

  /**
   * Discover and store mowers from Husqvarna API
   */
  async discoverMowers(sessionId: string): Promise<MowerWithStatus[]> {
    try {

      const { data, error } = await supabase.functions.invoke(this.MOWER_DISCOVERY_FUNCTION, {
        body: { sessionId }
      });

      if (error) {
        console.error('Mower discovery Edge Function error:', error);
        throw new Error(error.message || 'Failed to discover mowers');
      }

      if (!data || !data.success) {
        console.error('Mower discovery returned unsuccessful response:', data);
        const errorMessage = data?.message || data?.error || 'Mower discovery failed';
        throw new Error(errorMessage);
      }

      return data.mowers;

    } catch (error) {
      console.error('Mower discovery failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to discover mowers');
    }
  }

  /**
   * Get stored mower profiles for a session
   */
  async getMowerProfiles(sessionId: string): Promise<MowerProfile[]> {
    try {
      const { data, error } = await supabase
        .from('mower_profiles')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch mower profiles:', error);
        throw new Error('Failed to load mower profiles');
      }

      return data || [];

    } catch (error) {
      console.error('Get mower profiles failed:', error);
      throw new Error('Failed to load mower profiles');
    }
  }

  /**
   * Get a single mower profile by ID
   */
  async getMowerProfile(mowerId: string): Promise<MowerProfile | null> {
    try {
      const { data, error } = await supabase
        .from('mower_profiles')
        .select('*')
        .eq('id', mowerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows found
        }
        console.error('Failed to fetch mower profile:', error);
        throw new Error('Failed to load mower profile');
      }

      return data;

    } catch (error) {
      console.error('Get mower profile failed:', error);
      throw new Error('Failed to load mower profile');
    }
  }

  /**
   * Update mower profile name
   */
  async updateMowerName(mowerId: string, name: string): Promise<MowerProfile> {
    try {
      const { data, error } = await supabase
        .from('mower_profiles')
        .update({ name })
        .eq('id', mowerId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update mower name:', error);
        throw new Error('Failed to update mower name');
      }

      return data;

    } catch (error) {
      console.error('Update mower name failed:', error);
      throw new Error('Failed to update mower name');
    }
  }

  /**
   * Delete mower profile
   */
  async deleteMowerProfile(mowerId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('mower_profiles')
        .delete()
        .eq('id', mowerId);

      if (error) {
        console.error('Failed to delete mower profile:', error);
        throw new Error('Failed to delete mower profile');
      }

    } catch (error) {
      console.error('Delete mower profile failed:', error);
      throw new Error('Failed to delete mower profile');
    }
  }

  /**
   * Helper method to format mower activity status for display
   */
  formatMowerActivity(activity: string): string {
    const activityMap: Record<string, string> = {
      'UNKNOWN': 'Unknown',
      'MOWING': 'Mowing',
      'GOING_HOME': 'Going Home',
      'CHARGING': 'Charging',
      'LEAVING': 'Leaving',
      'PARKED_IN_CS': 'Parked',
      'STOPPED_IN_GARDEN': 'Stopped',
    };

    return activityMap[activity] || activity;
  }

  /**
   * Helper method to format mower mode for display
   */
  formatMowerMode(mode: string): string {
    const modeMap: Record<string, string> = {
      'MAIN_AREA': 'Main Area',
      'SECONDARY_AREA': 'Secondary Area',
      'HOME': 'Home',
      'DEMO': 'Demo',
      'UNKNOWN': 'Unknown',
    };

    return modeMap[mode] || mode;
  }

  /**
   * Helper method to get battery level color based on percentage
   */
  getBatteryColor(batteryPercent: number): string {
    if (batteryPercent >= 75) return 'text-green-600';
    if (batteryPercent >= 50) return 'text-yellow-600';
    if (batteryPercent >= 25) return 'text-orange-600';
    return 'text-red-600';
  }

  /**
   * Helper method to get activity status color
   */
  getActivityColor(activity: string): string {
    const colorMap: Record<string, string> = {
      'MOWING': 'text-green-600',
      'CHARGING': 'text-blue-600',
      'GOING_HOME': 'text-yellow-600',
      'LEAVING': 'text-yellow-600',
      'PARKED_IN_CS': 'text-gray-600',
      'STOPPED_IN_GARDEN': 'text-red-600',
      'UNKNOWN': 'text-gray-500',
    };

    return colorMap[activity] || 'text-gray-500';
  }
}