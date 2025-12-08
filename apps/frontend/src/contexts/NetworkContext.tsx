import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { clusterApiUrl } from '@solana/web3.js';

type Network = 'mainnet-beta' | 'devnet';

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  rpcEndpoint: string;
  toggleNetwork: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const RPC_ENDPOINTS: Record<Network, string> = {
  'mainnet-beta': clusterApiUrl('mainnet-beta'),
  'devnet': clusterApiUrl('devnet'),
};

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [network, setNetworkState] = useState<Network>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('solana_network');
      if (saved === 'mainnet-beta' || saved === 'devnet') {
        return saved;
      }
    }
    return 'devnet';
  });

  const setNetwork = useCallback((newNetwork: Network) => {
    setNetworkState(newNetwork);
    if (typeof window !== 'undefined') {
      localStorage.setItem('solana_network', newNetwork);
    }
    // Reload to apply new network
    window.location.reload();
  }, []);

  const toggleNetwork = useCallback(() => {
    const newNetwork = network === 'mainnet-beta' ? 'devnet' : 'mainnet-beta';
    setNetwork(newNetwork);
  }, [network, setNetwork]);

  const rpcEndpoint = useMemo(() => RPC_ENDPOINTS[network], [network]);

  const value = useMemo(() => ({
    network,
    setNetwork,
    rpcEndpoint,
    toggleNetwork,
  }), [network, setNetwork, rpcEndpoint, toggleNetwork]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};
