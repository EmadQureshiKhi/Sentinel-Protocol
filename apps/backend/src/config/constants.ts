// ===========================================
// Program IDs
// ===========================================

export const PROGRAMS = {
  DRIFT: 'dRiftyHA39MWEi3m9aunc5MzRF1JwodEEQExsqasSa',
  MARGINFI: 'MFv2hWf31Z9kbCa1snEjYgcUHQe3JG8F8jB7sFtzLmY',
  SOLEND: 'So1endDq2YkqhipRLMqwyepb63ScGAjWXvn4SNUZNH',
} as const;

export type Protocol = keyof typeof PROGRAMS;

// ===========================================
// Token Mints
// ===========================================

export const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenErt',
  mSOL: 'mSoLzYCxHdgvVrQgf5MXZzctke3MWW4ngtg9ZWsDLHP',
  jitoSOL: 'J1toso1uCk3jsCMkzskbEHjHnPoESZZYmB7SSrw5N5y',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
} as const;

export const TOKEN_DECIMALS: Record<string, number> = {
  [TOKENS.SOL]: 9,
  [TOKENS.USDC]: 6,
  [TOKENS.USDT]: 6,
  [TOKENS.mSOL]: 9,
  [TOKENS.jitoSOL]: 9,
  [TOKENS.BONK]: 5,
};

// ===========================================
// Pyth Price Feeds
// ===========================================

export const PYTH_FEEDS = {
  mainnet: {
    'SOL/USD': 'H6ARHf6YXhGU3NxYYu6A6ZwUqYtMihMgm8cr2DeKHSob',
    'BTC/USD': 'GVXRSv1FM20zfYfofqMS34uQTVcEMcwBZeP2NiZXV9fV',
    'ETH/USD': 'JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB',
    'USDC/USD': 'Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD',
  },
  devnet: {
    'SOL/USD': 'J83w4HKQvakYi3JnzrwyqLgZyWqYKVJ5v7zjhxKqPqo2',
  },
} as const;

// ===========================================
// Risk Thresholds
// ===========================================

export const RISK_THRESHOLDS = {
  // Health factor thresholds
  HEALTH_SAFE: 1.0,
  HEALTH_CAUTION: 0.5,
  HEALTH_DANGER: 0.25,
  HEALTH_CRITICAL: 0.1,

  // Risk score thresholds
  RISK_SAFE: 40,
  RISK_MONITOR: 70,
  RISK_PROTECT: 100,

  // HVIX thresholds
  HVIX_LOW: 1.5,
  HVIX_MEDIUM: 2.5,
  HVIX_HIGH: 3.5,

  // Alert thresholds
  ALERT_RISK_THRESHOLD: 60,
  ALERT_CASCADE_PROBABILITY: 0.6,
} as const;

// ===========================================
// Risk Score Weights
// ===========================================

export const RISK_WEIGHTS = {
  HEALTH_FACTOR: 40,
  VOLATILITY: 30,
  CASCADE: 30,
} as const;

// ===========================================
// Rate Limits
// ===========================================

export const RATE_LIMITS = {
  HELIUS_RPS: 100,
  JUPITER_RPS: 100,
  JITO_BUNDLES_PER_SEC: 10,
  SOLANA_RPC_RPS: 40,
} as const;

// ===========================================
// Timing Constants
// ===========================================

export const TIMING = {
  MONITORING_INTERVAL_MS: 10000, // 10 seconds
  PRICE_CACHE_TTL_MS: 5000, // 5 seconds
  QUOTE_CACHE_TTL_MS: 5000, // 5 seconds
  PRICE_STALENESS_MS: 10000, // 10 seconds
  BUNDLE_TIMEOUT_MS: 15000, // 15 seconds
  GEYSER_RECONNECT_BASE_MS: 1000,
  GEYSER_RECONNECT_MAX_MS: 60000,
} as const;

// ===========================================
// Jito Configuration
// ===========================================

export const JITO_CONFIG = {
  MAX_TRANSACTIONS_PER_BUNDLE: 5,
  DEFAULT_TIP_LAMPORTS: 100000, // 0.0001 SOL
  MIN_TIP_LAMPORTS: 10000,
  MAX_TIP_LAMPORTS: 1000000,
} as const;

// ===========================================
// HVIX Configuration
// ===========================================

export const HVIX_CONFIG = {
  TIME_WINDOWS_MINUTES: [60, 240, 720], // 1h, 4h, 12h
  MAX_PRICE_HISTORY: 720, // 12 hours at 1-min intervals
} as const;
