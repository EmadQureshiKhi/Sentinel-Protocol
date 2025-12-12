/**
 * Position Hooks
 * React Query hooks for position management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNetwork } from '../contexts';
import { useWallet } from '../contexts';

// Types
export interface PositionQuoteRequest {
  walletAddress: string;
  collateralToken: string;
  collateralAmount: number;
  borrowToken: string;
  leverage: number;
  protocol?: string;
}

export interface ProtocolQuote {
  protocol: 'DRIFT' | 'MARGINFI' | 'SOLEND';
  supplyApy: number;
  borrowApy: number;
  netApy: number;
  maxLtv: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
  liquidationPrice: number;
  healthFactor: number;
  borrowAmount: number;
  totalPositionValue: number;
  estimatedFees: {
    protocolFee: number;
    networkFee: number;
    total: number;
  };
  isRecommended: boolean;
  recommendationReason?: string;
}

export interface PositionQuote {
  request: PositionQuoteRequest;
  collateralValueUsd: number;
  borrowValueUsd: number;
  quotes: ProtocolQuote[];
  bestQuote: ProtocolQuote;
  currentPrices: {
    collateral: number;
    borrow: number;
  };
  timestamp: string;
}

export interface Position {
  id: string;
  walletAddress: string;
  protocol: 'DRIFT' | 'MARGINFI' | 'SOLEND';
  network: string;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  collateralToken: string;
  collateralMint: string;
  collateralAmount: number;
  borrowToken: string;
  borrowMint: string;
  borrowAmount: number;
  leverage: number;
  entryPrice: number;
  liquidationPrice: number;
  openHealthFactor: number;
  currentHealthFactor?: number;
  currentValue?: number;
  unrealizedPnl?: number;
  openedAt: string;
  closedAt?: string;
}

// Query keys
export const positionKeys = {
  all: ['positions'] as const,
  list: (wallet: string, network: string) => [...positionKeys.all, 'list', wallet, network] as const,
  detail: (id: string) => [...positionKeys.all, 'detail', id] as const,
  quote: (params: PositionQuoteRequest) => [...positionKeys.all, 'quote', params] as const,
};


/**
 * Get position quote with debounce
 */
export function usePositionQuote(params: Partial<PositionQuoteRequest> | null) {
  const { network } = useNetwork();
  const [debouncedParams, setDebouncedParams] = useState(params);

  // Debounce params changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedParams(params);
    }, 300);
    return () => clearTimeout(timer);
  }, [params]);

  const isValid = debouncedParams &&
    debouncedParams.walletAddress &&
    debouncedParams.collateralToken &&
    debouncedParams.collateralAmount &&
    debouncedParams.collateralAmount > 0 &&
    debouncedParams.borrowToken &&
    debouncedParams.leverage &&
    debouncedParams.leverage >= 1.1;

  return useQuery({
    queryKey: positionKeys.quote(debouncedParams as PositionQuoteRequest),
    queryFn: () => api.getPositionQuote({
      ...debouncedParams as PositionQuoteRequest,
      network,
    }),
    enabled: !!isValid,
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

/**
 * Get user's positions
 */
export function useUserPositions(walletAddress?: string) {
  const { network } = useNetwork();

  return useQuery({
    queryKey: positionKeys.list(walletAddress || '', network),
    queryFn: () => api.getUserPositions(walletAddress!, { network }),
    enabled: !!walletAddress,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Get position details
 */
export function usePosition(id: string) {
  return useQuery({
    queryKey: positionKeys.detail(id),
    queryFn: () => api.getPosition(id),
    enabled: !!id,
    staleTime: 5000,
  });
}

/**
 * Open position mutation
 */
export function useOpenPosition() {
  const queryClient = useQueryClient();
  const { network } = useNetwork();

  return useMutation({
    mutationFn: (params: {
      walletAddress: string;
      protocol: string;
      collateralToken: string;
      collateralMint: string;
      collateralAmount: number;
      borrowToken: string;
      borrowMint: string;
      borrowAmount: number;
      leverage: number;
      slippageBps?: number;
      autoMonitor?: boolean;
      enableAlerts?: boolean;
    }) => api.openPosition({ ...params, network }),
    onSuccess: (_, variables) => {
      // Invalidate positions list
      queryClient.invalidateQueries({
        queryKey: positionKeys.list(variables.walletAddress, network),
      });
    },
  });
}

/**
 * Close position mutation
 */
export function useClosePosition() {
  const queryClient = useQueryClient();
  const { network } = useNetwork();

  return useMutation({
    mutationFn: (params: {
      positionId: string;
      walletAddress: string;
      slippageBps?: number;
    }) => api.closePosition(params.positionId, {
      walletAddress: params.walletAddress,
      slippageBps: params.slippageBps,
      network,
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: positionKeys.detail(variables.positionId),
      });
      queryClient.invalidateQueries({
        queryKey: positionKeys.list(variables.walletAddress, network),
      });
    },
  });
}

// Token mint addresses
export const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
};

export const SUPPORTED_TOKENS = ['SOL', 'USDC', 'USDT', 'mSOL', 'jitoSOL'];
export const COLLATERAL_TOKENS = ['SOL', 'mSOL', 'jitoSOL'];
export const BORROW_TOKENS = ['USDC', 'USDT'];
