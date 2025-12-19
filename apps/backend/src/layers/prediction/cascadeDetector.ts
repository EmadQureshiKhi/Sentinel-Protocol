import { logger } from '../../utils/logger';
import { RISK_THRESHOLDS, RISK_WEIGHTS } from '../../config/constants';
import { HVIXCalculator } from './hvixCalculator';
import { HealthCalculator, HealthMetrics } from './healthCalculator';

// Account data for cascade detection
export interface AccountRiskData {
  walletAddress: string;
  healthFactor: number;
  collateralValue: number;
  borrowedValue: number;
  leverage: number;
  liquidationPrice: number;
  oraclePrice: number;
}

// Cascade risk score result
export interface CascadeRiskScore {
  walletAddress: string;
  riskScore: number; // 0-100
  hvixValue: number;
  cascadeProbability: number; // 0-1
  timeToLiquidation: number; // hours
  recommendedAction: 'PROTECT' | 'MONITOR' | 'SAFE';
  estimatedLosses: number; // USD
  riskComponents: {
    healthFactorRisk: number;
    volatilityRisk: number;
    cascadeRisk: number;
  };
}

// Cascade indicators
export interface CascadeIndicators {
  dangerZoneCount: number;
  totalAccountsAnalyzed: number;
  avgHealthFactor: number;
  positionCorrelation: number;
  totalValueAtRisk: number;
}

export class CascadeDetector {
  private hvixCalculator: HVIXCalculator;
  private healthCalculator: HealthCalculator;
  private priceHistory: Map<string, number[]> = new Map();

  constructor() {
    this.hvixCalculator = new HVIXCalculator();
    this.healthCalculator = new HealthCalculator();
  }

  /**
   * Detect cascade risk for all monitored accounts
   * Returns risk scores for each account
   */
  async detectCascadeRisk(
    accounts: AccountRiskData[],
    priceHistory: number[] = []
  ): Promise<CascadeRiskScore[]> {
    // Calculate HVIX
    const hvixResult = this.hvixCalculator.calculateHVIX(priceHistory);
    const hvix = hvixResult.value;

    // Identify cascade indicators
    const indicators = this._identifyCascadeIndicators(accounts);

    // Calculate risk score for each account
    const riskScores = accounts.map((account) => {
      return this._calculateAccountRisk(account, hvix, indicators);
    });

    // Sort by risk score (highest first)
    riskScores.sort((a, b) => b.riskScore - a.riskScore);

    logger.debug(`Cascade detection complete: ${riskScores.length} accounts analyzed`);

    return riskScores;
  }

  /**
   * Identify cascade indicators across all accounts
   */
  private _identifyCascadeIndicators(accounts: AccountRiskData[]): CascadeIndicators {
    if (accounts.length === 0) {
      return {
        dangerZoneCount: 0,
        totalAccountsAnalyzed: 0,
        avgHealthFactor: 1.0,
        positionCorrelation: 0,
        totalValueAtRisk: 0,
      };
    }

    // Count accounts in danger zone (health factor < 0.25)
    const dangerZoneAccounts = accounts.filter(
      (a) => a.healthFactor < RISK_THRESHOLDS.HEALTH_DANGER
    );

    // Calculate average health factor
    const avgHealthFactor =
      accounts.reduce((sum, a) => sum + a.healthFactor, 0) / accounts.length;

    // Calculate position correlation
    // High correlation = everyone has similar positions = higher cascade risk
    const positionCorrelation = this._calculatePositionCorrelation(accounts);

    // Calculate total value at risk
    const totalValueAtRisk = dangerZoneAccounts.reduce(
      (sum, a) => sum + a.collateralValue,
      0
    );

    return {
      dangerZoneCount: dangerZoneAccounts.length,
      totalAccountsAnalyzed: accounts.length,
      avgHealthFactor,
      positionCorrelation,
      totalValueAtRisk,
    };
  }

  /**
   * Calculate position correlation across accounts
   * Returns 0-1 (higher = more correlated = higher cascade risk)
   */
  private _calculatePositionCorrelation(accounts: AccountRiskData[]): number {
    if (accounts.length < 2) {
      return 0;
    }

    // Use leverage as correlation metric
    const leverages = accounts.map((a) => a.leverage);
    const avgLeverage = leverages.reduce((a, b) => a + b, 0) / leverages.length;

    // Calculate variance
    const variance =
      leverages.reduce((sum, l) => sum + Math.pow(l - avgLeverage, 2), 0) /
      leverages.length;
    const stdDev = Math.sqrt(variance);

    // Low std dev = high correlation (everyone has similar leverage)
    // Normalize to 0-1 range
    const correlation = Math.max(0, 1 - Math.min(stdDev / avgLeverage, 1));

    return correlation;
  }

  /**
   * Calculate risk score for a single account
   */
  private _calculateAccountRisk(
    account: AccountRiskData,
    hvix: number,
    indicators: CascadeIndicators
  ): CascadeRiskScore {
    // Component 1: Health Factor Risk (0-40 points)
    // Health factor >= 2.0 = 0 risk (safe)
    // Health factor 1.5 = 20 risk (caution)
    // Health factor 1.2 = 32 risk (danger)
    // Health factor < 1.1 = 40 risk (critical)
    let healthFactorRisk = 0;
    if (account.healthFactor < 1.1) {
      healthFactorRisk = 40; // Critical
    } else if (account.healthFactor < 1.3) {
      healthFactorRisk = 32; // Danger
    } else if (account.healthFactor < 1.5) {
      healthFactorRisk = 24; // Caution
    } else if (account.healthFactor < 2.0) {
      healthFactorRisk = 16; // Moderate
    }
    // else healthFactorRisk = 0 (Safe)

    // Component 2: Volatility Risk (0-30 points)
    // HVIX 1.0 = 0 risk, HVIX 3.0+ = 30 risk
    const volatilityRisk = Math.min(
      RISK_WEIGHTS.VOLATILITY,
      Math.max(0, (hvix - 1) * 15)
    );

    // Component 3: Cascade Contagion Risk (0-30 points)
    // Based on how many others are in danger zone
    const cascadeRisk = Math.min(
      RISK_WEIGHTS.CASCADE,
      (indicators.dangerZoneCount / Math.max(10, indicators.totalAccountsAnalyzed)) *
        RISK_WEIGHTS.CASCADE
    );

    // Total risk score (0-100)
    const riskScore = Math.min(100, healthFactorRisk + volatilityRisk + cascadeRisk);

    // Estimate cascade probability
    const cascadeProbability = this._estimateCascadeProbability(riskScore);

    // Estimate time to liquidation
    const timeToLiquidation = this._estimateTimeToLiquidation(account);

    // Estimate potential losses
    const estimatedLosses = this._estimateLosses(account, riskScore);

    // Determine recommended action
    const recommendedAction = this._getRecommendedAction(riskScore);

    return {
      walletAddress: account.walletAddress,
      riskScore: Math.round(riskScore),
      hvixValue: hvix,
      cascadeProbability,
      timeToLiquidation,
      recommendedAction,
      estimatedLosses,
      riskComponents: {
        healthFactorRisk: Math.round(healthFactorRisk),
        volatilityRisk: Math.round(volatilityRisk),
        cascadeRisk: Math.round(cascadeRisk),
      },
    };
  }

  /**
   * Estimate cascade probability based on risk score
   * Uses exponential curve (safer at low risk)
   */
  private _estimateCascadeProbability(riskScore: number): number {
    // Probability = (riskScore / 100)^2
    return Math.pow(riskScore / 100, 2);
  }

  /**
   * Estimate time until liquidation in hours
   */
  private _estimateTimeToLiquidation(account: AccountRiskData): number {
    // For safe positions (health factor > 2.0), return 0 to indicate "N/A"
    if (account.healthFactor >= 2.0) {
      return 0; // Safe - no immediate risk
    }

    // Calculate price distance to liquidation
    const priceDistance = Math.abs(
      (account.oraclePrice - account.liquidationPrice) / account.oraclePrice
    );

    // Rough estimate based on health factor
    if (account.healthFactor < 1.1) {
      return 6; // Critical - 6 hours
    }
    if (account.healthFactor < 1.3) {
      return 12; // Danger - 12 hours
    }
    if (account.healthFactor < 1.5) {
      return 24; // Caution - 24 hours
    }
    if (account.healthFactor < 2.0) {
      return 48; // Moderate risk - 48 hours
    }

    return 0; // Safe - no immediate risk
  }

  /**
   * Estimate potential losses from liquidation + MEV
   */
  private _estimateLosses(account: AccountRiskData, riskScore: number): number {
    // Liquidation penalty: typically 2-5% of borrowed value
    const liquidationPenalty = account.borrowedValue * 0.03;

    // MEV extraction: 0.5-2% of collateral for sandwich attacks
    // Higher risk = more likely to be targeted
    const mevExtraction =
      account.collateralValue * (riskScore / 100) * 0.01;

    return liquidationPenalty + mevExtraction;
  }

  /**
   * Get recommended action based on risk score
   */
  private _getRecommendedAction(
    riskScore: number
  ): 'PROTECT' | 'MONITOR' | 'SAFE' {
    if (riskScore >= RISK_THRESHOLDS.RISK_MONITOR) {
      return 'PROTECT';
    }
    if (riskScore >= RISK_THRESHOLDS.RISK_SAFE) {
      return 'MONITOR';
    }
    return 'SAFE';
  }

  /**
   * Record price for HVIX calculation
   */
  recordPrice(token: string, price: number): void {
    if (!this.priceHistory.has(token)) {
      this.priceHistory.set(token, []);
    }

    const history = this.priceHistory.get(token)!;
    history.push(price);

    // Keep only last 720 data points (12 hours at 1-min intervals)
    if (history.length > 720) {
      history.shift();
    }
  }

  /**
   * Get price history for a token
   */
  getPriceHistory(token: string): number[] {
    return this.priceHistory.get(token) || [];
  }

  /**
   * Get risk color for visualization
   */
  getRiskColor(riskScore: number): string {
    if (riskScore >= 70) return '#ef4444'; // red
    if (riskScore >= 40) return '#f97316'; // orange
    if (riskScore >= 20) return '#eab308'; // yellow
    return '#22c55e'; // green
  }
}

export default CascadeDetector;
