/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Warning, Info, TrendUp, TrendDown } from '@phosphor-icons/react';
import { ProtocolQuote } from '../../hooks/usePositions';

interface PositionPreviewProps {
  quote: ProtocolQuote | null;
  collateralToken: string;
  collateralAmount: number;
  borrowToken: string;
  currentPrices?: {
    collateral: number;
    borrow: number;
  };
  isLoading?: boolean;
}

const PositionPreview = ({
  quote,
  collateralToken,
  collateralAmount,
  borrowToken,
  currentPrices,
  isLoading,
}: PositionPreviewProps) => {
  if (isLoading) {
    return (
      <div css={css`
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 1.5rem;
      `}>
        <div css={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} css={css`
              height: 2.5rem;
              background: var(--bg-header);
              border-radius: 8px;
              animation: pulse 1.5s infinite;
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `} />
          ))}
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div css={css`
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 2rem;
        text-align: center;
        color: var(--text-tertiary);
      `}>
        <Info size={32} css={css`margin-bottom: 0.5rem; opacity: 0.5;`} />
        <p>Enter position details to see preview</p>
      </div>
    );
  }

  const healthColor = quote.healthFactor >= 1.5
    ? 'var(--status-success)'
    : quote.healthFactor >= 1.2
    ? 'var(--status-warning)'
    : 'var(--status-error)';

  return (
    <div css={css`
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
    `}>
      <div css={css`
        padding: 1rem 1.25rem;
        background: var(--bg-header);
        border-bottom: 1px solid var(--border-subtle);
      `}>
        <h3 css={css`
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        `}>
          Position Preview
        </h3>
      </div>

      <div css={css`padding: 1.25rem;`}>
        {/* Deposit */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-subtle);
        `}>
          <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
            <TrendUp size={16} css={css`color: var(--status-success);`} />
            <span css={css`font-size: 0.875rem; color: var(--text-secondary);`}>Deposit</span>
          </div>
          <div css={css`text-align: right;`}>
            <div css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-primary);`}>
              {collateralAmount} {collateralToken}
            </div>
            {currentPrices && (
              <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>
                ${(collateralAmount * currentPrices.collateral).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Borrow */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-subtle);
        `}>
          <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
            <TrendDown size={16} css={css`color: var(--status-error);`} />
            <span css={css`font-size: 0.875rem; color: var(--text-secondary);`}>Borrow</span>
          </div>
          <div css={css`text-align: right;`}>
            <div css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-primary);`}>
              {quote.borrowAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {borrowToken}
            </div>
            {currentPrices && (
              <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>
                ${(quote.borrowAmount * currentPrices.borrow).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Total Position */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-subtle);
        `}>
          <span css={css`font-size: 0.875rem; color: var(--text-secondary);`}>Total Position</span>
          <div css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-primary);`}>
            ${quote.totalPositionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Health Factor */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-subtle);
        `}>
          <span css={css`font-size: 0.875rem; color: var(--text-secondary);`}>Health Factor</span>
          <div css={css`
            font-size: 1rem;
            font-weight: 700;
            color: ${healthColor};
          `}>
            {quote.healthFactor.toFixed(2)}
          </div>
        </div>

        {/* Liquidation Price */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-subtle);
        `}>
          <span css={css`font-size: 0.875rem; color: var(--text-secondary);`}>Liquidation Price</span>
          <div css={css`text-align: right;`}>
            <div css={css`font-size: 0.875rem; font-weight: 600; color: var(--status-error);`}>
              ${quote.liquidationPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            {currentPrices && (
              <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>
                {((quote.liquidationPrice / currentPrices.collateral - 1) * 100).toFixed(1)}% from current
              </div>
            )}
          </div>
        </div>

        {/* Fees */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
        `}>
          <span css={css`font-size: 0.875rem; color: var(--text-secondary);`}>Est. Fees</span>
          <div css={css`font-size: 0.875rem; color: var(--text-tertiary);`}>
            ~${quote.estimatedFees.total.toFixed(2)}
          </div>
        </div>

        {/* Warnings */}
        {quote.healthFactor < 1.5 && (
          <div css={css`
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            margin-top: 1rem;
            padding: 0.75rem;
            background: var(--status-warning-bg);
            border: 1px solid var(--status-warning-border);
            border-radius: 8px;
          `}>
            <Warning size={18} css={css`color: var(--status-warning); flex-shrink: 0; margin-top: 2px;`} />
            <div css={css`font-size: 0.75rem; color: var(--status-warning);`}>
              {quote.healthFactor < 1.2
                ? 'Very high risk! Position may be liquidated quickly if price moves against you.'
                : 'Health factor is low. Consider using less leverage for a safer position.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionPreview;
