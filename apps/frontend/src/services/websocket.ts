/**
 * WebSocket Service
 * Handles real-time updates from the backend
 */

import { io, Socket } from 'socket.io-client';

// Event types
export type WebSocketEvent =
  | 'account:update'
  | 'alert:new'
  | 'alert:resolved'
  | 'protection:started'
  | 'protection:completed'
  | 'stats:update'
  | 'price:update'
  | 'hvix:update';

// Event payloads
export interface AccountUpdatePayload {
  walletAddress: string;
  healthFactor: number;
  riskScore: number;
  leverage: number;
  timestamp: number;
}

export interface AlertPayload {
  id: string;
  walletAddress: string;
  severity: string;
  message: string;
  riskScore: number;
  timestamp: number;
}

export interface ProtectionPayload {
  id: string;
  walletAddress: string;
  status: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  mevSaved?: number;
  timestamp: number;
}

export interface StatsPayload {
  totalAccounts: number;
  activeAlerts: number;
  atRiskAccounts: number;
  totalMevSaved: number;
  timestamp: number;
}

export interface PricePayload {
  token: string;
  price: number;
  change24h?: number;
  timestamp: number;
}

export interface HvixPayload {
  value: number;
  level: string;
  timestamp: number;
}

// Callback types
type EventCallback<T> = (data: T) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private eventListeners: Map<string, Set<EventCallback<any>>> = new Map();

  /**
   * Connect to WebSocket server
   */
  connect(url?: string): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    const wsUrl = url || import.meta.env.VITE_WS_URL || 'http://localhost:3001';

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyListeners('connected', { clientId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.notifyListeners('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      this.notifyListeners('error', { error: error.message });
    });

    // Application events
    this.socket.on('account:update', (data: AccountUpdatePayload) => {
      this.notifyListeners('account:update', data);
    });

    this.socket.on('alert:new', (data: AlertPayload) => {
      this.notifyListeners('alert:new', data);
    });

    this.socket.on('alert:resolved', (data: AlertPayload) => {
      this.notifyListeners('alert:resolved', data);
    });

    this.socket.on('protection:started', (data: ProtectionPayload) => {
      this.notifyListeners('protection:started', data);
    });

    this.socket.on('protection:completed', (data: ProtectionPayload) => {
      this.notifyListeners('protection:completed', data);
    });

    this.socket.on('stats:update', (data: StatsPayload) => {
      this.notifyListeners('stats:update', data);
    });

    this.socket.on('price:update', (data: PricePayload) => {
      this.notifyListeners('price:update', data);
    });

    this.socket.on('hvix:update', (data: HvixPayload) => {
      this.notifyListeners('hvix:update', data);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Subscribe to account updates
   */
  subscribeToAccount(walletAddress: string): void {
    this.socket?.emit('subscribe:account', walletAddress);
  }

  /**
   * Unsubscribe from account updates
   */
  unsubscribeFromAccount(walletAddress: string): void {
    this.socket?.emit('unsubscribe:account', walletAddress);
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(): void {
    this.socket?.emit('subscribe:alerts');
  }

  /**
   * Unsubscribe from alerts
   */
  unsubscribeFromAlerts(): void {
    this.socket?.emit('unsubscribe:alerts');
  }

  /**
   * Subscribe to stats updates
   */
  subscribeToStats(): void {
    this.socket?.emit('subscribe:stats');
  }

  /**
   * Subscribe to price updates
   */
  subscribeToPrices(): void {
    this.socket?.emit('subscribe:prices');
  }

  /**
   * Add event listener
   */
  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remove event listener
   */
  off<T>(event: string, callback: EventCallback<T>): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Notify all listeners for an event
   */
  private notifyListeners(event: string, data: any): void {
    this.eventListeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in WebSocket listener for ${event}:`, error);
      }
    });
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Export singleton instance
export const websocket = new WebSocketService();
export default websocket;
