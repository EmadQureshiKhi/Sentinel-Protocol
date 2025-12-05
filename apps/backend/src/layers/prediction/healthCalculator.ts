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
   * Parse Drift account data to extract position info
   * Note: This is a simplified version. Full implementation requires
   * using @drift-labs/sdk to properly decode account data.
   */
  parseDriftAccountData(accountData: string): PositionData | null {
    try {
      // In production, use Drift SDK to decode:
      // const user = driftClient.getUser(userAccountAddress);
      // const totalCollateral = user.getTotalCollateral();
      // const totalLiability = user.getTotalLiability();
      
      // For now, return placeholder that will be replaced with SDK integration
      logger.debug('Parsing Drift account data (placeholder)');
      
      // This will be implemented with actual Drift SDK parsing
      return null;
    } catch (error) {
      logger.error('Failed to parse Drift account data:', error);
      return null;
    }
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
