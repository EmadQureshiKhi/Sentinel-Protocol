/**
 * Portfolio Service
 * Aggregates all positions for a wallet across protocols
 */

import { logger } from '../../utils/logger';
import { DatabaseService } from '../database';
import { NetworkType, ProtocolName } from '../protocols/types';
import { priceService } from '../prices';
import { PortfolioSummary, PortfolioPosition, PortfolioHistory } from './types';

const prisma = DatabaseService.getInstance().getClient();

export class PortfolioService {
  private network: NetworkType;
  private priceCache: Map<string, number> = new Map();

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  /**
   * Get token price from Jupiter API
   */
  private async getTokenPrice(token: string): Promise<number> {
    // Check local cache first (valid for this request)
    if (this.priceCache.has(token)) {
      return this.priceCache.get(token)!;
    }

    const price = await priceService.getPriceBySymbol(token);
    
    // Fallback for stablecoins if API fails
    if (price === 0 && token.toUpperCase().includes('USD')) {
      return 1.0;
    }
    
    this.priceCache.set(token, price);
    return price;
  }

  /**
   * Clear price cache (call at start of each request)
   */
  private clearPriceCache(): void {
    this.priceCache.clear();
  }

  /**
   * Get full portfolio for a wallet
   */
  async getPortfolio(walletAddress: string): Promise<PortfolioSummary> {
    logger.info('Getting portfolio', { walletAddress });
    this.clearPriceCache();

    const networkFilter = this.network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET';

    const positions = await prisma.position.findMany({
      where: {
        walletAddress,
        network: networkFilter,
      },
    });

    let totalCollateralUsd = 0;
    let totalDebtUsd = 0;
    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;
    let openPositions = 0;
    let closedPositions = 0;
    let liquidatedPositions = 0;


    for (const position of positions) {
      const collateralPrice = await this.getTokenPrice(position.collateralToken);
      const borrowPrice = await this.getTokenPrice(position.borrowToken);

      const collateralValue = position.collateralAmount * collateralPrice;
      const debtValue = position.borrowAmount * borrowPrice;

      if (position.status === 'OPEN') {
        totalCollateralUsd += collateralValue;
        totalDebtUsd += debtValue;
        openPositions++;

        // Calculate unrealized P&L
        const entryValue = position.collateralAmount * position.entryPrice;
        const currentValue = collateralValue;
        totalUnrealizedPnl += currentValue - entryValue;
      } else if (position.status === 'CLOSED') {
        closedPositions++;
        // Realized P&L would be stored in position
        totalRealizedPnl += position.unrealizedPnl || 0;
      } else if (position.status === 'LIQUIDATED') {
        liquidatedPositions++;
      }
    }

    // Calculate aggregate health factor
    let aggregateHealthFactor = 999;
    if (totalDebtUsd > 0) {
      // Assume average 85% liquidation threshold
      aggregateHealthFactor = (totalCollateralUsd * 0.85) / totalDebtUsd;
    }

    return {
      walletAddress,
      network: this.network,
      totalCollateralUsd,
      totalDebtUsd,
      netWorth: totalCollateralUsd - totalDebtUsd,
      aggregateHealthFactor,
      totalPositions: positions.length,
      openPositions,
      closedPositions,
      liquidatedPositions,
      totalUnrealizedPnl,
      totalRealizedPnl,
      updatedAt: new Date(),
    };
  }

  /**
   * Get all positions with current values
   */
  async getPositions(walletAddress: string): Promise<PortfolioPosition[]> {
    this.clearPriceCache();
    const networkFilter = this.network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET';

    const positions = await prisma.position.findMany({
      where: {
        walletAddress,
        network: networkFilter,
      },
      orderBy: { openedAt: 'desc' },
    });

    const results: PortfolioPosition[] = [];
    
    for (const position of positions) {
      const collateralPrice = await this.getTokenPrice(position.collateralToken);
      const borrowPrice = await this.getTokenPrice(position.borrowToken);

      const collateralValueUsd = position.collateralAmount * collateralPrice;
      const borrowValueUsd = position.borrowAmount * borrowPrice;

      // Calculate health factor (using 85% liquidation threshold)
      const liquidationThreshold = 0.85;
      const healthFactor = borrowValueUsd > 0 
        ? (collateralValueUsd * liquidationThreshold) / borrowValueUsd 
        : 999;

      // Calculate liquidation price dynamically
      // Liquidation occurs when: collateralAmount * liqPrice * threshold = borrowValueUsd
      // liqPrice = borrowValueUsd / (collateralAmount * threshold)
      const liquidationPrice = position.collateralAmount > 0 && borrowValueUsd > 0
        ? borrowValueUsd / (position.collateralAmount * liquidationThreshold)
        : 0;

      // Calculate actual leverage from current values
      const actualLeverage = collateralValueUsd > borrowValueUsd 
        ? collateralValueUsd / (collateralValueUsd - borrowValueUsd)
        : position.leverage;

      // Calculate P&L
      const entryValue = position.collateralAmount * position.entryPrice;
      const currentValue = collateralValueUsd;
      const unrealizedPnl = currentValue - entryValue;
      const unrealizedPnlPercent = entryValue > 0 ? (unrealizedPnl / entryValue) * 100 : 0;

      results.push({
        id: position.id,
        protocol: position.protocol as ProtocolName,
        network: this.network,
        status: position.status as 'OPEN' | 'CLOSED' | 'LIQUIDATED',
        collateralToken: position.collateralToken,
        collateralAmount: position.collateralAmount,
        collateralValueUsd,
        borrowToken: position.borrowToken,
        borrowAmount: position.borrowAmount,
        borrowValueUsd,
        leverage: actualLeverage,
        healthFactor,
        liquidationPrice,
        entryPrice: position.entryPrice,
        currentPrice: collateralPrice,
        unrealizedPnl,
        unrealizedPnlPercent,
        openedAt: position.openedAt,
      });
    }
    
    return results;
  }

  /**
   * Get portfolio history for charts
   * Queries PositionHistory table for historical snapshots
   */
  async getPortfolioHistory(
    walletAddress: string,
    days: number = 30
  ): Promise<PortfolioHistory[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all positions for this wallet
    const networkFilter = this.network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET';
    const positions = await prisma.position.findMany({
      where: {
        walletAddress,
        network: networkFilter,
      },
      select: { id: true },
    });

    if (positions.length === 0) {
      return [];
    }

    const positionIds = positions.map(p => p.id);

    // Get historical snapshots
    const snapshots = await prisma.positionHistory.findMany({
      where: {
        positionId: { in: positionIds },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day and aggregate
    const dailyData = new Map<string, PortfolioHistory>();

    for (const snapshot of snapshots) {
      const dateKey = snapshot.createdAt.toISOString().split('T')[0];
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          timestamp: new Date(dateKey),
          totalCollateralUsd: 0,
          totalDebtUsd: 0,
          netWorth: 0,
          aggregateHealthFactor: 0,
        });
      }

      const day = dailyData.get(dateKey)!;
      day.totalCollateralUsd += snapshot.collateralValue;
      day.totalDebtUsd += snapshot.borrowValue;
    }

    // Calculate derived values
    const history: PortfolioHistory[] = [];
    for (const [, day] of dailyData) {
      day.netWorth = day.totalCollateralUsd - day.totalDebtUsd;
      day.aggregateHealthFactor = day.totalDebtUsd > 0 
        ? (day.totalCollateralUsd * 0.85) / day.totalDebtUsd 
        : 999;
      history.push(day);
    }

    return history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

// Singleton instances per network
const portfolioServices: Map<NetworkType, PortfolioService> = new Map();

export function getPortfolioService(network: NetworkType = 'mainnet-beta'): PortfolioService {
  if (!portfolioServices.has(network)) {
    portfolioServices.set(network, new PortfolioService(network));
  }
  return portfolioServices.get(network)!;
}

export function createPortfolioService(network: NetworkType = 'mainnet-beta'): PortfolioService {
  return new PortfolioService(network);
}
