/**
 * Positions API Routes
 * Endpoints for position management
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { NetworkType, ProtocolName } from '../../services/protocols/types';
import { getQuoteService, getPositionOpeningService } from '../../services/positions';
import { DatabaseService } from '../../services/database';

const prisma = DatabaseService.getInstance().getClient();

const router = Router();

/**
 * POST /api/positions/quote
 * Get position quote with protocol comparison
 */
router.post('/quote', async (req: Request, res: Response) => {
  try {
    const {
      walletAddress,
      collateralToken,
      collateralAmount,
      borrowToken,
      leverage,
      network = 'mainnet-beta',
      protocol,
    } = req.body;

    if (!walletAddress || !collateralToken || !collateralAmount || !borrowToken || !leverage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress, collateralToken, collateralAmount, borrowToken, leverage',
      });
    }

    const quoteService = getQuoteService(network as NetworkType);
    const quote = await quoteService.getPositionQuote({
      walletAddress,
      collateralToken,
      collateralAmount: parseFloat(collateralAmount),
      borrowToken,
      leverage: parseFloat(leverage),
      network: network as NetworkType,
      protocol: protocol as ProtocolName | undefined,
    });

    res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    logger.error('Error getting position quote', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get position quote',
    });
  }
});


/**
 * POST /api/positions/open
 * Build transaction to open a position
 */
router.post('/open', async (req: Request, res: Response) => {
  try {
    const {
      walletAddress,
      protocol,
      collateralToken,
      collateralMint,
      collateralAmount,
      borrowToken,
      borrowMint,
      borrowAmount,
      leverage,
      slippageBps = 50,
      network = 'mainnet-beta',
      autoMonitor = true,
      enableAlerts = true,
    } = req.body;

    if (!walletAddress || !protocol || !collateralToken || !collateralAmount || !borrowToken || !leverage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const openingService = getPositionOpeningService(network as NetworkType);
    const result = await openingService.openPosition({
      walletAddress,
      protocol: protocol as ProtocolName,
      collateralToken,
      collateralMint: collateralMint || collateralToken,
      collateralAmount: parseFloat(collateralAmount),
      borrowToken,
      borrowMint: borrowMint || borrowToken,
      borrowAmount: parseFloat(borrowAmount || '0'),
      leverage: parseFloat(leverage),
      slippageBps: parseInt(slippageBps),
      network: network as NetworkType,
      autoMonitor,
      enableAlerts,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error opening position', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to open position',
    });
  }
});

/**
 * GET /api/positions
 * List user's positions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { walletAddress, status, network } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const where: any = {
      walletAddress: walletAddress as string,
    };

    if (status) {
      where.status = status as string;
    }

    if (network) {
      where.network = network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET';
    }

    const positions = await prisma.position.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    res.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    logger.error('Error listing positions', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list positions',
    });
  }
});

/**
 * GET /api/positions/:id
 * Get position details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found',
      });
    }

    res.json({
      success: true,
      data: position,
    });
  } catch (error) {
    logger.error('Error getting position', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get position',
    });
  }
});

/**
 * POST /api/positions/:id/close
 * Build transaction to close a position
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, slippageBps = 50, network = 'mainnet-beta' } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const openingService = getPositionOpeningService(network as NetworkType);
    const result = await openingService.closePosition({
      positionId: id,
      walletAddress,
      slippageBps: parseInt(slippageBps),
    });

    res.json(result);
  } catch (error) {
    logger.error('Error closing position', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to close position',
    });
  }
});

/**
 * POST /api/positions/:id/adjust
 * Build transaction to adjust collateral
 */
router.post('/:id/adjust', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, action, amount, slippageBps = 50, network = 'mainnet-beta' } = req.body;

    if (!walletAddress || !action || !amount) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, action, and amount are required',
      });
    }

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'action must be "add" or "remove"',
      });
    }

    const openingService = getPositionOpeningService(network as NetworkType);
    const result = await openingService.adjustCollateral({
      positionId: id,
      walletAddress,
      action,
      amount: parseFloat(amount),
      slippageBps: parseInt(slippageBps),
    });

    res.json(result);
  } catch (error) {
    logger.error('Error adjusting collateral', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to adjust collateral',
    });
  }
});

/**
 * POST /api/positions/:id/confirm
 * Confirm position was opened (after tx confirmation)
 */
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { txSignature } = req.body;

    const position = await prisma.position.update({
      where: { id },
      data: {
        openTxSignature: txSignature,
      },
    });

    res.json({
      success: true,
      data: position,
    });
  } catch (error) {
    logger.error('Error confirming position', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to confirm position',
    });
  }
});

export default router;
