/**
 * Accounts API Routes
 * Handles account monitoring operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';
import { Protocol } from '@prisma/client';

const router = Router();
const database = DatabaseService.getInstance();

/**
 * GET /api/accounts
 * List all monitored accounts
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive, protocol } = req.query;
    
    const accounts = await database.listAccounts({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      protocol: protocol as Protocol | undefined,
    });

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:wallet
 * Get account details with latest snapshot
 */
router.get('/:wallet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wallet } = req.params;
    
    const account = await database.getAccount(wallet);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/accounts
 * Add account to monitoring
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress, protocol } = req.body;

    if (!walletAddress || !protocol) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress and protocol are required',
      });
    }

    // Validate protocol
    if (!['DRIFT', 'MARGINFI', 'SOLEND'].includes(protocol)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid protocol. Must be DRIFT, MARGINFI, or SOLEND',
      });
    }

    // Validate wallet address format (basic check)
    if (walletAddress.length < 32 || walletAddress.length > 44) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format',
      });
    }

    // Check if account already exists
    const existing = await database.getAccount(walletAddress);
    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        const updated = await database.updateAccount(walletAddress, { isActive: true });
        return res.json({
          success: true,
          data: updated,
          message: 'Account reactivated',
        });
      }
      return res.status(409).json({
        success: false,
        error: 'Account already being monitored',
      });
    }

    const account = await database.createAccount({
      walletAddress,
      protocol: protocol as Protocol,
      isActive: true,
    });

    logger.info(`Account added to monitoring: ${walletAddress}`);

    res.status(201).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/accounts/:wallet
 * Remove account from monitoring
 */
router.delete('/:wallet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wallet } = req.params;

    const account = await database.getAccount(wallet);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    // Soft delete - just deactivate
    await database.updateAccount(wallet, { isActive: false });

    logger.info(`Account removed from monitoring: ${wallet}`);

    res.json({
      success: true,
      message: 'Account removed from monitoring',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:wallet/history
 * Get snapshot history for account
 */
router.get('/:wallet/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wallet } = req.params;
    const { limit, since } = req.query;

    const account = await database.getAccount(wallet);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    const history = await database.getSnapshotHistory(account.id, {
      limit: limit ? parseInt(limit as string, 10) : 100,
      since: since ? new Date(since as string) : undefined,
    });

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
