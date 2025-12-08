/**
 * Health API Routes
 * System health checks
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../services/database';
import { CacheService } from '../../services/cache';

const router = Router();

/**
 * GET /api/health
 * System health check
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = DatabaseService.getInstance();
    const cache = CacheService.getInstance();

    // Check database
    let databaseStatus = 'unknown';
    try {
      await database.getClient().$queryRaw`SELECT 1`;
      databaseStatus = 'healthy';
    } catch {
      databaseStatus = 'unhealthy';
    }

    // Check cache
    const cacheStatus = cache.isRedisConnected() ? 'healthy' : 'degraded';

    const isHealthy = databaseStatus === 'healthy';

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        cache: cacheStatus,
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/health/database
 * Database connection status
 */
router.get('/database', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = DatabaseService.getInstance();

    const startTime = Date.now();
    await database.getClient().$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    res.json({
      success: true,
      status: 'healthy',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/cache
 * Cache (Redis) connection status
 */
router.get('/cache', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cache = CacheService.getInstance();
    const isConnected = cache.isRedisConnected();

    res.json({
      success: true,
      status: isConnected ? 'healthy' : 'degraded',
      mode: isConnected ? 'redis' : 'local',
      message: isConnected 
        ? 'Redis connected' 
        : 'Using local cache (Redis unavailable)',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/health/ready
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = DatabaseService.getInstance();
    
    // Check if database is ready
    await database.getClient().$queryRaw`SELECT 1`;

    res.json({
      success: true,
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      ready: false,
      error: 'Service not ready',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/live
 * Liveness probe for Kubernetes
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    success: true,
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
