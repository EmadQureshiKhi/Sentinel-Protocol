import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

type Network = 'mainnet-beta' | 'devnet';

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  rpcEndpoint: string;
  toggleNetwork: () => void;
  isMainnet: boolean;
  isDevnet: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const STORAGE_KEY = 'sentinel_network';

const RPC_ENDPOINTS: Record<Network, string> = {
  'mainnet-beta': import.meta.env.VITE_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
  devnet: import.meta.env.VITE_DEVNET_RPC_URL || 'https://api.devnet.solana.com',
};

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  const [network, setNetworkState] = useState<Network>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'mainnet-beta' || saved === 'devnet') {
        return saved;
      }
    }
    return 'devnet';
  });

  // Persist network choice
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, network);
    }
  }, [network]);

  const setNetwork = useCallback(
    (newNetwork: Network) => {
      if (newNetwork !== network) {
        setNetworkState(newNetwork);
        // Clear all cached queries when network changes
        queryClient.clear();
      }
    },
    [network, queryClient]
  );

  const toggleNetwork = useCallback(() => {
    const newNetwork = network === 'mainnet-beta' ? 'devnet' : 'mainnet-beta';
    setNetwork(newNetwork);
  }, [network, setNetwork]);

  const rpcEndpoint = useMemo(() => RPC_ENDPOINTS[network], [network]);
  const isMainnet = network === 'mainnet-beta';
  const isDevnet = network === 'devnet';

  const value = useMemo(
    () => ({
      network,
      setNetwork,
      rpcEndpoint,
      toggleNetwork,
      isMainnet,
      isDevnet,
    }),
    [network, setNetwork, rpcEndpoint, toggleNetwork, isMainnet, isDevnet]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};
