/**
 * Portfolio Hooks
 * React Query hooks for portfolio management
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useNetwork } from '../contexts';

// Types
export interface PortfolioSummary {
  walletAddress: string;
  network: string;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  netWorth: number;
  aggregateHealthFactor: number;
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  liquidatedPositions: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  updatedAt: string;
}

export interface PortfolioPosition {
  id: string;
  protocol: 'DRIFT' | 'KAMINO' | 'SAVE' | 'LOOPSCALE';
  network: string;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  collateralToken: string;
  collateralAmount: number;
  collateralValueUsd: number;
  borrowToken: string;
  borrowAmount: number;
  borrowValueUsd: number;
  leverage: number;
  healthFactor: number;
  liquidationPrice: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  openedAt: string;
}

export interface PortfolioHistory {
  timestamp: string;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  netWorth: number;
  aggregateHealthFactor: number;
}

export interface PnLBreakdown {
  walletAddress: string;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalPnl: number;
  byProtocol: {
    protocol: string;
    unrealizedPnl: number;
    realizedPnl: number;
  }[];
  byToken: {
    token: string;
    unrealizedPnl: number;
    realizedPnl: number;
  }[];
}

// Query keys
export const portfolioKeys = {
  all: ['portfolio'] as const,
  summary: (wallet: string, network: string) => [...portfolioKeys.all, 'summary', wallet, network] as const,
  positions: (wallet: string, network: string) => [...portfolioKeys.all, 'positions', wallet, network] as const,
  history: (wallet: string, network: string, days: number) => [...portfolioKeys.all, 'history', wallet, network, days] as const,
  pnl: (wallet: string, network: string) => [...portfolioKeys.all, 'pnl', wallet, network] as const,
};

/**
 * Get portfolio summary
 */
export function usePortfolio(walletAddress?: string) {
  const { network } = useNetwork();

  return useQuery({
    queryKey: portfolioKeys.summary(walletAddress || '', network),
    queryFn: () => api.getPortfolio(walletAddress!, network),
    enabled: !!walletAddress,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Get portfolio positions with current values
 */
export function usePortfolioPositions(walletAddress?: string) {
  const { network } = useNetwork();

  return useQuery({
    queryKey: portfolioKeys.positions(walletAddress || '', network),
    queryFn: () => api.getPortfolioPositions(walletAddress!, network),
    enabled: !!walletAddress,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Get portfolio history for charts
 */
export function usePortfolioHistory(walletAddress?: string, days: number = 30) {
  const { network } = useNetwork();

  return useQuery({
    queryKey: portfolioKeys.history(walletAddress || '', network, days),
    queryFn: () => api.getPortfolioHistory(walletAddress!, days, network),
    enabled: !!walletAddress,
    staleTime: 60000,
  });
}

/**
 * Get P&L breakdown
 */
export function usePnL(walletAddress?: string) {
  const { network } = useNetwork();

  return useQuery({
    queryKey: portfolioKeys.pnl(walletAddress || '', network),
    queryFn: () => api.getPortfolioPnL(walletAddress!, network),
    enabled: !!walletAddress,
    staleTime: 30000,
  });
}

/**
 * Format currency for display
 */
export function formatUsd(value: number): string {
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
