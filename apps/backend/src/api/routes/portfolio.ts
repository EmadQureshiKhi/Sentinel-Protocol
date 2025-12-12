/**
 * Portfolio API Routes
 * Endpoints for portfolio aggregation and P&L
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { NetworkType } from '../../services/protocols/types';
import { getPortfolioService, getPnLService } from '../../services/portfolio';

const router = Router();

/**
 * GET /api/portfolio
 * Get full portfolio summary
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { walletAddress, network = 'mainnet-beta' } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const portfolioService = getPortfolioService(network as NetworkType);
    const portfolio = await portfolioService.getPortfolio(walletAddress as string);

    res.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    logger.error('Error getting portfolio', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolio',
    });
  }
});

/**
 * GET /api/portfolio/positions
 * Get all positions with current values
 */
router.get('/positions', async (req: Request, res: Response) => {
  try {
    const { walletAddress, network = 'mainnet-beta' } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const portfolioService = getPortfolioService(network as NetworkType);
    const positions = await portfolioService.getPositions(walletAddress as string);

    res.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    logger.error('Error getting positions', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get positions',
    });
  }
});

/**
 * GET /api/portfolio/history
 * Get portfolio history for charts
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { walletAddress, network = 'mainnet-beta', days = '30' } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const portfolioService = getPortfolioService(network as NetworkType);
    const history = await portfolioService.getPortfolioHistory(
      walletAddress as string,
      parseInt(days as string)
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error getting portfolio history', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolio history',
    });
  }
});

/**
 * GET /api/portfolio/pnl
 * Get P&L breakdown
 */
router.get('/pnl', async (req: Request, res: Response) => {
  try {
    const { walletAddress, network = 'mainnet-beta' } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const pnlService = getPnLService(network as NetworkType);
    const pnl = await pnlService.getPnLBreakdown(walletAddress as string);

    res.json({
      success: true,
      data: pnl,
    });
  } catch (error) {
    logger.error('Error getting P&L', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get P&L',
    });
  }
});

export default router;
