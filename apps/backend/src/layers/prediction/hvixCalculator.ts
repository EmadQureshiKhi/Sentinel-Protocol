import { logger } from '../../utils/logger';
import { HVIX_CONFIG, RISK_THRESHOLDS } from '../../config/constants';

// Volatility level types
export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

// HVIX result structure
export interface HVIXResult {
  value: number;
  level: VolatilityLevel;
  components: {
    window: number; // minutes
    change: number; // percentage change
    weight: number;
    contribution: number;
  }[];
  timestamp: number;
}

export class HVIXCalculator {
  // Time windows in minutes: 1h, 4h, 12h
  private timeWindows: readonly number[] = HVIX_CONFIG.TIME_WINDOWS_MINUTES;

  /**
   * Calculate HVIX (Historical Volatility Index)
   * 
   * Formula: HVIX = √(Σ(ΔP_i² × w_i))
   * 
   * Where:
   * - ΔP_i = Price change percentage in window i
   * - w_i = Time-decay weight (recent = higher weight)
   * 
   * @param priceHistory - Array of historical prices (oldest to newest)
   * @returns HVIX result with value and components
   */
  calculateHVIX(priceHistory: number[]): HVIXResult {
    if (priceHistory.length < 2) {
      return {
        value: 1.0, // Baseline (no volatility data)
        level: 'LOW',
        components: [],
        timestamp: Date.now(),
      };
    }

    const components: HVIXResult['components'] = [];
    let volatilitySum = 0;
    let totalWeight = 0;

    // Calculate volatility for each time window
    for (let i = 0; i < this.timeWindows.length; i++) {
      const window = this.timeWindows[i];
      
      // Check if we have enough data for this window
      if (priceHistory.length >= window) {
        const recentPrice = priceHistory[priceHistory.length - 1];
        const priorIndex = Math.max(0, priceHistory.length - window);
        const priorPrice = priceHistory[priorIndex];
        
        // Calculate percentage change
        const percentChange = Math.abs((recentPrice - priorPrice) / priorPrice);
        
        // Weight: more recent windows have higher weight
        // Using inverse of window index (1, 0.5, 0.33...)
        const weight = 1 / (i + 1);
        
        // Contribution to volatility
        const contribution = (percentChange ** 2) * weight;
        
        volatilitySum += contribution;
        totalWeight += weight;
        
        components.push({
          window,
          change: percentChange * 100, // Convert to percentage
          weight,
          contribution,
        });
      }
    }

    // Calculate final HVIX
    const hvix = totalWeight > 0 
      ? Math.sqrt(volatilitySum / totalWeight) * 100 // Scale to readable number
      : 1.0;

    const level = this.getVolatilityLevel(hvix);

    logger.debug(`HVIX calculated: ${hvix.toFixed(3)} (${level})`);

    return {
      value: hvix,
      level,
      components,
      timestamp: Date.now(),
    };
  }

  /**
   * Get volatility level based on HVIX value
   */
  getVolatilityLevel(hvix: number): VolatilityLevel {
    if (hvix < RISK_THRESHOLDS.HVIX_LOW) {
      return 'LOW';
    }
    if (hvix < RISK_THRESHOLDS.HVIX_MEDIUM) {
      return 'MEDIUM';
    }
    if (hvix < RISK_THRESHOLDS.HVIX_HIGH) {
      return 'HIGH';
    }
    return 'EXTREME';
  }

  /**
   * Check if HVIX indicates cascade risk
   * Cascade risk when HVIX > 2.5x baseline
   */
  isCascadeRisk(hvix: number): boolean {
    return hvix >= RISK_THRESHOLDS.HVIX_MEDIUM;
  }

  /**
   * Calculate rolling HVIX over multiple periods
   * Useful for detecting volatility trends
   */
  calculateRollingHVIX(
    priceHistory: number[],
    periods: number = 5,
    periodLength: number = 60 // minutes
  ): number[] {
    const results: number[] = [];
    
    for (let i = 0; i < periods; i++) {
      const endIndex = priceHistory.length - (i * periodLength);
      const startIndex = Math.max(0, endIndex - (periodLength * 12)); // 12 periods back
      
      if (endIndex > startIndex) {
        const slice = priceHistory.slice(startIndex, endIndex);
        const hvixResult = this.calculateHVIX(slice);
        results.unshift(hvixResult.value);
      }
    }
    
    return results;
  }

  /**
   * Detect volatility spike
   * Returns true if current HVIX is significantly higher than recent average
   */
  detectVolatilitySpike(
    currentHVIX: number,
    historicalHVIX: number[],
    threshold: number = 1.5 // 50% above average
  ): boolean {
    if (historicalHVIX.length === 0) {
      return false;
    }
    
    const avgHVIX = historicalHVIX.reduce((a, b) => a + b, 0) / historicalHVIX.length;
    
    return currentHVIX > avgHVIX * threshold;
  }

  /**
   * Calculate volatility trend
   * Returns: 'increasing', 'decreasing', or 'stable'
   */
  calculateVolatilityTrend(
    hvixHistory: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (hvixHistory.length < 3) {
      return 'stable';
    }
    
    // Compare recent vs older values
    const recentAvg = hvixHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const olderAvg = hvixHistory.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    
    const changePercent = (recentAvg - olderAvg) / olderAvg;
    
    if (changePercent > 0.1) {
      return 'increasing';
    }
    if (changePercent < -0.1) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * Get color for HVIX visualization
   */
  getHVIXColor(hvix: number): string {
    const level = this.getVolatilityLevel(hvix);
    switch (level) {
      case 'LOW':
        return '#22c55e'; // green
      case 'MEDIUM':
        return '#eab308'; // yellow
      case 'HIGH':
        return '#f97316'; // orange
      case 'EXTREME':
        return '#ef4444'; // red
    }
  }

  /**
   * Format HVIX for display
   */
  formatHVIX(hvix: number): string {
    return `${hvix.toFixed(2)}`;
  }
}

export default HVIXCalculator;
