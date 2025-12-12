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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Liquidation Shield API',
    version: '1.0.0',
    network: config.network,
    timestamp: new Date().toISOString(),
  });
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
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main();
