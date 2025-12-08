import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletProvider, NetworkProvider, ToastProvider } from './contexts';
import App from './App';
import './index.css';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

// Get network from localStorage or default to devnet
const network = (localStorage.getItem('solana_network') || 'devnet') as 'mainnet-beta' | 'devnet';
const endpoint = network === 'mainnet-beta'
  ? import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

// Wallet adapters
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <ConnectionProvider endpoint={endpoint}>
          <SolanaWalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <WalletProvider>
                <ToastProvider>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </ToastProvider>
              </WalletProvider>
            </WalletModalProvider>
          </SolanaWalletProvider>
        </ConnectionProvider>
      </NetworkProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
