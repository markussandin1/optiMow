import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time - how long data is considered fresh
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Cache time - how long inactive data stays in cache  
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
      // Retry failed requests
      retry: (failureCount, error) => {
        // Don't retry on authentication errors
        if (error instanceof Error && error.message.includes('Authentication required')) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

// Query keys factory for consistent key management
export const queryKeys = {
  // Auth related
  auth: {
    session: (email: string) => ['auth', 'session', email] as const,
    currentUser: () => ['auth', 'currentUser'] as const,
  },
  
  // Mower related (for future iterations)
  mowers: {
    all: () => ['mowers'] as const,
    byId: (id: string) => ['mowers', id] as const,
    profiles: (sessionId: string) => ['mowers', 'profiles', sessionId] as const,
  },
  
  // Data collection (for future iterations)
  data: {
    latest: (mowerId: string) => ['data', 'latest', mowerId] as const,
    history: (mowerId: string, timeRange: string) => ['data', 'history', mowerId, timeRange] as const,
    workArea: (mowerId: string) => ['data', 'workArea', mowerId] as const,
  },
} as const;