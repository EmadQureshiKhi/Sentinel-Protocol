import { PublicKey } from '@solana/web3.js';

/**
 * Validate a Solana wallet address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate health factor value
 */
export function isValidHealthFactor(healthFactor: number): boolean {
  if (typeof healthFactor !== 'number') return false;
  if (isNaN(healthFactor)) return false;
  if (healthFactor < 0) return false;
  return true;
}

/**
 * Validate risk score (0-100)
 */
export function isValidRiskScore(riskScore: number): boolean {
  if (typeof riskScore !== 'number') return false;
  if (isNaN(riskScore)) return false;
  if (riskScore < 0 || riskScore > 100) return false;
  return true;
}

/**
 * Validate slippage tolerance (in bps)
 */
export function isValidSlippage(slippageBps: number): boolean {
  if (typeof slippageBps !== 'number') return false;
  if (slippageBps < 0 || slippageBps > 10000) return false; // 0-100%
  return true;
}

/**
 * Validate Jupiter quote response
 */
export function isValidQuoteResponse(response: any): boolean {
  if (!response) return false;
  if (!response.outAmount) return false;
  if (BigInt(response.outAmount) === 0n) return false;
  if (!response.routePlan || response.routePlan.length === 0) return false;
  return true;
}

/**
 * Truncate wallet address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format USD value
 */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompact(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}
