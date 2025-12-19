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
  private _isRunning: boolean = false;
  private config: OrchestratorConfig;
  private currentHvix: number = 0;
  private sharedDriftClient: any = null; // Shared Drift client to avoid subscription overload

  constructor(config: OrchestratorConfig = {}) {
    super();
    
    this.config = {
      monitoringIntervalMs: config.monitoringIntervalMs || 30000, // Changed from 10s to 30s
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
   * Initialize shared Drift client to avoid subscription overload
   */
  private async initializeSharedDriftClient(): Promise<void> {
    try {
      const DriftSDK = await import('@drift-labs/sdk');
      const { Connection, PublicKey, Keypair } = await import('@solana/web3.js');

      // Create connection
      const connection = new Connection(
        process.env.MAINNET_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Create dummy wallet for reading account data
      const dummyKeypair = Keypair.generate();
      const dummyWallet = {
        publicKey: dummyKeypair.publicKey,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      };

      // Initialize Drift client
      this.sharedDriftClient = new DriftSDK.DriftClient({
        connection,
        wallet: dummyWallet,
        env: 'mainnet-beta',
      });

      await this.sharedDriftClient.subscribe();
      logger.info('✅ Shared Drift client initialized');
    } catch (error) {
      logger.error('Failed to initialize shared Drift client:', error);
      throw error;
    }
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      logger.warn('Orchestrator is already running');
      return;
    }

    logger.info('Starting Orchestrator...');

    try {
      // Connect to database
      await this.database.connect();

      // Initialize shared Drift client
      await this.initializeSharedDriftClient();

      // Initialize Geyser monitor
      await this.geyserMonitor.initialize();

      // Load monitored accounts from database
      await this.loadMonitoredAccounts();

      // Start price oracle
      await this.priceOracle.start(60000); // Update every minute

      // Start monitoring loop
      this.startMonitoringLoop();

      this._isRunning = true;
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

    this._isRunning = false;

    // Stop monitoring loop
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Cleanup shared Drift client
    if (this.sharedDriftClient) {
      try {
        await this.sharedDriftClient.unsubscribe();
        logger.info('Shared Drift client unsubscribed');
      } catch (error) {
        logger.error('Error unsubscribing shared Drift client:', error);
      }
      this.sharedDriftClient = null;
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
    if (!this._isRunning) return;

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
        let riskData: AccountRiskData;
        
        // Demo account with simulated high-risk position
        const DEMO_WALLET = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
        
        if (account.walletAddress === DEMO_WALLET) {
          // Create demo data showing a risky position
          const currentTime = Date.now();
          const cycleNumber = Math.floor(currentTime / 30000); // Changes every 30s
          
          // Simulate oscillating between CRITICAL and HIGH risk to trigger alerts
          // Health factor 1.05-1.25 = Risk score 32-40 (critical/danger zone)
          const baseHealth = 1.15;
          const healthVariation = Math.sin(cycleNumber * 0.2) * 0.10; // Oscillate between 1.05 and 1.25
          const demoHealthFactor = Math.max(1.05, Math.min(1.25, baseHealth + healthVariation));
          
          riskData = {
            walletAddress: account.walletAddress,
            healthFactor: demoHealthFactor,
            collateralValue: 125.8, // $125.8 in SOL
            borrowedValue: 98.5, // $98.5 in USDC (high debt!)
            leverage: 8.5, // 8.5x leverage (very risky!)
            liquidationPrice: 128.2, // Very close to current price (~$130)
            oraclePrice: solPrice?.price || 130,
          };
          
          logger.info('🎭 Demo account data generated', {
            wallet: DEMO_WALLET,
            healthFactor: demoHealthFactor.toFixed(3),
            riskLevel: demoHealthFactor < 1.1 ? 'CRITICAL' : demoHealthFactor < 1.3 ? 'HIGH' : 'MODERATE',
            leverage: '8.5x',
            collateral: '$125.8',
            debt: '$98.5',
          });
        } else {
          // Try to fetch fresh data from Drift using shared client
          try {
            const positionData = this.sharedDriftClient 
              ? await this.healthCalculator.parseDriftAccountDataWithClient(account.walletAddress, this.sharedDriftClient)
              : await this.healthCalculator.parseDriftAccountData(account.walletAddress);
            
            if (positionData) {
            const healthMetrics = this.healthCalculator.calculateHealthMetrics(positionData);
            
            logger.debug('Health metrics calculated', {
              wallet: account.walletAddress,
              healthFactor: healthMetrics.healthFactor,
              collateral: positionData.collateralValue,
              debt: positionData.borrowedValue,
              liquidationThreshold: positionData.liquidationThreshold,
            });
            
            riskData = {
              walletAddress: account.walletAddress,
              healthFactor: healthMetrics.healthFactor,
              collateralValue: positionData.collateralValue,
              borrowedValue: positionData.borrowedValue,
              leverage: healthMetrics.leverage,
              liquidationPrice: positionData.liquidationPrice,
              oraclePrice: positionData.oraclePrice,
            };
          } else {
            // Fallback to latest snapshot if Drift fetch fails
            const latestSnapshot = account.snapshots[0];
            if (!latestSnapshot) continue;

            riskData = {
              walletAddress: account.walletAddress,
              healthFactor: latestSnapshot.healthFactor,
              collateralValue: latestSnapshot.collateralValue,
              borrowedValue: latestSnapshot.borrowedValue,
              leverage: latestSnapshot.leverage,
              liquidationPrice: latestSnapshot.liquidationPrice,
              oraclePrice: solPrice?.price || 0,
            };
          }
        } catch (error) {
          // Fallback to latest snapshot on error
          const latestSnapshot = account.snapshots[0];
          if (!latestSnapshot) continue;

          riskData = {
            walletAddress: account.walletAddress,
            healthFactor: latestSnapshot.healthFactor,
            collateralValue: latestSnapshot.collateralValue,
            borrowedValue: latestSnapshot.borrowedValue,
            leverage: latestSnapshot.leverage,
            liquidationPrice: latestSnapshot.liquidationPrice,
            oraclePrice: solPrice?.price || 0,
          };
          }
        }

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
        const snapshotData = {
          accountId: account.id,
          healthFactor: originalData?.healthFactor || 0,
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
        };
        
        logger.debug('Creating snapshot', {
          wallet: account.walletAddress,
          healthFactor: snapshotData.healthFactor,
          collateral: snapshotData.collateralValue,
          debt: snapshotData.borrowedValue,
        });
        
        await this.database.createSnapshot(snapshotData);
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

      // Parse account data and calculate health (Drift only for now)
      const positionData = await this.healthCalculator.parseDriftAccountData(walletAddress);
      
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
      isRunning: this._isRunning,
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

  /**
   * Check if orchestrator is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }
}

export default Orchestrator;
