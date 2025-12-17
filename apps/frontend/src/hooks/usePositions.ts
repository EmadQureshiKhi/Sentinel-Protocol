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
  protocol: 'DRIFT' | 'KAMINO' | 'SAVE' | 'LOOPSCALE';
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
  protocol: 'DRIFT' | 'KAMINO' | 'SAVE' | 'LOOPSCALE';
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

export interface Transaction {
  id: string;
  type: 'POSITION_OPEN' | 'PROTECTIVE_SWAP';
  timestamp: string;
  protocol: string;
  status: string;
  txSignature?: string | null;
  details: {
    collateralToken?: string;
    collateralAmount?: number;
    borrowToken?: string;
    borrowAmount?: number;
    leverage?: number;
    fromToken?: string;
    toToken?: string;
    inputAmount?: number;
    outputAmount?: number;
    mevSaved?: number | null;
  };
}

// Query keys
export const positionKeys = {
  all: ['positions'] as const,
  list: (wallet: string, network: string) => [...positionKeys.all, 'list', wallet, network] as const,
  detail: (id: string) => [...positionKeys.all, 'detail', id] as const,
  quote: (params: PositionQuoteRequest) => [...positionKeys.all, 'quote', params] as const,
  transactions: (wallet: string) => [...positionKeys.all, 'transactions', wallet] as const,
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
      queryClient.invalidateQueries({
        queryKey: positionKeys.transactions(variables.walletAddress),
      });
    },
  });
}

/**
 * Get transaction history (positions + swaps)
 */
export function useTransactionHistory(walletAddress?: string, limit = 50) {
  return useQuery({
    queryKey: positionKeys.transactions(walletAddress || ''),
    queryFn: () => api.getTransactionHistory(walletAddress!, limit),
    enabled: !!walletAddress,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

// Token mint addresses
export const TOKEN_MINTS: Record<string, string> = {
  // Native & Wrapped
  SOL: 'So11111111111111111111111111111111111111112',
  wSOL: 'So11111111111111111111111111111111111111112',
  // Stablecoins
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  PYUSD: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
  // Liquid Staking Tokens
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  bSOL: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  stSOL: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
  INF: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm',
  // Wrapped BTC & ETH
  wBTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  wETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  tBTC: '6DNSN2BJsaPFdFFc1zP37kkeNe4Usc1Sqkzr9C9vPWcU',
  // Other popular tokens
  JTO: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  RNDR: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
  HNT: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
};

export const SUPPORTED_TOKENS = [
  'SOL', 'USDC', 'USDT', 'PYUSD',
  'mSOL', 'jitoSOL', 'bSOL', 'stSOL', 'INF',
  'wBTC', 'wETH', 'tBTC',
  'JTO', 'JUP', 'BONK', 'WIF'
];

export const COLLATERAL_TOKENS = [
  'SOL', 'mSOL', 'jitoSOL', 'bSOL', 'stSOL', 'INF',
  'wBTC', 'wETH', 'tBTC',
  'JTO', 'JUP'
];

export const BORROW_TOKENS = ['USDC', 'USDT', 'PYUSD', 'SOL', 'wETH', 'wBTC'];
