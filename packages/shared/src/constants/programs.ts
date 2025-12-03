// ===========================================
// DeFi Protocol Program IDs
// ===========================================

export const PROGRAMS = {
  DRIFT: 'dRiftyHA39MWEi3m9aunc5MzRF1JwodEEQExsqasSa',
  MARGINFI: 'MFv2hWf31Z9kbCa1snEjYgcUHQe3JG8F8jB7sFtzLmY',
  SOLEND: 'So1endDq2YkqhipRLMqwyepb63ScGAjWXvn4SNUZNH',
} as const;

export type ProtocolName = keyof typeof PROGRAMS;

export const PROTOCOL_NAMES: Record<string, string> = {
  [PROGRAMS.DRIFT]: 'Drift',
  [PROGRAMS.MARGINFI]: 'Marginfi',
  [PROGRAMS.SOLEND]: 'Solend',
};

// ===========================================
// Jito Tip Accounts
// ===========================================

export const JITO_TIP_ACCOUNTS = {
  devnet: 'FWjCWwPnwVs8EJWwFiCC3xKqVxqcLDmN2PxPt4KhbCJN',
  mainnet: 'Awsom38c6YetPn6dBW1ztRSvVF21pWifD7yvnEm3JDp',
} as const;

// ===========================================
// Pyth Price Feed Addresses
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

export function getProgramName(programId: string): string {
  return PROTOCOL_NAMES[programId] || 'Unknown';
}

export function getJitoTipAccount(network: 'devnet' | 'mainnet'): string {
  return JITO_TIP_ACCOUNTS[network];
}
