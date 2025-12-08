/**
 * Main Orchestrator
 * Coordinates all services and manages the monitoring loop
 */

import { EventEmitter } from 'events';
import { Protocol, RecommendedAction } from '@prisma/client';
import { logger } from '../utils/logger';
import { DatabaseService } from './database';
import { CacheService } from './cache';
import { GeyserMonitor } from '../layers/prediction/geyserMonitor';
import { HealthCalculator } from '../layers/prediction/healthCalculator';
import { PriceOracle } from '../layers/prediction/priceOracle';
import { HVIXCalculator } from '../layers/prediction/hvixCalculator';
import { CascadeDetector, AccountRiskData } from '../layers/prediction/cascadeDetector';
import { AlertSystem } from '../layers/prediction/alertSystem';
import { ProtectedSwapExecutor } from '../layers/execution/protectedSwapExecutor';
import { TIMING, TOKENS } from '../config/constants';

export interface OrchestratorConfig {
  monitoringIntervalMs?: number;
  enableAutoProtection?: boolean;
  autoProtectionThreshold?: number;
}

export interface MonitoringState {
  isRunning: boolean;
  lastUpdate: Date | null;
  accountsMonitored: number;
  activeAlerts: number;
  currentHvix: number;
}

export class Orchestrator extends EventEmitter {
  private database: DatabaseService;
  private cache: CacheService;
  private geyserMonitor: GeyserMonitor;
  private healthCalculator: HealthCalculator;
  private priceOracle: PriceOracle;
  private hvixCalculator: HVIXCalculator;
  private cascadeDetector: CascadeDetector;
  private alertSystem: AlertSystem;
  private swapExecutor: ProtectedSwapExecutor;

  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private config: OrchestratorConfig;
  private currentHvix: number = 0;

  constructor(config: OrchestratorConfig = {}) {
    super();
    
    this.config = {
      monitoringIntervalMs: config.monitoringIntervalMs || TIMING.MONITORING_INTERVAL_MS,
      enableAutoProtection: config.enableAutoProtection || false,
      autoProtectionThreshold: config.autoProtectionThreshold || 80,
    };

    // Initialize services
    this.database = DatabaseService.getInstance();
    this.cache = CacheService.getInstance();
    this.geyserMonitor = new GeyserMonitor();
    this.healthCalculator = new HealthCalculator();
    this.priceOracle = new PriceOracle();
    this.hvixCalculator = new HVIXCalculator();
    this.cascadeDetector = new CascadeDetector();
    this.alertSystem = new AlertSystem();
    this.swapExecutor = new ProtectedSwapExecutor();

    this.setupEventHandlers();
    
    logger.info('Orchestrator initialized', { config: this.config });
  }

  /**
   * Setup event handlers for all services
   */
  private setupEventHandlers(): void {
    // Geyser account updates
    this.geyserMonitor.on('accountUpdate', (data) => {
      this.handleAccountUpdate(data);
    });

    // Alert events
    this.alertSystem.on('alert:new', (alert) => {
      this.handleNewAlert(alert);
    });

    // Price updates
    this.priceOracle.on('priceUpdate', (data) => {
      this.emit('priceUpdate', data);
    });
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Orchestrator is already running');
      return;
    }

    logger.info('Starting Orchestrator...');

    try {
      // Connect to database
      await this.database.connect();

      // Initialize Geyser monitor
      await this.geyserMonitor.initialize();

      // Load monitored accounts from database
      await this.loadMonitoredAccounts();

      // Start price oracle
      await this.priceOracle.start(60000); // Update every minute

      // Start monitoring loop
      this.startMonitoringLoop();

      this.isRunning = true;
      this.emit('started');
      
      logger.info('Orchestrator started successfully');
    } catch (error) {
      logger.error('Failed to start Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Stop the orchestrator
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Orchestrator...');

    this.isRunning = false;

    // Stop monitoring loop
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Stop services
    this.priceOracle.stop();
    this.geyserMonitor.shutdown();
    await this.cache.disconnect();
    await this.database.disconnect();

    this.emit('stopped');
    logger.info('Orchestrator shutdown complete');
  }

  /**
   * Load monitored accounts from database
   */
  private async loadMonitoredAccounts(): Promise<void> {
    const accounts = await this.database.listAccounts({ isActive: true });
    
    for (const account of accounts) {
      this.geyserMonitor.addWalletToMonitor(account.walletAddress);
    }

    logger.info(`Loaded ${accounts.length} monitored accounts`);
  }

  /**
   * Start the main monitoring loop
   */
  private startMonitoringLoop(): void {
    this.monitoringInterval = setInterval(
      () => this.runMonitoringCycle(),
      this.config.monitoringIntervalMs
    );

    // Run immediately
    this.runMonitoringCycle();
  }

  /**
   * Run a single monitoring cycle
   */
  private async runMonitoringCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const startTime = Date.now();

      // 1. Get all monitored accounts
      const accounts = await this.database.listAccounts({ isActive: true });
      
      if (accounts.length === 0) {
        return;
      }

      // 2. Get current prices
      const solPrice = await this.priceOracle.getPrice(TOKENS.SOL);
      
      // 3. Get price history and calculate HVIX
      const priceHistory = this.priceOracle.getPriceHistory(TOKENS.SOL, 60);
      if (priceHistory.length > 0) {
        const hvixResult = this.hvixCalculator.calculateHVIX(priceHistory);
        this.currentHvix = hvixResult.value;
      }

      // 4. Build risk data for each account
      const riskDataList: AccountRiskData[] = [];
      
      for (const account of accounts) {
        const latestSnapshot = account.snapshots[0];
        if (!latestSnapshot) continue;

        const riskData: AccountRiskData = {
          walletAddress: account.walletAddress,
          healthFactor: latestSnapshot.healthFactor,
          collateralValue: latestSnapshot.collateralValue,
          borrowedValue: latestSnapshot.borrowedValue,
          leverage: latestSnapshot.leverage,
          liquidationPrice: latestSnapshot.liquidationPrice,
          oraclePrice: solPrice?.price || 0,
        };

        riskDataList.push(riskData);
      }

      // 5. Detect cascade risks (async method)
      const riskScores = await this.cascadeDetector.detectCascadeRisk(
        riskDataList,
        priceHistory
      );

      // 6. Generate alerts
      const alertResult = this.alertSystem.generateAlerts(riskScores);
      const newAlerts = alertResult.newAlerts || [];

      // 7. Store snapshots
      for (const riskScore of riskScores) {
        const account = accounts.find(
          (a) => a.walletAddress === riskScore.walletAddress
        );
        if (!account) continue;

        // Find original risk data for oracle price
        const originalData = riskDataList.find(
          (r) => r.walletAddress === riskScore.walletAddress
        );

        // Create snapshot
        await this.database.createSnapshot({
          accountId: account.id,
          healthFactor: riskScore.riskComponents.healthFactorRisk / 40, // Convert back to health factor
          collateralValue: originalData?.collateralValue || 0,
          borrowedValue: originalData?.borrowedValue || 0,
          leverage: originalData?.leverage || 1,
          liquidationPrice: originalData?.liquidationPrice || 0,
          oraclePrice: originalData?.oraclePrice || 0,
          maintenanceMarginRatio: 0.05,
          currentMarginRatio: originalData?.healthFactor || 1,
          riskScore: riskScore.riskScore,
          hvixValue: this.currentHvix,
          cascadeProbability: riskScore.cascadeProbability,
          timeToLiquidation: riskScore.timeToLiquidation,
        });
      }

      // 8. Store new alerts
      for (const alert of newAlerts) {
        const account = accounts.find(
          (a) => a.walletAddress === alert.walletAddress
        );
        if (!account) continue;

        await this.database.createAlert({
          accountId: account.id,
          riskScore: alert.riskScore,
          cascadeProbability: alert.cascadeProbability,
          timeToLiquidation: alert.timeToLiquidation || 0,
          estimatedLosses: alert.estimatedLosses || 0,
          recommendedAction: alert.recommendedAction === 'PROTECT' 
            ? RecommendedAction.PROTECT 
            : alert.recommendedAction === 'MONITOR' 
              ? RecommendedAction.MONITOR 
              : RecommendedAction.SAFE,
        });
      }

      // 9. Emit updates
      this.emit('monitoringUpdate', {
        accounts: riskScores.length,
        alerts: newAlerts.length,
        hvix: this.currentHvix,
        duration: Date.now() - startTime,
      });

      // 10. Handle critical alerts (auto-protection if enabled)
      if (this.config.enableAutoProtection) {
        for (const alert of newAlerts) {
          if (alert.riskScore >= (this.config.autoProtectionThreshold || 80)) {
            await this.handleCriticalAlert(alert);
          }
        }
      }

    } catch (error) {
      logger.error('Monitoring cycle error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle account update from Geyser
   */
  private async handleAccountUpdate(data: any): Promise<void> {
    try {
      const { walletAddress, accountData } = data;

      // Parse account data and calculate health
      const positionData = this.healthCalculator.parseDriftAccountData(accountData);
      
      if (positionData) {
        // Get account from database
        const account = await this.database.getAccount(walletAddress);
        if (!account) return;

        // Calculate health metrics
        const healthMetrics = this.healthCalculator.calculateHealthMetrics(positionData);

        // Create snapshot
        await this.database.createSnapshot({
          accountId: account.id,
          healthFactor: healthMetrics.healthFactor,
          collateralValue: positionData.collateralValue,
          borrowedValue: positionData.borrowedValue,
          leverage: healthMetrics.leverage,
          liquidationPrice: positionData.liquidationPrice,
          oraclePrice: positionData.oraclePrice,
          maintenanceMarginRatio: positionData.maintenanceMarginRatio,
          currentMarginRatio: healthMetrics.marginRatio,
          riskScore: 0, // Will be calculated in next cycle
          hvixValue: this.currentHvix,
          cascadeProbability: 0,
          timeToLiquidation: 0,
        });

        this.emit('accountUpdate', {
          walletAddress,
          healthFactor: healthMetrics.healthFactor,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Error handling account update:', error);
    }
  }

  /**
   * Handle new alert
   */
  private handleNewAlert(alert: any): void {
    this.emit('alert', alert);
    logger.warn('New alert generated:', {
      wallet: alert.walletAddress,
      riskScore: alert.riskScore,
    });
  }

  /**
   * Handle critical alert (auto-protection)
   */
  private async handleCriticalAlert(alert: any): Promise<void> {
    if (!this.config.enableAutoProtection) return;

    logger.warn('Handling critical alert for auto-protection:', {
      wallet: alert.walletAddress,
      riskScore: alert.riskScore,
    });

    // Auto-protection would be implemented here
    // This would trigger a protective swap automatically
    this.emit('autoProtectionTriggered', alert);
  }

  /**
   * Add account to monitoring
   */
  async addAccount(walletAddress: string, protocol: Protocol): Promise<void> {
    // Add to database
    await this.database.createAccount({
      walletAddress,
      protocol,
      isActive: true,
    });

    // Add to Geyser monitor
    this.geyserMonitor.addWalletToMonitor(walletAddress);

    logger.info(`Added account to monitoring: ${walletAddress}`);
    this.emit('accountAdded', { walletAddress, protocol });
  }

  /**
   * Remove account from monitoring
   */
  async removeAccount(walletAddress: string): Promise<void> {
    // Remove from Geyser monitor
    this.geyserMonitor.removeWalletFromMonitor(walletAddress);

    // Deactivate in database
    await this.database.updateAccount(walletAddress, { isActive: false });

    logger.info(`Removed account from monitoring: ${walletAddress}`);
    this.emit('accountRemoved', { walletAddress });
  }

  /**
   * Get current monitoring state
   */
  async getState(): Promise<MonitoringState> {
    const activeAlerts = await this.database.getAlertCount({ resolved: false });
    const accountCount = await this.database.getActiveAccountCount();

    return {
      isRunning: this.isRunning,
      lastUpdate: new Date(),
      accountsMonitored: accountCount,
      activeAlerts,
      currentHvix: this.currentHvix,
    };
  }

  /**
   * Get services for direct access
   */
  getServices() {
    return {
      database: this.database,
      cache: this.cache,
      geyserMonitor: this.geyserMonitor,
      healthCalculator: this.healthCalculator,
      priceOracle: this.priceOracle,
      hvixCalculator: this.hvixCalculator,
      cascadeDetector: this.cascadeDetector,
      alertSystem: this.alertSystem,
      swapExecutor: this.swapExecutor,
    };
  }
}

export default Orchestrator;
