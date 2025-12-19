/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';

import {
  Shield,
  ArrowSquareOut,
  Funnel,
  TrendUp,
  CheckCircle,
  XCircle,
  Clock,
} from '@phosphor-icons/react';
import { useTransactionHistory } from '../hooks/usePositions';
import { useWallet } from '../contexts/WalletContext';
import { LoadingSpinner } from '../components/common';

type StatusFilter = 'all' | 'CONFIRMED' | 'PENDING' | 'FAILED' | 'OPEN' | 'CLOSED';

export default function History() {
  const { connection } = useWallet();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  const { data: transactions, isLoading } = useTransactionHistory(connection?.account.publicKey, 100);

  const filteredTransactions = transactions?.filter((tx) => {
    if (statusFilter === 'all') return true;
    return tx.status === statusFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'OPEN':
        return <CheckCircle size={16} weight="fill" />;
      case 'FAILED':
      case 'LIQUIDATED':
        return <XCircle size={16} weight="fill" />;
      default:
        return <Clock size={16} weight="fill" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'OPEN':
        return { bg: 'rgba(220, 253, 143, 0.1)', border: 'rgba(220, 253, 143, 0.3)', text: '#dcfd8f' };
      case 'FAILED':
      case 'LIQUIDATED':
        return { bg: 'rgba(255, 100, 100, 0.1)', border: 'rgba(255, 100, 100, 0.3)', text: '#ff6464' };
      case 'CLOSED':
        return { bg: 'rgba(100, 100, 255, 0.1)', border: 'rgba(100, 100, 255, 0.3)', text: '#6464ff' };
      default:
        return { bg: 'rgba(255, 165, 0, 0.1)', border: 'rgba(255, 165, 0, 0.3)', text: '#ffa500' };
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
            margin-bottom: 2rem;
          `}
        >
          <h1
            css={css`
              font-size: 2rem;
              font-weight: 700;
              color: #fff;
              margin-bottom: 0.5rem;
            `}
          >
            Transaction History
          </h1>
          <p
            css={css`
              color: #a0a0a0;
              font-size: 0.9375rem;
            `}
          >
            View all protection transactions and MEV savings
          </p>
        </div>

        {/* MEV Savings Summary */}
        <div
          css={css`
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          `}
        >
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1rem;
              `}
            >
              <Shield size={24} color="#dcfd8f" weight="fill" />
              <span
                css={css`
                  color: #a0a0a0;
                  font-size: 0.875rem;
                `}
              >
                Total Transactions
              </span>
            </div>
            <div
              css={css`
                font-size: 2rem;
                font-weight: 700;
                color: #fff;
              `}
            >
              {transactions?.length || 0}
            </div>
          </div>
          
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(220, 253, 143, 0.3);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1rem;
              `}
            >
              <TrendUp size={24} color="#dcfd8f" weight="fill" />
              <span
                css={css`
                  color: #a0a0a0;
                  font-size: 0.875rem;
                `}
              >
                Total MEV Saved
              </span>
            </div>
            <div
              css={css`
                font-size: 2rem;
                font-weight: 700;
                color: #dcfd8f;
              `}
            >
              ${transactions?.reduce((sum, tx) => sum + (tx.details.mevSaved || 0), 0).toFixed(2) || '0.00'}
            </div>
          </div>
          
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1rem;
              `}
            >
              <CheckCircle size={24} color="#dcfd8f" weight="fill" />
              <span
                css={css`
                  color: #a0a0a0;
                  font-size: 0.875rem;
                `}
              >
                Success Rate
              </span>
            </div>
            <div
              css={css`
                font-size: 2rem;
                font-weight: 700;
                color: #fff;
              `}
            >
              {transactions && transactions.length > 0
                ? `${((transactions.filter(t => t.status === 'CONFIRMED' || t.status === 'OPEN').length / transactions.length) * 100).toFixed(0)}%`
                : '0%'}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1.5rem;
          `}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <Funnel size={20} color="#a0a0a0" />
            <span
              css={css`
                color: #a0a0a0;
                font-size: 0.875rem;
              `}
            >
              Filter:
            </span>
          </div>
          <div
            css={css`
              display: flex;
              gap: 0.5rem;
            `}
          >
            {(['all', 'CONFIRMED', 'CLOSED', 'PENDING', 'FAILED'] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                css={css`
                  padding: 0.5rem 1rem;
                  background: ${statusFilter === status ? '#dcfd8f' : 'rgba(255, 255, 255, 0.05)'};
                  color: ${statusFilter === status ? '#0a0e27' : '#a0a0a0'};
                  border: 1px solid ${statusFilter === status ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
                  border-radius: 8px;
                  font-size: 0.875rem;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    background: ${statusFilter === status ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
                  }
                `}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction Table */}
        <div
          css={css`
            background: rgba(12, 13, 16, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            backdrop-filter: blur(20px);
            overflow: hidden;
          `}
        >
          {isLoading ? (
            <div
              css={css`
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 4rem;
              `}
            >
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <div
              css={css`
                overflow-x: auto;
              `}
            >
              <table
                css={css`
                  width: 100%;
                  border-collapse: collapse;
                `}
              >
                <thead>
                  <tr
                    css={css`
                      background: rgba(255, 255, 255, 0.03);
                      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    `}
                  >
                    <th css={css`padding: 1rem 1.5rem; text-align: left; font-size: 0.875rem; font-weight: 600; color: #a0a0a0;`}>Date</th>
                    <th css={css`padding: 1rem 1.5rem; text-align: left; font-size: 0.875rem; font-weight: 600; color: #a0a0a0;`}>Type</th>
                    <th css={css`padding: 1rem 1.5rem; text-align: left; font-size: 0.875rem; font-weight: 600; color: #a0a0a0;`}>Protocol</th>
                    <th css={css`padding: 1rem 1.5rem; text-align: left; font-size: 0.875rem; font-weight: 600; color: #a0a0a0;`}>Details</th>
                    <th css={css`padding: 1rem 1.5rem; text-align: left; font-size: 0.875rem; font-weight: 600; color: #a0a0a0;`}>Status</th>
                    <th css={css`padding: 1rem 1.5rem; text-align: left; font-size: 0.875rem; font-weight: 600; color: #a0a0a0;`}>Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const statusColors = getStatusColor(tx.status);
                    return (
                      <tr
                        key={tx.id}
                        css={css`
                          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                          transition: background 0.2s;

                          &:hover {
                            background: rgba(255, 255, 255, 0.03);
                          }
                        `}
                      >
                        <td css={css`padding: 1rem 1.5rem; font-size: 0.875rem; color: #fff;`}>
                          {new Date(tx.timestamp).toLocaleDateString()}
                          <div css={css`font-size: 0.75rem; color: #666; margin-top: 0.25rem;`}>
                            {new Date(tx.timestamp).toLocaleTimeString()}
                          </div>
                        </td>
                        <td css={css`padding: 1rem 1.5rem; font-size: 0.875rem; color: #fff;`}>
                          {tx.type === 'POSITION_OPEN' ? 'Open Position' : 
                           tx.type === 'POSITION_CLOSE' ? 'Close Position' : 'Swap'}
                        </td>
                        <td css={css`padding: 1rem 1.5rem; font-size: 0.875rem; color: #dcfd8f;`}>
                          {tx.protocol}
                        </td>
                        <td css={css`padding: 1rem 1.5rem; font-size: 0.875rem;`}>
                          {tx.type === 'POSITION_OPEN' ? (
                            <>
                              <span css={css`color: #fff;`}>{tx.details.collateralToken}</span>
                              <span css={css`color: #666; margin: 0 0.5rem;`}>→</span>
                              <span css={css`color: #fff;`}>{tx.details.borrowToken}</span>
                              <div css={css`font-size: 0.75rem; color: #666; margin-top: 0.25rem;`}>
                                {tx.details.leverage?.toFixed(1)}x leverage
                              </div>
                            </>
                          ) : tx.type === 'POSITION_CLOSE' ? (
                            <>
                              <span css={css`color: #fff;`}>{tx.details.collateralToken}</span>
                              <span css={css`color: #666; margin: 0 0.5rem;`}>→</span>
                              <span css={css`color: #fff;`}>{tx.details.borrowToken}</span>
                              <div css={css`font-size: 0.75rem; color: ${tx.details.realizedPnl >= 0 ? '#dcfd8f' : '#ff6464'}; margin-top: 0.25rem;`}>
                                P/L: ${tx.details.realizedPnl?.toFixed(2) || '0.00'}
                              </div>
                            </>
                          ) : (
                            <>
                              <span css={css`color: #fff;`}>{tx.details.fromToken}</span>
                              <span css={css`color: #666; margin: 0 0.5rem;`}>→</span>
                              <span css={css`color: #fff;`}>{tx.details.toToken}</span>
                            </>
                          )}
                        </td>
                        <td css={css`padding: 1rem 1.5rem;`}>
                          <span
                            css={css`
                              display: inline-flex;
                              align-items: center;
                              gap: 0.375rem;
                              padding: 0.375rem 0.75rem;
                              background: ${statusColors.bg};
                              border: 1px solid ${statusColors.border};
                              border-radius: 6px;
                              font-size: 0.75rem;
                              font-weight: 600;
                              color: ${statusColors.text};
                            `}
                          >
                            {getStatusIcon(tx.status)}
                            {tx.status}
                          </span>
                        </td>
                        <td css={css`padding: 1rem 1.5rem;`}>
                          {tx.txSignature ? (
                            <a
                              href={`https://solscan.io/tx/${tx.txSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              css={css`
                                color: #dcfd8f;
                                transition: color 0.2s;

                                &:hover {
                                  color: #fff;
                                }
                              `}
                            >
                              <ArrowSquareOut size={18} />
                            </a>
                          ) : (
                            <span css={css`color: #666;`}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              css={css`
                text-align: center;
                padding: 4rem 2rem;
              `}
            >
              <Shield size={64} color="#666" weight="thin" />
              <p
                css={css`
                  color: #a0a0a0;
                  margin-top: 1rem;
                `}
              >
                No transactions found
              </p>
              <p
                css={css`
                  font-size: 0.875rem;
                  color: #666;
                  margin-top: 0.5rem;
                `}
              >
                Protection transactions will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
