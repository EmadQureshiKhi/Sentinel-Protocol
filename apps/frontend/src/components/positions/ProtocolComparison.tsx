/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Star, CheckCircle } from '@phosphor-icons/react';
import ProtocolBadge from '../rates/ProtocolBadge';
import { ProtocolQuote } from '../../hooks/usePositions';

interface ProtocolComparisonProps {
  quotes: ProtocolQuote[];
  selectedProtocol: string | null;
  onSelectProtocol: (protocol: string) => void;
}

const ProtocolComparison = ({ quotes, selectedProtocol, onSelectProtocol }: ProtocolComparisonProps) => {
  if (!quotes || quotes.length === 0) {
    return null;
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    `}>
      <h3 css={css`
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
      `}>
        Compare Protocols
      </h3>

      <div css={css`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
      `}>
        {quotes.map((quote) => {
          const isSelected = selectedProtocol === quote.protocol;
          const isBest = quote.isRecommended;

          return (
            <button
              key={quote.protocol}
              onClick={() => onSelectProtocol(quote.protocol)}
              css={css`
                background: ${isSelected ? 'var(--clr-primary-bg)' : 'var(--bg-surface)'};
                border: 1px solid ${isSelected ? 'var(--clr-primary)' : 'var(--border-subtle)'};
                border-radius: 12px;
                padding: 1rem;
                cursor: pointer;
                text-align: left;
                transition: all 0.15s;
                position: relative;

                &:hover {
                  border-color: ${isSelected ? 'var(--clr-primary)' : 'var(--border-default)'};
                }
              `}
            >
              {/* Best badge */}
              {isBest && (
                <div css={css`
                  position: absolute;
                  top: -8px;
                  right: 12px;
                  display: flex;
                  align-items: center;
                  gap: 0.25rem;
                  padding: 0.125rem 0.5rem;
                  background: var(--clr-primary);
                  color: var(--bg-base);
                  font-size: 0.625rem;
                  font-weight: 700;
                  border-radius: 4px;
                  text-transform: uppercase;
                `}>
                  <Star size={10} weight="fill" />
                  Best
                </div>
              )}

              {/* Selected indicator */}
              {isSelected && (
                <CheckCircle
                  size={18}
                  weight="fill"
                  css={css`
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    color: var(--clr-primary);
                  `}
                />
              )}

              <div css={css`margin-bottom: 0.75rem;`}>
                <ProtocolBadge protocol={quote.protocol} size="sm" />
              </div>

              <div css={css`
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.5rem;
                font-size: 0.75rem;
              `}>
                <div>
                  <div css={css`color: var(--text-tertiary); margin-bottom: 0.125rem;`}>
                    Borrow APY
                  </div>
                  <div css={css`color: var(--status-error); font-weight: 600;`}>
                    {quote.borrowApy.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div css={css`color: var(--text-tertiary); margin-bottom: 0.125rem;`}>
                    Net APY
                  </div>
                  <div css={css`
                    color: ${quote.netApy >= 0 ? 'var(--status-success)' : 'var(--status-error)'};
                    font-weight: 600;
                  `}>
                    {quote.netApy >= 0 ? '+' : ''}{quote.netApy.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div css={css`color: var(--text-tertiary); margin-bottom: 0.125rem;`}>
                    Health Factor
                  </div>
                  <div css={css`
                    color: ${quote.healthFactor >= 1.5 ? 'var(--status-success)' : quote.healthFactor >= 1.2 ? 'var(--status-warning)' : 'var(--status-error)'};
                    font-weight: 600;
                  `}>
                    {quote.healthFactor.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div css={css`color: var(--text-tertiary); margin-bottom: 0.125rem;`}>
                    Max LTV
                  </div>
                  <div css={css`color: var(--text-primary); font-weight: 600;`}>
                    {quote.maxLtv}%
                  </div>
                </div>
              </div>

              {isBest && quote.recommendationReason && (
                <div css={css`
                  margin-top: 0.75rem;
                  padding-top: 0.5rem;
                  border-top: 1px solid var(--border-subtle);
                  font-size: 0.6875rem;
                  color: var(--clr-primary);
                `}>
                  {quote.recommendationReason}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProtocolComparison;
