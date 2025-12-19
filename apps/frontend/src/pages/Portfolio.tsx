/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowsClockwise, Wallet } from '@phosphor-icons/react';
import { useWallet } from '../contexts';
import { usePortfolio, usePortfolioPositions, PortfolioPosition } from '../hooks/usePortfolio';
import PortfolioSummary from '../components/portfolio/PortfolioSummary';
import PositionCard from '../components/portfolio/PositionCard';
import PositionDetailModal from '../components/portfolio/PositionDetailModal';

const Portfolio = () => {
  const navigate = useNavigate();
  const { connection } = useWallet();
  const walletAddress = connection?.account?.publicKey || null;

  const [selectedPosition, setSelectedPosition] = useState<PortfolioPosition | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    refetch: refetchPortfolio,
  } = usePortfolio(walletAddress || undefined);

  const {
    data: positions,
    isLoading: positionsLoading,
    refetch: refetchPositions,
  } = usePortfolioPositions(walletAddress || undefined);

  const handleRefresh = () => {
    refetchPortfolio();
    refetchPositions();
  };

  // Not connected state
  if (!walletAddress) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
      `}>
        <Wallet size={64} css={css`color: var(--text-tertiary); margin-bottom: 1.5rem; opacity: 0.5;`} />
        <h2 css={css`font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;`}>
          Connect Your Wallet
        </h2>
        <p css={css`font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.5rem; max-width: 400px;`}>
          Connect your wallet to view your portfolio, track positions, and manage your leveraged positions across protocols.
        </p>
      </div>
    );
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    `}>
      {/* Header */}
      <div css={css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      `}>
        <div>
          <h1 css={css`font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;`}>
            Portfolio
          </h1>
          <p css={css`font-size: 0.875rem; color: var(--text-secondary);`}>
            Track and manage your leveraged positions
          </p>
        </div>

        <div css={css`display: flex; gap: 0.75rem;`}>
          <button
            onClick={handleRefresh}
            css={css`
              display: flex;
              align-items: center;
              gap: 0.375rem;
              padding: 0.5rem 0.75rem;
              background: transparent;
              border: 1px solid var(--border-default);
              border-radius: 8px;
              color: var(--text-secondary);
              font-size: 0.75rem;
              cursor: pointer;
              transition: all 0.15s;
              &:hover {
                border-color: var(--clr-primary);
                color: var(--clr-primary);
              }
            `}
          >
            <ArrowsClockwise size={14} />
            Refresh
          </button>

          <button
            onClick={() => navigate('/open-position')}
            css={css`
              display: flex;
              align-items: center;
              gap: 0.375rem;
              padding: 0.5rem 1rem;
              background: var(--clr-primary);
              border: none;
              border-radius: 8px;
              color: var(--bg-base);
              font-size: 0.875rem;
              font-weight: 600;
              cursor: pointer;
              transition: opacity 0.15s;
              &:hover { opacity: 0.9; }
            `}
          >
            <Plus size={16} weight="bold" />
            Open Position
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <PortfolioSummary
        portfolio={portfolio}
        isLoading={portfolioLoading}
      />

      {/* Tabs */}
      <PositionTabs
        positions={positions || []}
        isLoading={positionsLoading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onManagePosition={setSelectedPosition}
      />

      {/* Position Detail Modal */}
      {selectedPosition && walletAddress && (
        <PositionDetailModal
          position={selectedPosition}
          walletAddress={walletAddress}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </div>
  );
};

// Position Tabs Component
const PositionTabs = ({
  positions,
  isLoading,
  activeTab,
  onTabChange,
  onManagePosition,
}: {
  positions: PortfolioPosition[];
  isLoading: boolean;
  activeTab: 'open' | 'closed';
  onTabChange: (tab: 'open' | 'closed') => void;
  onManagePosition: (position: PortfolioPosition) => void;
}) => {
  const navigate = useNavigate();
  
  const openPositions = useMemo(() => positions.filter(p => p.status === 'OPEN'), [positions]);
  const closedPositions = useMemo(() => positions.filter(p => p.status !== 'OPEN'), [positions]);
  
  const displayedPositions = activeTab === 'open' ? openPositions : closedPositions;

  return (
    <div css={css`display: flex; flex-direction: column; gap: 1rem;`}>
      {/* Tab Headers */}
      <div css={css`
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--border-subtle);
      `}>
        <button
          onClick={() => onTabChange('open')}
          css={css`
            padding: 0.75rem 1.5rem;
            background: transparent;
            border: none;
            border-bottom: 2px solid ${activeTab === 'open' ? 'var(--clr-primary)' : 'transparent'};
            color: ${activeTab === 'open' ? 'var(--clr-primary)' : 'var(--text-secondary)'};
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
            &:hover {
              color: ${activeTab === 'open' ? 'var(--clr-primary)' : 'var(--text-primary)'};
            }
          `}
        >
          Open ({openPositions.length})
        </button>
        <button
          onClick={() => onTabChange('closed')}
          css={css`
            padding: 0.75rem 1.5rem;
            background: transparent;
            border: none;
            border-bottom: 2px solid ${activeTab === 'closed' ? 'var(--clr-primary)' : 'transparent'};
            color: ${activeTab === 'closed' ? 'var(--clr-primary)' : 'var(--text-secondary)'};
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
            &:hover {
              color: ${activeTab === 'closed' ? 'var(--clr-primary)' : 'var(--text-primary)'};
            }
          `}
        >
          Closed ({closedPositions.length})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 1rem;
        `}>
          {[1, 2, 3].map(i => (
            <div key={i} css={css`
              background: var(--bg-surface);
              border: 1px solid var(--border-subtle);
              border-radius: 12px;
              padding: 1.5rem;
              animation: pulse 1.5s infinite;
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}>
              <div css={css`height: 1.5rem; background: var(--bg-header); border-radius: 4px; margin-bottom: 1rem;`} />
              <div css={css`height: 4rem; background: var(--bg-header); border-radius: 4px; margin-bottom: 1rem;`} />
              <div css={css`height: 2rem; background: var(--bg-header); border-radius: 4px;`} />
            </div>
          ))}
        </div>
      ) : displayedPositions.length === 0 ? (
        <div css={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          text-align: center;
        `}>
          <Wallet size={48} css={css`color: var(--text-tertiary); margin-bottom: 1rem; opacity: 0.5;`} />
          <h3 css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;`}>
            {activeTab === 'open' ? 'No Open Positions' : 'No Closed Positions'}
          </h3>
          <p css={css`font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.5rem; max-width: 300px;`}>
            {activeTab === 'open' 
              ? 'Open your first leveraged position to start earning.'
              : 'Your closed positions will appear here.'}
          </p>
          {activeTab === 'open' && (
            <button
              onClick={() => navigate('/open-position')}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.5rem;
                background: var(--clr-primary);
                border: none;
                border-radius: 8px;
                color: var(--bg-base);
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: opacity 0.15s;
                &:hover { opacity: 0.9; }
              `}
            >
              <Plus size={18} weight="bold" />
              Open Position
            </button>
          )}
        </div>
      ) : (
        <div css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 1rem;
          ${activeTab === 'closed' ? 'opacity: 0.8;' : ''}
        `}>
          {displayedPositions.map(position => (
            <PositionCard
              key={position.id}
              position={position}
              onManage={activeTab === 'open' ? onManagePosition : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Portfolio;
