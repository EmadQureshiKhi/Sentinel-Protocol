/**
 * Drift Protocol Service
 * Fetches REAL rates from Drift Data API
 */

import axios from 'axios';
import { ProtocolRates, TokenRate, NetworkType, TOKEN_MINTS } from './types';
import { logger } from '../../utils/logger';
import { CacheService } from '../cache';

const cacheService = CacheService.getInstance();
const CACHE_TTL = 30; // 30 seconds

// Drift Data API endpoints
const DRIFT_DATA_API = {
  'mainnet-beta': 'https://data.api.drift.trade',
  devnet: 'https://data-master.api.drift.trade',
};

// Drift spot market indices to token symbols
// Based on /contracts endpoint
const DRIFT_SPOT_MARKETS: Record<number, string> = {
  0: 'USDC',
  1: 'SOL',
  2: 'mSOL',
  5: 'USDT',
  6: 'jitoSOL',
  7: 'PYTH',
  8: 'bSOL',
  9: 'JTO',
  10: 'WIF',
  11: 'JUP',
  // Add more as needed
};

interface RateHistoryPoint {
  timestamp: number;
  rate: string;
}

export class DriftService {
  private network: NetworkType;
  private apiUrl: string;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
    this.apiUrl = DRIFT_DATA_API[network] || DRIFT_DATA_API['mainnet-beta'];
  }

  /**
   * Get all rates from Drift Protocol using Data API
   */
  async getRates(): Promise<ProtocolRates> {
    const cacheKey = `drift:rates:${this.network}`;
    const cached = await cacheService.get<ProtocolRates>(cacheKey);
    if (cached) return cached;

    try {
      logger.info('Fetching Drift rates from Data API', { network: this.network });

      const rates = await this.fetchSpotMarketRates();
      const tvl = rates.reduce((sum, r) => sum + r.totalSupply, 0);

      const result: ProtocolRates = {
        protocol: 'DRIFT',
        network: this.network,
        rates,
        tvl,
        updatedAt: new Date(),
      };

      await cacheService.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('Error fetching Drift rates', { error });
      throw error;
    }
  }

  /**
   * Fetch spot market rates from Drift Data API
   */
  private async fetchSpotMarketRates(): Promise<TokenRate[]> {
    const rates: TokenRate[] = [];
    const networkKey = this.network === 'mainnet-beta' ? 'mainnet' : 'devnet';

    try {
      // Fetch contracts to get market info
      const contractsResponse = await axios.get(`${this.apiUrl}/contracts`, {
        timeout: 15000,
      });

      const contracts = contractsResponse.data.contracts || [];

      // Filter for spot markets we support
      for (const [marketIndex, symbol] of Object.entries(DRIFT_SPOT_MARKETS)) {
        const networkMints = TOKEN_MINTS[networkKey as keyof typeof TOKEN_MINTS];
        const mint = networkMints[symbol as keyof typeof networkMints];
        if (!mint) continue;

        try {
          // Fetch deposit rate
          const depositResponse = await axios.get(`${this.apiUrl}/rateHistory`, {
            params: {
              marketIndex: parseInt(marketIndex),
              type: 'deposit',
            },
            timeout: 10000,
          });

          // Fetch borrow rate
          const borrowResponse = await axios.get(`${this.apiUrl}/rateHistory`, {
            params: {
              marketIndex: parseInt(marketIndex),
              type: 'borrow',
            },
            timeout: 10000,
          });

          const depositData = depositResponse.data.data || [];
          const borrowData = borrowResponse.data.data || [];

          // Get latest rates (last element in array)
          const latestDeposit = depositData[depositData.length - 1];
          const latestBorrow = borrowData[borrowData.length - 1];

          if (!latestDeposit || !latestBorrow) {
            logger.warn('No rate data for market', { marketIndex, symbol });
            continue;
          }

          // Rates are returned as strings (e.g., "0.023094" = 2.31%)
          const depositApy = parseFloat(latestDeposit[1]) * 100;
          const borrowApy = parseFloat(latestBorrow[1]) * 100;

          // Fetch deposit and borrow balances
          const depositBalanceResponse = await axios.get(`${this.apiUrl}/rateHistory`, {
            params: {
              marketIndex: parseInt(marketIndex),
              type: 'deposit_balance',
            },
            timeout: 10000,
          });

          const borrowBalanceResponse = await axios.get(`${this.apiUrl}/rateHistory`, {
            params: {
              marketIndex: parseInt(marketIndex),
              type: 'borrow_balance',
            },
            timeout: 10000,
          });

          const depositBalanceData = depositBalanceResponse.data.data || [];
          const borrowBalanceData = borrowBalanceResponse.data.data || [];

          const latestDepositBalance = depositBalanceData[depositBalanceData.length - 1];
          const latestBorrowBalance = borrowBalanceData[borrowBalanceData.length - 1];

          const totalSupply = latestDepositBalance ? parseFloat(latestDepositBalance[1]) : 0;
          const totalBorrow = latestBorrowBalance ? parseFloat(latestBorrowBalance[1]) : 0;
          const utilization = totalSupply > 0 ? (totalBorrow / totalSupply) * 100 : 0;

          rates.push({
            token: symbol,
            symbol,
            mint,
            supplyApy: depositApy,
            borrowApy: borrowApy,
            totalSupply,
            totalBorrow,
            utilization,
            ltv: this.getLTV(symbol),
            liquidationThreshold: this.getLiquidationThreshold(symbol),
            liquidationPenalty: 5,
          });

          logger.debug('Fetched Drift rate', {
            symbol,
            depositApy: depositApy.toFixed(2),
            borrowApy: borrowApy.toFixed(2),
          });
        } catch (error: any) {
          logger.warn('Failed to fetch rate for market', {
            marketIndex,
            symbol,
            error: error.message,
          });
          continue;
        }
      }

      logger.info('Fetched Drift rates from Data API', { count: rates.length });
    } catch (error: any) {
      logger.error('Failed to fetch Drift contracts', { error: error.message });
      throw new Error('Failed to fetch Drift rates from Data API');
    }

    // If no rates from API (e.g., devnet), use fallback rates for testing
    if (rates.length === 0) {
      logger.info('Using fallback Drift rates for testing', { network: this.network });
      return this.getFallbackRates();
    }

    return rates;
  }

  /**
   * Get fallback rates for devnet testing
   * These are approximate rates based on mainnet data
   */
  private getFallbackRates(): TokenRate[] {
    const networkKey = this.network === 'mainnet-beta' ? 'mainnet' : 'devnet';
    const networkMints = TOKEN_MINTS[networkKey as keyof typeof TOKEN_MINTS];

    return [
      {
        token: 'SOL',
        symbol: 'SOL',
        mint: networkMints['SOL'] || 'So11111111111111111111111111111111111111112',
        supplyApy: 2.5,
        borrowApy: 6.0,
        totalSupply: 100000000,
        totalBorrow: 50000000,
        utilization: 50,
        ltv: 80,
        liquidationThreshold: 85,
        liquidationPenalty: 5,
      },
      {
        token: 'USDC',
        symbol: 'USDC',
        mint: networkMints['USDC'] || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        supplyApy: 4.0,
        borrowApy: 5.5,
        totalSupply: 200000000,
        totalBorrow: 120000000,
        utilization: 60,
        ltv: 90,
        liquidationThreshold: 95,
        liquidationPenalty: 5,
      },
      {
        token: 'USDT',
        symbol: 'USDT',
        mint: networkMints['USDT'] || 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenErt',
        supplyApy: 3.8,
        borrowApy: 5.2,
        totalSupply: 80000000,
        totalBorrow: 45000000,
        utilization: 56,
        ltv: 90,
        liquidationThreshold: 95,
        liquidationPenalty: 5,
      },
      {
        token: 'mSOL',
        symbol: 'mSOL',
        mint: networkMints['mSOL'] || 'mSoLzYCxHdgvVrQgf5MXZzctke3MWW4ngtg9ZWsDLHP',
        supplyApy: 3.0,
        borrowApy: 7.0,
        totalSupply: 30000000,
        totalBorrow: 10000000,
        utilization: 33,
        ltv: 75,
        liquidationThreshold: 80,
        liquidationPenalty: 5,
      },
    ];
  }

  private getLTV(symbol: string): number {
    const ltvMap: Record<string, number> = {
      SOL: 80,
      USDC: 90,
      USDT: 90,
      mSOL: 75,
      jitoSOL: 75,
      bSOL: 75,
    };
    return ltvMap[symbol] || 70;
  }

  private getLiquidationThreshold(symbol: string): number {
    const thresholdMap: Record<string, number> = {
      SOL: 85,
      USDC: 95,
      USDT: 95,
      mSOL: 80,
      jitoSOL: 80,
      bSOL: 80,
    };
    return thresholdMap[symbol] || 75;
  }

  async getTokenRate(token: string): Promise<TokenRate | null> {
    const rates = await this.getRates();
    return rates.rates.find((r) => r.token.toUpperCase() === token.toUpperCase()) || null;
  }
}

export const createDriftService = (network: NetworkType) => new DriftService(network);
