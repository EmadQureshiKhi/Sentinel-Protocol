/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Plus } from '@phosphor-icons/react';
import { Modal } from '../components/common';
import { useAccounts, useAddAccount } from '../hooks/useAccounts';

export default function Accounts() {
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [newProtocol, setNewProtocol] = useState<'DRIFT' | 'MARGINFI' | 'SOLEND'>('DRIFT');
  
  const { data: accounts, isLoading } = useAccounts({ isActive: true });
  const addAccountMutation = useAddAccount();

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

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return '#ff6464';
    if (riskScore >= 40) return '#ffa500';
    return '#dcfd8f';
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
              Monitored Accounts
            </h1>
            <p
              css={css`
                color: #a0a0a0;
                font-size: 0.9375rem;
              `}
            >
              Track and protect your DeFi positions across protocols
            </p>
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

        {/* Accounts Grid */}
        {isLoading ? (
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
              gap: 1.5rem;
            `}
          >
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                css={css`
                  background: rgba(12, 13, 16, 0.6);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 16px;
                  padding: 1.5rem;
                  backdrop-filter: blur(20px);
                  animation: pulse 2s infinite;

                  @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                  }
                `}
              >
                <div css={css`height: 100px;`} />
              </div>
            ))}
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
              gap: 1.5rem;
            `}
          >
            {accounts.map((account) => {
              const latestSnapshot = account.snapshots?.[0];
              const totalValue = latestSnapshot ? (latestSnapshot.collateralValue + latestSnapshot.borrowedValue) : 0;
              const healthFactor = latestSnapshot?.healthFactor;
              const riskScore = latestSnapshot?.riskScore || 0;

              return (
              <div
                key={account.id}
                onClick={() => navigate(`/account/${account.walletAddress}`)}
                css={css`
                  background: rgba(12, 13, 16, 0.8);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 16px;
                  padding: 1.5rem;
                  backdrop-filter: blur(20px);
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    transform: translateY(-4px);
                    border-color: rgba(220, 253, 143, 0.3);
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
                  }
                `}
              >
                {/* Header */}
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                  `}
                >
                  <div>
                    <div
                      css={css`
                        font-family: 'Courier New', monospace;
                        font-size: 0.875rem;
                        color: #dcfd8f;
                        margin-bottom: 0.25rem;
                      `}
                    >
                      {account.walletAddress.slice(0, 6)}...{account.walletAddress.slice(-4)}
                    </div>
                    <div
                      css={css`
                        display: inline-block;
                        padding: 0.25rem 0.75rem;
                        background: rgba(220, 253, 143, 0.1);
                        border: 1px solid rgba(220, 253, 143, 0.3);
                        border-radius: 6px;
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: #dcfd8f;
                      `}
                    >
                      {account.protocol}
                    </div>
                  </div>
                  <Shield size={24} color="#dcfd8f" weight="fill" />
                </div>

                {/* Stats */}
                <div
                  css={css`
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                  `}
                >
                  <div>
                    <div
                      css={css`
                        font-size: 0.75rem;
                        color: #a0a0a0;
                        margin-bottom: 0.25rem;
                      `}
                    >
                      Total Value
                    </div>
                    <div
                      css={css`
                        font-size: 1.25rem;
                        font-weight: 700;
                        color: #fff;
                      `}
                    >
                      ${totalValue.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div
                      css={css`
                        font-size: 0.75rem;
                        color: #a0a0a0;
                        margin-bottom: 0.25rem;
                      `}
                    >
                      Health Factor
                    </div>
                    <div
                      css={css`
                        font-size: 1.25rem;
                        font-weight: 700;
                        color: ${healthFactor && healthFactor < 1.5 ? '#ff6464' : '#dcfd8f'};
                      `}
                    >
                      {healthFactor?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Risk Score */}
                <div>
                  <div
                    css={css`
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      margin-bottom: 0.5rem;
                    `}
                  >
                    <span
                      css={css`
                        font-size: 0.75rem;
                        color: #a0a0a0;
                      `}
                    >
                      Risk Score
                    </span>
                    <span
                      css={css`
                        font-size: 0.875rem;
                        font-weight: 700;
                        color: ${getRiskColor(riskScore)};
                      `}
                    >
                      {riskScore}%
                    </span>
                  </div>
                  <div
                    css={css`
                      height: 6px;
                      background: rgba(255, 255, 255, 0.1);
                      border-radius: 3px;
                      overflow: hidden;
                    `}
                  >
                    <div
                      css={css`
                        height: 100%;
                        width: ${riskScore}%;
                        background: ${getRiskColor(riskScore)};
                        border-radius: 3px;
                        transition: width 0.3s;
                      `}
                    />
                  </div>
                </div>

                {/* Status */}
                <div
                  css={css`
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8125rem;
                    color: ${account.isActive ? '#dcfd8f' : '#a0a0a0'};
                  `}
                >
                  <div
                    css={css`
                      width: 6px;
                      height: 6px;
                      border-radius: 50%;
                      background: ${account.isActive ? '#dcfd8f' : '#a0a0a0'};
                    `}
                  />
                  {account.isActive ? 'Monitoring Active' : 'Monitoring Paused'}
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <div
            css={css`
              text-align: center;
              padding: 4rem 2rem;
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              backdrop-filter: blur(20px);
            `}
          >
            <Shield size={64} color="#a0a0a0" weight="thin" />
            <h3
              css={css`
                font-size: 1.25rem;
                font-weight: 600;
                color: #fff;
                margin-top: 1rem;
                margin-bottom: 0.5rem;
              `}
            >
              No Accounts Monitored
            </h3>
            <p
              css={css`
                color: #a0a0a0;
                margin-bottom: 1.5rem;
              `}
            >
              Add your first account to start protecting your positions
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
