/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Wallet, CreditCard, Heart, TrendUp, TrendDown } from '@phosphor-icons/react';
import { PortfolioSummary as PortfolioSummaryType, formatUsd } from '../../hooks/usePortfolio';

interface PortfolioSummaryProps {
  portfolio: PortfolioSummaryType | null;
  isLoading?: boolean;
}

const PortfolioSummary = ({ portfolio, isLoading }: PortfolioSummaryProps) => {
  if (isLoading) {
    return (
      <div css={css`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      `}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} css={css`
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 1.25rem;
            animation: pulse 1.5s infinite;
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}>
            <div css={css`height: 1rem; width: 60%; background: var(--bg-header); border-radius: 4px; margin-bottom: 0.75rem;`} />
            <div css={css`height: 2rem; width: 80%; background: var(--bg-header); border-radius: 4px;`} />
          </div>
        ))}
      </div>
    );
  }

  const healthColor = !portfolio ? 'var(--text-tertiary)' :
    portfolio.aggregateHealthFactor >= 2 ? 'var(--status-success)' :
    portfolio.aggregateHealthFactor >= 1.5 ? 'var(--status-warning)' :
    'var(--status-error)';

  const pnlColor = !portfolio ? 'var(--text-tertiary)' :
    portfolio.totalUnrealizedPnl >= 0 ? 'var(--status-success)' : 'var(--status-error)';

  const cards = [
    {
      icon: Wallet,
      label: 'Total Collateral',
      value: portfolio ? formatUsd(portfolio.totalCollateralUsd) : '$0.00',
      color: 'var(--text-primary)',
      subtext: portfolio ? `${portfolio.openPositions} open positions` : null,
    },
    {
      icon: CreditCard,
      label: 'Total Debt',
      value: portfolio ? formatUsd(portfolio.totalDebtUsd) : '$0.00',
      color: 'var(--status-error)',
      subtext: portfolio ? `Net Worth: ${formatUsd(portfolio.netWorth)}` : null,
    },
    {
      icon: Heart,
      label: 'Health Factor',
      value: portfolio ? portfolio.aggregateHealthFactor.toFixed(2) : '—',
      color: healthColor,
      subtext: portfolio?.aggregateHealthFactor < 1.5 ? 'At risk' : 'Healthy',
    },
    {
      icon: portfolio?.totalUnrealizedPnl >= 0 ? TrendUp : TrendDown,
      label: 'Unrealized P&L',
      value: portfolio ? formatUsd(portfolio.totalUnrealizedPnl) : '$0.00',
      color: pnlColor,
      subtext: portfolio ? `Realized: ${formatUsd(portfolio.totalRealizedPnl)}` : null,
    },
  ];

  return (
    <div css={css`
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    `}>
      {cards.map((card, idx) => (
        <div
          key={idx}
          css={css`
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 1.25rem;
          `}
        >
          <div css={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
          `}>
            <card.icon size={18} css={css`color: var(--text-tertiary);`} />
            <span css={css`font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500;`}>
              {card.label}
            </span>
          </div>
          <div css={css`
            font-size: 1.5rem;
            font-weight: 700;
            color: ${card.color};
            margin-bottom: 0.25rem;
          `}>
            {card.value}
          </div>
          {card.subtext && (
            <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>
              {card.subtext}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PortfolioSummary;
