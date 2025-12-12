/**
 * Rate Aggregator Service
 * Aggregates rates from all protocols and finds best rates
 */

import { DriftService, createDriftService } from './drift';
import { MarginFiService, createMarginFiService } from './marginfi';
import { SolendService, createSolendService } from './solend';
import {
  ProtocolRates,
  AggregatedRates,
  NetworkType,
  ProtocolName,
  TokenRate,
  PositionQuoteParams,
  PositionQuote,
} from './types';
import { logger } from '../../utils/logger';
import { CacheService } from '../cache';

const cacheService = CacheService.getInstance();

const CACHE_TTL = 5; // 5 seconds

export class RateAggregator {
  private driftService: DriftService;
  private marginFiService: MarginFiService;
  private solendService: SolendService;
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
    this.driftService = createDriftService(network);
    this.marginFiService = createMarginFiService(network);
    this.solendService = createSolendService(network);
  }

  /**
   * Get rates from all protocols
   */
  async getAllRates(): Promise<AggregatedRates> {
    const cacheKey = `rates:all:${this.network}`;
    
    // Try cache first
    const cached = await cacheService.get<AggregatedRates>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      logger.info('Fetching rates from all protocols', { network: this.network });

      // Fetch from all protocols in parallel
      const [driftRates, marginFiRates, solendRates] = await Promise.all([
        this.driftService.getRates().catch(err => {
          logger.error('Failed to fetch Drift rates', { error: err });
          return null;
        }),
        this.marginFiService.getRates().catch(err => {
          logger.error('Failed to fetch MarginFi rates', { error: err });
          return null;
        }),
        this.solendService.getRates().catch(err => {
          logger.error('Failed to fetch Solend rates', { error: err });
          return null;
        }),
      ]);

      const protocols: ProtocolRates[] = [];
      if (driftRates) protocols.push(driftRates);
      if (marginFiRates) protocols.push(marginFiRates);
      if (solendRates) protocols.push(solendRates);

      // Calculate best rates
      const bestSupplyRates = this.findBestSupplyRates(protocols);
      const bestBorrowRates = this.findBestBorrowRates(protocols);

      const result: AggregatedRates = {
        protocols,
        bestSupplyRates,
        bestBorrowRates,
        updatedAt: new Date(),
      };

      // Cache the result
      await cacheService.set(cacheKey, result, CACHE_TTL);

      return result;
    } catch (error) {
      logger.error('Error aggregating rates', { error });
      throw error;
    }
  }

  /**
   * Get rates for a specific protocol
   */
  async getProtocolRates(protocol: ProtocolName): Promise<ProtocolRates> {
    const cacheKey = `rates:${protocol}:${this.network}`;
    
    const cached = await cacheService.get<ProtocolRates>(cacheKey);
    if (cached) {
      return cached;
    }

    let rates: ProtocolRates;
    switch (protocol) {
      case 'DRIFT':
        rates = await this.driftService.getRates();
        break;
      case 'MARGINFI':
        rates = await this.marginFiService.getRates();
        break;
      case 'SOLEND':
        rates = await this.solendService.getRates();
        break;
      default:
        throw new Error(`Unknown protocol: ${protocol}`);
    }

    await cacheService.set(cacheKey, rates, CACHE_TTL);
    return rates;
  }

  /**
   * Compare rates for a specific token across protocols
   */
  async compareTokenRates(token: string): Promise<{
    token: string;
    rates: Array<{ protocol: ProtocolName; supplyApy: number; borrowApy: number; ltv: number }>;
    bestSupply: { protocol: ProtocolName; rate: number };
    bestBorrow: { protocol: ProtocolName; rate: number };
  }> {
    const allRates = await this.getAllRates();
    
    const tokenRates: Array<{ protocol: ProtocolName; supplyApy: number; borrowApy: number; ltv: number }> = [];
    
    for (const protocolRates of allRates.protocols) {
      const tokenRate = protocolRates.rates.find(r => r.token === token);
      if (tokenRate) {
        tokenRates.push({
          protocol: protocolRates.protocol,
          supplyApy: tokenRate.supplyApy,
          borrowApy: tokenRate.borrowApy,
          ltv: tokenRate.ltv,
        });
      }
    }

    // Find best rates
    const bestSupply = tokenRates.reduce((best, curr) => 
      curr.supplyApy > best.supplyApy ? curr : best
    );
    const bestBorrow = tokenRates.reduce((best, curr) => 
      curr.borrowApy < best.borrowApy ? curr : best
    );

    return {
      token,
      rates: tokenRates,
      bestSupply: { protocol: bestSupply.protocol, rate: bestSupply.supplyApy },
      bestBorrow: { protocol: bestBorrow.protocol, rate: bestBorrow.borrowApy },
    };
  }

  /**
   * Get position quotes from all protocols
   */
  async getPositionQuotes(params: PositionQuoteParams): Promise<PositionQuote[]> {
    const allRates = await this.getAllRates();
    const quotes: PositionQuote[] = [];

    // Mock price data (in production, fetch from oracle)
    const prices: Record<string, number> = {
      SOL: 140,
      USDC: 1,
      USDT: 1,
      mSOL: 155,
      jitoSOL: 158,
    };

    const collateralPrice = prices[params.collateralToken] || 1;
    const borrowPrice = prices[params.borrowToken] || 1;
    const collateralValueUsd = params.collateralAmount * collateralPrice;
    const borrowValueUsd = collateralValueUsd * (params.leverage - 1);
    const borrowAmount = borrowValueUsd / borrowPrice;

    for (const protocolRates of allRates.protocols) {
      const collateralRate = protocolRates.rates.find(r => r.token === params.collateralToken);
      const borrowRate = protocolRates.rates.find(r => r.token === params.borrowToken);

      if (!collateralRate || !borrowRate) continue;

      // Check if leverage is possible with this protocol's LTV
      const maxLeverage = 1 / (1 - collateralRate.ltv / 100);
      if (params.leverage > maxLeverage) continue;

      const liquidationPrice = borrowValueUsd / (params.collateralAmount * (collateralRate.liquidationThreshold / 100));
      const healthFactor = (collateralValueUsd * (collateralRate.liquidationThreshold / 100)) / borrowValueUsd;
      const netApy = collateralRate.supplyApy - (borrowRate.borrowApy * (params.leverage - 1));

      quotes.push({
        protocol: protocolRates.protocol,
        collateralToken: params.collateralToken,
        collateralAmount: params.collateralAmount,
        collateralValueUsd,
        borrowToken: params.borrowToken,
        borrowAmount,
        borrowValueUsd,
        leverage: params.leverage,
        liquidationPrice,
        healthFactor,
        borrowApy: borrowRate.borrowApy,
        supplyApy: collateralRate.supplyApy,
        netApy,
        estimatedFees: 0.001 * collateralValueUsd, // 0.1% estimated fees
        isRecommended: false,
        recommendReason: undefined,
      });
    }

    // Mark the best quote as recommended
    if (quotes.length > 0) {
      // Recommend based on lowest borrow APY
      const bestQuote = quotes.reduce((best, curr) => 
        curr.borrowApy < best.borrowApy ? curr : best
      );
      bestQuote.isRecommended = true;
      bestQuote.recommendReason = 'Lowest borrow rate';
    }

    return quotes;
  }

  /**
   * Find best supply rates across all protocols
   */
  private findBestSupplyRates(protocols: ProtocolRates[]): Map<string, { protocol: ProtocolName; rate: number }> {
    const bestRates = new Map<string, { protocol: ProtocolName; rate: number }>();

    for (const protocolRates of protocols) {
      for (const tokenRate of protocolRates.rates) {
        const current = bestRates.get(tokenRate.token);
        if (!current || tokenRate.supplyApy > current.rate) {
          bestRates.set(tokenRate.token, {
            protocol: protocolRates.protocol,
            rate: tokenRate.supplyApy,
          });
        }
      }
    }

    return bestRates;
  }

  /**
   * Find best (lowest) borrow rates across all protocols
   */
  private findBestBorrowRates(protocols: ProtocolRates[]): Map<string, { protocol: ProtocolName; rate: number }> {
    const bestRates = new Map<string, { protocol: ProtocolName; rate: number }>();

    for (const protocolRates of protocols) {
      for (const tokenRate of protocolRates.rates) {
        const current = bestRates.get(tokenRate.token);
        if (!current || tokenRate.borrowApy < current.rate) {
          bestRates.set(tokenRate.token, {
            protocol: protocolRates.protocol,
            rate: tokenRate.borrowApy,
          });
        }
      }
    }

    return bestRates;
  }
}

// Factory function
export const createRateAggregator = (network: NetworkType) => new RateAggregator(network);

// Singleton instances for each network
const aggregators: Record<NetworkType, RateAggregator> = {
  'mainnet-beta': new RateAggregator('mainnet-beta'),
  'devnet': new RateAggregator('devnet'),
};

export const getRateAggregator = (network: NetworkType): RateAggregator => {
  return aggregators[network];
};
