import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthService } from '@/services/auth';
import type { AuthSession } from '@/lib/database.types';

interface User {
  email: string;
  sessionId: string;
}

interface AuthState {
  // State
  user: User | null;
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initiateOAuth: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

const authService = new AuthService();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      session: null,
      isLoading: false,
      error: null,

      // Actions
      initiateOAuth: async () => {
        try {
          set({ isLoading: true, error: null });

          // Generate OAuth URL and redirect (email will come from OAuth callback)
          const oauthUrl = await authService.initiateHusqvarnaOAuth();
          
          // Redirect to Husqvarna OAuth page
          window.location.href = oauthUrl;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'OAuth initiation failed';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          const { user } = get();
          if (user?.sessionId) {
            await authService.logout(user.sessionId);
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            session: null,
            error: null,
          });
          
          // Reset mower store when logging out
          // Import is done dynamically to avoid circular dependency
          import('@/stores/mowerStore').then(({ useMowerStore }) => {
            useMowerStore.getState().reset();
          });
        }
      },

      refreshSession: async () => {
        try {
          const { user } = get();
          if (!user?.sessionId) {
            throw new Error('No session to refresh');
          }

          set({ isLoading: true, error: null });

          const refreshedSession = await authService.refreshTokens(user.sessionId);
          
          set({
            session: refreshedSession,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Session refresh failed';
          set({
            error: errorMessage,
            isLoading: false,
          });
          
          // If refresh fails, clear the session
          if (errorMessage.includes('Session not found') || errorMessage.includes('refresh')) {
            set({
              user: null,
              session: null,
            });
          }
          
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'optimow-auth-store',
      // Persist both user and session data for authentication
      partialize: (state) => ({
        user: state.user,
        session: state.session,
      }),
    }
  )
);

// Helper hooks for common auth operations
export const useAuth = () => {
  const store = useAuthStore();
  
  return {
    ...store,
    isAuthenticated: !!store.user && !!store.session,
  };
};

export const useAuthActions = () => {
  const { initiateOAuth, logout, refreshSession, clearError, setLoading } = useAuthStore();
  
  return {
    initiateOAuth,
    logout,
    refreshSession,
    clearError,
    setLoading,
  };
};