/**
 * Alerts API Routes
 * Handles alert operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';
import { AlertStatus } from '@prisma/client';

const router = Router();
const database = DatabaseService.getInstance();

/**
 * GET /api/alerts
 * List active alerts
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, status } = req.query;

    const alerts = await database.getActiveAlerts({
      accountId: accountId as string | undefined,
      status: status as AlertStatus | undefined,
    });

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/alerts/:id
 * Get alert details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await database.getAlert(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await database.getAlert(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    if (alert.acknowledgedAt) {
      return res.status(400).json({
        success: false,
        error: 'Alert already acknowledged',
      });
    }

    const updated = await database.acknowledgeAlert(id);

    logger.info(`Alert acknowledged: ${id}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/alerts/:id/resolve
 * Resolve an alert
 */
router.post('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await database.getAlert(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    if (alert.resolvedAt) {
      return res.status(400).json({
        success: false,
        error: 'Alert already resolved',
      });
    }

    const updated = await database.resolveAlert(id);

    logger.info(`Alert resolved: ${id}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
