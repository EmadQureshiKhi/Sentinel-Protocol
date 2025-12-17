/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatsOverview, AlertFeed } from '../components/dashboard';
import { Modal } from '../components/common';
import { useAccounts, useAddAccount, useRemoveAccount } from '../hooks/useAccounts';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  Plus, 
  Circle, 
  Shield, 
  Wallet, 
  TrendUp, 
  Warning,
  Trash,
  Eye,
  ArrowRight,
  Lightning
} from '@phosphor-icons/react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [newProtocol, setNewProtocol] = useState<'DRIFT' | 'KAMINO' | 'SAVE' | 'LOOPSCALE'>('DRIFT');
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  
  const { data: accounts, isLoading } = useAccounts({ isActive: true });
  const addAccountMutation = useAddAccount();
  const removeAccountMutation = useRemoveAccount();
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

  const handleRemoveAccount = async (walletAddress: string) => {
    try {
      await removeAccountMutation.mutateAsync(walletAddress);
      setAccountToDelete(null);
    } catch (error) {
      console.error('Failed to remove account:', error);
    }
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return '#ff6464';
    if (riskScore >= 40) return '#ffa500';
    return '#4ade80';
  };

  const getHealthColor = (healthFactor: number | undefined) => {
    if (!healthFactor) return '#a0a0a0';
    if (healthFactor < 1.2) return '#ff6464';
    if (healthFactor < 1.5) return '#ffa500';
    return '#4ade80';
  };

  const getProtocolColor = (protocol: string) => {
    const colors: Record<string, string> = {
      DRIFT: '#a78bfa',
      KAMINO: '#60a5fa',
      SAVE: '#f472b6',
      LOOPSCALE: '#4ade80',
    };
    return colors[protocol] || '#a0a0a0';
  };

  return (
    <div css={css`min-height: 100vh; padding: 1.5rem 2rem;`}>
      <div css={css`max-width: 1600px; margin: 0 auto;`}>
        
        {/* Header */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        `}>
          <div>
            <h1 css={css`
              font-size: 1.75rem;
              font-weight: 700;
              color: #fff;
              margin-bottom: 0.25rem;
              display: flex;
              align-items: center;
              gap: 0.75rem;
            `}>
              <Shield size={28} weight="fill" color="#dcfd8f" />
              Liquidation Shield
            </h1>
            <p css={css`color: #a0a0a0; font-size: 0.875rem;`}>
              Monitor and protect your DeFi positions in real-time
            </p>
          </div>
          
          <div css={css`display: flex; align-items: center; gap: 1rem;`}>
            {/* Live Status */}
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.5rem 1rem;
              background: ${wsState.isConnected ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 100, 100, 0.1)'};
              border: 1px solid ${wsState.isConnected ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 100, 100, 0.3)'};
              border-radius: 8px;
            `}>
              <Circle size={8} weight="fill" color={wsState.isConnected ? '#4ade80' : '#ff6464'} />
              <span css={css`
                font-size: 0.8125rem;
                color: ${wsState.isConnected ? '#4ade80' : '#ff6464'};
                font-weight: 600;
              `}>
                {wsState.isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            
            {/* Add Account Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.625rem 1.25rem;
                background: linear-gradient(135deg, #dcfd8f 0%, #b8e063 100%);
                color: #0a0e27;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 12px rgba(220, 253, 143, 0.2);

                &:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 8px 24px rgba(220, 253, 143, 0.3);
                }
              `}
            >
              <Plus size={18} weight="bold" />
              Add Account
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div css={css`margin-bottom: 1.5rem;`}>
          <StatsOverview />
        </div>

        {/* Main Content Grid */}
        <div css={css`
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 1.5rem;

          @media (max-width: 1200px) {
            grid-template-columns: 1fr;
          }
        `}>
          
          {/* Accounts Section */}
          <div css={css`
            background: var(--bg-surface);
            border: 1px solid var(--border-default);
            border-radius: 16px;
            overflow: hidden;
          `}>
            {/* Section Header */}
            <div css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 1.25rem 1.5rem;
              border-bottom: 1px solid var(--border-default);
            `}>
              <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
                <Wallet size={20} color="#dcfd8f" />
                <h2 css={css`font-size: 1rem; font-weight: 600; color: #dcfd8f;`}>
                  Monitored Accounts
                </h2>
                {accounts && accounts.length > 0 && (
                  <span css={css`
                    padding: 0.125rem 0.5rem;
                    background: rgba(220, 253, 143, 0.15);
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #dcfd8f;
                  `}>
                    {accounts.length}
                  </span>
                )}
              </div>
            </div>

            {/* Accounts List */}
            <div css={css`padding: 1rem;`}>
              {isLoading ? (
                <div css={css`display: flex; flex-direction: column; gap: 0.75rem;`}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} css={css`
                      background: var(--bg-header);
                      border-radius: 12px;
                      padding: 1rem;
                      height: 100px;
                      animation: pulse 2s infinite;
                      @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                      }
                    `} />
                  ))}
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div css={css`display: flex; flex-direction: column; gap: 0.75rem;`}>
                  {accounts.map((account) => {
                    const latestSnapshot = account.snapshots?.[0];
                    const totalValue = latestSnapshot 
                      ? (latestSnapshot.collateralValue + latestSnapshot.borrowedValue) 
                      : 0;
                    const healthFactor = latestSnapshot?.healthFactor;
                    const riskScore = latestSnapshot?.riskScore || 0;

                    return (
                      <div
                        key={account.id}
                        css={css`
                          background: var(--bg-header);
                          border: 1px solid var(--border-default);
                          border-radius: 12px;
                          padding: 1rem 1.25rem;
                          transition: all 0.2s;
                          cursor: pointer;

                          &:hover {
                            background: var(--bg-surface-hover);
                            border-color: var(--clr-primary-border);
                            transform: translateX(4px);
                          }
                        `}
                        onClick={() => navigate(`/account/${account.walletAddress}`)}
                      >
                        <div css={css`
                          display: flex;
                          justify-content: space-between;
                          align-items: flex-start;
                        `}>
                          {/* Left Side */}
                          <div css={css`flex: 1;`}>
                            <div css={css`
                              display: flex;
                              align-items: center;
                              gap: 0.75rem;
                              margin-bottom: 0.75rem;
                            `}>
                              {/* Protocol Badge */}
                              <span css={css`
                                padding: 0.25rem 0.625rem;
                                background: ${getProtocolColor(account.protocol)}20;
                                border: 1px solid ${getProtocolColor(account.protocol)}40;
                                border-radius: 6px;
                                font-size: 0.6875rem;
                                font-weight: 700;
                                color: ${getProtocolColor(account.protocol)};
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                              `}>
                                {account.protocol}
                              </span>
                              
                              {/* Wallet Address */}
                              <span css={css`
                                font-family: 'SF Mono', 'Fira Code', monospace;
                                font-size: 0.8125rem;
                                color: #a0a0a0;
                              `}>
                                {account.walletAddress.slice(0, 6)}...{account.walletAddress.slice(-4)}
                              </span>
                              
                              {/* Status Dot */}
                              <Circle 
                                size={6} 
                                weight="fill" 
                                color={account.isActive ? '#4ade80' : '#666'} 
                              />
                            </div>

                            {/* Stats Row */}
                            <div css={css`
                              display: flex;
                              gap: 2rem;
                            `}>
                              <div>
                                <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.125rem;`}>
                                  Total Value
                                </div>
                                <div css={css`font-size: 1rem; font-weight: 700; color: #fff;`}>
                                  ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              
                              <div>
                                <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.125rem;`}>
                                  Health Factor
                                </div>
                                <div css={css`
                                  font-size: 1rem;
                                  font-weight: 700;
                                  color: ${getHealthColor(healthFactor)};
                                  display: flex;
                                  align-items: center;
                                  gap: 0.25rem;
                                `}>
                                  {healthFactor?.toFixed(2) || '—'}
                                  {healthFactor && healthFactor < 1.5 && (
                                    <Warning size={14} weight="fill" />
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.125rem;`}>
                                  Risk Score
                                </div>
                                <div css={css`
                                  font-size: 1rem;
                                  font-weight: 700;
                                  color: ${getRiskColor(riskScore)};
                                `}>
                                  {riskScore}%
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Side - Actions */}
                          <div css={css`
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                          `}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAccountToDelete(account.walletAddress);
                              }}
                              css={css`
                                padding: 0.5rem;
                                background: transparent;
                                border: 1px solid rgba(255, 100, 100, 0.2);
                                border-radius: 8px;
                                color: #ff6464;
                                cursor: pointer;
                                transition: all 0.2s;
                                opacity: 0.6;

                                &:hover {
                                  opacity: 1;
                                  background: rgba(255, 100, 100, 0.1);
                                }
                              `}
                            >
                              <Trash size={16} />
                            </button>
                            <ArrowRight size={18} color="#666" />
                          </div>
                        </div>

                        {/* Risk Bar */}
                        <div css={css`
                          margin-top: 0.75rem;
                          height: 3px;
                          background: var(--bg-surface);
                          border-radius: 2px;
                          overflow: hidden;
                        `}>
                          <div css={css`
                            height: 100%;
                            width: ${Math.min(riskScore, 100)}%;
                            background: ${getRiskColor(riskScore)};
                            border-radius: 2px;
                            transition: width 0.3s;
                          `} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty State */
                <div css={css`
                  text-align: center;
                  padding: 3rem 2rem;
                `}>
                  <div css={css`
                    width: 64px;
                    height: 64px;
                    margin: 0 auto 1rem;
                    background: rgba(220, 253, 143, 0.1);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  `}>
                    <Shield size={32} color="#dcfd8f" weight="duotone" />
                  </div>
                  <h3 css={css`
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #fff;
                    margin-bottom: 0.5rem;
                  `}>
                    No Accounts Yet
                  </h3>
                  <p css={css`
                    color: #666;
                    font-size: 0.875rem;
                    margin-bottom: 1.5rem;
                    max-width: 280px;
                    margin-left: auto;
                    margin-right: auto;
                  `}>
                    Add your first wallet to start monitoring and protecting your positions
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    css={css`
                      display: inline-flex;
                      align-items: center;
                      gap: 0.5rem;
                      padding: 0.75rem 1.5rem;
                      background: linear-gradient(135deg, #dcfd8f 0%, #b8e063 100%);
                      color: #0a0e27;
                      border: none;
                      border-radius: 10px;
                      font-weight: 600;
                      font-size: 0.875rem;
                      cursor: pointer;
                      transition: all 0.2s;

                      &:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 24px rgba(220, 253, 143, 0.3);
                      }
                    `}
                  >
                    <Plus size={18} weight="bold" />
                    Add Your First Account
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div css={css`display: flex; flex-direction: column; gap: 1.5rem;`}>
            
            {/* Quick Actions */}
            <div css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 16px;
              padding: 1.25rem;
              backdrop-filter: blur(20px);
            `}>
              <h3 css={css`
                font-size: 0.875rem;
                font-weight: 600;
                color: #dcfd8f;
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
              `}>
                <Lightning size={16} color="#dcfd8f" />
                Quick Actions
              </h3>
              
              <div css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
                <button
                  onClick={() => navigate('/open-position')}
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: rgba(220, 253, 143, 0.08);
                    border: 1px solid rgba(220, 253, 143, 0.15);
                    border-radius: 10px;
                    color: #dcfd8f;
                    font-weight: 500;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;

                    &:hover {
                      background: rgba(220, 253, 143, 0.12);
                      border-color: rgba(220, 253, 143, 0.25);
                    }
                  `}
                >
                  <TrendUp size={18} />
                  Open New Position
                </button>
                
                <button
                  onClick={() => navigate('/rates')}
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 10px;
                    color: #a0a0a0;
                    font-weight: 500;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;

                    &:hover {
                      background: rgba(255, 255, 255, 0.05);
                      color: #fff;
                    }
                  `}
                >
                  <Eye size={18} />
                  View Protocol Rates
                </button>
              </div>
            </div>

            {/* Alert Feed */}
            <div css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 16px;
              padding: 1.25rem;
              backdrop-filter: blur(20px);
              flex: 1;
            `}>
              <h3 css={css`
                font-size: 0.875rem;
                font-weight: 600;
                color: #dcfd8f;
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
              `}>
                <Warning size={16} color="#dcfd8f" />
                Active Alerts
              </h3>
              <AlertFeed />
            </div>
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Account to Monitor"
      >
        <div css={css`display: flex; flex-direction: column; gap: 1.25rem;`}>
          <div>
            <label css={css`
              display: block;
              font-size: 0.8125rem;
              font-weight: 500;
              color: #a0a0a0;
              margin-bottom: 0.5rem;
            `}>
              Wallet Address
            </label>
            <input
              type="text"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              placeholder="Enter Solana wallet address"
              css={css`
                width: 100%;
                padding: 0.875rem 1rem;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: #fff;
                font-size: 0.9375rem;
                font-family: 'SF Mono', 'Fira Code', monospace;

                &::placeholder { color: #444; }
                &:focus {
                  outline: none;
                  border-color: #dcfd8f;
                  background: rgba(220, 253, 143, 0.03);
                }
              `}
            />
          </div>
          
          <div>
            <label css={css`
              display: block;
              font-size: 0.8125rem;
              font-weight: 500;
              color: #a0a0a0;
              margin-bottom: 0.5rem;
            `}>
              Protocol
            </label>
            <div css={css`
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 0.5rem;
            `}>
              {(['DRIFT', 'KAMINO', 'SAVE', 'LOOPSCALE'] as const).map((protocol) => (
                <button
                  key={protocol}
                  onClick={() => setNewProtocol(protocol)}
                  css={css`
                    padding: 0.75rem;
                    background: ${newProtocol === protocol 
                      ? `${getProtocolColor(protocol)}15` 
                      : 'rgba(255, 255, 255, 0.03)'};
                    border: 1px solid ${newProtocol === protocol 
                      ? `${getProtocolColor(protocol)}40` 
                      : 'rgba(255, 255, 255, 0.08)'};
                    border-radius: 10px;
                    color: ${newProtocol === protocol 
                      ? getProtocolColor(protocol) 
                      : '#a0a0a0'};
                    font-weight: 600;
                    font-size: 0.8125rem;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover {
                      border-color: ${getProtocolColor(protocol)}60;
                    }
                  `}
                >
                  {protocol}
                </button>
              ))}
            </div>
          </div>

          <div css={css`display: flex; gap: 0.75rem; margin-top: 0.5rem;`}>
            <button
              onClick={() => setIsAddModalOpen(false)}
              css={css`
                flex: 1;
                padding: 0.875rem;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: #a0a0a0;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 255, 255, 0.06);
                  color: #fff;
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
                padding: 0.875rem;
                background: linear-gradient(135deg, #dcfd8f 0%, #b8e063 100%);
                color: #0a0e27;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover:not(:disabled) {
                  transform: translateY(-1px);
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!accountToDelete}
        onClose={() => setAccountToDelete(null)}
        title="Remove Account"
      >
        <div css={css`text-align: center;`}>
          <div css={css`
            width: 56px;
            height: 56px;
            margin: 0 auto 1rem;
            background: rgba(255, 100, 100, 0.1);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
          `}>
            <Trash size={28} color="#ff6464" />
          </div>
          <p css={css`color: #a0a0a0; margin-bottom: 1.5rem;`}>
            Are you sure you want to stop monitoring this account?
          </p>
          <div css={css`display: flex; gap: 0.75rem;`}>
            <button
              onClick={() => setAccountToDelete(null)}
              css={css`
                flex: 1;
                padding: 0.875rem;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: #a0a0a0;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 255, 255, 0.06);
                  color: #fff;
                }
              `}
            >
              Cancel
            </button>
            <button
              onClick={() => accountToDelete && handleRemoveAccount(accountToDelete)}
              disabled={removeAccountMutation.isPending}
              css={css`
                flex: 1;
                padding: 0.875rem;
                background: rgba(255, 100, 100, 0.15);
                border: 1px solid rgba(255, 100, 100, 0.3);
                border-radius: 10px;
                color: #ff6464;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover:not(:disabled) {
                  background: rgba(255, 100, 100, 0.25);
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
              `}
            >
              {removeAccountMutation.isPending ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
