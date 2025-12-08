/**
 * Stats Hooks
 * React Query hooks for statistics operations
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

// Query keys
export const statsKeys = {
  all: ['stats'] as const,
  overview: () => [...statsKeys.all, 'overview'] as const,
  mevSavings: () => [...statsKeys.all, 'mev-savings'] as const,
  daily: (date?: string) => [...statsKeys.all, 'daily', date] as const,
  history: (days?: number) => [...statsKeys.all, 'history', days] as const,
};

/**
 * Get overview stats
 */
export function useStats() {
  return useQuery({
    queryKey: statsKeys.overview(),
    queryFn: () => api.getOverviewStats(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 15000, // Refetch every 15 seconds
  });
}

/**
 * Get MEV savings stats
 */
export function useMevSavings() {
  return useQuery({
    queryKey: statsKeys.mevSavings(),
    queryFn: () => api.getMevSavings(),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get daily stats
 */
export function useDailyStats(date?: string) {
  return useQuery({
    queryKey: statsKeys.daily(date),
    queryFn: () => api.getDailyStats(date),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get stats history
 */
export function useStatsHistory(days: number = 7) {
  return useQuery({
    queryKey: statsKeys.history(days),
    queryFn: () => api.getStatsHistory(days),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get formatted stats for display
 */
export function useFormattedStats() {
  const { data: stats, ...rest } = useStats();

  const formatted = stats
    ? {
        totalAccounts: stats.totalAccounts.toLocaleString(),
        atRiskAccounts: stats.atRiskAccounts.toLocaleString(),
        activeAlerts: stats.activeAlerts.toLocaleString(),
        totalSwaps: stats.totalSwaps.toLocaleString(),
        totalMevSaved: formatMevSaved(stats.totalMevSaved),
        totalMevSavedUsd: formatUsd(stats.totalMevSaved / 1e9 * 140), // Rough SOL price
      }
    : null;

  return {
    data: formatted,
    raw: stats,
    ...rest,
  };
}

// Helper functions
function formatMevSaved(lamports: number): string {
  const sol = lamports / 1e9;
  if (sol >= 1000) {
    return `${(sol / 1000).toFixed(2)}K SOL`;
  }
  return `${sol.toFixed(4)} SOL`;
}

function formatUsd(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}
