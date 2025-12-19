/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react';
import { X, Copy, Eye, EyeSlash, SignOut, ArrowSquareOut, CheckCircle, XCircle, Clock } from '@phosphor-icons/react';
import { useWallet } from '../../contexts';
import { useTransactionHistory } from '../../hooks/usePositions';
import { useState } from 'react';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

interface AccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountSidebar = ({ isOpen, onClose }: AccountSidebarProps) => {
  const { connection, disconnect } = useWallet();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'activity'>('portfolio');
  const [balanceVisible, setBalanceVisible] = useState(true);

  const { data: transactions, isLoading: transactionsLoading } = useTransactionHistory(
    connection?.account?.publicKey,
    10
  );

  if (!isOpen || !connection) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDisconnect = async () => {
    await disconnect();
    onClose();
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Calculate total portfolio value
  const totalValue = connection.account.tokens.reduce((total, token) => {
    const balance = parseFloat(token.balance);
    const price = token.price || 0;
    return total + (balance * price);
  }, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'OPEN':
        return <CheckCircle size={12} weight="fill" />;
      case 'FAILED':
      case 'LIQUIDATED':
        return <XCircle size={12} weight="fill" />;
      default:
        return <Clock size={12} weight="fill" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'OPEN':
        return { bg: 'rgba(220, 253, 143, 0.1)', border: 'rgba(220, 253, 143, 0.3)', text: 'var(--clr-primary)' };
      case 'FAILED':
      case 'LIQUIDATED':
        return { bg: 'rgba(255, 100, 100, 0.1)', border: 'rgba(255, 100, 100, 0.3)', text: 'var(--status-error)' };
      case 'CLOSED':
        return { bg: 'rgba(100, 100, 255, 0.1)', border: 'rgba(100, 100, 255, 0.3)', text: '#6464ff' };
      default:
        return { bg: 'rgba(255, 165, 0, 0.1)', border: 'rgba(255, 165, 0, 0.3)', text: 'var(--status-warning)' };
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        css={css`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 999;
        `}
      />

      {/* Sidebar */}
      <div
        css={css`
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 420px;
          background: var(--bg-header);
          border-left: 1px solid var(--border-subtle);
          z-index: 1000;
          overflow-y: auto;
          animation: ${slideIn} 0.3s ease-out;
          display: flex;
          flex-direction: column;
        `}
      >
        {/* Header with Account ID */}
        <div css={css`padding: 1.5rem; border-bottom: 1px solid var(--border-subtle);`}>
          <div css={css`display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem;`}>
            <div css={css`flex: 1;`}>
              <div css={css`display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;`}>
                <span css={css`font-size: 1.125rem; font-weight: 600; color: var(--text-primary); font-family: monospace;`}>
                  {truncateAddress(connection.account.publicKey)}
                </span>
                <button
                  onClick={() => handleCopy(connection.account.publicKey, 'publicKey')}
                  css={css`
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.25rem;
                    display: flex;
                    align-items: center;
                    transition: color 0.2s;
                    &:hover { color: var(--clr-primary); }
                  `}
                >
                  {copiedField === 'publicKey' ? '✓' : <Copy size={16} weight="bold" />}
                </button>
              </div>
              <div css={css`font-size: 0.8125rem; color: var(--text-secondary); font-family: monospace;`}>
                {connection.wallet.name}
              </div>
            </div>
            <button
              onClick={onClose}
              css={css`
                background: transparent;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                padding: 0.25rem;
                display: flex;
                align-items: center;
                transition: color 0.2s;
                &:hover { color: var(--text-primary); }
              `}
            >
              <X size={24} weight="bold" />
            </button>
          </div>

          {/* Balance Display */}
          <div css={css`margin-bottom: 0.5rem;`}>
            <div css={css`display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;`}>
              <span css={css`font-size: 2.5rem; font-weight: 700; color: var(--text-primary);`}>
                {balanceVisible ? `$${totalValue.toFixed(2)}` : '••••'}
              </span>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                css={css`
                  background: transparent;
                  border: none;
                  color: var(--text-secondary);
                  cursor: pointer;
                  padding: 0.25rem;
                  display: flex;
                  align-items: center;
                  transition: color 0.2s;
                  &:hover { color: var(--text-primary); }
                `}
              >
                {balanceVisible ? <Eye size={20} /> : <EyeSlash size={20} />}
              </button>
            </div>
            <div css={css`font-size: 0.9375rem; color: var(--text-secondary);`}>
              {balanceVisible ? `~${connection.account.balance} SOL` : '~•••• SOL'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div css={css`display: flex; border-bottom: 1px solid var(--border-subtle);`}>
          <button
            onClick={() => setActiveTab('portfolio')}
            css={css`
              flex: 1;
              padding: 1rem;
              background: transparent;
              border: none;
              color: ${activeTab === 'portfolio' ? 'var(--text-primary)' : 'var(--text-secondary)'};
              font-size: 0.9375rem;
              font-weight: 600;
              cursor: pointer;
              border-bottom: 2px solid ${activeTab === 'portfolio' ? 'var(--clr-primary)' : 'transparent'};
              transition: all 0.2s;
              &:hover { color: var(--text-primary); }
            `}
          >
            Portfolio
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            css={css`
              flex: 1;
              padding: 1rem;
              background: transparent;
              border: none;
              color: ${activeTab === 'activity' ? 'var(--text-primary)' : 'var(--text-secondary)'};
              font-size: 0.9375rem;
              font-weight: 600;
              cursor: pointer;
              border-bottom: 2px solid ${activeTab === 'activity' ? 'var(--clr-primary)' : 'transparent'};
              transition: all 0.2s;
              &:hover { color: var(--text-primary); }
            `}
          >
            Activity
          </button>
        </div>

        {/* Content */}
        <div css={css`flex: 1; overflow-y: auto; padding-bottom: 100px;`}>
          {activeTab === 'portfolio' ? (
            <>
              {/* Holdings Header */}
              <div css={css`padding: 1.5rem 1.5rem 1rem 1.5rem; border-bottom: 1px solid var(--border-subtle);`}>
                <div css={css`display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;`}>
                  <span css={css`font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary);`}>
                    Holdings ({connection.account.tokens.length})
                  </span>
                </div>
                <div css={css`display: flex; align-items: baseline; gap: 0.75rem;`}>
                  <span css={css`font-size: 1.125rem; font-weight: 700; color: var(--text-primary);`}>
                    {balanceVisible ? `$${totalValue.toFixed(2)}` : '••••'}
                  </span>
                </div>
              </div>

              {/* Token List */}
              <div css={css`padding: 0.75rem 1rem 1rem 1rem;`}>
                {connection.account.tokens.map((token, index) => {
                  const tokenBalance = parseFloat(token.balance);
                  const tokenValue = tokenBalance * (token.price || 0);

                  return (
                    <div
                      key={`${token.symbol}-${index}`}
                      css={css`
                        cursor: pointer;
                        transition: all 0.2s;
                        &:hover { opacity: 0.8; }
                        &:not(:last-child) { margin-bottom: 0.75rem; }
                      `}
                    >
                      <div css={css`display: flex; align-items: center; justify-content: space-between;`}>
                        <div css={css`display: flex; align-items: center; gap: 0.625rem;`}>
                          <div
                            css={css`
                              width: 32px;
                              height: 32px;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              background: var(--clr-primary-bg);
                              border-radius: 50%;
                              font-size: 0.875rem;
                            `}
                          >
                            {token.symbol === 'SOL' ? '◎' : token.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div css={css`font-size: 0.8125rem; font-weight: 600; color: var(--text-primary);`}>
                              {token.name}
                            </div>
                            <div css={css`font-size: 0.75rem; color: var(--text-secondary);`}>
                              {balanceVisible ? `${tokenBalance.toFixed(4)} ${token.symbol}` : '•••• ' + token.symbol}
                            </div>
                          </div>
                        </div>
                        <div css={css`text-align: right;`}>
                          <div css={css`font-size: 0.8125rem; font-weight: 600; color: var(--text-primary);`}>
                            {balanceVisible ? `$${tokenValue.toFixed(2)}` : '••••'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div css={css`padding: 1rem;`}>
              {transactionsLoading ? (
                <div css={css`padding: 2rem; text-align: center;`}>
                  <div css={css`
                    display: inline-block;
                    width: 1.5rem;
                    height: 1.5rem;
                    border: 2px solid var(--border-subtle);
                    border-top-color: var(--clr-primary);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    @keyframes spin { to { transform: rotate(360deg); } }
                  `} />
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <div css={css`padding: 2rem; text-align: center;`}>
                  <Clock size={40} css={css`color: var(--text-tertiary); margin-bottom: 0.75rem; opacity: 0.5;`} />
                  <p css={css`color: var(--text-secondary); font-size: 0.8125rem;`}>
                    No recent activity
                  </p>
                </div>
              ) : (
                <div css={css`display: flex; flex-direction: column; gap: 0.75rem;`}>
                  {transactions.map((tx) => {
                    const statusColors = getStatusColor(tx.status);
                    return (
                      <div
                        key={tx.id}
                        css={css`
                          padding: 0.875rem;
                          background: var(--bg-surface);
                          border: 1px solid var(--border-subtle);
                          border-radius: 8px;
                          transition: border-color 0.15s;
                          &:hover { border-color: var(--border-default); }
                        `}
                      >
                        <div css={css`display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;`}>
                          <div css={css`flex: 1;`}>
                            <div css={css`font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;`}>
                              {tx.type === 'POSITION_OPEN' ? 'Position Opened' : 
                               tx.type === 'POSITION_CLOSE' ? 'Position Closed' : 'Protective Swap'}
                            </div>
                            <div css={css`font-size: 0.6875rem; color: var(--text-secondary);`}>
                              {tx.type === 'POSITION_OPEN' ? (
                                <>
                                  {tx.details.collateralToken} → {tx.details.borrowToken}
                                  <br />
                                  {tx.details.leverage?.toFixed(1)}x • {tx.protocol}
                                </>
                              ) : tx.type === 'POSITION_CLOSE' ? (
                                <>
                                  {tx.details.collateralToken} → {tx.details.borrowToken}
                                  <br />
                                  <span css={css`color: ${tx.details.realizedPnl >= 0 ? 'var(--status-success)' : 'var(--status-error)'};`}>
                                    P/L: ${tx.details.realizedPnl?.toFixed(2) || '0.00'}
                                  </span> • {tx.protocol}
                                </>
                              ) : (
                                <>
                                  {tx.details.fromToken} → {tx.details.toToken}
                                  <br />
                                  {tx.protocol}
                                </>
                              )}
                            </div>
                          </div>
                          {tx.txSignature && (
                            <a
                              href={`https://solscan.io/tx/${tx.txSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              css={css`
                                color: var(--clr-primary);
                                transition: opacity 0.15s;
                                &:hover { opacity: 0.8; }
                              `}
                            >
                              <ArrowSquareOut size={16} />
                            </a>
                          )}
                        </div>
                        <div css={css`display: flex; justify-content: space-between; align-items: center;`}>
                          <span css={css`
                            display: inline-flex;
                            align-items: center;
                            gap: 0.25rem;
                            padding: 0.125rem 0.5rem;
                            background: ${statusColors.bg};
                            border: 1px solid ${statusColors.border};
                            border-radius: 4px;
                            font-size: 0.625rem;
                            font-weight: 600;
                            color: ${statusColors.text};
                          `}>
                            {getStatusIcon(tx.status)}
                            {tx.status}
                          </span>
                          <span css={css`font-size: 0.6875rem; color: var(--text-tertiary);`}>
                            {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Disconnect Button */}
        <div css={css`
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 1.5rem;
          background: var(--bg-header);
          border-top: 1px solid var(--border-subtle);
        `}>
          <button
            onClick={handleDisconnect}
            css={css`
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
              padding: 0.875rem;
              background: var(--status-danger-bg);
              border: 1px solid var(--status-danger-border);
              border-radius: 12px;
              color: var(--status-danger);
              font-size: 0.9375rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                background: rgba(255, 77, 77, 0.15);
              }
            `}
          >
            <SignOut size={18} weight="bold" />
            Disconnect
          </button>
        </div>
      </div>
    </>
  );
};

export default AccountSidebar;
