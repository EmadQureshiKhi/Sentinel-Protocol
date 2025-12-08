/**
 * Stats API Routes
 * Handles statistics and analytics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../services/database';

const router = Router();
const database = DatabaseService.getInstance();

/**
 * GET /api/stats/overview
 * System overview (accounts, alerts, swaps)
 */
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await database.getOverviewStats();

    res.json({
      success: true,
      data: {
        totalAccounts: stats.totalAccounts,
        atRiskAccounts: stats.atRiskAccounts,
        activeAlerts: stats.activeAlerts,
        totalSwaps: stats.totalSwaps,
        totalMevSaved: stats.totalMevSaved,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/mev-savings
 * Total MEV saved
 */
router.get('/mev-savings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const totalMevSaved = await database.getTotalMevSaved();

    // Get recent swaps for breakdown
    const recentSwaps = await database.getSwapHistory({
      limit: 10,
    });

    const recentSavings = recentSwaps.map((swap) => ({
      id: swap.id,
      amount: swap.mevSaved || 0,
      fromToken: swap.fromToken,
      toToken: swap.toToken,
      createdAt: swap.createdAt,
    }));

    res.json({
      success: true,
      data: {
        totalMevSaved,
        totalMevSavedUsd: totalMevSaved / 1e9 * 140, // Approximate USD value
        recentSavings,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/daily
 * Daily statistics
 */
router.get('/daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.query;
    
    const targetDate = date ? new Date(date as string) : new Date();
    const stats = await database.getDailyStats(targetDate);

    res.json({
      success: true,
      data: {
        date: stats.date.toISOString().split('T')[0],
        totalAccounts: stats.totalAccounts,
        totalAlerts: stats.totalAlerts,
        totalSwaps: stats.totalSwaps,
        totalMevSaved: stats.totalMevSaved,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/history
 * Historical statistics (last 7 days)
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days = 7 } = req.query;
    const numDays = Math.min(parseInt(days as string, 10) || 7, 30);

    const history = [];
    for (let i = 0; i < numDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const stats = await database.getDailyStats(date);
      history.push({
        date: stats.date.toISOString().split('T')[0],
        totalAccounts: stats.totalAccounts,
        totalAlerts: stats.totalAlerts,
        totalSwaps: stats.totalSwaps,
        totalMevSaved: stats.totalMevSaved,
      });
    }

    res.json({
      success: true,
      data: history.reverse(), // Oldest first
    });
  } catch (error) {
    next(error);
  }
});

export default router;
