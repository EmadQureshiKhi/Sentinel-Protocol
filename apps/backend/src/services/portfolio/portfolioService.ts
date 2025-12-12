/**
 * Portfolio Service
 * Aggregates all positions for a wallet across protocols
 */

import { logger } from '../../utils/logger';
import { DatabaseService } from '../database';
import { getQuoteService } from '../positions/quoteService';
import { NetworkType, ProtocolName } from '../protocols/types';
import { PortfolioSummary, PortfolioPosition, PortfolioHistory } from './types';

const prisma = DatabaseService.getInstance().getClient();

// Mock prices - in production, fetch from Pyth/Switchboard
const MOCK_PRICES: Record<string, number> = {
  SOL: 185.50,
  USDC: 1.00,
  USDT: 1.00,
  mSOL: 205.25,
  jitoSOL: 210.80,
};

export class PortfolioService {
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  /**
   * Get token price
   */
  private getTokenPrice(token: string): number {
    return MOCK_PRICES[token.toUpperCase()] || 1.0;
  }

  /**
   * Get full portfolio for a wallet
   */
  async getPortfolio(walletAddress: string): Promise<PortfolioSummary> {
    logger.info('Getting portfolio', { walletAddress });

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
      const collateralPrice = this.getTokenPrice(position.collateralToken);
      const borrowPrice = this.getTokenPrice(position.borrowToken);

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
    const networkFilter = this.network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET';

    const positions = await prisma.position.findMany({
      where: {
        walletAddress,
        network: networkFilter,
      },
      orderBy: { openedAt: 'desc' },
    });

    return positions.map(position => {
      const collateralPrice = this.getTokenPrice(position.collateralToken);
      const borrowPrice = this.getTokenPrice(position.borrowToken);

      const collateralValueUsd = position.collateralAmount * collateralPrice;
      const borrowValueUsd = position.borrowAmount * borrowPrice;

      // Calculate health factor
      const healthFactor = borrowValueUsd > 0 
        ? (collateralValueUsd * 0.85) / borrowValueUsd 
        : 999;

      // Calculate P&L
      const entryValue = position.collateralAmount * position.entryPrice;
      const currentValue = collateralValueUsd;
      const unrealizedPnl = currentValue - entryValue;
      const unrealizedPnlPercent = entryValue > 0 ? (unrealizedPnl / entryValue) * 100 : 0;

      return {
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
        leverage: position.leverage,
        healthFactor,
        liquidationPrice: position.liquidationPrice,
        entryPrice: position.entryPrice,
        currentPrice: collateralPrice,
        unrealizedPnl,
        unrealizedPnlPercent,
        openedAt: position.openedAt,
      };
    });
  }

  /**
   * Get portfolio history for charts
   */
  async getPortfolioHistory(
    walletAddress: string,
    days: number = 30
  ): Promise<PortfolioHistory[]> {
    // In production, this would query PositionHistory table
    // For now, return mock data
    const history: PortfolioHistory[] = [];
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate mock historical data with some variance
      const baseCollateral = 5000 + Math.random() * 1000;
      const baseDebt = 3000 + Math.random() * 500;

      history.push({
        timestamp: date,
        totalCollateralUsd: baseCollateral,
        totalDebtUsd: baseDebt,
        netWorth: baseCollateral - baseDebt,
        aggregateHealthFactor: (baseCollateral * 0.85) / baseDebt,
      });
    }

    return history;
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
