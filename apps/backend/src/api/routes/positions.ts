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
 * POST /api/positions/:id/confirm-close
 * Confirm position was closed (update status to CLOSED)
 */
router.post('/:id/confirm-close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { txSignature, realizedPnl } = req.body;

    // Update position status to CLOSED
    const position = await prisma.position.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closeTxSignature: txSignature || null,
        unrealizedPnl: realizedPnl || 0, // Store realized P/L in unrealizedPnl field
      },
    });

    logger.info('Position closed confirmed', { id, txSignature, realizedPnl });

    res.json({
      success: true,
      position,
    });
  } catch (error) {
    logger.error('Error confirming position close', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to confirm position close',
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
 * POST /api/positions/confirm
 * Create position record after transaction confirmation
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const {
      walletAddress,
      protocol,
      network,
      collateralToken,
      collateralMint,
      collateralAmount,
      borrowToken,
      borrowMint,
      borrowAmount,
      leverage,
      entryPrice,
      liquidationPrice,
      healthFactor,
      txSignature,
      autoMonitor,
    } = req.body;

    if (!walletAddress || !protocol || !txSignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Create position record
    const position = await prisma.position.create({
      data: {
        walletAddress,
        protocol,
        network: network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET',
        status: 'OPEN',
        collateralToken,
        collateralMint: collateralMint || collateralToken,
        collateralAmount: parseFloat(collateralAmount),
        borrowToken,
        borrowMint: borrowMint || borrowToken,
        borrowAmount: parseFloat(borrowAmount || '0'),
        leverage: parseFloat(leverage),
        entryPrice: parseFloat(entryPrice),
        liquidationPrice: parseFloat(liquidationPrice),
        openHealthFactor: parseFloat(healthFactor),
        openTxSignature: txSignature,
      },
    });

    // Auto-add to monitoring if requested
    if (autoMonitor) {
      const existing = await prisma.monitoredAccount.findUnique({
        where: { walletAddress },
      });

      if (!existing) {
        await prisma.monitoredAccount.create({
          data: {
            walletAddress,
            protocol,
            isActive: true,
          },
        });
      }
    }

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

/**
 * GET /api/positions/history/transactions
 * Get transaction history for a wallet (positions + swaps)
 */
router.get('/history/transactions', async (req: Request, res: Response) => {
  try {
    const { walletAddress, limit = 50 } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    // Fetch positions
    const positions = await prisma.position.findMany({
      where: { walletAddress: walletAddress as string },
      orderBy: { openedAt: 'desc' },
      take: parseInt(limit as string),
    });

    // Fetch protective swaps
    const account = await prisma.monitoredAccount.findUnique({
      where: { walletAddress: walletAddress as string },
      include: {
        protectiveSwaps: {
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string),
        },
      },
    });

    // Combine and format transactions
    const transactions = [
      // Position opens
      ...positions.map(p => ({
        id: p.id,
        type: 'POSITION_OPEN' as const,
        timestamp: p.openedAt,
        protocol: p.protocol,
        status: 'CONFIRMED',
        txSignature: p.openTxSignature,
        details: {
          collateralToken: p.collateralToken,
          collateralAmount: p.collateralAmount,
          borrowToken: p.borrowToken,
          borrowAmount: p.borrowAmount,
          leverage: p.leverage,
        },
      })),
      // Position closes (only for closed positions)
      ...positions
        .filter(p => p.status === 'CLOSED' && p.closedAt)
        .map(p => ({
          id: `${p.id}-close`,
          type: 'POSITION_CLOSE' as const,
          timestamp: p.closedAt!,
          protocol: p.protocol,
          status: 'CLOSED',
          txSignature: p.closeTxSignature,
          details: {
            collateralToken: p.collateralToken,
            collateralAmount: p.collateralAmount,
            borrowToken: p.borrowToken,
            borrowAmount: p.borrowAmount,
            leverage: p.leverage,
            realizedPnl: p.unrealizedPnl,
          },
        })),
      // Protective swaps
      ...(account?.protectiveSwaps || []).map(s => ({
        id: s.id,
        type: 'PROTECTIVE_SWAP' as const,
        timestamp: s.createdAt,
        protocol: account?.protocol || 'DRIFT',
        status: s.status,
        txSignature: s.transactionSignature,
        details: {
          fromToken: s.fromToken,
          toToken: s.toToken,
          inputAmount: s.inputAmount,
          outputAmount: s.outputAmount,
          mevSaved: s.mevSaved,
        },
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    logger.error('Error getting transaction history', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction history',
    });
  }
});

/**
 * DELETE /api/positions/:id
 * Delete a position (for cleanup)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    // Verify ownership
    const position = await prisma.position.findUnique({
      where: { id },
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found',
      });
    }

    if (position.walletAddress !== walletAddress) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    await prisma.position.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Position deleted',
    });
  } catch (error) {
    logger.error('Error deleting position', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete position',
    });
  }
});

export default router;
