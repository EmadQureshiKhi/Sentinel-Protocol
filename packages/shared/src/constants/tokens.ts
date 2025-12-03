// ===========================================
// Token Mint Addresses
// ===========================================

export const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenErt',
  mSOL: 'mSoLzYCxHdgvVrQgf5MXZzctke3MWW4ngtg9ZWsDLHP',
  jitoSOL: 'J1toso1uCk3jsCMkzskbEHjHnPoESZZYmB7SSrw5N5y',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
} as const;

export type TokenSymbol = keyof typeof TOKENS;

export const TOKEN_DECIMALS: Record<string, number> = {
  [TOKENS.SOL]: 9,
  [TOKENS.USDC]: 6,
  [TOKENS.USDT]: 6,
  [TOKENS.mSOL]: 9,
  [TOKENS.jitoSOL]: 9,
  [TOKENS.BONK]: 5,
};

export const TOKEN_NAMES: Record<string, string> = {
  [TOKENS.SOL]: 'Solana',
  [TOKENS.USDC]: 'USD Coin',
  [TOKENS.USDT]: 'Tether',
  [TOKENS.mSOL]: 'Marinade SOL',
  [TOKENS.jitoSOL]: 'Jito SOL',
  [TOKENS.BONK]: 'Bonk',
};

export function getTokenDecimals(mint: string): number {
  return TOKEN_DECIMALS[mint] || 9;
}

export function formatTokenAmount(amount: number, mint: string): string {
  const decimals = getTokenDecimals(mint);
  return (amount / Math.pow(10, decimals)).toFixed(decimals > 6 ? 4 : 2);
}

export function parseTokenAmount(amount: string, mint: string): number {
  const decimals = getTokenDecimals(mint);
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals));
}
