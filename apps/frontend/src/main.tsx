import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletProvider, NetworkProvider, ToastProvider, useNetwork } from './contexts';
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

// Wallet adapters
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

// Inner component that uses network context for dynamic endpoint
const SolanaProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { rpcEndpoint } = useNetwork();
  
  return (
    <ConnectionProvider endpoint={rpcEndpoint} config={{ commitment: 'confirmed' }}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <SolanaProviders>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </SolanaProviders>
      </NetworkProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
