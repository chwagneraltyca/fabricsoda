/**
 * QueryClient Context
 *
 * Provides TanStack Query client for data caching, optimistic updates,
 * and request deduplication across the workload.
 *
 * Configuration:
 * - staleTime: 30s - Data considered fresh, no refetch
 * - gcTime: 5 min - Keep cached data for 5 minutes
 * - refetchOnWindowFocus: true - Refresh when user returns to tab
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/overview
 */

import React from 'react';
import { QueryClient, QueryClientProvider as TanStackQueryClientProvider } from '@tanstack/react-query';

// Create QueryClient instance with optimized defaults for Fabric workload
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 30 seconds - no refetch during this time
      staleTime: 30 * 1000,

      // Keep cached data for 5 minutes (garbage collection time)
      gcTime: 5 * 60 * 1000,

      // Retry failed requests once
      retry: 1,

      // Refetch when window regains focus
      refetchOnWindowFocus: true,

      // Don't refetch on mount if data exists
      refetchOnMount: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

/**
 * Get the QueryClient instance for use outside of React components
 * (e.g., in hooks or service functions)
 */
export function getQueryClient(): QueryClient {
  return queryClient;
}

interface QueryClientProviderProps {
  children: React.ReactNode;
}

/**
 * QueryClientProvider wrapper for the workload
 *
 * Wrap your component tree with this provider to enable TanStack Query features.
 */
export const QueryClientProvider: React.FC<QueryClientProviderProps> = ({ children }) => {
  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
    </TanStackQueryClientProvider>
  );
};
