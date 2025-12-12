/**
 * Portfolio Types
 */

import { ProtocolName, NetworkType } from '../protocols/types';

export interface PortfolioSummary {
  walletAddress: string;
  network: NetworkType;
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
  updatedAt: Date;
}

export interface PortfolioPosition {
  id: string;
  protocol: ProtocolName;
  network: NetworkType;
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
  openedAt: Date;
}

export interface PortfolioHistory {
  timestamp: Date;
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
    protocol: ProtocolName;
    unrealizedPnl: number;
    realizedPnl: number;
  }[];
  byToken: {
    token: string;
    unrealizedPnl: number;
    realizedPnl: number;
  }[];
}
