/**
 * Database Service
 * Handles all database operations using Prisma client
 */

import { PrismaClient, Protocol, SwapStatus, AlertStatus, RecommendedAction } from '@prisma/client';
import { logger } from '../utils/logger';

// Types for database operations
export interface CreateAccountInput {
  walletAddress: string;
  protocol: Protocol;
  isActive?: boolean;
}

export interface CreateSnapshotInput {
  accountId: string;
  healthFactor: number;
  collateralValue: number;
  borrowedValue: number;
  leverage: number;
  liquidationPrice: number;
  oraclePrice: number;
  maintenanceMarginRatio: number;
  currentMarginRatio: number;
  riskScore: number;
  hvixValue: number;
  cascadeProbability: number;
  timeToLiquidation: number;
}

export interface CreateAlertInput {
  accountId: string;
  riskScore: number;
  cascadeProbability: number;
  timeToLiquidation: number;
  estimatedLosses: number;
  recommendedAction: RecommendedAction;
}

export interface CreateSwapInput {
  accountId: string;
  fromToken: string;
  toToken: string;
  inputAmount: number;
  outputAmount: number;
  slippageBps: number;
  usedShadowLane: boolean;
  usedJitoBundle: boolean;
  jitoTipLamports?: number;
  bundleId?: string;
  standardSlippage?: number;
  actualSlippage?: number;
  mevSaved?: number;
  transactionSignature?: string;
  status: SwapStatus;
  errorMessage?: string;
}

export interface DailyStats {
  date: Date;
  totalAccounts: number;
  totalAlerts: number;
  totalSwaps: number;
  totalMevSaved: number;
}

export class DatabaseService {
  private prisma: PrismaClient;
  private static instance: DatabaseService;

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Log database errors
    this.prisma.$on('error' as never, (e: any) => {
      logger.error('Prisma error:', e);
    });

    this.prisma.$on('warn' as never, (e: any) => {
      logger.warn('Prisma warning:', e);
    });

    logger.info('Database Service initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connected');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    logger.info('Database disconnected');
  }

  // ==========================================
  // Account Operations
  // ==========================================

  async createAccount(input: CreateAccountInput) {
    return this.prisma.monitoredAccount.create({
      data: {
        walletAddress: input.walletAddress,
        protocol: input.protocol,
        isActive: input.isActive ?? true,
      },
    });
  }

  async getAccount(walletAddress: string) {
    return this.prisma.monitoredAccount.findUnique({
      where: { walletAddress },
      include: {
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        alerts: {
          where: { status: AlertStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getAccountById(id: string) {
    return this.prisma.monitoredAccount.findUnique({
      where: { id },
      include: {
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async updateAccount(walletAddress: string, data: { isActive?: boolean; protocol?: Protocol }) {
    return this.prisma.monitoredAccount.update({
      where: { walletAddress },
      data,
    });
  }

  async deleteAccount(walletAddress: string) {
    return this.prisma.monitoredAccount.delete({
      where: { walletAddress },
    });
  }

  async listAccounts(options?: { isActive?: boolean; protocol?: Protocol }) {
    return this.prisma.monitoredAccount.findMany({
      where: {
        isActive: options?.isActive,
        protocol: options?.protocol,
      },
      include: {
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveAccountCount(): Promise<number> {
    return this.prisma.monitoredAccount.count({
      where: { isActive: true },
    });
  }

  // ==========================================
  // Snapshot Operations
  // ==========================================

  async createSnapshot(input: CreateSnapshotInput) {
    // Sanitize values - Prisma can't handle Infinity or NaN
    const sanitizedInput = {
      ...input,
      healthFactor: Number.isFinite(input.healthFactor) ? input.healthFactor : 999,
      leverage: Number.isFinite(input.leverage) ? input.leverage : 1,
      currentMarginRatio: Number.isFinite(input.currentMarginRatio) ? input.currentMarginRatio : 999,
      collateralValue: Number.isFinite(input.collateralValue) ? input.collateralValue : 0,
      borrowedValue: Number.isFinite(input.borrowedValue) ? input.borrowedValue : 0,
    };
    
    return this.prisma.accountSnapshot.create({
      data: sanitizedInput,
    });
  }

  async getLatestSnapshot(accountId: string) {
    return this.prisma.accountSnapshot.findFirst({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSnapshotHistory(
    accountId: string,
    options?: { limit?: number; since?: Date }
  ) {
    return this.prisma.accountSnapshot.findMany({
      where: {
        accountId,
        createdAt: options?.since ? { gte: options.since } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });
  }

  // ==========================================
  // Alert Operations
  // ==========================================

  async createAlert(input: CreateAlertInput) {
    return this.prisma.alert.create({
      data: {
        ...input,
        status: AlertStatus.ACTIVE,
      },
    });
  }

  async getAlert(id: string) {
    return this.prisma.alert.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });
  }

  async getActiveAlerts(options?: { accountId?: string; status?: AlertStatus }) {
    return this.prisma.alert.findMany({
      where: {
        status: options?.status || AlertStatus.ACTIVE,
        accountId: options?.accountId,
      },
      include: {
        account: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeAlert(id: string) {
    return this.prisma.alert.update({
      where: { id },
      data: { 
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
      },
    });
  }

  async resolveAlert(id: string) {
    return this.prisma.alert.update({
      where: { id },
      data: { 
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }

  async getAlertCount(options?: { resolved?: boolean }): Promise<number> {
    return this.prisma.alert.count({
      where: {
        status: options?.resolved === false ? AlertStatus.ACTIVE : undefined,
      },
    });
  }

  // ==========================================
  // Swap Operations
  // ==========================================

  async createSwap(input: CreateSwapInput) {
    return this.prisma.protectiveSwap.create({
      data: input,
    });
  }

  async getSwap(id: string) {
    return this.prisma.protectiveSwap.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });
  }

  async updateSwapStatus(
    id: string,
    status: SwapStatus,
    data?: { transactionSignature?: string; bundleId?: string; errorMessage?: string }
  ) {
    return this.prisma.protectiveSwap.update({
      where: { id },
      data: {
        status,
        ...data,
        executedAt: status === SwapStatus.CONFIRMED ? new Date() : undefined,
      },
    });
  }

  async getSwapHistory(options?: {
    accountId?: string;
    status?: SwapStatus;
    limit?: number;
    since?: Date;
  }) {
    return this.prisma.protectiveSwap.findMany({
      where: {
        accountId: options?.accountId,
        status: options?.status,
        createdAt: options?.since ? { gte: options.since } : undefined,
      },
      include: {
        account: true,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });
  }

  async getTotalMevSaved(): Promise<number> {
    const result = await this.prisma.protectiveSwap.aggregate({
      _sum: { mevSaved: true },
      where: { status: SwapStatus.CONFIRMED },
    });
    return result._sum.mevSaved || 0;
  }

  // ==========================================
  // Price History Operations
  // ==========================================

  async recordPrice(token: string, price: number, confidence: number, source: string) {
    return this.prisma.priceHistory.create({
      data: { token, price, confidence, source },
    });
  }

  async getPriceHistory(token: string, minutes: number = 60) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.prisma.priceHistory.findMany({
      where: {
        token,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLatestPrice(token: string) {
    return this.prisma.priceHistory.findFirst({
      where: { token },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // Stats Operations
  // ==========================================

  async getDailyStats(date?: Date): Promise<DailyStats> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [totalAccounts, totalAlerts, swapStats] = await Promise.all([
      this.prisma.monitoredAccount.count({
        where: { isActive: true },
      }),
      this.prisma.alert.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.protectiveSwap.aggregate({
        _count: { _all: true },
        _sum: { mevSaved: true },
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: SwapStatus.CONFIRMED,
        },
      }),
    ]);

    return {
      date: startOfDay,
      totalAccounts,
      totalAlerts,
      totalSwaps: swapStats._count._all,
      totalMevSaved: swapStats._sum.mevSaved || 0,
    };
  }

  async getOverviewStats() {
    const [
      totalAccounts,
      activeAlerts,
      totalSwaps,
      totalMevSaved,
      atRiskAccounts,
    ] = await Promise.all([
      this.prisma.monitoredAccount.count({ where: { isActive: true } }),
      this.prisma.alert.count({ where: { status: AlertStatus.ACTIVE } }),
      this.prisma.protectiveSwap.count({ where: { status: SwapStatus.CONFIRMED } }),
      this.getTotalMevSaved(),
      // Count unique accounts with risk score >= 30 (using distinct accountId)
      this.prisma.accountSnapshot
        .findMany({
          where: {
            riskScore: { gte: 30 },
            createdAt: { gte: new Date(Date.now() - 60000) }, // Last minute
          },
          distinct: ['accountId'],
          select: { accountId: true },
        })
        .then((snapshots) => snapshots.length),
    ]);

    return {
      totalAccounts,
      activeAlerts,
      totalSwaps,
      totalMevSaved,
      atRiskAccounts,
    };
  }

  /**
   * Get Prisma client for advanced queries
   */
  getClient(): PrismaClient {
    return this.prisma;
  }
}

export default DatabaseService;
