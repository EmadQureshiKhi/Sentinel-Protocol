import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { reconnectWithBackoff } from '../../utils/retry';
import { config } from '../../config';
import { PROGRAMS, Protocol, TIMING } from '../../config/constants';

// Types for Geyser messages
interface GeyserMessage {
  jsonrpc: string;
  method?: string;
  params?: {
    result: {
      context: { slot: number };
      value: {
        pubkey: string;
        account: {
          data: [string, string]; // [base64 data, encoding]
          executable: boolean;
          lamports: number;
          owner: string;
          rentEpoch: number;
        };
      };
    };
    subscription: number;
  };
  result?: number | any;
  id?: number;
}

// Account data structure
export interface MonitoredAccountData {
  walletAddress: string;
  protocol: Protocol;
  lamports: number;
  data: string;
  owner: string;
  slot: number;
  lastUpdated: Date;
}

export class GeyserMonitor extends EventEmitter {
  private ws: WebSocket | null = null;
  private heliusApiKey: string;
  private heliusUrl: string;
  private isConnected: boolean = false;
  private isShuttingDown: boolean = false;
  private subscriptionId: number = 0;
  
  // Track monitored wallets and their data
  private monitoredWallets: Set<string> = new Set();
  private accountCache: Map<string, MonitoredAccountData> = new Map();
  private walletSubscriptions: Map<string, number> = new Map();
  private protocolSubscriptions: Map<Protocol, number> = new Map();

  constructor(apiKey?: string, geyserUrl?: string) {
    super();
    this.heliusApiKey = apiKey || config.heliusApiKey;
    this.heliusUrl = geyserUrl || config.heliusGeyserUrl;
  }

  /**
   * Initialize WebSocket connection to Helius Geyser
   */
  async initialize(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Geyser monitor already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      // Use URL directly if it already contains api-key, otherwise append it
      const wsUrl = this.heliusUrl.includes('api-key') 
        ? this.heliusUrl 
        : `${this.heliusUrl}?api-key=${this.heliusApiKey}`;
      
      logger.info('Connecting to Helius Geyser...', { url: this.heliusUrl });
      
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        logger.info('✅ Helius Geyser WebSocket connected');
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as GeyserMessage;
          this._handleGeyserMessage(message);
        } catch (error) {
          logger.error('Failed to parse Geyser message:', error);
        }
      });

      this.ws.on('error', (error: Error) => {
        logger.error('❌ WebSocket error:', error);
        this.emit('error', error);
        if (!this.isConnected) {
          reject(error);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.isConnected = false;
        logger.warn(`WebSocket closed: ${code} - ${reason.toString()}`);
        this.emit('disconnected', { code, reason: reason.toString() });
        
        // Auto-reconnect if not shutting down
        if (!this.isShuttingDown) {
          this._handleReconnect();
        }
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }


  /**
   * Handle auto-reconnection with exponential backoff
   */
  private async _handleReconnect(): Promise<void> {
    logger.info('Attempting to reconnect to Geyser...');
    
    await reconnectWithBackoff(
      async () => {
        await this.initialize();
        // Re-subscribe to all protocols and wallets
        await this._resubscribeAll();
      },
      {
        baseDelayMs: TIMING.GEYSER_RECONNECT_BASE_MS,
        maxDelayMs: TIMING.GEYSER_RECONNECT_MAX_MS,
        onAttempt: (attempt, delay) => {
          logger.info(`Reconnection attempt ${attempt}, next retry in ${delay}ms`);
        },
      }
    );
  }

  /**
   * Re-subscribe to all protocols and wallets after reconnection
   */
  private async _resubscribeAll(): Promise<void> {
    // Re-subscribe to protocols
    for (const protocol of this.protocolSubscriptions.keys()) {
      await this.subscribeToProtocol(protocol);
    }
    
    // Re-subscribe to individual wallets
    for (const wallet of this.monitoredWallets) {
      await this._subscribeToAccount(wallet);
    }
    
    logger.info('Re-subscribed to all protocols and wallets');
  }

  /**
   * Subscribe to a DeFi protocol's program account updates
   */
  async subscribeToProtocol(protocol: Protocol): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const programId = PROGRAMS[protocol];
    if (!programId) {
      throw new Error(`Unknown protocol: ${protocol}`);
    }

    const subscriptionRequest = {
      jsonrpc: '2.0',
      id: ++this.subscriptionId,
      method: 'programSubscribe',
      params: [
        programId,
        {
          encoding: 'base64',
          commitment: 'processed',
        },
      ],
    };

    this.ws.send(JSON.stringify(subscriptionRequest));
    this.protocolSubscriptions.set(protocol, this.subscriptionId);
    
    logger.info(`📡 Subscribed to ${protocol} program: ${programId}`);
  }

  /**
   * Add a wallet to monitoring
   */
  async addWalletToMonitor(walletAddress: string, protocol: Protocol = 'DRIFT'): Promise<void> {
    if (this.monitoredWallets.has(walletAddress)) {
      logger.debug(`Wallet already monitored: ${walletAddress}`);
      return;
    }

    this.monitoredWallets.add(walletAddress);
    
    // Initialize cache entry
    this.accountCache.set(walletAddress, {
      walletAddress,
      protocol,
      lamports: 0,
      data: '',
      owner: '',
      slot: 0,
      lastUpdated: new Date(),
    });

    // Subscribe to account updates
    await this._subscribeToAccount(walletAddress);
    
    logger.info(`👁️ Monitoring wallet: ${walletAddress} (${protocol})`);
    this.emit('walletAdded', { walletAddress, protocol });
  }

  /**
   * Subscribe to individual account updates
   */
  private async _subscribeToAccount(walletAddress: string): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const subscriptionRequest = {
      jsonrpc: '2.0',
      id: ++this.subscriptionId,
      method: 'accountSubscribe',
      params: [
        walletAddress,
        {
          encoding: 'base64',
          commitment: 'processed',
        },
      ],
    };

    this.ws.send(JSON.stringify(subscriptionRequest));
    this.walletSubscriptions.set(walletAddress, this.subscriptionId);
  }

  /**
   * Remove a wallet from monitoring
   */
  async removeWalletFromMonitor(walletAddress: string): Promise<void> {
    if (!this.monitoredWallets.has(walletAddress)) {
      return;
    }

    this.monitoredWallets.delete(walletAddress);
    this.accountCache.delete(walletAddress);
    
    // Unsubscribe from account updates
    const subscriptionId = this.walletSubscriptions.get(walletAddress);
    if (subscriptionId && this.ws && this.isConnected) {
      const unsubscribeRequest = {
        jsonrpc: '2.0',
        id: ++this.subscriptionId,
        method: 'accountUnsubscribe',
        params: [subscriptionId],
      };
      this.ws.send(JSON.stringify(unsubscribeRequest));
    }
    
    this.walletSubscriptions.delete(walletAddress);
    
    logger.info(`🔕 Stopped monitoring wallet: ${walletAddress}`);
    this.emit('walletRemoved', { walletAddress });
  }

  /**
   * Handle incoming Geyser messages
   */
  private _handleGeyserMessage(message: GeyserMessage): void {
    // Handle subscription confirmations
    if (message.result !== undefined && message.id) {
      logger.debug(`Subscription confirmed: ${message.id} -> ${message.result}`);
      return;
    }

    // Handle account notifications
    if (message.method === 'accountNotification' && message.params) {
      const { result, subscription } = message.params;
      const { value, context } = result;
      
      const walletAddress = value.pubkey;
      const accountData = value.account;
      
      // Update cache if this is a monitored wallet
      if (this.monitoredWallets.has(walletAddress)) {
        const existingData = this.accountCache.get(walletAddress);
        
        const updatedData: MonitoredAccountData = {
          walletAddress,
          protocol: existingData?.protocol || 'DRIFT',
          lamports: accountData.lamports,
          data: accountData.data[0], // base64 encoded data
          owner: accountData.owner,
          slot: context.slot,
          lastUpdated: new Date(),
        };
        
        this.accountCache.set(walletAddress, updatedData);
        
        logger.debug(`📊 Account update: ${walletAddress.slice(0, 8)}... slot: ${context.slot}`);
        
        // Emit event for listeners
        this.emit('accountUpdate', updatedData);
      }
    }

    // Handle program notifications (for protocol-wide monitoring)
    if (message.method === 'programNotification' && message.params) {
      const { result, subscription } = message.params;
      this.emit('programUpdate', result);
    }
  }

  /**
   * Get all monitored accounts
   */
  getMonitoredAccounts(): MonitoredAccountData[] {
    return Array.from(this.accountCache.values());
  }

  /**
   * Get a specific account by wallet address
   */
  getAccount(walletAddress: string): MonitoredAccountData | undefined {
    return this.accountCache.get(walletAddress);
  }

  /**
   * Get list of monitored wallet addresses
   */
  getMonitoredWallets(): string[] {
    return Array.from(this.monitoredWallets);
  }

  /**
   * Check if connected
   */
  isConnectedToGeyser(): boolean {
    return this.isConnected;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.monitoredWallets.clear();
    this.accountCache.clear();
    this.walletSubscriptions.clear();
    this.protocolSubscriptions.clear();
    
    logger.info('🔌 Geyser monitor shut down');
    this.emit('shutdown');
  }
}

export default GeyserMonitor;
