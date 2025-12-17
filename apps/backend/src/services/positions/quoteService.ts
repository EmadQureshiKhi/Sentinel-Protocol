/**
 * Position Quote Service
 * Calculates position previews and compares across protocols
 */

import { logger } from '../../utils/logger';
import { getRateAggregator } from '../protocols/rateAggregator';
import { ProtocolName, NetworkType, TokenRate, ProtocolRates } from '../protocols/types';
import { priceService, TOKEN_MINTS } from '../prices';
import {
  PositionQuoteRequest,
  PositionQuoteResponse,
  ProtocolQuote,
  TokenPrice,
} from './types';

export class QuoteService {
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  /**
   * Get current token price from Jupiter API
   */
  async getTokenPrice(token: string): Promise<TokenPrice> {
    const priceData = await priceService.getPrice(token);
    
    if (!priceData) {
      logger.warn('Failed to fetch price, using fallback', { token });
      // Fallback for stablecoins
      const fallbackPrice = token.toUpperCase().includes('USD') ? 1.0 : 0;
      return {
        token: token.toUpperCase(),
        mint: TOKEN_MINTS[token.toUpperCase()] || token,
        price: fallbackPrice,
        confidence: 0,
        source: 'fallback',
        updatedAt: new Date(),
      };
    }
    
    return {
      token: priceData.symbol,
      mint: priceData.mint,
      price: priceData.price,
      confidence: 0.99,
      source: 'jupiter',
      updatedAt: new Date(priceData.timestamp),
    };
  }


  /**
   * Calculate liquidation price for a position
   * For a long position (collateral = volatile asset, debt = stable):
   * Liquidation occurs when collateralValue * liquidationThreshold <= debtValue
   * So: collateralAmount * liqPrice * threshold = borrowAmount * borrowPrice
   * liqPrice = (borrowAmount * borrowPrice) / (collateralAmount * threshold)
   */
  calculateLiquidationPrice(
    collateralAmount: number,
    collateralPrice: number,
    borrowAmount: number,
    borrowPrice: number,
    liquidationThreshold: number
  ): number {
    if (borrowAmount === 0 || collateralAmount === 0) return 0;
    
    // Convert threshold from percentage (e.g., 85) to decimal (0.85)
    const thresholdDecimal = liquidationThreshold / 100;
    
    // Liquidation price = debt value / (collateral amount * threshold)
    const borrowValue = borrowAmount * borrowPrice;
    const liquidationPrice = borrowValue / (collateralAmount * thresholdDecimal);
    
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
    
    // Use all available protocols from the rate aggregator
    for (const protocolData of allRates.protocols) {
      const protocol = protocolData.protocol;

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
