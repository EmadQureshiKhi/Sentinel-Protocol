/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Wallet, Plus } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import PositionCard from './PositionCard';
import { PortfolioPosition } from '../../hooks/usePortfolio';

interface PositionListProps {
  positions: PortfolioPosition[];
  isLoading?: boolean;
  onManagePosition?: (position: PortfolioPosition) => void;
}

const PositionList = ({ positions, isLoading, onManagePosition }: PositionListProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
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
    );
  }

  if (!positions || positions.length === 0) {
    return (
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
          No Positions Yet
        </h3>
        <p css={css`font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.5rem; max-width: 300px;`}>
          Open your first leveraged position to start earning and tracking your portfolio.
        </p>
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
      </div>
    );
  }

  // Separate open and closed positions
  const openPositions = positions.filter(p => p.status === 'OPEN');
  const closedPositions = positions.filter(p => p.status !== 'OPEN');

  return (
    <div css={css`display: flex; flex-direction: column; gap: 1.5rem;`}>
      {/* Open Positions */}
      {openPositions.length > 0 && (
        <div>
          <h3 css={css`
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 1rem;
          `}>
            Open Positions ({openPositions.length})
          </h3>
          <div css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            gap: 1rem;
          `}>
            {openPositions.map(position => (
              <PositionCard
                key={position.id}
                position={position}
                onManage={onManagePosition}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed Positions */}
      {closedPositions.length > 0 && (
        <div>
          <h3 css={css`
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 1rem;
          `}>
            Closed Positions ({closedPositions.length})
          </h3>
          <div css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            gap: 1rem;
            opacity: 0.7;
          `}>
            {closedPositions.map(position => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionList;
