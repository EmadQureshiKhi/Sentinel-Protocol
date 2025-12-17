/**
 * Cache Service
 * Handles caching with Redis for quotes, prices, and rate limiting
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface CachedQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  timestamp: number;
}

export interface CachedPrice {
  token: string;
  price: number;
  confidence: number;
  timestamp: number;
  source: string;
}

export class CacheService {
  private redis: Redis | null = null;
  private localCache: Map<string, { value: any; expiry: number }> = new Map();
  private static instance: CacheService;

  constructor() {
    this.initializeRedis();
    logger.info('Cache Service initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    // Skip Redis if not configured or in development without Redis
    if (!config.redisUrl && process.env.NODE_ENV !== 'production') {
      logger.info('Redis not configured, using local cache only');
      return;
    }

    try {
      const redisUrl = config.redisUrl || 'redis://localhost:6379';
      
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 1) {
            logger.warn('Redis connection failed, falling back to local cache');
            return null; // Stop retrying
          }
          return 500;
        },
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected');
      });

      this.redis.on('error', (err) => {
        logger.warn('Redis error, using local cache:', err.message);
        this.redis = null;
      });

      // Try to connect with timeout
      const connectPromise = this.redis.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 2000)
      );

      Promise.race([connectPromise, timeoutPromise]).catch(() => {
        logger.warn('Redis not available, using local cache only');
        if (this.redis) {
          this.redis.disconnect();
        }
        this.redis = null;
      });
    } catch (error) {
      logger.warn('Failed to initialize Redis, using local cache only');
      this.redis = null;
    }
  }

  // ==========================================
  // Quote Caching
  // ==========================================

  /**
   * Cache a swap quote
   */
  async cacheQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    quote: CachedQuote,
    ttlSeconds: number = 5
  ): Promise<void> {
    const key = `quote:${inputMint}:${outputMint}:${amount}`;
    const value = JSON.stringify(quote);

    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, value);
      } catch (error) {
        this.setLocal(key, quote, ttlSeconds);
      }
    } else {
      this.setLocal(key, quote, ttlSeconds);
    }
  }

  /**
   * Get cached quote
   */
  async getCachedQuote(
    inputMint: string,
    outputMint: string,
    amount: string
  ): Promise<CachedQuote | null> {
    const key = `quote:${inputMint}:${outputMint}:${amount}`;

    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value);
        }
      } catch (error) {
        return this.getLocal(key);
      }
    }

    return this.getLocal(key);
  }

  // ==========================================
  // Price Caching
  // ==========================================

  /**
   * Cache a token price
   */
  async cachePrice(
    token: string,
    price: CachedPrice,
    ttlSeconds: number = 5
  ): Promise<void> {
    const key = `price:${token}`;
    const value = JSON.stringify(price);

    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, value);
      } catch (error) {
        this.setLocal(key, price, ttlSeconds);
      }
    } else {
      this.setLocal(key, price, ttlSeconds);
    }
  }

  /**
   * Get cached price
   */
  async getCachedPrice(token: string): Promise<CachedPrice | null> {
    const key = `price:${token}`;

    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value);
        }
      } catch (error) {
        return this.getLocal(key);
      }
    }

    return this.getLocal(key);
  }

  // ==========================================
  // Rate Limiting
  // ==========================================

  /**
   * Check and increment rate limit
   * Returns true if request is allowed, false if rate limited
   */
  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<boolean> {
    const rateLimitKey = `ratelimit:${key}`;

    if (this.redis) {
      try {
        const multi = this.redis.multi();
        multi.incr(rateLimitKey);
        multi.expire(rateLimitKey, windowSeconds);
        const results = await multi.exec();

        if (results && results[0]) {
          const count = results[0][1] as number;
          return count <= maxRequests;
        }
      } catch (error) {
        return this.checkLocalRateLimit(rateLimitKey, maxRequests, windowSeconds);
      }
    }

    return this.checkLocalRateLimit(rateLimitKey, maxRequests, windowSeconds);
  }

  /**
   * Get remaining rate limit
   */
  async getRateLimitRemaining(
    key: string,
    maxRequests: number
  ): Promise<number> {
    const rateLimitKey = `ratelimit:${key}`;

    if (this.redis) {
      try {
        const count = await this.redis.get(rateLimitKey);
        return Math.max(0, maxRequests - (parseInt(count || '0', 10)));
      } catch (error) {
        return maxRequests;
      }
    }

    const cached = this.localCache.get(rateLimitKey);
    if (cached && cached.expiry > Date.now()) {
      return Math.max(0, maxRequests - cached.value);
    }
    return maxRequests;
  }

  // ==========================================
  // Generic Cache Operations
  // ==========================================

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, serialized);
        return;
      } catch (error) {
        // Fall through to local cache
      }
    }

    this.setLocal(key, value, ttlSeconds);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value);
        }
      } catch (error) {
        // Fall through to local cache
      }
    }

    return this.getLocal(key);
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        // Continue to delete from local
      }
    }

    this.localCache.delete(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.redis) {
      try {
        return (await this.redis.exists(key)) === 1;
      } catch (error) {
        // Fall through to local cache
      }
    }

    const cached = this.localCache.get(key);
    return cached !== undefined && cached.expiry > Date.now();
  }

  // ==========================================
  // Local Cache Helpers
  // ==========================================

  private setLocal(key: string, value: any, ttlSeconds: number): void {
    this.localCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });

    // Clean up expired entries periodically
    if (this.localCache.size > 1000) {
      this.cleanupLocalCache();
    }
  }

  private getLocal<T>(key: string): T | null {
    const cached = this.localCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    this.localCache.delete(key);
    return null;
  }

  private checkLocalRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): boolean {
    const cached = this.localCache.get(key);
    const now = Date.now();

    if (!cached || cached.expiry < now) {
      this.localCache.set(key, {
        value: 1,
        expiry: now + windowSeconds * 1000,
      });
      return true;
    }

    cached.value++;
    return cached.value <= maxRequests;
  }

  private cleanupLocalCache(): void {
    const now = Date.now();
    for (const [key, value] of this.localCache.entries()) {
      if (value.expiry < now) {
        this.localCache.delete(key);
      }
    }
  }

  // ==========================================
  // Connection Management
  // ==========================================

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.redis?.status === 'ready';
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis disconnected');
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        logger.warn('Failed to clear Redis cache');
      }
    }
    this.localCache.clear();
  }
}

export default CacheService;
