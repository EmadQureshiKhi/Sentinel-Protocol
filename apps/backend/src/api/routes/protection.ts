/**
 * Protection API Routes
 * Handles protective swap operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../services/database';
import { JupiterSwapEngine } from '../../layers/execution/jupiterSwap';
import { SlippageAnalyzer } from '../../layers/execution/slippageAnalyzer';
import { logger } from '../../utils/logger';
import { SwapStatus } from '@prisma/client';

const router = Router();
const database = DatabaseService.getInstance();
const jupiterEngine = new JupiterSwapEngine();
const slippageAnalyzer = new SlippageAnalyzer();

/**
 * POST /api/protection/quote
 * Get protection quote with MEV comparison
 */
router.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { inputMint, outputMint, amount, slippageBps = 100 } = req.body;

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        success: false,
        error: 'inputMint, outputMint, and amount are required',
      });
    }

    // Get standard quote
    const quote = await jupiterEngine.getSwapQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps
    );

    // Compare routes for MEV analysis
    const comparison = await slippageAnalyzer.compareRoutes(
      inputMint,
      outputMint,
      amount
    );

    res.json({
      success: true,
      data: {
        quote: {
          inputMint: quote.inputMint,
          outputMint: quote.outputMint,
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          priceImpactPct: quote.priceImpactPct,
          slippageBps: quote.slippageBps,
        },
        mevAnalysis: {
          standardSlippage: comparison.standardRoute.priceImpactPct,
          protectedSlippage: comparison.protectedRoute.priceImpactPct,
          estimatedMevSavings: comparison.comparison.estimatedMevSavings,
          recommendation: comparison.comparison.recommendProtection 
            ? 'Use MEV protection' 
            : 'Standard execution acceptable',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/protection/execute
 * Execute protective swap (requires signed transaction from frontend)
 */
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      walletAddress,
      inputMint,
      outputMint,
      amount,
      slippageBps = 100,
      useJito = true,
    } = req.body;

    if (!walletAddress || !inputMint || !outputMint || !amount) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, inputMint, outputMint, and amount are required',
      });
    }

    // Get account
    const account = await database.getAccount(walletAddress);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    // Get quote for MEV savings calculation
    const comparison = await slippageAnalyzer.compareRoutes(
      inputMint,
      outputMint,
      amount
    );

    // Create swap record
    const swap = await database.createSwap({
      accountId: account.id,
      fromToken: inputMint,
      toToken: outputMint,
      inputAmount: amount,
      outputAmount: 0, // Will be updated after execution
      slippageBps,
      usedShadowLane: true,
      usedJitoBundle: useJito,
      mevSaved: comparison.comparison.estimatedMevSavings,
      status: SwapStatus.PENDING,
    });

    // Note: Actual execution requires the user's keypair
    // In production, this would return instructions for the frontend to sign
    // For now, we return the swap record and quote

    res.json({
      success: true,
      data: {
        swapId: swap.id,
        status: 'pending',
        quote: {
          inputMint,
          outputMint,
          amount,
          slippageBps,
        },
        mevSavings: comparison.comparison.estimatedMevSavings,
        message: 'Swap created. Sign and submit transaction from wallet.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/protection/history
 * Get swap history
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, status, limit, since } = req.query;

    const swaps = await database.getSwapHistory({
      accountId: accountId as string | undefined,
      status: status as SwapStatus | undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
      since: since ? new Date(since as string) : undefined,
    });

    res.json({
      success: true,
      data: swaps,
      count: swaps.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/protection/:id
 * Get swap details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const swap = await database.getSwap(id);

    if (!swap) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found',
      });
    }

    res.json({
      success: true,
      data: swap,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/protection/:id/status
 * Update swap status (for webhook callbacks)
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, transactionSignature, bundleId, errorMessage } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required',
      });
    }

    const swap = await database.getSwap(id);
    if (!swap) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found',
      });
    }

    const updated = await database.updateSwapStatus(id, status as SwapStatus, {
      transactionSignature,
      bundleId,
      errorMessage,
    });

    logger.info(`Swap status updated: ${id} -> ${status}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
