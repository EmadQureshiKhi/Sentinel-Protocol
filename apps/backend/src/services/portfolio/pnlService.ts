/**
 * P&L Service
 * Tracks profit and loss for positions
 */

import { logger } from '../../utils/logger';
import { DatabaseService } from '../database';
import { NetworkType, ProtocolName } from '../protocols/types';
import { PnLBreakdown } from './types';

const prisma = DatabaseService.getInstance().getClient();

// Mock prices
const MOCK_PRICES: Record<string, number> = {
  SOL: 185.50,
  USDC: 1.00,
  USDT: 1.00,
  mSOL: 205.25,
  jitoSOL: 210.80,
};

export class PnLService {
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  private getTokenPrice(token: string): number {
    return MOCK_PRICES[token.toUpperCase()] || 1.0;
  }

  /**
   * Get P&L breakdown for a wallet
   */
  async getPnLBreakdown(walletAddress: string): Promise<PnLBreakdown> {
    logger.info('Getting P&L breakdown', { walletAddress });

    const networkFilter = this.network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET';

    const positions = await prisma.position.findMany({
      where: {
        walletAddress,
        network: networkFilter,
      },
    });

    const byProtocol: Map<ProtocolName, { unrealizedPnl: number; realizedPnl: number }> = new Map();
    const byToken: Map<string, { unrealizedPnl: number; realizedPnl: number }> = new Map();

    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;

    for (const position of positions) {
      const collateralPrice = this.getTokenPrice(position.collateralToken);
      const entryValue = position.collateralAmount * position.entryPrice;
      const currentValue = position.collateralAmount * collateralPrice;

      let unrealizedPnl = 0;
      let realizedPnl = 0;

      if (position.status === 'OPEN') {
        unrealizedPnl = currentValue - entryValue;
        totalUnrealizedPnl += unrealizedPnl;
      } else {
        realizedPnl = position.unrealizedPnl || 0;
        totalRealizedPnl += realizedPnl;
      }

      // Aggregate by protocol
      const protocol = position.protocol as ProtocolName;
      const protocolPnl = byProtocol.get(protocol) || { unrealizedPnl: 0, realizedPnl: 0 };
      protocolPnl.unrealizedPnl += unrealizedPnl;
      protocolPnl.realizedPnl += realizedPnl;
      byProtocol.set(protocol, protocolPnl);

      // Aggregate by token
      const token = position.collateralToken;
      const tokenPnl = byToken.get(token) || { unrealizedPnl: 0, realizedPnl: 0 };
      tokenPnl.unrealizedPnl += unrealizedPnl;
      tokenPnl.realizedPnl += realizedPnl;
      byToken.set(token, tokenPnl);
    }

    return {
      walletAddress,
      totalUnrealizedPnl,
      totalRealizedPnl,
      totalPnl: totalUnrealizedPnl + totalRealizedPnl,
      byProtocol: Array.from(byProtocol.entries()).map(([protocol, pnl]) => ({
        protocol,
        ...pnl,
      })),
      byToken: Array.from(byToken.entries()).map(([token, pnl]) => ({
        token,
        ...pnl,
      })),
    };
  }
}

// Singleton instances per network
const pnlServices: Map<NetworkType, PnLService> = new Map();

export function getPnLService(network: NetworkType = 'mainnet-beta'): PnLService {
  if (!pnlServices.has(network)) {
    pnlServices.set(network, new PnLService(network));
  }
  return pnlServices.get(network)!;
}
