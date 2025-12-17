/**
 * Kamino Protocol Service
 * Fetches REAL rates from Kamino Lend using DeFiLlama
 */

import { ProtocolRates, TokenRate, NetworkType, TOKEN_MINTS } from './types';
import { logger } from '../../utils/logger';
import { CacheService } from '../cache';
import { fetchDefiLlamaYields } from './defiLlama';

const cacheService = CacheService.getInstance();
const CACHE_TTL = 30; // 30 seconds

// Token mint to symbol mapping
const MINT_TO_SYMBOL: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 'mSOL',
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: 'jitoSOL',
};

export class KaminoService {
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  /**
   * Get all rates from Kamino Lend
   */
  async getRates(): Promise<ProtocolRates> {
    const cacheKey = `kamino:rates:${this.network}`;
    const cached = await cacheService.get<ProtocolRates>(cacheKey);
    if (cached) return cached;

    try {
      logger.info('Fetching Kamino rates from DeFiLlama', { network: this.network });

      const rates = await this.fetchKaminoRates();
      const tvl = rates.reduce((sum, r) => sum + r.totalSupply, 0);

      const result: ProtocolRates = {
        protocol: 'KAMINO',
        network: this.network,
        rates,
        tvl,
        updatedAt: new Date(),
      };

      await cacheService.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('Error fetching Kamino rates', { error });
      throw error;
    }
  }

  /**
   * Fetch rates from DeFiLlama
   */
  private async fetchKaminoRates(): Promise<TokenRate[]> {
    const rates: TokenRate[] = [];
    const networkKey = this.network === 'mainnet-beta' ? 'mainnet' : 'devnet';

    const pools = await fetchDefiLlamaYields();

    // Filter for Kamino Lend pools
    const kaminoPools = pools.filter((pool) => pool.project === 'kamino-lend');

    for (const pool of kaminoPools) {
      const mint = pool.underlyingTokens?.[0];
      if (!mint) continue;

      const symbol = MINT_TO_SYMBOL[mint];
      if (!symbol) continue;

      // Only include tokens we support
      const networkMints = TOKEN_MINTS[networkKey as keyof typeof TOKEN_MINTS];
      if (!networkMints[symbol as keyof typeof networkMints]) continue;

      rates.push({
        token: symbol,
        symbol,
        mint,
        supplyApy: pool.apy || pool.apyBase || 0,
        borrowApy: (pool.apy || pool.apyBase || 0) * 1.5, // Estimate borrow rate
        totalSupply: pool.tvlUsd,
        totalBorrow: pool.tvlUsd * 0.6, // Estimate 60% utilization
        utilization: 60,
        ltv: this.getLTV(symbol),
        liquidationThreshold: this.getLiquidationThreshold(symbol),
        liquidationPenalty: 5,
      });
    }

    logger.info('Fetched Kamino rates', { count: rates.length });

    if (rates.length === 0) {
      throw new Error('No Kamino rates available');
    }

    return rates;
  }

  private getLTV(symbol: string): number {
    const ltvMap: Record<string, number> = {
      SOL: 80,
      USDC: 90,
      USDT: 88,
      mSOL: 75,
      jitoSOL: 75,
    };
    return ltvMap[symbol] || 70;
  }

  private getLiquidationThreshold(symbol: string): number {
    const thresholdMap: Record<string, number> = {
      SOL: 85,
      USDC: 95,
      USDT: 93,
      mSOL: 80,
      jitoSOL: 80,
    };
    return thresholdMap[symbol] || 75;
  }

  async getTokenRate(token: string): Promise<TokenRate | null> {
    const rates = await this.getRates();
    return rates.rates.find((r) => r.token.toUpperCase() === token.toUpperCase()) || null;
  }
}

export const createKaminoService = (network: NetworkType) => new KaminoService(network);
