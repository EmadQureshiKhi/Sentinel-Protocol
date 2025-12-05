/**
 * Slippage Analyzer
 * Compares standard routes vs MEV-protected routes to estimate savings
 */

import { logger } from '../../utils/logger';
import { JupiterSwapEngine, JupiterQuote } from './jupiterSwap';
import { TOKEN_DECIMALS } from '../../config/constants';

// Route comparison result
export interface RouteComparison {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  standardRoute: {
    outputAmount: string;
    priceImpactPct: number;
    slippageBps: number;
    routeSteps: number;
  };
  protectedRoute: {
    outputAmount: string;
    priceImpactPct: number;
    slippageBps: number;
    routeSteps: number;
  };
  comparison: {
    outputDifference: string;
    outputDifferencePct: number;
    estimatedMevSavings: number;
    recommendProtection: boolean;
  };
  timestamp: number;
}

// MEV estimation parameters
interface MevEstimationParams {
  tradeSize: number; // USD value
  priceImpact: number; // percentage
  volatility: number; // HVIX value
  marketCondition: 'normal' | 'volatile' | 'extreme';
}

export class SlippageAnalyzer {
  private jupiterEngine: JupiterSwapEngine;
  private comparisonHistory: RouteComparison[] = [];
  private readonly maxHistorySize = 100;

  constructor(jupiterEngine?: JupiterSwapEngine) {
    this.jupiterEngine = jupiterEngine || new JupiterSwapEngine();
    logger.info('Slippage Analyzer initialized');
  }

  /**
   * Compare standard route vs protected route
   */
  async compareRoutes(
    inputMint: string,
    outputMint: string,
    amount: number,
    standardSlippageBps: number = 100, // 1% for standard
    protectedSlippageBps: number = 50   // 0.5% for protected
  ): Promise<RouteComparison> {
    try {
      // Get standard quote (higher slippage tolerance)
      const standardQuote = await this.jupiterEngine.getSwapQuote(
        inputMint,
        outputMint,
        amount,
        standardSlippageBps,
        { onlyDirectRoutes: false }
      );

      // Get protected quote (lower slippage, optimized routing)
      const protectedQuote = await this.jupiterEngine.getSwapQuote(
        inputMint,
        outputMint,
        amount,
        protectedSlippageBps,
        { onlyDirectRoutes: false }
      );

      // Calculate comparison metrics
      const standardOutput = BigInt(standardQuote.outAmount);
      const protectedOutput = BigInt(protectedQuote.outAmount);
      const outputDiff = protectedOutput - standardOutput;
      const outputDiffPct = Number(outputDiff * 10000n / standardOutput) / 100;

      // Estimate MEV savings based on trade characteristics
      const estimatedMevSavings = this.estimateMevSavings(
        amount,
        parseFloat(standardQuote.priceImpactPct),
        parseFloat(protectedQuote.priceImpactPct)
      );

      const comparison: RouteComparison = {
        inputMint,
        outputMint,
        inputAmount: amount.toString(),
        standardRoute: {
          outputAmount: standardQuote.outAmount,
          priceImpactPct: parseFloat(standardQuote.priceImpactPct),
          slippageBps: standardSlippageBps,
          routeSteps: standardQuote.routePlan.length,
        },
        protectedRoute: {
          outputAmount: protectedQuote.outAmount,
          priceImpactPct: parseFloat(protectedQuote.priceImpactPct),
          slippageBps: protectedSlippageBps,
          routeSteps: protectedQuote.routePlan.length,
        },
        comparison: {
          outputDifference: outputDiff.toString(),
          outputDifferencePct: outputDiffPct,
          estimatedMevSavings,
          recommendProtection: estimatedMevSavings > 0.5, // Recommend if savings > $0.50
        },
        timestamp: Date.now(),
      };

      // Store in history
      this.addToHistory(comparison);

      logger.info('Route comparison complete', {
        input: inputMint.slice(0, 8),
        output: outputMint.slice(0, 8),
        mevSavings: `$${estimatedMevSavings.toFixed(2)}`,
        recommend: comparison.comparison.recommendProtection,
      });

      return comparison;
    } catch (error) {
      logger.error('Failed to compare routes:', error);
      throw error;
    }
  }

  /**
   * Estimate MEV savings based on trade characteristics
   * MEV extraction typically occurs through:
   * 1. Sandwich attacks (front-run + back-run)
   * 2. Arbitrage from price impact
   */
  estimateMevSavings(
    inputAmount: number,
    standardPriceImpact: number,
    protectedPriceImpact: number
  ): number {
    // Price impact difference represents potential MEV extraction
    const impactDiff = Math.abs(standardPriceImpact - protectedPriceImpact);
    
    // Base MEV estimation: larger trades and higher impact = more MEV
    // Typical sandwich attack extracts 0.1-0.5% of trade value
    const baseMevRate = 0.002; // 0.2% base rate
    const impactMultiplier = 1 + (impactDiff * 10); // Higher impact = more MEV
    
    // Estimate USD value (assuming input is in smallest units)
    // This is a rough estimate - actual value depends on token
    const estimatedUsdValue = inputAmount / 1e9 * 100; // Rough SOL estimate
    
    const mevSavings = estimatedUsdValue * baseMevRate * impactMultiplier;
    
    return Math.max(0, mevSavings);
  }

  /**
   * Estimate MEV risk based on market conditions
   */
  estimateMevRisk(params: MevEstimationParams): {
    riskLevel: 'low' | 'medium' | 'high';
    estimatedExtraction: number;
    recommendation: string;
  } {
    let riskScore = 0;
    
    // Trade size factor (larger = more attractive to MEV)
    if (params.tradeSize > 10000) riskScore += 3;
    else if (params.tradeSize > 1000) riskScore += 2;
    else if (params.tradeSize > 100) riskScore += 1;
    
    // Price impact factor
    if (params.priceImpact > 1) riskScore += 3;
    else if (params.priceImpact > 0.5) riskScore += 2;
    else if (params.priceImpact > 0.1) riskScore += 1;
    
    // Volatility factor
    if (params.volatility > 3) riskScore += 3;
    else if (params.volatility > 2) riskScore += 2;
    else if (params.volatility > 1.5) riskScore += 1;
    
    // Market condition factor
    if (params.marketCondition === 'extreme') riskScore += 3;
    else if (params.marketCondition === 'volatile') riskScore += 2;
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    let estimatedExtraction: number;
    let recommendation: string;
    
    if (riskScore >= 8) {
      riskLevel = 'high';
      estimatedExtraction = params.tradeSize * 0.005; // 0.5%
      recommendation = 'Strongly recommend using Jito bundles for MEV protection';
    } else if (riskScore >= 4) {
      riskLevel = 'medium';
      estimatedExtraction = params.tradeSize * 0.002; // 0.2%
      recommendation = 'Consider using MEV protection for better execution';
    } else {
      riskLevel = 'low';
      estimatedExtraction = params.tradeSize * 0.0005; // 0.05%
      recommendation = 'Standard execution should be acceptable';
    }
    
    return { riskLevel, estimatedExtraction, recommendation };
  }

  /**
   * Calculate optimal slippage based on trade size and market conditions
   */
  calculateOptimalSlippage(
    tradeSizeUsd: number,
    priceImpact: number,
    volatility: number
  ): number {
    // Base slippage: 0.5%
    let slippageBps = 50;
    
    // Adjust for trade size
    if (tradeSizeUsd > 10000) slippageBps += 25;
    else if (tradeSizeUsd > 1000) slippageBps += 10;
    
    // Adjust for price impact
    if (priceImpact > 1) slippageBps += 50;
    else if (priceImpact > 0.5) slippageBps += 25;
    
    // Adjust for volatility
    if (volatility > 3) slippageBps += 50;
    else if (volatility > 2) slippageBps += 25;
    
    // Cap at reasonable maximum
    return Math.min(slippageBps, 300); // Max 3%
  }

  /**
   * Add comparison to history
   */
  private addToHistory(comparison: RouteComparison): void {
    this.comparisonHistory.push(comparison);
    
    // Trim history if too large
    if (this.comparisonHistory.length > this.maxHistorySize) {
      this.comparisonHistory = this.comparisonHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get comparison history
   */
  getComparisonHistory(limit?: number): RouteComparison[] {
    if (limit) {
      return this.comparisonHistory.slice(-limit);
    }
    return [...this.comparisonHistory];
  }

  /**
   * Get aggregate MEV savings stats
   */
  getMevSavingsStats(): {
    totalComparisons: number;
    totalEstimatedSavings: number;
    avgSavingsPerTrade: number;
    protectionRecommendedPct: number;
  } {
    const total = this.comparisonHistory.length;
    if (total === 0) {
      return {
        totalComparisons: 0,
        totalEstimatedSavings: 0,
        avgSavingsPerTrade: 0,
        protectionRecommendedPct: 0,
      };
    }

    const totalSavings = this.comparisonHistory.reduce(
      (sum, c) => sum + c.comparison.estimatedMevSavings,
      0
    );
    
    const recommendedCount = this.comparisonHistory.filter(
      c => c.comparison.recommendProtection
    ).length;

    return {
      totalComparisons: total,
      totalEstimatedSavings: totalSavings,
      avgSavingsPerTrade: totalSavings / total,
      protectionRecommendedPct: (recommendedCount / total) * 100,
    };
  }

  /**
   * Clear comparison history
   */
  clearHistory(): void {
    this.comparisonHistory = [];
    logger.debug('Slippage analyzer history cleared');
  }
}

export default SlippageAnalyzer;
