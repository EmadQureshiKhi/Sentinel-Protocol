/**
 * Liquidation Shield Backend
 * Main entry point
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { config } from './config';

// Import routes
import accountsRouter from './api/routes/accounts';
import alertsRouter from './api/routes/alerts';
import protectionRouter from './api/routes/protection';
import statsRouter from './api/routes/stats';
import healthRouter from './api/routes/health';
import ratesRouter from './api/routes/rates';
import positionsRouter from './api/routes/positions';
import portfolioRouter from './api/routes/portfolio';
import privacyRouter from './api/routes/privacy';

// Import middleware
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';
import { standardRateLimiter, swapRateLimiter } from './api/middleware/rateLimit';

// Import services
import { WebSocketHandler } from './api/websocket/handler';
import { Orchestrator } from './services/orchestrator';
import { DatabaseService } from './services/database';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(httpServer);

// Initialize services
let orchestrator: Orchestrator | null = null;

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health/live') {
      logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Apply rate limiting
app.use('/api', standardRateLimiter);
app.use('/api/protection/execute', swapRateLimiter);

// Mount routes
app.use('/api/accounts', accountsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/protection', protectionRouter);
app.use('/api/stats', statsRouter);
app.use('/api/health', healthRouter);
app.use('/api/rates', ratesRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/privacy', privacyRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Liquidation Shield API',
    version: '1.0.0',
    network: config.network,
    timestamp: new Date().toISOString(),
  });
});

// Orchestrator control state
let orchestratorStartedAt: Date | null = null;
let orchestratorAutoShutdownTimer: NodeJS.Timeout | null = null;
const ORCHESTRATOR_AUTO_SHUTDOWN_MS = 60 * 60 * 1000; // 1 hour

// Server status endpoint (for frontend to check if backend is running)
app.get('/api/server/status', (req, res) => {
  const uptime = process.uptime();
  const orchestratorRunning = orchestrator?.isRunning() || false;
  const orchestratorUptime = orchestratorStartedAt 
    ? Math.floor((Date.now() - orchestratorStartedAt.getTime()) / 1000)
    : 0;
  const orchestratorRemainingMs = orchestratorStartedAt && orchestratorAutoShutdownTimer
    ? Math.max(0, ORCHESTRATOR_AUTO_SHUTDOWN_MS - (Date.now() - orchestratorStartedAt.getTime()))
    : null;
  
  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: Math.floor(uptime),
      uptimeFormatted: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      orchestrator: {
        running: orchestratorRunning,
        startedAt: orchestratorStartedAt?.toISOString() || null,
        uptime: orchestratorUptime,
        uptimeFormatted: orchestratorRunning ? `${Math.floor(orchestratorUptime / 60)}m ${Math.floor(orchestratorUptime % 60)}s` : null,
        autoShutdown: {
          enabled: true,
          totalMs: ORCHESTRATOR_AUTO_SHUTDOWN_MS,
          remainingMs: orchestratorRemainingMs,
          remainingFormatted: orchestratorRemainingMs 
            ? `${Math.floor(orchestratorRemainingMs / 60000)}m ${Math.floor((orchestratorRemainingMs % 60000) / 1000)}s` 
            : null,
        },
      },
      startedAt: new Date(Date.now() - uptime * 1000).toISOString(),
    },
  });
});

// Start orchestrator endpoint
app.post('/api/server/orchestrator/start', async (req, res) => {
  try {
    if (!orchestrator) {
      return res.status(500).json({ success: false, error: 'Orchestrator not initialized' });
    }

    if (orchestrator.isRunning()) {
      return res.json({ success: true, message: 'Orchestrator already running' });
    }

    await orchestrator.start();
    orchestratorStartedAt = new Date();

    // Set auto-shutdown timer (1 hour)
    if (orchestratorAutoShutdownTimer) {
      clearTimeout(orchestratorAutoShutdownTimer);
    }
    orchestratorAutoShutdownTimer = setTimeout(async () => {
      logger.info('⏰ Orchestrator auto-shutdown: 1 hour reached');
      if (orchestrator?.isRunning()) {
        await orchestrator.shutdown();
        orchestratorStartedAt = null;
        orchestratorAutoShutdownTimer = null;
      }
    }, ORCHESTRATOR_AUTO_SHUTDOWN_MS);

    logger.info('🚀 Orchestrator started via API (auto-shutdown in 1 hour)');
    
    res.json({ 
      success: true, 
      message: 'Orchestrator started',
      autoShutdownIn: '1 hour',
    });
  } catch (error) {
    logger.error('Failed to start orchestrator:', error);
    res.status(500).json({ success: false, error: 'Failed to start orchestrator' });
  }
});

// Stop orchestrator endpoint
app.post('/api/server/orchestrator/stop', async (req, res) => {
  try {
    if (!orchestrator) {
      return res.status(500).json({ success: false, error: 'Orchestrator not initialized' });
    }

    if (!orchestrator.isRunning()) {
      return res.json({ success: true, message: 'Orchestrator already stopped' });
    }

    await orchestrator.shutdown();
    orchestratorStartedAt = null;
    
    if (orchestratorAutoShutdownTimer) {
      clearTimeout(orchestratorAutoShutdownTimer);
      orchestratorAutoShutdownTimer = null;
    }

    logger.info('🛑 Orchestrator stopped via API');
    
    res.json({ success: true, message: 'Orchestrator stopped' });
  } catch (error) {
    logger.error('Failed to stop orchestrator:', error);
    res.status(500).json({ success: false, error: 'Failed to stop orchestrator' });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Liquidation Shield API',
    version: '1.0.0',
    endpoints: {
      accounts: '/api/accounts',
      alerts: '/api/alerts',
      protection: '/api/protection',
      stats: '/api/stats',
      health: '/api/health',
      rates: '/api/rates',
      positions: '/api/positions',
      portfolio: '/api/portfolio',
      privacy: '/api/privacy',
    },
    websocket: {
      events: [
        'account:update',
        'alert:new',
        'alert:resolved',
        'protection:started',
        'protection:completed',
        'stats:update',
        'price:update',
        'hvix:update',
      ],
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Export for testing
export { app, httpServer, wsHandler };

/**
 * Start the server
 */
async function main() {
  try {
    logger.info('🚀 Starting Liquidation Shield Backend...');
    logger.info(`   Network: ${config.network}`);
    logger.info(`   Port: ${config.port}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);

    // Connect to database
    const database = DatabaseService.getInstance();
    await database.connect();

    // Initialize orchestrator
    orchestrator = new Orchestrator({
      monitoringIntervalMs: 10000,
      enableAutoProtection: false,
    });

    // Wire up orchestrator events to WebSocket
    orchestrator.on('accountUpdate', (data) => {
      wsHandler.emitAccountUpdate(data);
    });

    orchestrator.on('alert', (alert) => {
      wsHandler.emitNewAlert(alert);
    });

    orchestrator.on('monitoringUpdate', (data) => {
      wsHandler.emitStatsUpdate({
        totalAccounts: data.accounts,
        activeAlerts: data.alerts,
        atRiskAccounts: 0,
        totalMevSaved: 0,
        timestamp: Date.now(),
      });
    });

    // Start orchestrator
    await orchestrator.start();

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`✅ Server running on port ${config.port}`);
      logger.info(`   API: http://localhost:${config.port}/api`);
      logger.info(`   Health: http://localhost:${config.port}/api/health`);
      logger.info(`   WebSocket: ws://localhost:${config.port}`);
    });

    // Auto-shutdown timer (1 hour) to save Railway credits
    const AUTO_SHUTDOWN_MS = parseInt(process.env.AUTO_SHUTDOWN_MS || '3600000'); // Default 1 hour
    if (process.env.ENABLE_AUTO_SHUTDOWN === 'true') {
      logger.info(`⏰ Auto-shutdown enabled: Server will shutdown in ${AUTO_SHUTDOWN_MS / 60000} minutes`);
      setTimeout(() => {
        logger.info('⏰ Auto-shutdown timer reached. Shutting down to save credits...');
        shutdown('AUTO_SHUTDOWN');
      }, AUTO_SHUTDOWN_MS);
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Shutting down gracefully...`);
      
      // Stop accepting new connections
      httpServer.close();
      
      // Shutdown orchestrator
      if (orchestrator) {
        await orchestrator.shutdown();
      }
      
      // Close WebSocket
      wsHandler.close();
      
      // Disconnect database
      await database.disconnect();
      
      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      const errorMessage = error?.message || String(error);
      logger.error('Uncaught exception:', errorMessage);
      
      // Don't crash on WebSocket/rate limit errors - these are recoverable
      if (errorMessage.includes('429') || 
          errorMessage.includes('WebSocket') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT')) {
        logger.warn('Recoverable error detected, continuing operation...');
        return;
      }
      
      // For other critical errors, shutdown gracefully
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: any, promise) => {
      const errorMessage = reason?.message || String(reason);
      logger.error('Unhandled rejection:', errorMessage);
      
      // Don't crash on WebSocket/rate limit rejections
      if (errorMessage.includes('429') || 
          errorMessage.includes('WebSocket') ||
          errorMessage.includes('ECONNRESET')) {
        logger.warn('Recoverable rejection detected, continuing operation...');
        return;
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main();
