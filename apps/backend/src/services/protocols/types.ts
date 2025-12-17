/**
 * Protocol Types
 * Shared types for all protocol integrations
 */

export type ProtocolName = 'DRIFT' | 'KAMINO' | 'SAVE' | 'FRANCIUM' | 'LOOPSCALE';
export type NetworkType = 'mainnet-beta' | 'devnet';

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
  protocol: ProtocolName;
  network: NetworkType;
  rates: TokenRate[];
  tvl: number;
  updatedAt: Date;
}

export interface AggregatedRates {
  protocols: ProtocolRates[];
  bestSupplyRates: Map<string, { protocol: ProtocolName; rate: number }>;
  bestBorrowRates: Map<string, { protocol: ProtocolName; rate: number }>;
  updatedAt: Date;
}

export interface PositionQuoteParams {
  collateralToken: string;
  collateralAmount: number;
  borrowToken: string;
  leverage: number;
  network: NetworkType;
}

export interface PositionQuote {
  protocol: ProtocolName;
  collateralToken: string;
  collateralAmount: number;
  collateralValueUsd: number;
  borrowToken: string;
  borrowAmount: number;
  borrowValueUsd: number;
  leverage: number;
  liquidationPrice: number;
  healthFactor: number;
  borrowApy: number;
  supplyApy: number;
  netApy: number;
  estimatedFees: number;
  isRecommended: boolean;
  recommendReason?: string;
}

export interface ProtocolConfig {
  name: ProtocolName;
  programId: string;
  mainnetRpc: string;
  devnetRpc: string;
}

// Token mint addresses
export const TOKEN_MINTS = {
  mainnet: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    bSOL: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  },
  devnet: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    USDT: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS',
    mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  },
} as const;

// Token decimals
export const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  mSOL: 9,
  jitoSOL: 9,
  bSOL: 9,
};
