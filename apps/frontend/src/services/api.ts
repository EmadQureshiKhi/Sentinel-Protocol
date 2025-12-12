/**
 * API Service
 * Handles all HTTP requests to the backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

// Account types
export interface Account {
  id: string;
  walletAddress: string;
  protocol: 'DRIFT' | 'MARGINFI' | 'SOLEND';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  snapshots?: AccountSnapshot[];
  alerts?: Alert[];
}

export interface AccountSnapshot {
  id: string;
  accountId: string;
  healthFactor: number;
  collateralValue: number;
  borrowedValue: number;
  leverage: number;
  liquidationPrice: number;
  oraclePrice: number;
  riskScore: number;
  hvixValue: number;
  cascadeProbability: number;
  timeToLiquidation: number;
  createdAt: string;
}

// Alert types
export interface Alert {
  id: string;
  accountId: string;
  riskScore: number;
  cascadeProbability: number;
  timeToLiquidation: number;
  estimatedLosses: number;
  recommendedAction: 'PROTECT' | 'MONITOR' | 'SAFE';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'EXPIRED';
  acknowledgedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  account?: Account;
}

// Protection/Swap types
export interface ProtectionQuote {
  quote: {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
    slippageBps: number;
  };
  mevAnalysis: {
    standardSlippage: number;
    protectedSlippage: number;
    estimatedMevSavings: number;
    recommendation: string;
  };
}

export interface ProtectiveSwap {
  id: string;
  accountId: string;
  fromToken: string;
  toToken: string;
  inputAmount: number;
  outputAmount: number;
  slippageBps: number;
  usedShadowLane: boolean;
  usedJitoBundle: boolean;
  mevSaved?: number;
  transactionSignature?: string;
  bundleId?: string;
  status: 'PENDING' | 'SIMULATING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  errorMessage?: string;
  createdAt: string;
  executedAt?: string;
  account?: Account;
}

// Stats types
export interface OverviewStats {
  totalAccounts: number;
  atRiskAccounts: number;
  activeAlerts: number;
  totalSwaps: number;
  totalMevSaved: number;
  timestamp: string;
}

export interface MevSavingsStats {
  totalMevSaved: number;
  totalMevSavedUsd: number;
  recentSavings: {
    id: string;
    amount: number;
    fromToken: string;
    toToken: string;
    createdAt: string;
  }[];
  timestamp: string;
}

export interface DailyStats {
  date: string;
  totalAccounts: number;
  totalAlerts: number;
  totalSwaps: number;
  totalMevSaved: number;
}

// Health types
export interface HealthStatus {
  success: boolean;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: string;
    cache: string;
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    unit: string;
  };
}

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // ==========================================
  // Account Endpoints
  // ==========================================

  async getAccounts(params?: { isActive?: boolean; protocol?: string }): Promise<Account[]> {
    const response = await this.client.get<ApiResponse<Account[]>>('/accounts', { params });
    return response.data.data || [];
  }

  async getAccount(walletAddress: string): Promise<Account | null> {
    const response = await this.client.get<ApiResponse<Account>>(`/accounts/${walletAddress}`);
    return response.data.data || null;
  }

  async addAccount(walletAddress: string, protocol: string): Promise<Account> {
    const response = await this.client.post<ApiResponse<Account>>('/accounts', {
      walletAddress,
      protocol,
    });
    return response.data.data!;
  }

  async removeAccount(walletAddress: string): Promise<void> {
    await this.client.delete(`/accounts/${walletAddress}`);
  }

  async getAccountHistory(walletAddress: string, params?: { limit?: number; since?: string }): Promise<AccountSnapshot[]> {
    const response = await this.client.get<ApiResponse<AccountSnapshot[]>>(
      `/accounts/${walletAddress}/history`,
      { params }
    );
    return response.data.data || [];
  }

  // ==========================================
  // Alert Endpoints
  // ==========================================

  async getAlerts(params?: { accountId?: string; status?: string }): Promise<Alert[]> {
    const response = await this.client.get<ApiResponse<Alert[]>>('/alerts', { params });
    return response.data.data || [];
  }

  async getAlert(id: string): Promise<Alert | null> {
    const response = await this.client.get<ApiResponse<Alert>>(`/alerts/${id}`);
    return response.data.data || null;
  }

  async acknowledgeAlert(id: string): Promise<Alert> {
    const response = await this.client.post<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`);
    return response.data.data!;
  }

  async resolveAlert(id: string): Promise<Alert> {
    const response = await this.client.post<ApiResponse<Alert>>(`/alerts/${id}/resolve`);
    return response.data.data!;
  }

  // ==========================================
  // Protection Endpoints
  // ==========================================

  async getProtectionQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps?: number
  ): Promise<ProtectionQuote> {
    const response = await this.client.post<ApiResponse<ProtectionQuote>>('/protection/quote', {
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });
    return response.data.data!;
  }

  async executeProtection(params: {
    walletAddress: string;
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    useJito?: boolean;
  }): Promise<{ swapId: string; status: string; mevSavings: number }> {
    const response = await this.client.post<ApiResponse<any>>('/protection/execute', params);
    return response.data.data!;
  }

  async getProtectionHistory(params?: {
    accountId?: string;
    status?: string;
    limit?: number;
  }): Promise<ProtectiveSwap[]> {
    const response = await this.client.get<ApiResponse<ProtectiveSwap[]>>('/protection/history', { params });
    return response.data.data || [];
  }

  async getProtection(id: string): Promise<ProtectiveSwap | null> {
    const response = await this.client.get<ApiResponse<ProtectiveSwap>>(`/protection/${id}`);
    return response.data.data || null;
  }

  // ==========================================
  // Stats Endpoints
  // ==========================================

  async getOverviewStats(): Promise<OverviewStats> {
    const response = await this.client.get<ApiResponse<OverviewStats>>('/stats/overview');
    return response.data.data!;
  }

  async getMevSavings(): Promise<MevSavingsStats> {
    const response = await this.client.get<ApiResponse<MevSavingsStats>>('/stats/mev-savings');
    return response.data.data!;
  }

  async getDailyStats(date?: string): Promise<DailyStats> {
    const response = await this.client.get<ApiResponse<DailyStats>>('/stats/daily', {
      params: { date },
    });
    return response.data.data!;
  }

  async getStatsHistory(days?: number): Promise<DailyStats[]> {
    const response = await this.client.get<ApiResponse<DailyStats[]>>('/stats/history', {
      params: { days },
    });
    return response.data.data || [];
  }

  // ==========================================
  // Health Endpoints
  // ==========================================

  async getHealth(): Promise<HealthStatus> {
    const response = await this.client.get<HealthStatus>('/health');
    return response.data;
  }

  async getDatabaseHealth(): Promise<{ success: boolean; status: string; latency: string }> {
    const response = await this.client.get('/health/database');
    return response.data;
  }

  async getCacheHealth(): Promise<{ success: boolean; status: string; mode: string }> {
    const response = await this.client.get('/health/cache');
    return response.data;
  }

  // ==========================================
  // Rates Endpoints
  // ==========================================

  async getAllRates(network: string = 'mainnet-beta'): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/rates', {
      params: { network },
    });
    return response.data.data;
  }

  async getProtocolRates(protocol: string, network: string = 'mainnet-beta'): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/rates/${protocol.toLowerCase()}`, {
      params: { network },
    });
    return response.data.data;
  }

  async compareTokenRates(token: string, network: string = 'mainnet-beta'): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/rates/compare/${token}`, {
      params: { network },
    });
    return response.data.data;
  }

  async getBestRates(network: string = 'mainnet-beta'): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/rates/best', {
      params: { network },
    });
    return response.data.data;
  }

  // ==========================================
  // Positions Endpoints
  // ==========================================

  async getPositionQuote(params: {
    walletAddress: string;
    collateralToken: string;
    collateralAmount: number;
    borrowToken: string;
    leverage: number;
    network?: string;
    protocol?: string;
  }): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>('/positions/quote', params);
    return response.data.data;
  }

  async openPosition(params: {
    walletAddress: string;
    protocol: string;
    collateralToken: string;
    collateralMint: string;
    collateralAmount: number;
    borrowToken: string;
    borrowMint: string;
    borrowAmount: number;
    leverage: number;
    slippageBps?: number;
    network?: string;
    autoMonitor?: boolean;
    enableAlerts?: boolean;
  }): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>('/positions/open', params);
    return response.data;
  }

  async getUserPositions(walletAddress: string, params?: { status?: string; network?: string }): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>('/positions', {
      params: { walletAddress, ...params },
    });
    return response.data.data || [];
  }

  async getPosition(id: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/positions/${id}`);
    return response.data.data;
  }

  async closePosition(id: string, params: { walletAddress: string; slippageBps?: number; network?: string }): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/positions/${id}/close`, params);
    return response.data;
  }

  // ==========================================
  // Portfolio Endpoints
  // ==========================================

  async getPortfolio(walletAddress: string, network: string = 'mainnet-beta'): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/portfolio', {
      params: { walletAddress, network },
    });
    return response.data.data;
  }

  async getPortfolioPositions(walletAddress: string, network: string = 'mainnet-beta'): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>('/portfolio/positions', {
      params: { walletAddress, network },
    });
    return response.data.data || [];
  }

  async getPortfolioHistory(walletAddress: string, days: number = 30, network: string = 'mainnet-beta'): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>('/portfolio/history', {
      params: { walletAddress, days, network },
    });
    return response.data.data || [];
  }

  async getPortfolioPnL(walletAddress: string, network: string = 'mainnet-beta'): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/portfolio/pnl', {
      params: { walletAddress, network },
    });
    return response.data.data;
  }
}

// Export singleton instance
export const api = new ApiService();
export default api;
