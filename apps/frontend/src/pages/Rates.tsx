/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';
import { TrendUp, TrendDown, ArrowsClockwise, Clock } from '@phosphor-icons/react';
import { useAllRates } from '../hooks/useRates';
import RateTable from '../components/rates/RateTable';
import ProtocolBadge from '../components/rates/ProtocolBadge';

type RateType = 'supply' | 'borrow';

const Rates = () => {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useAllRates();
  const [rateType, setRateType] = useState<RateType>('supply');

  const getTimeSinceUpdate = () => {
    if (!dataUpdatedAt) return '';
    const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  if (isLoading) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      `}>
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
        `}>
          <h1 css={css`font-size: 1.5rem; font-weight: 600; color: var(--text-primary);`}>
            Protocol Rates
          </h1>
        </div>
        <div css={css`
          display: grid;
          grid-template-columns: repeat(3, 1fr);
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
              <div css={css`height: 3rem; background: var(--bg-header); border-radius: 4px;`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem;
        text-align: center;
      `}>
        <p css={css`color: var(--status-error); margin-bottom: 1rem;`}>
          Failed to load rates
        </p>
        <button
          onClick={() => refetch()}
          css={css`
            padding: 0.5rem 1rem;
            background: var(--clr-primary);
            color: var(--bg-base);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
          `}
        >
          Retry
        </button>
      </div>
    );
  }


  const bestSupplyRates = data?.bestSupplyRates || {};
  const bestBorrowRates = data?.bestBorrowRates || {};

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
            Protocol Rates
          </h1>
          <p css={css`font-size: 0.875rem; color: var(--text-secondary);`}>
            Compare lending rates across Drift, MarginFi, and Solend
          </p>
        </div>

        <div css={css`display: flex; align-items: center; gap: 1rem;`}>
          {/* Updated timestamp */}
          <div css={css`
            display: flex;
            align-items: center;
            gap: 0.375rem;
            font-size: 0.75rem;
            color: var(--text-tertiary);
          `}>
            <Clock size={14} />
            Updated {getTimeSinceUpdate()}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => refetch()}
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
        </div>
      </div>

      {/* Protocol Summary Cards */}
      <div css={css`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      `}>
        {data?.protocols?.map((protocol: any) => (
          <div
            key={protocol.protocol}
            css={css`
              background: var(--bg-surface);
              border: 1px solid var(--border-subtle);
              border-radius: 12px;
              padding: 1.25rem;
            `}
          >
            <div css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1rem;
            `}>
              <ProtocolBadge protocol={protocol.protocol} size="md" />
              <span css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>
                TVL: ${(protocol.tvl / 1e6).toFixed(1)}M
              </span>
            </div>
            <div css={css`
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 0.75rem;
            `}>
              <div>
                <div css={css`font-size: 0.6875rem; color: var(--text-tertiary); margin-bottom: 0.25rem;`}>
                  Avg Supply APY
                </div>
                <div css={css`font-size: 1.125rem; font-weight: 600; color: var(--status-success);`}>
                  {(protocol.rates.reduce((sum: number, r: any) => sum + r.supplyApy, 0) / protocol.rates.length).toFixed(2)}%
                </div>
              </div>
              <div>
                <div css={css`font-size: 0.6875rem; color: var(--text-tertiary); margin-bottom: 0.25rem;`}>
                  Avg Borrow APY
                </div>
                <div css={css`font-size: 1.125rem; font-weight: 600; color: var(--status-error);`}>
                  {(protocol.rates.reduce((sum: number, r: any) => sum + r.borrowApy, 0) / protocol.rates.length).toFixed(2)}%
                </div>
              </div>
            </div>
            <div css={css`
              margin-top: 0.75rem;
              font-size: 0.75rem;
              color: var(--text-secondary);
            `}>
              {protocol.rates.length} assets available
            </div>
          </div>
        ))}
      </div>

      {/* Rate Type Toggle */}
      <div css={css`
        display: flex;
        gap: 0.5rem;
        background: var(--bg-surface);
        padding: 0.25rem;
        border-radius: 8px;
        width: fit-content;
      `}>
        <button
          onClick={() => setRateType('supply')}
          css={css`
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.5rem 1rem;
            background: ${rateType === 'supply' ? 'var(--clr-primary-bg)' : 'transparent'};
            border: none;
            border-radius: 6px;
            color: ${rateType === 'supply' ? 'var(--clr-primary)' : 'var(--text-secondary)'};
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
          `}
        >
          <TrendUp size={16} />
          Supply Rates
        </button>
        <button
          onClick={() => setRateType('borrow')}
          css={css`
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.5rem 1rem;
            background: ${rateType === 'borrow' ? 'var(--clr-primary-bg)' : 'transparent'};
            border: none;
            border-radius: 6px;
            color: ${rateType === 'borrow' ? 'var(--clr-primary)' : 'var(--text-secondary)'};
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
          `}
        >
          <TrendDown size={16} />
          Borrow Rates
        </button>
      </div>

      {/* Rate Table */}
      <RateTable
        protocols={data?.protocols || []}
        bestSupplyRates={bestSupplyRates}
        bestBorrowRates={bestBorrowRates}
        type={rateType}
      />
    </div>
  );
};

export default Rates;
