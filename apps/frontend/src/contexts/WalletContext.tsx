import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';

export interface Token {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logo?: string;
  price?: number;
  mint?: string;
}

export interface WalletAccount {
  publicKey: string;
  balance: string;
  tokens: Token[];
}

export interface WalletInfo {
  id: 'phantom' | 'solflare';
  name: string;
  icon: string;
  isInstalled: boolean;
  isRecommended?: boolean;
}

export interface WalletConnection {
  wallet: WalletInfo;
  account: WalletAccount;
  network: 'mainnet-beta' | 'devnet';
}

interface WalletContextType {
  connection: WalletConnection | null;
  isConnecting: boolean;
  error: string | null;
  installedWallets: WalletInfo[];
  connect: (walletId: 'phantom' | 'solflare') => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { publicKey, connected, disconnect: solanaDisconnect, select, wallet } = useSolanaWallet();
  const { connection: solanaConnection } = useConnection();
  
  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<WalletInfo[]>([]);

  // Detect installed wallets
  useEffect(() => {
    const detectWallets = () => {
      const detected: WalletInfo[] = [];
      
      // Check for Phantom
      if (typeof window !== 'undefined' && (window as any).phantom?.solana) {
        detected.push({
          id: 'phantom',
          name: 'Phantom',
          icon: '/assets/wallets/phantom.svg',
          isInstalled: true,
          isRecommended: true,
        });
      }

      // Check for Solflare
      if (typeof window !== 'undefined' && (window as any).solflare) {
        detected.push({
          id: 'solflare',
          name: 'Solflare',
          icon: '/assets/wallets/solflare.svg',
          isInstalled: true,
        });
      }

      setInstalledWallets(detected);
    };

    detectWallets();
    // Re-detect after a short delay (in case extensions load slowly)
    const timer = setTimeout(detectWallets, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch SOL balance
  const fetchBalance = useCallback(async (pubKey: PublicKey): Promise<string> => {
    try {
      const balance = await solanaConnection.getBalance(pubKey);
      return (balance / LAMPORTS_PER_SOL).toFixed(4);
    } catch (err) {
      console.error('Error fetching balance:', err);
      return '0';
    }
  }, [solanaConnection]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!publicKey || !walletConnection) return;
    
    const balance = await fetchBalance(publicKey);
    setWalletConnection(prev => prev ? {
      ...prev,
      account: { ...prev.account, balance }
    } : null);
  }, [publicKey, walletConnection, fetchBalance]);

  // Update wallet connection when Solana wallet connects
  useEffect(() => {
    const updateConnection = async () => {
      if (connected && publicKey && wallet) {
        const balance = await fetchBalance(publicKey);
        const network = (localStorage.getItem('solana_network') || 'devnet') as 'mainnet-beta' | 'devnet';
        
        const walletId = wallet.adapter.name.toLowerCase().includes('phantom') ? 'phantom' : 'solflare';
        
        setWalletConnection({
          wallet: {
            id: walletId as 'phantom' | 'solflare',
            name: wallet.adapter.name,
            icon: `/assets/wallets/${walletId}.svg`,
            isInstalled: true,
          },
          account: {
            publicKey: publicKey.toBase58(),
            balance,
            tokens: [{
              symbol: 'SOL',
              name: 'Solana',
              balance,
              decimals: 9,
              logo: '/assets/tokens/sol.svg',
            }],
          },
          network,
        });

        // Store in localStorage for persistence
        localStorage.setItem('liquidation_shield_wallet', walletId);
      } else {
        setWalletConnection(null);
      }
    };

    updateConnection();
  }, [connected, publicKey, wallet, fetchBalance]);

  const connect = useCallback(async (walletId: 'phantom' | 'solflare') => {
    setIsConnecting(true);
    setError(null);

    try {
      // Select the wallet adapter
      const walletName = walletId === 'phantom' ? 'Phantom' : 'Solflare';
      select(walletName as any);
      
      // The actual connection happens through the wallet adapter
      // The useEffect above will handle updating the state
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [select]);

  const disconnect = useCallback(async () => {
    try {
      await solanaDisconnect();
      setWalletConnection(null);
      localStorage.removeItem('liquidation_shield_wallet');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to disconnect wallet';
      setError(errorMessage);
      console.error('Wallet disconnect error:', err);
    }
  }, [solanaDisconnect]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(() => ({
    connection: walletConnection,
    isConnecting,
    error,
    installedWallets,
    connect,
    disconnect,
    clearError,
    refreshBalance,
  }), [walletConnection, isConnecting, error, installedWallets, connect, disconnect, clearError, refreshBalance]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
