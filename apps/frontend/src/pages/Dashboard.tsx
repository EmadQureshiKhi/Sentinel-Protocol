/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';
import { StatsOverview, AccountCard, AlertFeed } from '../components/dashboard';
import { Modal } from '../components/common';
import { useAccounts, useAddAccount } from '../hooks/useAccounts';
import { useWebSocket } from '../hooks/useWebSocket';
import { Plus, Circle } from '@phosphor-icons/react';

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [newProtocol, setNewProtocol] = useState<'DRIFT' | 'MARGINFI' | 'SOLEND'>('DRIFT');
  
  const { data: accounts, isLoading } = useAccounts({ isActive: true });
  const addAccountMutation = useAddAccount();
  const wsState = useWebSocket();

  const handleAddAccount = async () => {
    if (!newWallet) return;
    
    try {
      await addAccountMutation.mutateAsync({
        walletAddress: newWallet,
        protocol: newProtocol,
      });
      setIsAddModalOpen(false);
      setNewWallet('');
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  };

  return (
    <div
      css={css`
        min-height: 100vh;
        padding: 2rem;
      `}
    >
      <div
        css={css`
          max-width: 1400px;
          margin: 0 auto;
        `}
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
          `}
        >
          <div>
            <h1
              css={css`
                font-size: 2rem;
                font-weight: 700;
                color: #fff;
                margin-bottom: 0.5rem;
              `}
            >
              Dashboard
            </h1>
            <p
              css={css`
                color: #a0a0a0;
                font-size: 0.9375rem;
              `}
            >
              Monitor and protect your DeFi positions
            </p>
          </div>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 1rem;
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                background: rgba(12, 13, 16, 0.6);
                border: 1px solid ${wsState.isConnected ? 'rgba(220, 253, 143, 0.3)' : 'rgba(255, 100, 100, 0.3)'};
                border-radius: 8px;
                backdrop-filter: blur(20px);
              `}
            >
              <Circle
                size={8}
                weight="fill"
                color={wsState.isConnected ? '#dcfd8f' : '#ff6464'}
              />
              <span
                css={css`
                  font-size: 0.875rem;
                  color: ${wsState.isConnected ? '#dcfd8f' : '#ff6464'};
                  font-weight: 600;
                `}
              >
                {wsState.isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.5rem;
                background: #dcfd8f;
                color: #0a0e27;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                font-size: 0.9375rem;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 8px 24px rgba(220, 253, 143, 0.3);
                }
              `}
            >
              <Plus size={20} weight="bold" />
              Add Account
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div
          css={css`
            margin-bottom: 2rem;
          `}
        >
          <StatsOverview />
        </div>

        {/* Main Content */}
        <div
          css={css`
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1.5rem;

            @media (max-width: 1024px) {
              grid-template-columns: 1fr;
            }
          `}
        >
          {/* Accounts Grid */}
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <h2
              css={css`
                font-size: 1.25rem;
                font-weight: 600;
                color: #fff;
                margin-bottom: 1.5rem;
              `}
            >
              Monitored Accounts
            </h2>
            
            {isLoading ? (
              <div
                css={css`
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                  gap: 1rem;
                `}
              >
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    css={css`
                      background: rgba(255, 255, 255, 0.03);
                      border: 1px solid rgba(255, 255, 255, 0.1);
                      border-radius: 12px;
                      padding: 1rem;
                      animation: pulse 2s infinite;

                      @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                      }
                    `}
                  >
                    <div css={css`height: 80px;`} />
                  </div>
                ))}
              </div>
            ) : accounts && accounts.length > 0 ? (
              <div
                css={css`
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                  gap: 1rem;
                `}
              >
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onClick={() => {
                      window.location.href = `/account/${account.walletAddress}`;
                    }}
                  />
                ))}
              </div>
            ) : (
              <div
                css={css`
                  text-align: center;
                  padding: 3rem 1rem;
                `}
              >
                <span css={css`font-size: 3rem;`}>🛡️</span>
                <p
                  css={css`
                    color: #a0a0a0;
                    margin-top: 1rem;
                    margin-bottom: 0.5rem;
                  `}
                >
                  No accounts monitored yet
                </p>
                <p
                  css={css`
                    font-size: 0.875rem;
                    color: #666;
                    margin-bottom: 1.5rem;
                  `}
                >
                  Add a wallet address to start monitoring
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  css={css`
                    padding: 0.75rem 1.5rem;
                    background: #dcfd8f;
                    color: #0a0e27;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover {
                      transform: translateY(-2px);
                      box-shadow: 0 8px 24px rgba(220, 253, 143, 0.3);
                    }
                  `}
                >
                  Add Your First Account
                </button>
              </div>
            )}
          </div>

          {/* Alert Feed */}
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <h2
              css={css`
                font-size: 1.25rem;
                font-weight: 600;
                color: #fff;
                margin-bottom: 1.5rem;
              `}
            >
              Active Alerts
            </h2>
            <AlertFeed />
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Account to Monitor"
      >
        <div css={css`display: flex; flex-direction: column; gap: 1rem;`}>
          <div>
            <label css={css`display: block; font-size: 0.875rem; color: #a0a0a0; margin-bottom: 0.5rem;`}>
              Wallet Address
            </label>
            <input
              type="text"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              placeholder="Enter Solana wallet address"
              css={css`
                width: 100%;
                padding: 0.75rem 1rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #fff;
                font-size: 0.9375rem;

                &::placeholder {
                  color: #666;
                }

                &:focus {
                  outline: none;
                  border-color: #dcfd8f;
                }
              `}
            />
          </div>
          
          <div>
            <label css={css`display: block; font-size: 0.875rem; color: #a0a0a0; margin-bottom: 0.5rem;`}>
              Protocol
            </label>
            <select
              value={newProtocol}
              onChange={(e) => setNewProtocol(e.target.value as any)}
              css={css`
                width: 100%;
                padding: 0.75rem 1rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #fff;
                font-size: 0.9375rem;

                &:focus {
                  outline: none;
                  border-color: #dcfd8f;
                }
              `}
            >
              <option value="DRIFT">Drift</option>
              <option value="MARGINFI">Marginfi</option>
              <option value="SOLEND">Solend</option>
            </select>
          </div>

          <div css={css`display: flex; gap: 0.75rem; margin-top: 1rem;`}>
            <button
              onClick={() => setIsAddModalOpen(false)}
              css={css`
                flex: 1;
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #fff;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 255, 255, 0.1);
                }
              `}
            >
              Cancel
            </button>
            <button
              onClick={handleAddAccount}
              disabled={!newWallet || addAccountMutation.isPending}
              css={css`
                flex: 1;
                padding: 0.75rem;
                background: #dcfd8f;
                color: #0a0e27;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover:not(:disabled) {
                  transform: translateY(-2px);
                  box-shadow: 0 8px 24px rgba(220, 253, 143, 0.3);
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
              `}
            >
              {addAccountMutation.isPending ? 'Adding...' : 'Add Account'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
