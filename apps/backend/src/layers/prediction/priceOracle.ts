import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { withRetry } from '../../utils/retry';
import { TIMING } from '../../config/constants';
import { config } from '../../config';

// Price data structure
export interface PriceData {
  token: string;
  price: number;
  confidence: number;
  timestamp: number;
  source: string;
  priceChange24h?: number;
}

// Price history entry
interface PriceHistoryEntry {
  price: number;
  timestamp: number;
}

// Jupiter Price API v3 response structure
interface JupiterPriceV3Response {
  [tokenAddress: string]: {
    blockId: number | null;
    decimals: number;
    usdPrice: number;
    priceChange24h: number | null;
  };
}

export class PriceOracle extends EventEmitter {
  private priceCache: Map<string, PriceData> = new Map();
  private priceHistory: Map<string, PriceHistoryEntry[]> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private maxHistoryLength: number = 720; // 12 hours at 1-min intervals
  
  // Jupiter API v3 configuration
  private readonly jupiterApiUrl = `${config.jupiterApiUrl}/price/v3`;
  private readonly jupiterApiKey = config.jupiterApiKey;

  constructor() {
    super();
  }

  /**
   * Start the price oracle with periodic updates
   */
  async start(intervalMs: number = 60000): Promise<void> {
    logger.info('Starting price oracle...');
    
    // Initial price fetch
    await this.updateAllPrices();
    
    // Set up periodic updates
    this.updateInterval = setInterval(async () => {
      await this.updateAllPrices();
    }, intervalMs);
    
    logger.info('✅ Price oracle started');
  }

  /**
   * Stop the price oracle
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    logger.info('Price oracle stopped');
  }

  /**
   * Get current price for a token
   * Returns cached price if fresh, otherwise fetches new price
   */
  async getPrice(token: string): Promise<PriceData | null> {
    const cached = this.priceCache.get(token);
    
    // Check if cache is fresh (within TTL)
    if (cached && this.isPriceFresh(cached)) {
      return cached;
    }
    
    // Fetch fresh price
    return await this.fetchPrice(token);
  }

  /**
   * Check if a price is fresh (not stale)
   */
  private isPriceFresh(priceData: PriceData): boolean {
    const age = Date.now() - priceData.timestamp;
    return age < TIMING.PRICE_CACHE_TTL_MS;
  }

  /**
   * Check if a price is stale (too old to use)
   */
  isPriceStale(priceData: PriceData): boolean {
    const age = Date.now() - priceData.timestamp;
    return age > TIMING.PRICE_STALENESS_MS;
  }

  /**
   * Build request headers for Jupiter API
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.jupiterApiKey) {
      headers['x-api-key'] = this.jupiterApiKey;
    }
    
    return headers;
  }

  /**
   * Fetch price from Jupiter Price API v3
   */
  async fetchPrice(token: string): Promise<PriceData | null> {
    try {
      const priceData = await withRetry(
        async () => {
          const response = await axios.get<JupiterPriceV3Response>(
            `${this.jupiterApiUrl}?ids=${token}`,
            { 
              timeout: 5000,
              headers: this.getHeaders(),
            }
          );
          
          const data = response.data?.[token];
          if (!data) {
            throw new Error(`No price data for ${token}`);
          }
          
          return {
            token,
            price: data.usdPrice,
            confidence: 0.99, // Jupiter doesn't provide confidence
            timestamp: Date.now(),
            source: 'jupiter-v3',
            priceChange24h: data.priceChange24h ?? undefined,
          };
        },
        { maxRetries: 3, baseDelayMs: 500 }
      );
      
      // Update cache
      this.priceCache.set(token, priceData);
      
      // Record in history
      this.recordPrice(token, priceData.price);
      
      return priceData;
    } catch (error) {
      logger.error(`Failed to fetch price for ${token}:`, error);
      return null;
    }
  }

  /**
   * Update prices for common tokens
   */
  async updateAllPrices(): Promise<void> {
    const tokens = [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    ];
    
    try {
      // Batch fetch from Jupiter Price API v3
      const tokenIds = tokens.join(',');
      const response = await axios.get<JupiterPriceV3Response>(
        `${this.jupiterApiUrl}?ids=${tokenIds}`,
        { 
          timeout: 5000,
          headers: this.getHeaders(),
        }
      );
      
      const data = response.data;
      if (!data) return;
      
      for (const token of tokens) {
        const tokenData = data[token];
        if (tokenData) {
          const priceData: PriceData = {
            token,
            price: tokenData.usdPrice,
            confidence: 0.99,
            timestamp: Date.now(),
            source: 'jupiter-v3',
            priceChange24h: tokenData.priceChange24h ?? undefined,
          };
          
          this.priceCache.set(token, priceData);
          this.recordPrice(token, priceData.price);
          
          this.emit('priceUpdate', priceData);
        }
      }
      
      logger.debug('Updated all prices from Jupiter v3');
    } catch (error) {
      logger.error('Failed to update prices:', error);
    }
  }

  /**
   * Record price in history for HVIX calculation
   */
  recordPrice(token: string, price: number): void {
    if (!this.priceHistory.has(token)) {
      this.priceHistory.set(token, []);
    }
    
    const history = this.priceHistory.get(token)!;
    
    history.push({
      price,
      timestamp: Date.now(),
    });
    
    // Trim to max length
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
  }

  /**
   * Get price history for a token
   * @param token - Token address
   * @param minutes - Number of minutes of history to return
   */
  getPriceHistory(token: string, minutes?: number): number[] {
    const history = this.priceHistory.get(token) || [];
    
    if (!minutes) {
      return history.map(h => h.price);
    }
    
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return history
      .filter(h => h.timestamp >= cutoffTime)
      .map(h => h.price);
  }

  /**
   * Get price history with timestamps
   */
  getPriceHistoryWithTimestamps(token: string, minutes?: number): PriceHistoryEntry[] {
    const history = this.priceHistory.get(token) || [];
    
    if (!minutes) {
      return [...history];
    }
    
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return history.filter(h => h.timestamp >= cutoffTime);
  }

  /**
   * Get cached price (no fetch)
   */
  getCachedPrice(token: string): PriceData | null {
    return this.priceCache.get(token) || null;
  }

  /**
   * Get SOL price in USD
   */
  async getSolPrice(): Promise<number> {
    const solMint = 'So11111111111111111111111111111111111111112';
    const priceData = await this.getPrice(solMint);
    return priceData?.price || 0;
  }

  /**
   * Convert token amount to USD value
   */
  async getUsdValue(token: string, amount: number): Promise<number> {
    const priceData = await this.getPrice(token);
    if (!priceData) return 0;
    return amount * priceData.price;
  }

  /**
   * Get all cached prices
   */
  getAllCachedPrices(): Map<string, PriceData> {
    return new Map(this.priceCache);
  }
}

export default PriceOracle;
