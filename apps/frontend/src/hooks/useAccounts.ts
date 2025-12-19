/**
 * Account Hooks
 * React Query hooks for account operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Query keys
export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...accountKeys.lists(), filters] as const,
  details: () => [...accountKeys.all, 'detail'] as const,
  detail: (wallet: string) => [...accountKeys.details(), wallet] as const,
  history: (wallet: string) => [...accountKeys.detail(wallet), 'history'] as const,
};

/**
 * Get all accounts
 */
export function useAccounts(params?: { isActive?: boolean; protocol?: string }) {
  return useQuery({
    queryKey: accountKeys.list(params || {}),
    queryFn: () => api.getAccounts(params),
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Get single account by wallet address
 */
export function useAccount(walletAddress: string) {
  return useQuery({
    queryKey: accountKeys.detail(walletAddress),
    queryFn: () => api.getAccount(walletAddress),
    enabled: !!walletAddress,
    staleTime: 5000, // 5 seconds
  });
}

/**
 * Get account snapshot history
 */
export function useAccountHistory(
  walletAddress: string,
  params?: { limit?: number; since?: string }
) {
  return useQuery({
    queryKey: accountKeys.history(walletAddress),
    queryFn: () => api.getAccountHistory(walletAddress, params),
    enabled: !!walletAddress,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Add account to monitoring
 */
export function useAddAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ walletAddress, protocol }: { walletAddress: string; protocol: string }) =>
      api.addAccount(walletAddress, protocol),
    onSuccess: () => {
      // Invalidate accounts list
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

/**
 * Remove account from monitoring
 */
export function useRemoveAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (walletAddress: string) => api.removeAccount(walletAddress),
    onSuccess: (_, walletAddress) => {
      // Invalidate accounts list and specific account
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(walletAddress) });
    },
  });
}

/**
 * Get accounts at risk (risk score >= 30)
 */
export function useAccountsAtRisk() {
  const { data: accounts, ...rest } = useAccounts({ isActive: true });

  const atRiskAccounts = accounts?.filter((account) => {
    const latestSnapshot = account.snapshots?.[0];
    return latestSnapshot && latestSnapshot.riskScore >= 30;
  });

  return {
    data: atRiskAccounts,
    ...rest,
  };
}
