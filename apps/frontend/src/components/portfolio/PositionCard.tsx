/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { TrendUp, TrendDown, Warning } from '@phosphor-icons/react';
import ProtocolBadge from '../rates/ProtocolBadge';
import { PortfolioPosition, formatUsd, formatPercent } from '../../hooks/usePortfolio';

interface PositionCardProps {
  position: PortfolioPosition;
  onManage?: (position: PortfolioPosition) => void;
}

const PositionCard = ({ position, onManage }: PositionCardProps) => {
  const healthColor = position.healthFactor >= 2 ? 'var(--status-success)' :
    position.healthFactor >= 1.5 ? 'var(--status-warning)' : 'var(--status-error)';

  const pnlColor = position.unrealizedPnl >= 0 ? 'var(--status-success)' : 'var(--status-error)';
  const PnlIcon = position.unrealizedPnl >= 0 ? TrendUp : TrendDown;

  return (
    <div css={css`
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
      transition: border-color 0.15s;
      &:hover { border-color: var(--border-default); }
    `}>
      {/* Header */}
      <div css={css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--border-subtle);
        background: var(--bg-header);
      `}>
        <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
          <ProtocolBadge protocol={position.protocol} size="sm" />
          <span css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-primary);`}>
            {position.collateralToken}/{position.borrowToken}
          </span>
          <span css={css`
            padding: 0.125rem 0.375rem;
            background: var(--clr-primary-bg);
            color: var(--clr-primary);
            font-size: 0.625rem;
            font-weight: 700;
            border-radius: 4px;
          `}>
            {position.leverage.toFixed(1)}x
          </span>
        </div>

        {position.healthFactor < 1.5 && (
          <Warning size={18} css={css`color: var(--status-warning);`} />
        )}
      </div>

      {/* Body */}
      <div css={css`padding: 1.25rem;`}>
        <div css={css`
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        `}>
          {/* Collateral */}
          <div>
            <div css={css`font-size: 0.6875rem; color: var(--text-tertiary); margin-bottom: 0.25rem;`}>
              Collateral
            </div>
            <div css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-primary);`}>
              {position.collateralAmount.toFixed(4)} {position.collateralToken}
            </div>
            <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>
              {formatUsd(position.collateralValueUsd)}
            </div>
          </div>

          {/* Debt */}
          <div>
            <div css={css`font-size: 0.6875rem; color: var(--text-tertiary); margin-bottom: 0.25rem;`}>
              Debt
            </div>
            <div css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-primary);`}>
              {position.borrowAmount.toFixed(2)} {position.borrowToken}
            </div>
            <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>
              {formatUsd(position.borrowValueUsd)}
            </div>
          </div>

          {/* Health Factor */}
          <div>
            <div css={css`font-size: 0.6875rem; color: var(--text-tertiary); margin-bottom: 0.25rem;`}>
              Health Factor
            </div>
            <div css={css`font-size: 1rem; font-weight: 700; color: ${healthColor};`}>
              {position.healthFactor.toFixed(2)}
            </div>
          </div>

          {/* P&L */}
          <div>
            <div css={css`font-size: 0.6875rem; color: var(--text-tertiary); margin-bottom: 0.25rem;`}>
              Unrealized P&L
            </div>
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.25rem;
              font-size: 0.875rem;
              font-weight: 600;
              color: ${pnlColor};
            `}>
              <PnlIcon size={14} />
              {formatUsd(position.unrealizedPnl)}
              <span css={css`font-size: 0.75rem; opacity: 0.8;`}>
                ({formatPercent(position.unrealizedPnlPercent)})
              </span>
            </div>
          </div>
        </div>

        {/* Liquidation Info */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.75rem;
        `}>
          <span css={css`color: var(--text-tertiary);`}>
            Liq. Price: <span css={css`color: var(--status-error);`}>${position.liquidationPrice.toFixed(2)}</span>
          </span>
          <span css={css`color: var(--text-tertiary);`}>
            Entry: ${position.entryPrice.toFixed(2)} → Current: ${position.currentPrice.toFixed(2)}
          </span>
        </div>

        {/* Actions */}
        {onManage && (
          <div css={css`
            display: flex;
            gap: 0.5rem;
            margin-top: 1rem;
          `}>
            <button
              onClick={() => onManage(position)}
              css={css`
                flex: 1;
                padding: 0.5rem;
                background: var(--clr-primary-bg);
                border: 1px solid var(--clr-primary);
                border-radius: 6px;
                color: var(--clr-primary);
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
                &:hover { background: var(--clr-primary); color: var(--bg-base); }
              `}
            >
              Manage
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionCard;
