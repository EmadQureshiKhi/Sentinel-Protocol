import { logger } from '../../utils/logger';
import { RISK_THRESHOLDS } from '../../config/constants';

// Health tier types
export type HealthTier = 'SAFE' | 'CAUTION' | 'DANGER' | 'CRITICAL';

// Position data structure
export interface PositionData {
  collateralValue: number; // USD
  borrowedValue: number; // USD
  liquidationThreshold: number; // e.g., 0.8 = 80%
  maintenanceMarginRatio: number; // e.g., 0.05 = 5%
  oraclePrice: number;
  liquidationPrice: number;
}

// Calculated health metrics
export interface HealthMetrics {
  healthFactor: number;
  marginRatio: number;
  leverage: number;
  healthTier: HealthTier;
  distanceToLiquidation: number; // percentage
  isAtRisk: boolean;
}

export class HealthCalculator {
  /**
   * Calculate health factor
   * Health Factor = (Total Collateral × Liquidation Threshold) / Total Debt
   * 
   * @param collateralValue - Total collateral value in USD
   * @param debtValue - Total borrowed/debt value in USD
   * @param liquidationThreshold - Liquidation threshold (default 0.8 = 80%)
   * @returns Health factor (>1 = safe, <1 = at risk)
   */
  calculateHealthFactor(
    collateralValue: number,
    debtValue: number,
    liquidationThreshold: number = 0.8
  ): number {
    if (debtValue === 0) {
      return Infinity; // No debt = infinitely healthy
    }

    if (collateralValue <= 0) {
      return 0; // No collateral = immediate liquidation
    }

    const healthFactor = (collateralValue * liquidationThreshold) / debtValue;
    
    return Math.max(0, healthFactor);
  }

  /**
   * Calculate margin ratio
   * Margin Ratio = (Collateral - Debt) / Collateral
   * 
   * @param collateralValue - Total collateral value in USD
   * @param debtValue - Total borrowed/debt value in USD
   * @returns Margin ratio (0-1, higher = safer)
   */
  calculateMarginRatio(collateralValue: number, debtValue: number): number {
    if (collateralValue <= 0) {
      return 0;
    }

    const marginRatio = (collateralValue - debtValue) / collateralValue;
    
    return Math.max(0, Math.min(1, marginRatio));
  }

  /**
   * Calculate leverage
   * Leverage = Total Position Value / Equity
   * 
   * @param collateralValue - Total collateral value in USD
   * @param debtValue - Total borrowed/debt value in USD
   * @returns Leverage multiplier (e.g., 2.5x)
   */
  calculateLeverage(collateralValue: number, debtValue: number): number {
    const equity = collateralValue - debtValue;
    
    if (equity <= 0) {
      return Infinity; // Underwater position
    }

    return collateralValue / equity;
  }

  /**
   * Get health tier based on health factor
   */
  getHealthTier(healthFactor: number): HealthTier {
    if (healthFactor >= RISK_THRESHOLDS.HEALTH_SAFE) {
      return 'SAFE';
    }
    if (healthFactor >= RISK_THRESHOLDS.HEALTH_CAUTION) {
      return 'CAUTION';
    }
    if (healthFactor >= RISK_THRESHOLDS.HEALTH_DANGER) {
      return 'DANGER';
    }
    return 'CRITICAL';
  }

  /**
   * Calculate distance to liquidation as percentage
   * How much can the collateral drop before liquidation?
   */
  calculateDistanceToLiquidation(
    healthFactor: number,
    liquidationThreshold: number = 0.8
  ): number {
    if (healthFactor <= 1) {
      return 0; // Already at or past liquidation
    }

    // Distance = (healthFactor - 1) / healthFactor * 100
    const distance = ((healthFactor - 1) / healthFactor) * 100;
    
    return Math.max(0, distance);
  }

  /**
   * Calculate liquidation price for a position
   * At what price will the position be liquidated?
   */
  calculateLiquidationPrice(
    collateralAmount: number, // Amount of collateral token
    debtValue: number, // USD value of debt
    liquidationThreshold: number = 0.8
  ): number {
    if (collateralAmount <= 0) {
      return Infinity;
    }

    // Liquidation occurs when: collateralAmount * price * threshold = debtValue
    // So: liquidationPrice = debtValue / (collateralAmount * threshold)
    const liquidationPrice = debtValue / (collateralAmount * liquidationThreshold);
    
    return liquidationPrice;
  }

  /**
   * Calculate all health metrics for a position
   */
  calculateHealthMetrics(position: PositionData): HealthMetrics {
    const healthFactor = this.calculateHealthFactor(
      position.collateralValue,
      position.borrowedValue,
      position.liquidationThreshold
    );

    const marginRatio = this.calculateMarginRatio(
      position.collateralValue,
      position.borrowedValue
    );

    const leverage = this.calculateLeverage(
      position.collateralValue,
      position.borrowedValue
    );

    const healthTier = this.getHealthTier(healthFactor);

    const distanceToLiquidation = this.calculateDistanceToLiquidation(
      healthFactor,
      position.liquidationThreshold
    );

    const isAtRisk = healthFactor < RISK_THRESHOLDS.HEALTH_SAFE;

    return {
      healthFactor,
      marginRatio,
      leverage,
      healthTier,
      distanceToLiquidation,
      isAtRisk,
    };
  }

  /**
   * Parse Drift account data to extract position info using Drift SDK
   */
  async parseDriftAccountData(
    userAccountAddress: string,
    rpcUrl?: string
  ): Promise<PositionData | null> {
    try {
      // Import Drift SDK dynamically
      const DriftSDK = await import('@drift-labs/sdk');
      const { Connection, PublicKey } = await import('@solana/web3.js');

      // Create connection
      const connection = new Connection(
        rpcUrl || process.env.MAINNET_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Create dummy wallet for reading account data
      const dummyWallet = {
        publicKey: new PublicKey(userAccountAddress),
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      };

      // Initialize Drift client
      const driftClient = new DriftSDK.DriftClient({
        connection,
        wallet: dummyWallet,
        env: 'mainnet-beta',
      });

      await driftClient.subscribe();

      try {
        // Get user account
        const userPubkey = new PublicKey(userAccountAddress);
        
        // Add user to client
        await driftClient.addUser(0, userPubkey);
        const user = driftClient.getUser(0, userPubkey);

        // Get account data
        const userAccount = user.getUserAccount();
        
        // Calculate total collateral value (in USD)
        const totalCollateral = user.getTotalCollateral();
        const collateralValueUSD = totalCollateral.toNumber() / 1e6; // Convert from USDC precision

        // Calculate total liability/debt value (in USD)
        const totalLiabilityValue = user.getTotalLiabilityValue();
        const debtValueUSD = totalLiabilityValue.toNumber() / 1e6; // Convert from USDC precision

        // Get margin ratio and health
        const marginRatio = user.getMarginRatio();
        const freeCollateral = user.getFreeCollateral();
        
        // Calculate liquidation threshold (typically 80-85% for most protocols)
        // Drift uses maintenance margin ratio
        const maintenanceMarginRatio = 0.0625; // 6.25% for Drift
        const liquidationThreshold = 1 - maintenanceMarginRatio; // ~93.75%

        // Get oracle price for main collateral (assuming SOL)
        // In production, you'd get the specific collateral token's price
        const spotMarkets = driftClient.getSpotMarketAccounts();
        const solMarket = spotMarkets.find(m => m.marketIndex === 1); // SOL market
        const oraclePrice = solMarket ? solMarket.historicalOracleData.lastOraclePrice.toNumber() / 1e6 : 0;

        // Calculate liquidation price
        // This is simplified - in production you'd calculate per position
        const liquidationPrice = debtValueUSD / (collateralValueUSD * liquidationThreshold);

        await driftClient.unsubscribe();

        logger.info('Successfully parsed Drift account data', {
          userAccount: userAccountAddress,
          collateralValue: collateralValueUSD,
          debtValue: debtValueUSD,
          marginRatio: marginRatio.toNumber(),
        });

        return {
          collateralValue: collateralValueUSD,
          borrowedValue: debtValueUSD,
          liquidationThreshold,
          maintenanceMarginRatio,
          oraclePrice,
          liquidationPrice,
        };
      } finally {
        await driftClient.unsubscribe();
      }
    } catch (error) {
      logger.error('Failed to parse Drift account data:', error);
      return null;
    }
  }

  /**
   * Get real-time health metrics for a Drift position
   */
  async getDriftHealthMetrics(
    userAccountAddress: string,
    rpcUrl?: string
  ): Promise<HealthMetrics | null> {
    const positionData = await this.parseDriftAccountData(userAccountAddress, rpcUrl);
    
    if (!positionData) {
      return null;
    }

    return this.calculateHealthMetrics(positionData);
  }

  /**
   * Estimate time to liquidation based on current trajectory
   * @param healthFactor - Current health factor
   * @param healthFactorChange - Rate of change per hour (negative = declining)
   * @returns Estimated hours until liquidation
   */
  estimateTimeToLiquidation(
    healthFactor: number,
    healthFactorChange: number = -0.01 // Default: declining 1% per hour
  ): number {
    if (healthFactor <= 1) {
      return 0; // Already at liquidation
    }

    if (healthFactorChange >= 0) {
      return Infinity; // Health is improving or stable
    }

    // Time = (healthFactor - 1) / |healthFactorChange|
    const hoursToLiquidation = (healthFactor - 1) / Math.abs(healthFactorChange);
    
    return Math.max(0, hoursToLiquidation);
  }

  /**
   * Get liquidation prices for all positions in a Drift account
   */
  async getDriftLiquidationPrices(
    userAccountAddress: string,
    rpcUrl?: string
  ): Promise<Array<{ token: string; liquidationPrice: number; currentPrice: number }> | null> {
    try {
      // Import Drift SDK dynamically
      const DriftSDK = await import('@drift-labs/sdk');
      const { Connection, PublicKey } = await import('@solana/web3.js');

      // Create connection
      const connection = new Connection(
        rpcUrl || process.env.MAINNET_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Create dummy wallet
      const dummyWallet = {
        publicKey: new PublicKey(userAccountAddress),
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      };

      // Initialize Drift client
      const driftClient = new DriftSDK.DriftClient({
        connection,
        wallet: dummyWallet,
        env: 'mainnet-beta',
      });

      await driftClient.subscribe();

      try {
        const userPubkey = new PublicKey(userAccountAddress);
        await driftClient.addUser(0, userPubkey);
        const user = driftClient.getUser(0, userPubkey);

        const liquidationPrices: Array<{ token: string; liquidationPrice: number; currentPrice: number }> = [];

        // Get spot positions
        const userAccount = user.getUserAccount();
        const spotPositions = userAccount.spotPositions;
        const spotMarkets = driftClient.getSpotMarketAccounts();

        for (const position of spotPositions) {
          if (position.scaledBalance.eq(new DriftSDK.BN(0))) {
            continue; // Skip empty positions
          }

          const market = spotMarkets.find(m => m.marketIndex === position.marketIndex);
          if (!market) continue;

          // Get current oracle price
          const oraclePrice = market.historicalOracleData.lastOraclePrice.toNumber() / 1e6;

          // Calculate liquidation price for this position
          // This is simplified - actual calculation is more complex
          const tokenBalance = position.scaledBalance.toNumber() / 1e9;
          const isLong = tokenBalance > 0;

          // For now, use a simplified calculation
          // In production, you'd use Drift's liquidation price calculation
          const liquidationPrice = isLong ? oraclePrice * 0.8 : oraclePrice * 1.2;

          liquidationPrices.push({
            token: `Market ${position.marketIndex}`,
            liquidationPrice,
            currentPrice: oraclePrice,
          });
        }

        await driftClient.unsubscribe();

        logger.info('Retrieved liquidation prices', {
          userAccount: userAccountAddress,
          positionCount: liquidationPrices.length,
        });

        return liquidationPrices;
      } finally {
        await driftClient.unsubscribe();
      }
    } catch (error) {
      logger.error('Failed to get Drift liquidation prices:', error);
      return null;
    }
  }

  /**
   * Get color for health factor visualization
   */
  getHealthColor(healthFactor: number): string {
    const tier = this.getHealthTier(healthFactor);
    switch (tier) {
      case 'SAFE':
        return '#22c55e'; // green
      case 'CAUTION':
        return '#eab308'; // yellow
      case 'DANGER':
        return '#f97316'; // orange
      case 'CRITICAL':
        return '#ef4444'; // red
    }
  }
}

export default HealthCalculator;
