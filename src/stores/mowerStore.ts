import { create } from 'zustand';
import { MowerService, type MowerWithStatus } from '@/services/mower';
import { supabase } from '@/lib/supabase';

interface MowerState {
  // State
  mowers: MowerWithStatus[];
  selectedMowerId: string | null;
  isLoading: boolean;
  error: string | null;
  hasDiscovered: boolean;

  // Actions
  discoverMowers: (sessionId: string) => Promise<void>;
  loadMowers: (sessionId: string) => Promise<void>;
  selectMower: (mowerId: string) => void;
  updateMowerName: (mowerId: string, name: string) => Promise<void>;
  deleteMower: (mowerId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const mowerService = new MowerService();

export const useMowerStore = create<MowerState>((set, get) => ({
  // Initial state
  mowers: [],
  selectedMowerId: null,
  isLoading: false,
  error: null,
  hasDiscovered: false,

  // Actions
  discoverMowers: async (sessionId: string) => {
    try {
      set({ isLoading: true, error: null });

      const mowers = await mowerService.discoverMowers(sessionId);
      
      set({
        mowers,
        hasDiscovered: true,
        isLoading: false,
        // Auto-select first mower if none selected
        selectedMowerId: get().selectedMowerId || (mowers.length > 0 ? mowers[0].id : null),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to discover mowers';
      console.error('Discover mowers error:', error);
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  loadMowers: async (sessionId: string) => {
    try {
      set({ isLoading: true, error: null });

      const profiles = await mowerService.getMowerProfiles(sessionId);
      
      // For each profile, get the latest EPOS data to show last known status
      const mowersWithStatus: MowerWithStatus[] = await Promise.all(
        profiles.map(async (profile) => {
          try {
            // Get latest EPOS snapshot for this mower
            const { data: latestSnapshot } = await supabase
              .from('epos_data_snapshots')
              .select('*')
              .eq('mower_id', profile.husqvarna_id)
              .order('collected_at', { ascending: false })
              .limit(1)
              .single();

            if (latestSnapshot) {
              // Create status from latest EPOS data
              const current_status = {
                activity: latestSnapshot.activity,
                mode: latestSnapshot.mode,
                state: latestSnapshot.state,
                battery_percent: latestSnapshot.battery_level,
                error_code: latestSnapshot.error_code,
                last_position: latestSnapshot.latitude && latestSnapshot.longitude ? {
                  latitude: latestSnapshot.latitude,
                  longitude: latestSnapshot.longitude,
                  timestamp: Math.floor(new Date(latestSnapshot.collected_at).getTime() / 1000)
                } : null,
                work_areas: latestSnapshot.work_areas || [],
                data_collected_at: latestSnapshot.collected_at
              };

              return {
                ...profile,
                current_status
              };
            } else {
              // No EPOS data found
              return {
                ...profile,
                current_status: null
              };
            }
          } catch (error) {
            console.warn(`Could not load EPOS data for mower ${profile.husqvarna_id}:`, error);
            return {
              ...profile,
              current_status: null
            };
          }
        })
      );

      set({
        mowers: mowersWithStatus,
        isLoading: false,
        hasDiscovered: true, // Mark as discovered so useEffect doesn't loop
        // Auto-select first mower if none selected
        selectedMowerId: get().selectedMowerId || (mowersWithStatus.length > 0 ? mowersWithStatus[0].id : null),
      });

      const mowersWithData = mowersWithStatus.filter(m => m.current_status !== null).length;
      console.log(`✅ Loaded ${profiles.length} mower profiles from database (${mowersWithData} with EPOS data)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load mowers';
      console.error('Load mowers error:', error);
      
      // Don't treat "no profiles found" as an error - set empty state
      set({
        mowers: [],
        isLoading: false,
        hasDiscovered: true, // Still mark as discovered to prevent loops
        error: null, // Don't show error for empty profiles
      });
      console.log('No mower profiles found in database - user needs to discover mowers first');
    }
  },

  selectMower: (mowerId: string) => {
    const { mowers } = get();
    const mower = mowers.find(m => m.id === mowerId);
    
    if (mower) {
      set({ selectedMowerId: mowerId });
    }
  },

  updateMowerName: async (mowerId: string, name: string) => {
    try {
      set({ isLoading: true, error: null });

      const updatedProfile = await mowerService.updateMowerName(mowerId, name);
      
      // Update the mower in the state
      set(state => ({
        mowers: state.mowers.map(mower => 
          mower.id === mowerId 
            ? { ...mower, name: updatedProfile.name }
            : mower
        ),
        isLoading: false,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update mower name';
      console.error('Update mower name error:', error);
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  deleteMower: async (mowerId: string) => {
    try {
      set({ isLoading: true, error: null });

      await mowerService.deleteMowerProfile(mowerId);
      
      // Remove the mower from state
      set(state => ({
        mowers: state.mowers.filter(mower => mower.id !== mowerId),
        selectedMowerId: state.selectedMowerId === mowerId ? null : state.selectedMowerId,
        isLoading: false,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete mower';
      console.error('Delete mower error:', error);
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      mowers: [],
      selectedMowerId: null,
      isLoading: false,
      error: null,
      hasDiscovered: false,
    });
  },
}));

// Helper hooks for easier usage
export const useMowers = () => {
  const store = useMowerStore();
  
  return {
    mowers: store.mowers,
    selectedMower: store.selectedMowerId 
      ? store.mowers.find(m => m.id === store.selectedMowerId) || null
      : null,
    selectedMowerId: store.selectedMowerId,
    isLoading: store.isLoading,
    error: store.error,
    hasDiscovered: store.hasDiscovered,
    hasMowers: store.mowers.length > 0,
  };
};

export const useMowerActions = () => {
  const { discoverMowers, loadMowers, selectMower, updateMowerName, deleteMower, clearError, reset } = useMowerStore();
  
  return {
    discoverMowers,
    loadMowers,
    selectMower,
    updateMowerName,
    deleteMower,
    clearError,
    reset,
  };
};