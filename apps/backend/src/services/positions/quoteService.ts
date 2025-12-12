/**
 * Position Quote Service
 * Calculates position previews and compares across protocols
 */

import { logger } from '../../utils/logger';
import { getRateAggregator } from '../protocols/rateAggregator';
import { ProtocolName, NetworkType, TokenRate, ProtocolRates } from '../protocols/types';
import {
  PositionQuoteRequest,
  PositionQuoteResponse,
  ProtocolQuote,
  TokenPrice,
} from './types';

// Mock prices - in production, fetch from Pyth/Switchboard
const MOCK_PRICES: Record<string, number> = {
  SOL: 185.50,
  USDC: 1.00,
  USDT: 1.00,
  mSOL: 205.25,
  jitoSOL: 210.80,
  ETH: 3450.00,
  BTC: 97500.00,
};

export class QuoteService {
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  /**
   * Get current token price
   */
  async getTokenPrice(token: string): Promise<TokenPrice> {
    const price = MOCK_PRICES[token.toUpperCase()] || 1.0;
    
    return {
      token: token.toUpperCase(),
      mint: this.getTokenMint(token),
      price,
      confidence: 0.99,
      source: 'mock',
      updatedAt: new Date(),
    };
  }

  /**
   * Get token mint address
   */
  private getTokenMint(token: string): string {
    const mints: Record<string, string> = {
      SOL: 'So11111111111111111111111111111111111111112',
      USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    };
    return mints[token.toUpperCase()] || token;
  }


  /**
   * Calculate liquidation price for a position
   */
  calculateLiquidationPrice(
    collateralAmount: number,
    collateralPrice: number,
    borrowAmount: number,
    borrowPrice: number,
    liquidationThreshold: number
  ): number {
    // Liquidation occurs when: collateralValue * liquidationThreshold = borrowValue
    // collateralAmount * liquidationPrice * threshold = borrowAmount * borrowPrice
    // liquidationPrice = (borrowAmount * borrowPrice) / (collateralAmount * threshold)
    
    const borrowValue = borrowAmount * borrowPrice;
    const liquidationPrice = borrowValue / (collateralAmount * (liquidationThreshold / 100));
    
    return liquidationPrice;
  }

  /**
   * Calculate health factor
   */
  calculateHealthFactor(
    collateralValue: number,
    borrowValue: number,
    liquidationThreshold: number
  ): number {
    if (borrowValue === 0) return 999;
    return (collateralValue * (liquidationThreshold / 100)) / borrowValue;
  }

  /**
   * Get position quote with comparison across protocols
   */
  async getPositionQuote(request: PositionQuoteRequest): Promise<PositionQuoteResponse> {
    logger.info('Getting position quote', { request });

    const aggregator = getRateAggregator(request.network);
    const allRates = await aggregator.getAllRates();

    // Get current prices
    const collateralPrice = await this.getTokenPrice(request.collateralToken);
    const borrowPrice = await this.getTokenPrice(request.borrowToken);

    const collateralValueUsd = request.collateralAmount * collateralPrice.price;
    
    // Calculate borrow amount based on leverage
    // Total position = collateral * leverage
    // Borrow = Total position - collateral = collateral * (leverage - 1)
    const totalPositionValue = collateralValueUsd * request.leverage;
    const borrowValueUsd = totalPositionValue - collateralValueUsd;
    const borrowAmount = borrowValueUsd / borrowPrice.price;

    const quotes: ProtocolQuote[] = [];
    const protocols: ProtocolName[] = ['DRIFT', 'MARGINFI', 'SOLEND'];

    for (const protocol of protocols) {
      const protocolData = allRates.protocols.find((p: ProtocolRates) => p.protocol === protocol);
      if (!protocolData) continue;

      const collateralRate = protocolData.rates.find(
        (r: TokenRate) => r.token.toUpperCase() === request.collateralToken.toUpperCase()
      );
      const borrowRate = protocolData.rates.find(
        (r: TokenRate) => r.token.toUpperCase() === request.borrowToken.toUpperCase()
      );

      if (!collateralRate || !borrowRate) continue;

      const liquidationPrice = this.calculateLiquidationPrice(
        request.collateralAmount,
        collateralPrice.price,
        borrowAmount,
        borrowPrice.price,
        collateralRate.liquidationThreshold
      );

      const healthFactor = this.calculateHealthFactor(
        collateralValueUsd,
        borrowValueUsd,
        collateralRate.liquidationThreshold
      );

      const netApy = collateralRate.supplyApy - borrowRate.borrowApy;

      quotes.push({
        protocol,
        supplyApy: collateralRate.supplyApy,
        borrowApy: borrowRate.borrowApy,
        netApy,
        maxLtv: collateralRate.ltv,
        liquidationThreshold: collateralRate.liquidationThreshold,
        liquidationPenalty: collateralRate.liquidationPenalty,
        liquidationPrice,
        healthFactor,
        borrowAmount,
        totalPositionValue,
        estimatedFees: {
          protocolFee: totalPositionValue * 0.001, // 0.1% protocol fee
          networkFee: 0.005, // ~0.005 SOL
          total: totalPositionValue * 0.001 + 0.005 * collateralPrice.price,
        },
        isRecommended: false,
      });
    }

    // Determine best quote
    const bestQuote = this.selectBestQuote(quotes, request);
    bestQuote.isRecommended = true;

    return {
      request,
      collateralValueUsd,
      borrowValueUsd,
      quotes,
      bestQuote,
      currentPrices: {
        collateral: collateralPrice.price,
        borrow: borrowPrice.price,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Select the best quote based on multiple factors
   */
  private selectBestQuote(quotes: ProtocolQuote[], request: PositionQuoteRequest): ProtocolQuote {
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }

    // If user specified a protocol, use that
    if (request.protocol) {
      const specified = quotes.find(q => q.protocol === request.protocol);
      if (specified) {
        specified.recommendationReason = 'User selected protocol';
        return specified;
      }
    }

    // Score each quote
    const scored = quotes.map(quote => {
      let score = 0;
      
      // Higher net APY is better (can be negative)
      score += quote.netApy * 10;
      
      // Lower borrow APY is better
      score -= quote.borrowApy * 5;
      
      // Higher health factor is safer
      score += quote.healthFactor * 2;
      
      // Lower liquidation penalty is better
      score -= quote.liquidationPenalty;
      
      // Lower fees are better
      score -= quote.estimatedFees.total * 0.1;

      return { quote, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    const best = scored[0].quote;
    
    // Determine reason
    if (best.netApy === Math.max(...quotes.map(q => q.netApy))) {
      best.recommendationReason = 'Best net APY';
    } else if (best.borrowApy === Math.min(...quotes.map(q => q.borrowApy))) {
      best.recommendationReason = 'Lowest borrow rate';
    } else if (best.healthFactor === Math.max(...quotes.map(q => q.healthFactor))) {
      best.recommendationReason = 'Safest position';
    } else {
      best.recommendationReason = 'Best overall value';
    }

    return best;
  }
}

// Singleton instances per network
const quoteServices: Map<NetworkType, QuoteService> = new Map();

export function getQuoteService(network: NetworkType = 'mainnet-beta'): QuoteService {
  if (!quoteServices.has(network)) {
    quoteServices.set(network, new QuoteService(network));
  }
  return quoteServices.get(network)!;
}

export function createQuoteService(network: NetworkType = 'mainnet-beta'): QuoteService {
  return new QuoteService(network);
}
