/**
 * Rates API Routes
 * Endpoints for fetching protocol rates and comparisons
 */

import { Router, Request, Response } from 'express';
import { getRateAggregator } from '../../services/protocols/rateAggregator';
import { NetworkType, ProtocolName } from '../../services/protocols/types';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/rates
 * Get aggregated rates from all protocols
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const network = (req.query.network as NetworkType) || 'mainnet-beta';
    const aggregator = getRateAggregator(network);
    
    const rates = await aggregator.getAllRates();
    
    res.json({
      success: true,
      data: rates,
    });
  } catch (error) {
    logger.error('Error fetching aggregated rates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rates',
    });
  }
});

/**
 * GET /api/rates/best
 * Get best rates for all tokens
 */
router.get('/best', async (req: Request, res: Response) => {
  try {
    const network = (req.query.network as NetworkType) || 'mainnet-beta';
    const aggregator = getRateAggregator(network);
    
    const rates = await aggregator.getAllRates();
    
    // Convert Maps to objects for JSON serialization
    const bestSupplyRates = Object.fromEntries(rates.bestSupplyRates);
    const bestBorrowRates = Object.fromEntries(rates.bestBorrowRates);
    
    res.json({
      success: true,
      data: {
        bestSupplyRates,
        bestBorrowRates,
        updatedAt: rates.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching best rates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch best rates',
    });
  }
});


/**
 * GET /api/rates/compare/:token
 * Compare rates for a specific token across all protocols
 */
router.get('/compare/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token.toUpperCase();
    const network = (req.query.network as NetworkType) || 'mainnet-beta';
    
    const aggregator = getRateAggregator(network);
    const comparison = await aggregator.compareTokenRates(token);
    
    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    logger.error('Error comparing token rates', { error, token: req.params.token });
    res.status(500).json({
      success: false,
      error: 'Failed to compare token rates',
    });
  }
});

/**
 * GET /api/rates/:protocol
 * Get rates for a specific protocol
 */
router.get('/:protocol', async (req: Request, res: Response) => {
  try {
    const protocol = req.params.protocol.toUpperCase() as ProtocolName;
    const network = (req.query.network as NetworkType) || 'mainnet-beta';
    
    if (!['DRIFT', 'MARGINFI', 'SOLEND'].includes(protocol)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid protocol. Must be one of: drift, marginfi, solend',
      });
    }
    
    const aggregator = getRateAggregator(network);
    const rates = await aggregator.getProtocolRates(protocol);
    
    res.json({
      success: true,
      data: rates,
    });
  } catch (error) {
    logger.error('Error fetching protocol rates', { error, protocol: req.params.protocol });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch protocol rates',
    });
  }
});

/**
 * POST /api/rates/refresh
 * Force refresh rates (clears cache)
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const network = (req.query.network as NetworkType) || 'mainnet-beta';
    
    const aggregator = getRateAggregator(network);
    const rates = await aggregator.getAllRates();
    
    res.json({
      success: true,
      message: 'Rates refreshed successfully',
      data: rates,
    });
  } catch (error) {
    logger.error('Error refreshing rates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to refresh rates',
    });
  }
});

export default router;
