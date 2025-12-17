/**
 * Position Management Types
 */

import { ProtocolName, NetworkType } from '../protocols/types';

export interface PositionQuoteRequest {
  walletAddress: string;
  collateralToken: string;
  collateralAmount: number;
  borrowToken: string;
  leverage: number;
  network: NetworkType;
  protocol?: ProtocolName; // Optional - if not provided, find best
}

export interface ProtocolQuote {
  protocol: ProtocolName;
  supplyApy: number;
  borrowApy: number;
  netApy: number; // supplyApy - borrowApy (can be negative)
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

export interface PositionQuoteResponse {
  request: PositionQuoteRequest;
  collateralValueUsd: number;
  borrowValueUsd: number;
  quotes: ProtocolQuote[];
  bestQuote: ProtocolQuote;
  currentPrices: {
    collateral: number;
    borrow: number;
  };
  timestamp: Date;
}

export interface OpenPositionRequest {
  walletAddress: string;
  protocol: ProtocolName;
  collateralToken: string;
  collateralMint: string;
  collateralAmount: number;
  borrowToken: string;
  borrowMint: string;
  borrowAmount: number;
  leverage: number;
  slippageBps: number;
  network: NetworkType;
  autoMonitor: boolean;
  enableAlerts: boolean;
}

export interface OpenPositionResponse {
  success: boolean;
  transaction?: string; // Base64 encoded unsigned transaction
  positionId?: string;
  // Position data for frontend to create record after tx confirmation
  positionData?: {
    walletAddress: string;
    protocol: ProtocolName;
    network: NetworkType;
    collateralToken: string;
    collateralMint: string;
    collateralAmount: number;
    borrowToken: string;
    borrowMint: string;
    borrowAmount: number;
    leverage: number;
    entryPrice: number;
    liquidationPrice: number;
    healthFactor: number;
    autoMonitor: boolean;
  };
  estimatedFees: {
    protocolFee: number;
    networkFee: number;
    total: number;
  };
  warnings?: string[];
  error?: string;
}

export interface ClosePositionRequest {
  positionId: string;
  walletAddress: string;
  slippageBps: number;
}

export interface ClosePositionResponse {
  success: boolean;
  transaction?: string;
  estimatedReturn: number;
  realizedPnl: number;
  error?: string;
}

export interface AdjustCollateralRequest {
  positionId: string;
  walletAddress: string;
  action: 'add' | 'remove';
  amount: number;
  slippageBps: number;
}

export interface AdjustCollateralResponse {
  success: boolean;
  transaction?: string;
  newHealthFactor: number;
  newLiquidationPrice: number;
  error?: string;
}

// Token price info
export interface TokenPrice {
  token: string;
  mint: string;
  price: number;
  confidence: number;
  source: string;
  updatedAt: Date;
}

// Position from database
export interface PositionData {
  id: string;
  walletAddress: string;
  protocol: ProtocolName;
  network: NetworkType;
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
  openTxSignature?: string;
  closeTxSignature?: string;
  openedAt: Date;
  closedAt?: Date;
}
