/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Star, TrendUp, TrendDown } from '@phosphor-icons/react';
import ProtocolBadge from './ProtocolBadge';

interface RateCardProps {
  token: string;
  protocol: 'DRIFT' | 'MARGINFI' | 'SOLEND';
  supplyApy: number;
  borrowApy: number;
  utilization: number;
  ltv: number;
  isBestSupply?: boolean;
  isBestBorrow?: boolean;
  onClick?: () => void;
}

const RateCard = ({
  token,
  protocol,
  supplyApy,
  borrowApy,
  utilization,
  ltv,
  isBestSupply,
  isBestBorrow,
  onClick,
}: RateCardProps) => {
  return (
    <div
      onClick={onClick}
      css={css`
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 1rem;
        cursor: ${onClick ? 'pointer' : 'default'};
        transition: all 0.15s;

        &:hover {
          border-color: var(--border-default);
          background: var(--bg-surface-hover);
        }
      `}
    >
      <div css={css`
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.75rem;
      `}>
        <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
          <span css={css`font-size: 1.25rem; font-weight: 600; color: var(--text-primary);`}>
            {token}
          </span>
          <ProtocolBadge protocol={protocol} size="sm" />
        </div>
        {(isBestSupply || isBestBorrow) && (
          <Star size={16} weight="fill" css={css`color: var(--clr-primary);`} />
        )}
      </div>

      <div css={css`display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;`}>
        <div>
          <div css={css`
            display: flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.6875rem;
            color: var(--text-tertiary);
            margin-bottom: 0.25rem;
          `}>
            <TrendUp size={12} />
            Supply APY
            {isBestSupply && <span css={css`color: var(--clr-primary); font-weight: 600;`}>BEST</span>}
          </div>
          <div css={css`
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--status-success);
          `}>
            {supplyApy.toFixed(2)}%
          </div>
        </div>

        <div>
          <div css={css`
            display: flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.6875rem;
            color: var(--text-tertiary);
            margin-bottom: 0.25rem;
          `}>
            <TrendDown size={12} />
            Borrow APY
            {isBestBorrow && <span css={css`color: var(--clr-primary); font-weight: 600;`}>BEST</span>}
          </div>
          <div css={css`
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--status-error);
          `}>
            {borrowApy.toFixed(2)}%
          </div>
        </div>
      </div>

      <div css={css`
        display: flex;
        justify-content: space-between;
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border-subtle);
        font-size: 0.75rem;
        color: var(--text-secondary);
      `}>
        <span>Utilization: {utilization.toFixed(1)}%</span>
        <span>Max LTV: {ltv}%</span>
      </div>
    </div>
  );
};

export default RateCard;
