/**
 * DeFiLlama Protocols Service
 * Fetches rates for multiple protocols from DeFiLlama
 */

import { ProtocolRates, TokenRate, NetworkType, TOKEN_MINTS, ProtocolName } from './types';
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
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: 'bSOL',
};

// Lending protocols available on DeFiLlama
const LENDING_PROTOCOLS = [
  { name: 'KAMINO', project: 'kamino-lend' },
  { name: 'SAVE', project: 'save' },
  { name: 'FRANCIUM', project: 'francium' },
  { name: 'LOOPSCALE', project: 'loopscale' },
];

export class DefiLlamaProtocolsService {
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  /**
   * Get rates for all lending protocols from DeFiLlama
   */
  async getAllProtocolRates(): Promise<ProtocolRates[]> {
    const allRates: ProtocolRates[] = [];

    for (const protocol of LENDING_PROTOCOLS) {
      try {
        const rates = await this.getProtocolRates(protocol.name as ProtocolName, protocol.project);
        if (rates.rates.length > 0) {
          allRates.push(rates);
        }
      } catch (error) {
        logger.warn('Failed to fetch protocol rates', { protocol: protocol.name, error });
      }
    }

    return allRates;
  }

  /**
   * Get rates for a specific protocol
   */
  async getProtocolRates(protocolName: ProtocolName, projectName: string): Promise<ProtocolRates> {
    const cacheKey = `defillama:${protocolName}:rates:${this.network}`;
    const cached = await cacheService.get<ProtocolRates>(cacheKey);
    if (cached) return cached;

    try {
      logger.info('Fetching protocol rates from DeFiLlama', { protocol: protocolName, project: projectName });

      const rates = await this.fetchProtocolRates(projectName);
      const tvl = rates.reduce((sum, r) => sum + r.totalSupply, 0);

      const result: ProtocolRates = {
        protocol: protocolName,
        network: this.network,
        rates,
        tvl,
        updatedAt: new Date(),
      };

      await cacheService.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('Error fetching protocol rates', { protocol: protocolName, error });
      throw error;
    }
  }

  /**
   * Fetch rates for a specific project from DeFiLlama
   */
  private async fetchProtocolRates(projectName: string): Promise<TokenRate[]> {
    const rates: TokenRate[] = [];
    const networkKey = this.network === 'mainnet-beta' ? 'mainnet' : 'devnet';

    const pools = await fetchDefiLlamaYields();

    // Filter for this project's pools
    const projectPools = pools.filter((pool) => pool.project === projectName);

    for (const pool of projectPools) {
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

    logger.info('Fetched protocol rates from DeFiLlama', { project: projectName, count: rates.length });

    return rates;
  }

  private getLTV(symbol: string): number {
    const ltvMap: Record<string, number> = {
      SOL: 80,
      USDC: 90,
      USDT: 88,
      mSOL: 75,
      jitoSOL: 75,
      bSOL: 75,
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
      bSOL: 80,
    };
    return thresholdMap[symbol] || 75;
  }
}

export const createDefiLlamaProtocolsService = (network: NetworkType) =>
  new DefiLlamaProtocolsService(network);
