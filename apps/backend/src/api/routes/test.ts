import { Router, Request, Response } from 'express';
import { PriceOracle } from '../../layers/prediction/priceOracle';
import { HVIXCalculator } from '../../layers/prediction/hvixCalculator';
import { HealthCalculator } from '../../layers/prediction/healthCalculator';
import { CascadeDetector, AccountRiskData } from '../../layers/prediction/cascadeDetector';
import { AlertSystem } from '../../layers/prediction/alertSystem';

const router = Router();

// Initialize components
const priceOracle = new PriceOracle();
const hvixCalculator = new HVIXCalculator();
const healthCalculator = new HealthCalculator();
const cascadeDetector = new CascadeDetector();
const alertSystem = new AlertSystem();

// Start price oracle
priceOracle.start(60000);

/**
 * GET /api/test/prediction
 * Test the prediction engine with mock data
 */
router.get('/prediction', async (req: Request, res: Response) => {
  try {
    // Get current SOL price
    const solPrice = await priceOracle.getSolPrice();
    
    // Generate some mock price history
    const priceHistory: number[] = [];
    for (let i = 0; i < 100; i++) {
      priceHistory.push(solPrice + (Math.random() - 0.5) * 20);
    }
    
    // Calculate HVIX
    const hvixResult = hvixCalculator.calculateHVIX(priceHistory);
    
    // Create mock accounts
    const mockAccounts: AccountRiskData[] = [
      {
        walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        healthFactor: 1.5,
        collateralValue: 50000,
        borrowedValue: 30000,
        leverage: 1.67,
        liquidationPrice: solPrice * 0.6,
        oraclePrice: solPrice,
      },
      {
        walletAddress: '8yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV',
        healthFactor: 0.8,
        collateralValue: 20000,
        borrowedValue: 15000,
        leverage: 4.0,
        liquidationPrice: solPrice * 0.85,
        oraclePrice: solPrice,
      },
      {
        walletAddress: '9zKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsW',
        healthFactor: 0.3,
        collateralValue: 15000,
        borrowedValue: 12000,
        leverage: 5.0,
        liquidationPrice: solPrice * 0.95,
        oraclePrice: solPrice,
      },
    ];
    
    // Detect cascade risk
    const riskScores = await cascadeDetector.detectCascadeRisk(mockAccounts, priceHistory);
    
    // Generate alerts
    const alertResult = alertSystem.generateAlerts(riskScores);
    
    res.json({
      success: true,
      data: {
        solPrice,
        hvix: {
          value: hvixResult.value,
          level: hvixResult.level,
        },
        accounts: riskScores.map((score) => ({
          wallet: score.walletAddress,
          riskScore: score.riskScore,
          healthFactor: mockAccounts.find(a => a.walletAddress === score.walletAddress)?.healthFactor,
          recommendedAction: score.recommendedAction,
          cascadeProbability: score.cascadeProbability,
          timeToLiquidation: score.timeToLiquidation,
          estimatedLosses: score.estimatedLosses,
        })),
        alerts: {
          newAlerts: alertResult.newAlerts.length,
          totalActive: alertResult.totalActive,
          activeAlerts: alertSystem.getActiveAlerts().map(a => ({
            id: a.id,
            wallet: a.walletAddress,
            riskScore: a.riskScore,
            recommendedAction: a.recommendedAction,
          })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/test/health
 * Test health calculator
 */
router.get('/health', (req: Request, res: Response) => {
  const collateral = parseFloat(req.query.collateral as string) || 10000;
  const debt = parseFloat(req.query.debt as string) || 7000;
  
  const healthFactor = healthCalculator.calculateHealthFactor(collateral, debt);
  const marginRatio = healthCalculator.calculateMarginRatio(collateral, debt);
  const leverage = healthCalculator.calculateLeverage(collateral, debt);
  const healthTier = healthCalculator.getHealthTier(healthFactor);
  
  res.json({
    success: true,
    data: {
      collateral,
      debt,
      healthFactor,
      marginRatio,
      leverage,
      healthTier,
      isAtRisk: healthFactor < 1.0,
    },
  });
});

export default router;
