// ===========================================
// Transaction Types
// ===========================================

export type SwapStatus = 'PENDING' | 'SIMULATING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';

export interface ProtectiveSwapConfig {
  userWallet: string;
  fromToken: string;
  toToken: string;
  swapAmount: number; // in token units
  slippageTolerance: number; // bps (e.g., 50 = 0.5%)
  useShadowLane: boolean;
  useJitoBundle: boolean;
  jitoTipLamports: number;
}

export interface ProtectiveSwap {
  id: string;
  accountId: string;
  walletAddress: string;

  // Swap details
  fromToken: string;
  toToken: string;
  inputAmount: number;
  outputAmount: number;
  slippageBps: number;

  // MEV protection
  usedShadowLane: boolean;
  usedJitoBundle: boolean;
  jitoTipLamports?: number;
  bundleId?: string;

  // Slippage analysis
  standardSlippage?: number; // What slippage would have been
  actualSlippage?: number;
  mevSaved?: number; // USD

  // Transaction
  transactionSignature?: string;
  status: SwapStatus;
  errorMessage?: string;

  executedAt?: Date;
  createdAt: Date;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: any[];
}

export interface SlippageComparison {
  standardQuote: SwapQuote;
  shadowLaneQuote: SwapQuote;
  standardSlippage: number;
  protectedSlippage: number;
  estimatedMevSavings: number; // USD
}

// ===========================================
// Transaction Helpers
// ===========================================

export function getSwapStatusLabel(status: SwapStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'SIMULATING':
      return 'Simulating...';
    case 'SUBMITTED':
      return 'Submitted';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'FAILED':
      return 'Failed';
  }
}

export function getSwapStatusColor(status: SwapStatus): string {
  switch (status) {
    case 'PENDING':
      return '#6b7280'; // gray
    case 'SIMULATING':
      return '#3b82f6'; // blue
    case 'SUBMITTED':
      return '#eab308'; // yellow
    case 'CONFIRMED':
      return '#22c55e'; // green
    case 'FAILED':
      return '#ef4444'; // red
  }
}

export function calculateMevSavings(
  standardSlippage: number,
  protectedSlippage: number,
  swapAmountUsd: number
): number {
  return (standardSlippage - protectedSlippage) * swapAmountUsd;
}
