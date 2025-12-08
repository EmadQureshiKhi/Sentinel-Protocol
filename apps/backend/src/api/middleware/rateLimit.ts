/**
 * Rate Limiting Middleware
 * Implements rate limiting by IP address
 */

import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../../services/cache';
import { logger } from '../../utils/logger';

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  keyGenerator?: (req: Request) => string;  // Custom key generator
  skip?: (req: Request) => boolean;         // Skip rate limiting
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60000,       // 1 minute
  maxRequests: 100,      // 100 requests per minute
  message: 'Too many requests, please try again later',
};

/**
 * Create rate limit middleware
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const options = { ...defaultConfig, ...config };
  const cache = CacheService.getInstance();

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if should skip
    if (options.skip && options.skip(req)) {
      return next();
    }

    // Generate key
    const key = options.keyGenerator 
      ? options.keyGenerator(req)
      : getClientIp(req);

    const windowSeconds = Math.ceil(options.windowMs / 1000);

    try {
      const allowed = await cache.checkRateLimit(
        key,
        options.maxRequests,
        windowSeconds
      );

      // Set rate limit headers
      const remaining = await cache.getRateLimitRemaining(key, options.maxRequests);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining - 1));
      res.setHeader('X-RateLimit-Reset', Date.now() + options.windowMs);

      if (!allowed) {
        logger.warn('Rate limit exceeded:', { ip: key, path: req.path });
        
        return res.status(429).json({
          success: false,
          error: options.message,
          retryAfter: windowSeconds,
          timestamp: new Date().toISOString(),
        });
      }

      next();
    } catch (error) {
      // On error, allow request but log
      logger.error('Rate limit check failed:', error);
      next();
    }
  };
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  // Check various headers for proxied requests
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Pre-configured rate limiters
export const standardRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});

export const strictRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  message: 'Rate limit exceeded for this endpoint',
});

export const swapRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  message: 'Too many swap requests, please wait',
});

export default createRateLimiter;
