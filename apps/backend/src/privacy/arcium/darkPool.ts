/**
 * Dark Pool Service
 * Private order matching and execution using Arcium MXE
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import * as crypto from 'crypto';
import {
  DarkPoolOrder,
  DarkPoolMatch,
  EncryptedData,
  ZKProof,
} from './types';
import { ArciumEncryption, getArciumEncryption } from './encryption';
import { logger } from '../../utils/logger';

interface OrderParams {
  walletAddress: string;
  side: 'buy' | 'sell';
  token: string;
  amount: number;
  price: number;
  expiresIn?: number;
}

interface MatchResult {
  match: DarkPoolMatch;
  buyOrder: DarkPoolOrder;
  sellOrder: DarkPoolOrder;
}

export class DarkPoolService {
  private encryption: ArciumEncryption;
  private orderBook: Map<string, DarkPoolOrder>;
  private matches: Map<string, DarkPoolMatch>;
  private tokenPools: Map<string, Set<string>>;

  constructor() {
    this.encryption = getArciumEncryption();
    this.orderBook = new Map();
    this.matches = new Map();
    this.tokenPools = new Map();
  }

  async submitOrder(params: OrderParams): Promise<DarkPoolOrder> {
    const [encryptedSide, encryptedToken, encryptedAmount, encryptedPrice] = 
      await Promise.all([
        this.encryption.encrypt(params.side),
        this.encryption.encrypt(params.token),
        this.encryption.encryptNumber(params.amount),
        this.encryption.encryptNumber(params.price),
      ]);

    const order: DarkPoolOrder = {
      orderId: crypto.randomUUID(),
      encryptedSide,
      encryptedToken,
      encryptedAmount,
      encryptedPrice,
      walletAddress: params.walletAddress,
      mxeClusterId: this.encryption.getClusterId(),
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + (params.expiresIn || 3600000),
    };

    this.orderBook.set(order.orderId, order);
    this.addToTokenPool(params.token, order.orderId);

    logger.info('Dark pool order submitted', {
      orderId: order.orderId,
      walletAddress: params.walletAddress,
    });

    await this.attemptMatch(order, params.token, params.side, params.amount, params.price);

    return order;
  }

  private async attemptMatch(
    newOrder: DarkPoolOrder,
    token: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number
  ): Promise<MatchResult | null> {
    const tokenPool = this.tokenPools.get(token);
    if (!tokenPool) return null;

    for (const orderId of tokenPool) {
      if (orderId === newOrder.orderId) continue;

      const existingOrder = this.orderBook.get(orderId);
      if (!existingOrder || existingOrder.status !== 'pending') continue;

      const existingSide = (await this.encryption.decrypt(existingOrder.encryptedSide)).toString();
      if (existingSide === side) continue;

      const existingPrice = await this.encryption.decryptNumber(existingOrder.encryptedPrice);
      const existingAmount = await this.encryption.decryptNumber(existingOrder.encryptedAmount);

      const pricesMatch = side === 'buy' 
        ? price >= existingPrice 
        : price <= existingPrice;

      if (pricesMatch && existingAmount > 0) {
        const matchAmount = Math.min(amount, existingAmount);
        const executionPrice = (price + existingPrice) / 2;

        const match = await this.executeMatch(
          side === 'buy' ? newOrder : existingOrder,
          side === 'sell' ? newOrder : existingOrder,
          matchAmount,
          executionPrice
        );

        return {
          match,
          buyOrder: side === 'buy' ? newOrder : existingOrder,
          sellOrder: side === 'sell' ? newOrder : existingOrder,
        };
      }
    }

    return null;
  }

  private async executeMatch(
    buyOrder: DarkPoolOrder,
    sellOrder: DarkPoolOrder,
    amount: number,
    price: number
  ): Promise<DarkPoolMatch> {
    const [encryptedExecutionPrice, encryptedExecutionAmount] = await Promise.all([
      this.encryption.encryptNumber(price),
      this.encryption.encryptNumber(amount),
    ]);

    const proofHash = await this.generateMatchProof(buyOrder, sellOrder, amount, price);

    const match: DarkPoolMatch = {
      matchId: crypto.randomUUID(),
      buyOrderId: buyOrder.orderId,
      sellOrderId: sellOrder.orderId,
      encryptedExecutionPrice,
      encryptedExecutionAmount,
      proofHash,
      executedAt: Date.now(),
    };

    buyOrder.status = 'matched';
    sellOrder.status = 'matched';

    this.matches.set(match.matchId, match);

    logger.info('Dark pool match executed', {
      matchId: match.matchId,
      buyOrderId: buyOrder.orderId,
      sellOrderId: sellOrder.orderId,
    });

    await this.settleMatch(match);

    return match;
  }

  private async settleMatch(match: DarkPoolMatch): Promise<void> {
    const buyOrder = this.orderBook.get(match.buyOrderId);
    const sellOrder = this.orderBook.get(match.sellOrderId);

    if (buyOrder && sellOrder) {
      buyOrder.status = 'executed';
      sellOrder.status = 'executed';

      logger.info('Dark pool match settled', {
        matchId: match.matchId,
      });
    }
  }

  private async generateMatchProof(
    buyOrder: DarkPoolOrder,
    sellOrder: DarkPoolOrder,
    amount: number,
    price: number
  ): Promise<string> {
    const proofInput = Buffer.concat([
      Buffer.from(buyOrder.orderId),
      Buffer.from(sellOrder.orderId),
      Buffer.from(amount.toString()),
      Buffer.from(price.toString()),
    ]);

    return crypto.createHash('sha256').update(proofInput).digest('hex').slice(0, 64);
  }

  private addToTokenPool(token: string, orderId: string): void {
    if (!this.tokenPools.has(token)) {
      this.tokenPools.set(token, new Set());
    }
    this.tokenPools.get(token)!.add(orderId);
  }

  async cancelOrder(orderId: string, walletAddress: string): Promise<boolean> {
    const order = this.orderBook.get(orderId);
    
    if (!order) return false;
    if (order.walletAddress !== walletAddress) return false;
    if (order.status !== 'pending') return false;

    order.status = 'cancelled';
    
    logger.info('Dark pool order cancelled', { orderId });
    
    return true;
  }

  async getOrder(orderId: string): Promise<DarkPoolOrder | null> {
    return this.orderBook.get(orderId) || null;
  }

  async getOrdersByWallet(walletAddress: string): Promise<DarkPoolOrder[]> {
    return Array.from(this.orderBook.values())
      .filter(order => order.walletAddress === walletAddress);
  }

  async getMatch(matchId: string): Promise<DarkPoolMatch | null> {
    return this.matches.get(matchId) || null;
  }

  async getMatchesByWallet(walletAddress: string): Promise<DarkPoolMatch[]> {
    const walletOrders = new Set(
      Array.from(this.orderBook.values())
        .filter(o => o.walletAddress === walletAddress)
        .map(o => o.orderId)
    );

    return Array.from(this.matches.values())
      .filter(m => walletOrders.has(m.buyOrderId) || walletOrders.has(m.sellOrderId));
  }

  async getPoolStats(token: string): Promise<{
    pendingOrders: number;
    matchedOrders: number;
    totalVolume: number;
  }> {
    const tokenPool = this.tokenPools.get(token);
    if (!tokenPool) {
      return { pendingOrders: 0, matchedOrders: 0, totalVolume: 0 };
    }

    let pendingOrders = 0;
    let matchedOrders = 0;
    let totalVolume = 0;

    for (const orderId of tokenPool) {
      const order = this.orderBook.get(orderId);
      if (!order) continue;

      if (order.status === 'pending') pendingOrders++;
      if (order.status === 'executed') {
        matchedOrders++;
        const amount = await this.encryption.decryptNumber(order.encryptedAmount);
        totalVolume += amount;
      }
    }

    return { pendingOrders, matchedOrders, totalVolume };
  }

  async cleanupExpiredOrders(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [orderId, order] of this.orderBook) {
      if (order.status === 'pending' && order.expiresAt < now) {
        order.status = 'cancelled';
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired dark pool orders', { count: cleaned });
    }

    return cleaned;
  }
}

let darkPoolInstance: DarkPoolService | null = null;

export function getDarkPoolService(): DarkPoolService {
  if (!darkPoolInstance) {
    darkPoolInstance = new DarkPoolService();
  }
  return darkPoolInstance;
}
