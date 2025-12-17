/**
 * Rates Hooks
 * React Query hooks for protocol rate operations
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useNetwork } from '../contexts';

// Types
export interface TokenRate {
  token: string;
  symbol: string;
  mint: string;
  supplyApy: number;
  borrowApy: number;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  ltv: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
}

export interface ProtocolRates {
  protocol: 'DRIFT' | 'KAMINO' | 'SAVE' | 'LOOPSCALE';
  network: string;
  rates: TokenRate[];
  tvl: number;
  updatedAt: string;
}

export interface BestRate {
  protocol: string;
  rate: number;
}

export interface AggregatedRates {
  protocols: ProtocolRates[];
  bestSupplyRates: Map<string, BestRate>;
  bestBorrowRates: Map<string, BestRate>;
  updatedAt: string;
}

export interface TokenComparison {
  token: string;
  rates: {
    protocol: string;
    supplyApy: number;
    borrowApy: number;
    ltv: number;
  }[];
  bestSupply: BestRate;
  bestBorrow: BestRate;
}

// Query keys
export const ratesKeys = {
  all: ['rates'] as const,
  aggregated: (network: string) => [...ratesKeys.all, 'aggregated', network] as const,
  protocol: (protocol: string, network: string) => [...ratesKeys.all, 'protocol', protocol, network] as const,
  compare: (token: string, network: string) => [...ratesKeys.all, 'compare', token, network] as const,
  best: (network: string) => [...ratesKeys.all, 'best', network] as const,
};


/**
 * Get all rates from all protocols
 */
export function useAllRates() {
  const { network } = useNetwork();
  
  return useQuery({
    queryKey: ratesKeys.aggregated(network),
    queryFn: () => api.getAllRates(network),
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 10000, // Refetch every 10 seconds in background
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

/**
 * Get rates for a specific protocol
 */
export function useProtocolRates(protocol: 'DRIFT' | 'KAMINO' | 'SAVE' | 'LOOPSCALE') {
  const { network } = useNetwork();
  
  return useQuery({
    queryKey: ratesKeys.protocol(protocol, network),
    queryFn: () => api.getProtocolRates(protocol, network),
    staleTime: 5000,
    refetchInterval: 5000,
  });
}

/**
 * Compare rates for a specific token across protocols
 */
export function useTokenComparison(token: string) {
  const { network } = useNetwork();
  
  return useQuery({
    queryKey: ratesKeys.compare(token, network),
    queryFn: () => api.compareTokenRates(token, network),
    staleTime: 5000,
    enabled: !!token,
  });
}

/**
 * Get best rates for all tokens
 */
export function useBestRates() {
  const { network } = useNetwork();
  
  return useQuery({
    queryKey: ratesKeys.best(network),
    queryFn: () => api.getBestRates(network),
    staleTime: 5000,
    refetchInterval: 5000,
  });
}

/**
 * Get formatted rates for display
 */
export function useFormattedRates() {
  const { data, ...rest } = useAllRates();

  const formatted = data ? {
    protocols: data.protocols.map((p: ProtocolRates) => ({
      ...p,
      tvlFormatted: formatTvl(p.tvl),
      rates: p.rates.map((r: TokenRate) => ({
        ...r,
        supplyApyFormatted: `${r.supplyApy.toFixed(2)}%`,
        borrowApyFormatted: `${r.borrowApy.toFixed(2)}%`,
        utilizationFormatted: `${r.utilization.toFixed(1)}%`,
      })),
    })),
    updatedAt: data.updatedAt,
    timeSinceUpdate: getTimeSinceUpdate(data.updatedAt),
  } : null;

  return {
    data: formatted,
    raw: data,
    ...rest,
  };
}

// Helper functions
function formatTvl(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function getTimeSinceUpdate(updatedAt: string): string {
  const seconds = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
