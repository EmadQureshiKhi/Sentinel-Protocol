/**
 * Protection Hooks
 * React Query hooks for protection/swap operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Query keys
export const protectionKeys = {
  all: ['protection'] as const,
  quotes: () => [...protectionKeys.all, 'quote'] as const,
  quote: (params: Record<string, any>) => [...protectionKeys.quotes(), params] as const,
  history: () => [...protectionKeys.all, 'history'] as const,
  historyList: (filters: Record<string, any>) => [...protectionKeys.history(), filters] as const,
  details: () => [...protectionKeys.all, 'detail'] as const,
  detail: (id: string) => [...protectionKeys.details(), id] as const,
};

/**
 * Get protection quote
 */
export function useProtectionQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps?: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: protectionKeys.quote({ inputMint, outputMint, amount, slippageBps }),
    queryFn: () => api.getProtectionQuote(inputMint, outputMint, amount, slippageBps),
    enabled: enabled && !!inputMint && !!outputMint && amount > 0,
    staleTime: 5000, // 5 seconds - quotes expire quickly
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Execute protection swap
 */
export function useExecuteProtection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      walletAddress: string;
      inputMint: string;
      outputMint: string;
      amount: number;
      slippageBps?: number;
      useJito?: boolean;
    }) => api.executeProtection(params),
    onSuccess: () => {
      // Invalidate protection history
      queryClient.invalidateQueries({ queryKey: protectionKeys.history() });
    },
  });
}

/**
 * Get protection/swap history
 */
export function useProtectionHistory(params?: {
  accountId?: string;
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: protectionKeys.historyList(params || {}),
    queryFn: () => api.getProtectionHistory(params),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get single protection/swap by ID
 */
export function useProtection(id: string) {
  return useQuery({
    queryKey: protectionKeys.detail(id),
    queryFn: () => api.getProtection(id),
    enabled: !!id,
    staleTime: 5000,
  });
}

/**
 * Get recent successful swaps
 */
export function useRecentSwaps(limit: number = 10) {
  return useProtectionHistory({ status: 'CONFIRMED', limit });
}

/**
 * Get pending swaps
 */
export function usePendingSwaps() {
  const { data: history, ...rest } = useProtectionHistory();

  const pendingSwaps = history?.filter(
    (swap) => swap.status === 'PENDING' || swap.status === 'SIMULATING' || swap.status === 'SUBMITTED'
  );

  return {
    data: pendingSwaps,
    ...rest,
  };
}
