/**
 * Price Service
 * Centralized price fetching using Jupiter Price API (Basic + Ultra fallback)
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { CacheService } from '../cache';

const cacheService = CacheService.getInstance();

// Token mint addresses
export const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

// Reverse lookup
export const MINT_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(TOKEN_MINTS).map(([k, v]) => [v, k])
);

export interface TokenPrice {
  symbol: string;
  mint: string;
  price: number;
  priceChange24h: number | null;
  timestamp: number;
}

// Jupiter API configuration
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
const JUPITER_API_URL = process.env.JUPITER_API_URL || 'https://api.jup.ag';
const JUPITER_ULTRA_API_URL = process.env.JUPITER_ULTRA_API_URL || 'https://api.jup.ag/ultra';
const CACHE_TTL = 10; // 10 seconds

// Create axios instance with API key header
const jupiterClient = axios.create({
  timeout: 5000,
  headers: JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {},
});

export class PriceService {
  private static instance: PriceService;

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  /**
   * Get price for a single token by symbol or mint
   */
  async getPrice(tokenOrMint: string): Promise<TokenPrice | null> {
    const mint = TOKEN_MINTS[tokenOrMint.toUpperCase()] || tokenOrMint;
    const symbol = MINT_TO_SYMBOL[mint] || tokenOrMint;

    // Check cache
    const cacheKey = `price:${mint}`;
    const cached = await cacheService.get<TokenPrice>(cacheKey);
    if (cached) return cached;

    try {
      // Use Jupiter Price API v3
      const response = await jupiterClient.get(`${JUPITER_API_URL}/price/v3`, {
        params: { ids: mint },
      });

      const data = response.data?.[mint];
      if (data) {
        const price: TokenPrice = {
          symbol,
          mint,
          price: data.usdPrice,
          priceChange24h: data.priceChange24h || null,
          timestamp: Date.now(),
        };

        await cacheService.set(cacheKey, price, CACHE_TTL);
        logger.debug('Price fetched', { symbol, price: price.price });
        return price;
      }
    } catch (error: any) {
      logger.error('Failed to fetch price', { 
        token: tokenOrMint, 
        error: error.message,
        status: error.response?.status 
      });
    }

    return null;
  }

  /**
   * Get prices for multiple tokens
   */
  async getPrices(tokens: string[]): Promise<Map<string, TokenPrice>> {
    const results = new Map<string, TokenPrice>();
    const mints = tokens.map(t => TOKEN_MINTS[t.toUpperCase()] || t);
    const uncached: string[] = [];

    // Check cache first
    for (let i = 0; i < mints.length; i++) {
      const mint = mints[i];
      const symbol = tokens[i].toUpperCase();
      const cacheKey = `price:${mint}`;
      const cached = await cacheService.get<TokenPrice>(cacheKey);
      if (cached) {
        results.set(symbol, cached);
      } else {
        uncached.push(mint);
      }
    }

    if (uncached.length === 0) return results;

    try {
      // Use Jupiter Price API v3
      const response = await jupiterClient.get(`${JUPITER_API_URL}/price/v3`, {
        params: { ids: uncached.join(',') },
      });

      const data = response.data;
      if (data) {
        for (const mint of uncached) {
          const priceData = data[mint];
          if (priceData) {
            const symbol = MINT_TO_SYMBOL[mint] || mint;
            const price: TokenPrice = {
              symbol,
              mint,
              price: priceData.usdPrice,
              priceChange24h: priceData.priceChange24h || null,
              timestamp: Date.now(),
            };

            results.set(symbol, price);
            await cacheService.set(`price:${mint}`, price, CACHE_TTL);
          }
        }
        logger.debug('Prices fetched', { count: results.size });
      }
    } catch (error: any) {
      logger.error('Failed to fetch prices', { error: error.message });
    }

    return results;
  }

  /**
   * Get all supported token prices
   */
  async getAllPrices(): Promise<Map<string, TokenPrice>> {
    return this.getPrices(Object.keys(TOKEN_MINTS));
  }

  /**
   * Get price by symbol (convenience method)
   */
  async getPriceBySymbol(symbol: string): Promise<number> {
    const price = await this.getPrice(symbol);
    return price?.price || 0;
  }
}

export const priceService = PriceService.getInstance();
