/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowsClockwise, Wallet } from '@phosphor-icons/react';
import { useWallet } from '../contexts';
import { usePortfolio, usePortfolioPositions, PortfolioPosition } from '../hooks/usePortfolio';
import PortfolioSummary from '../components/portfolio/PortfolioSummary';
import PositionList from '../components/portfolio/PositionList';
import PositionDetailModal from '../components/portfolio/PositionDetailModal';

const Portfolio = () => {
  const navigate = useNavigate();
  const { connection } = useWallet();
  const walletAddress = connection?.account?.publicKey || null;

  const [selectedPosition, setSelectedPosition] = useState<PortfolioPosition | null>(null);

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

      {/* Positions List */}
      <PositionList
        positions={positions || []}
        isLoading={positionsLoading}
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

export default Portfolio;
