/**
 * DeFiLlama API Service
 * Fetches real lending rates from DeFiLlama yields API
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { CacheService } from '../cache';

const cacheService = CacheService.getInstance();
const CACHE_TTL = 60; // 1 minute cache

const DEFILLAMA_YIELDS_URL = 'https://yields.llama.fi/pools';

// Token mint to symbol mapping
const MINT_TO_SYMBOL: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 'mSOL',
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: 'jitoSOL',
};

export interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  pool: string;
  underlyingTokens: string[] | null;
}

export interface ProtocolYield {
  protocol: string;
  symbol: string;
  mint: string;
  supplyApy: number;
  tvlUsd: number;
}

/**
 * Fetch all Solana lending pools from DeFiLlama
 */
export async function fetchDefiLlamaYields(): Promise<DefiLlamaPool[]> {
  const cacheKey = 'defillama:yields:solana';
  const cached = await cacheService.get<DefiLlamaPool[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(DEFILLAMA_YIELDS_URL, {
      timeout: 30000,
    });

    const pools: DefiLlamaPool[] = response.data.data.filter(
      (pool: DefiLlamaPool) => pool.chain === 'Solana'
    );

    await cacheService.set(cacheKey, pools, CACHE_TTL);
    logger.info('Fetched DeFiLlama yields', { count: pools.length });

    return pools;
  } catch (error: any) {
    logger.error('Failed to fetch DeFiLlama yields', { error: error.message });
    throw error;
  }
}

/**
 * Get yields for a specific protocol
 */
export async function getProtocolYields(projectName: string): Promise<ProtocolYield[]> {
  const pools = await fetchDefiLlamaYields();

  const protocolPools = pools.filter(
    (pool) => pool.project.toLowerCase().includes(projectName.toLowerCase())
  );

  return protocolPools.map((pool) => {
    // Try to get mint from underlying tokens
    const mint = pool.underlyingTokens?.[0] || '';
    const symbol = MINT_TO_SYMBOL[mint] || pool.symbol;

    return {
      protocol: pool.project,
      symbol,
      mint,
      supplyApy: pool.apy || pool.apyBase || 0,
      tvlUsd: pool.tvlUsd,
    };
  });
}

/**
 * Get Kamino lending rates (most popular Solana lending protocol)
 */
export async function getKaminoRates(): Promise<ProtocolYield[]> {
  return getProtocolYields('kamino-lend');
}

/**
 * Get all Solana lending rates grouped by protocol
 */
export async function getAllLendingRates(): Promise<Map<string, ProtocolYield[]>> {
  const pools = await fetchDefiLlamaYields();

  // Filter for lending protocols
  const lendingProjects = ['kamino-lend', 'save', 'solend', 'marginfi'];

  const ratesByProtocol = new Map<string, ProtocolYield[]>();

  for (const project of lendingProjects) {
    const projectPools = pools.filter((pool) =>
      pool.project.toLowerCase().includes(project.toLowerCase())
    );

    if (projectPools.length > 0) {
      ratesByProtocol.set(
        project,
        projectPools.map((pool) => {
          const mint = pool.underlyingTokens?.[0] || '';
          const symbol = MINT_TO_SYMBOL[mint] || pool.symbol;

          return {
            protocol: pool.project,
            symbol,
            mint,
            supplyApy: pool.apy || pool.apyBase || 0,
            tvlUsd: pool.tvlUsd,
          };
        })
      );
    }
  }

  return ratesByProtocol;
}
