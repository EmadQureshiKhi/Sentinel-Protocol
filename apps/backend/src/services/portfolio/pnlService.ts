/**
 * P&L Service
 * Tracks profit and loss for positions
 */

import { logger } from '../../utils/logger';
import { DatabaseService } from '../database';
import { NetworkType, ProtocolName } from '../protocols/types';
import { priceService } from '../prices';
import { PnLBreakdown } from './types';

const prisma = DatabaseService.getInstance().getClient();

export class PnLService {
  private network: NetworkType;
  private priceCache: Map<string, number> = new Map();

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
  }

  /**
   * Get token price from Jupiter API
   */
  private async getTokenPrice(token: string): Promise<number> {
    if (this.priceCache.has(token)) {
      return this.priceCache.get(token)!;
    }

    const price = await priceService.getPriceBySymbol(token);
    
    // Fallback for stablecoins
    if (price === 0 && token.toUpperCase().includes('USD')) {
      return 1.0;
    }
    
    this.priceCache.set(token, price);
    return price;
  }

  /**
   * Get P&L breakdown for a wallet
   */
  async getPnLBreakdown(walletAddress: string): Promise<PnLBreakdown> {
    logger.info('Getting P&L breakdown', { walletAddress });
    this.priceCache.clear();

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
      const collateralPrice = await this.getTokenPrice(position.collateralToken);
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
