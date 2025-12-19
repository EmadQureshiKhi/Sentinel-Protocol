/**
 * Privacy API Routes
 * Endpoints for Arcium privacy features
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import {
  getArciumPrivacyServices,
  initializeArciumPrivacy,
} from '../../privacy/arcium';

const router = Router();

initializeArciumPrivacy();

/**
 * GET /api/privacy/status
 * Get privacy services status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const services = getArciumPrivacyServices();
    const clusterInfo = await services.encryption.getClusterInfo();
    const queueStats = await services.orderFlow.getQueueStats();
    const monitoringStats = await services.monitoring.getAggregatedRiskStats();

    res.json({
      success: true,
      data: {
        mxeCluster: {
          id: clusterInfo.clusterId,
          status: clusterInfo.status,
          nodeCount: clusterInfo.nodes.length,
          threshold: clusterInfo.threshold,
        },
        orderFlow: queueStats,
        monitoring: monitoringStats,
        features: {
          privateMonitoring: true,
          privateSwaps: true,
          darkPool: true,
          encryptedOrderFlow: true,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting privacy status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get privacy status',
    });
  }
});

/**
 * POST /api/privacy/monitoring/encrypt
 * Encrypt position for private monitoring
 */
router.post('/monitoring/encrypt', async (req: Request, res: Response) => {
  try {
    const { walletAddress, collateralValue, debtValue, healthFactor, leverage } = req.body;

    if (!walletAddress || collateralValue === undefined || debtValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, collateralValue, and debtValue are required',
      });
    }

    const services = getArciumPrivacyServices();
    const encryptedPosition = await services.monitoring.encryptAndStorePosition(
      walletAddress,
      {
        collateralValue,
        debtValue,
        healthFactor: healthFactor || (collateralValue * 0.8) / debtValue,
        leverage: leverage || collateralValue / (collateralValue - debtValue),
      }
    );

    res.json({
      success: true,
      data: {
        positionId: encryptedPosition.id,
        mxeCluster: encryptedPosition.mxeClusterId,
        encryptedAt: encryptedPosition.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error encrypting position', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to encrypt position',
    });
  }
});

/**
 * POST /api/privacy/monitoring/check
 * Run private health check
 */
router.post('/monitoring/check', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const services = getArciumPrivacyServices();
    const result = await services.monitoring.computePrivateHealthCheck(walletAddress);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error running private health check', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to run private health check',
    });
  }
});

/**
 * POST /api/privacy/monitoring/batch-check
 * Run batch private health check
 */
router.post('/monitoring/batch-check', async (req: Request, res: Response) => {
  try {
    const { walletAddresses } = req.body;

    if (!walletAddresses || !Array.isArray(walletAddresses)) {
      return res.status(400).json({
        success: false,
        error: 'walletAddresses array is required',
      });
    }

    const services = getArciumPrivacyServices();
    const results = await services.monitoring.batchPrivateHealthCheck(walletAddresses);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          atRisk: results.filter(r => r.requiresAction).length,
        },
      },
    });
  } catch (error) {
    logger.error('Error running batch health check', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to run batch health check',
    });
  }
});

/**
 * POST /api/privacy/swap/create-intent
 * Create encrypted swap intent
 */
router.post('/swap/create-intent', async (req: Request, res: Response) => {
  try {
    const { walletAddress, fromToken, toToken, amount, minOutput, slippage } = req.body;

    if (!walletAddress || !fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, fromToken, toToken, and amount are required',
      });
    }

    const services = getArciumPrivacyServices();
    const intent = await services.swaps.createEncryptedSwapIntent({
      walletAddress,
      fromToken,
      toToken,
      amount,
      minOutput: minOutput || amount * 0.995,
      slippage: slippage || 0.5,
    });

    res.json({
      success: true,
      data: {
        intentId: intent.intentId,
        mxeCluster: intent.mxeClusterId,
        expiresAt: intent.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Error creating swap intent', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create swap intent',
    });
  }
});

/**
 * POST /api/privacy/swap/execute
 * Execute private swap
 */
router.post('/swap/execute', async (req: Request, res: Response) => {
  try {
    const { intentId } = req.body;

    if (!intentId) {
      return res.status(400).json({
        success: false,
        error: 'intentId is required',
      });
    }

    const services = getArciumPrivacyServices();
    const result = await services.swaps.executePrivateSwap(intentId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error executing private swap', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to execute private swap',
    });
  }
});

/**
 * POST /api/privacy/darkpool/order
 * Submit dark pool order
 */
router.post('/darkpool/order', async (req: Request, res: Response) => {
  try {
    const { walletAddress, side, token, amount, price, expiresIn } = req.body;

    if (!walletAddress || !side || !token || !amount || !price) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, side, token, amount, and price are required',
      });
    }

    const services = getArciumPrivacyServices();
    const order = await services.darkPool.submitOrder({
      walletAddress,
      side,
      token,
      amount,
      price,
      expiresIn,
    });

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        mxeCluster: order.mxeClusterId,
        expiresAt: order.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Error submitting dark pool order', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to submit dark pool order',
    });
  }
});

/**
 * GET /api/privacy/darkpool/orders/:walletAddress
 * Get dark pool orders for wallet
 */
router.get('/darkpool/orders/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const services = getArciumPrivacyServices();
    const orders = await services.darkPool.getOrdersByWallet(walletAddress);

    res.json({
      success: true,
      data: orders.map(o => ({
        orderId: o.orderId,
        status: o.status,
        createdAt: o.createdAt,
        expiresAt: o.expiresAt,
      })),
    });
  } catch (error) {
    logger.error('Error getting dark pool orders', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get dark pool orders',
    });
  }
});

/**
 * DELETE /api/privacy/darkpool/order/:orderId
 * Cancel dark pool order
 */
router.delete('/darkpool/order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required',
      });
    }

    const services = getArciumPrivacyServices();
    const cancelled = await services.darkPool.cancelOrder(orderId, walletAddress);

    res.json({
      success: cancelled,
      data: { orderId, cancelled },
    });
  } catch (error) {
    logger.error('Error cancelling dark pool order', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel dark pool order',
    });
  }
});

/**
 * GET /api/privacy/darkpool/stats/:token
 * Get dark pool stats for token
 */
router.get('/darkpool/stats/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const services = getArciumPrivacyServices();
    const stats = await services.darkPool.getPoolStats(token);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting dark pool stats', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get dark pool stats',
    });
  }
});

/**
 * POST /api/privacy/orderflow/submit
 * Submit intent to encrypted order flow
 */
router.post('/orderflow/submit', async (req: Request, res: Response) => {
  try {
    const { walletAddress, action, params, priority } = req.body;

    if (!walletAddress || !action || !params) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, action, and params are required',
      });
    }

    const services = getArciumPrivacyServices();
    const intentId = await services.orderFlow.submitIntent({
      walletAddress,
      action,
      params,
      priority,
    });

    const queueStats = await services.orderFlow.getQueueStats();

    res.json({
      success: true,
      data: {
        intentId,
        queuePosition: queueStats.queueSize,
      },
    });
  } catch (error) {
    logger.error('Error submitting to order flow', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to submit to order flow',
    });
  }
});

/**
 * GET /api/privacy/orderflow/status/:flowId
 * Get order flow status
 */
router.get('/orderflow/status/:flowId', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;

    const services = getArciumPrivacyServices();
    const status = await services.orderFlow.getFlowStatus(flowId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting order flow status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get order flow status',
    });
  }
});

/**
 * GET /api/privacy/orderflow/stats
 * Get order flow queue stats
 */
router.get('/orderflow/stats', async (req: Request, res: Response) => {
  try {
    const services = getArciumPrivacyServices();
    const stats = await services.orderFlow.getQueueStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting order flow stats', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get order flow stats',
    });
  }
});

export default router;
