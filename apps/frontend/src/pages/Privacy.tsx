/**
 * Privacy Page
 * Main page for Arcium privacy features - Black & Yellow theme
 */

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PrivacyStatus } from '../components/privacy/PrivacyStatus';
import { DarkPoolPanel } from '../components/privacy/DarkPoolPanel';
import { EncryptedOrderFlowPanel } from '../components/privacy/EncryptedOrderFlowPanel';
import { PrivateSwapModal } from '../components/privacy/PrivateSwapModal';

const Privacy: React.FC = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const [showSwapModal, setShowSwapModal] = useState(false);

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--clr-primary)' }}>
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
              Arcium Privacy Layer
            </h1>
            <p style={{ color: 'var(--text-secondary)' }} className="mt-1">Powered by Multi-Party Execution (MXE)</p>
          </div>
          <button
            onClick={() => setShowSwapModal(true)}
            className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
            style={{ 
              background: 'var(--clr-primary)', 
              color: '#000000',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Private Swap
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <PrivacyStatus />
          <EncryptedOrderFlowPanel walletAddress={walletAddress} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DarkPoolPanel walletAddress={walletAddress} />
          
          <div className="rounded-lg p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
              Privacy Features
            </h3>
            
            <div className="space-y-3">
              <FeatureItem
                title="Encrypted Order Flow"
                description="Transactions batched and encrypted before execution"
                icon="⚡"
                active
              />
              <FeatureItem
                title="Private Position Monitoring"
                description="Health checks on encrypted position data via MPC"
                icon="👁️"
                active
              />
              <FeatureItem
                title="Private Protective Swaps"
                description="MEV-protected swaps with MPC-signed transactions"
                icon="🔄"
                active
              />
              <FeatureItem
                title="Dark Pool Trading"
                description="Private order matching without public orderbook"
                icon="🌙"
                active
              />
            </div>

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
              <p style={{ color: 'var(--text-tertiary)' }} className="text-xs">
                All privacy features powered by Arcium's Multi-Party Execution (MXE) network. 
                Data is encrypted client-side and processed by distributed MXE nodes without 
                revealing sensitive information.
              </p>
            </div>
          </div>
        </div>

        <div 
          className="mt-6 rounded-lg p-6"
          style={{ 
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)'
          }}
        >
          <div className="flex items-start gap-4">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--bg-hover)' }}
            >
              <svg className="w-6 h-6" style={{ color: 'var(--clr-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold mb-1" style={{ color: 'var(--clr-primary)' }}>How Arcium Privacy Works</h4>
              <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
                Arcium uses Multi-Party Execution (MXE) to process encrypted data across a network of nodes. 
                Your position data, swap intents, and orders are encrypted before leaving your device. 
                MXE nodes perform computations on encrypted data using secure multi-party computation (MPC), 
                ensuring no single party ever sees your plaintext data. Results are verified using zero-knowledge 
                proofs before execution on-chain.
              </p>
            </div>
          </div>
        </div>
      </div>

      <PrivateSwapModal
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        walletAddress={walletAddress}
      />
    </div>
  );
};

const FeatureItem: React.FC<{
  title: string;
  description: string;
  icon: string;
  active: boolean;
}> = ({ title, description, icon, active }) => (
  <div 
    className="flex items-start gap-3 p-3 rounded-lg"
    style={{ 
      background: active ? 'rgba(234, 179, 8, 0.1)' : 'var(--bg-hover)',
      border: active ? '1px solid rgba(234, 179, 8, 0.2)' : '1px solid transparent'
    }}
  >
    <span className="text-xl">{icon}</span>
    <div className="flex-1">
      <p className="font-medium" style={{ color: active ? 'var(--clr-primary)' : 'var(--text-secondary)' }}>{title}</p>
      <p style={{ color: 'var(--text-tertiary)' }} className="text-xs">{description}</p>
    </div>
    {active && (
      <span 
        className="text-xs px-2 py-0.5 rounded"
        style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--clr-primary)' }}
      >
        Active
      </span>
    )}
  </div>
);

export default Privacy;
