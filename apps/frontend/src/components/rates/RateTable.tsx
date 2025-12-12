/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Star, CaretUp, CaretDown } from '@phosphor-icons/react';
import { useState } from 'react';
import ProtocolBadge from './ProtocolBadge';

interface TokenRate {
  token: string;
  symbol: string;
  supplyApy: number;
  borrowApy: number;
  utilization: number;
  ltv: number;
  liquidationThreshold: number;
  totalSupply: number;
  totalBorrow: number;
}

interface ProtocolRates {
  protocol: 'DRIFT' | 'MARGINFI' | 'SOLEND';
  rates: TokenRate[];
  tvl: number;
}

interface RateTableProps {
  protocols: ProtocolRates[];
  bestSupplyRates: Record<string, { protocol: string; rate: number }>;
  bestBorrowRates: Record<string, { protocol: string; rate: number }>;
  type: 'supply' | 'borrow';
}

type SortField = 'token' | 'rate' | 'utilization' | 'ltv';
type SortDirection = 'asc' | 'desc';

const RateTable = ({ protocols, bestSupplyRates, bestBorrowRates, type }: RateTableProps) => {
  const [sortField, setSortField] = useState<SortField>('rate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Flatten all rates with protocol info
  const allRates = protocols.flatMap(p =>
    p.rates.map(r => ({
      ...r,
      protocol: p.protocol,
      rate: type === 'supply' ? r.supplyApy : r.borrowApy,
      isBest: type === 'supply'
        ? bestSupplyRates[r.token]?.protocol === p.protocol
        : bestBorrowRates[r.token]?.protocol === p.protocol,
    }))
  );

  // Sort rates
  const sortedRates = [...allRates].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'token':
        comparison = a.token.localeCompare(b.token);
        break;
      case 'rate':
        comparison = a.rate - b.rate;
        break;
      case 'utilization':
        comparison = a.utilization - b.utilization;
        break;
      case 'ltv':
        comparison = a.ltv - b.ltv;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />;
  };


  return (
    <div css={css`
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
    `}>
      <table css={css`
        width: 100%;
        border-collapse: collapse;
      `}>
        <thead>
          <tr css={css`
            background: var(--bg-header);
            border-bottom: 1px solid var(--border-subtle);
          `}>
            <th
              onClick={() => handleSort('token')}
              css={css`
                padding: 0.75rem 1rem;
                text-align: left;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-secondary);
                cursor: pointer;
                user-select: none;
                &:hover { color: var(--text-primary); }
              `}
            >
              <span css={css`display: flex; align-items: center; gap: 0.25rem;`}>
                Token <SortIcon field="token" />
              </span>
            </th>
            <th css={css`
              padding: 0.75rem 1rem;
              text-align: left;
              font-size: 0.75rem;
              font-weight: 600;
              color: var(--text-secondary);
            `}>
              Protocol
            </th>
            <th
              onClick={() => handleSort('rate')}
              css={css`
                padding: 0.75rem 1rem;
                text-align: right;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-secondary);
                cursor: pointer;
                user-select: none;
                &:hover { color: var(--text-primary); }
              `}
            >
              <span css={css`display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;`}>
                {type === 'supply' ? 'Supply APY' : 'Borrow APY'} <SortIcon field="rate" />
              </span>
            </th>
            <th
              onClick={() => handleSort('utilization')}
              css={css`
                padding: 0.75rem 1rem;
                text-align: right;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-secondary);
                cursor: pointer;
                user-select: none;
                &:hover { color: var(--text-primary); }
              `}
            >
              <span css={css`display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;`}>
                Utilization <SortIcon field="utilization" />
              </span>
            </th>
            <th
              onClick={() => handleSort('ltv')}
              css={css`
                padding: 0.75rem 1rem;
                text-align: right;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-secondary);
                cursor: pointer;
                user-select: none;
                &:hover { color: var(--text-primary); }
              `}
            >
              <span css={css`display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;`}>
                Max LTV <SortIcon field="ltv" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRates.map((rate, idx) => (
            <tr
              key={`${rate.protocol}-${rate.token}-${idx}`}
              css={css`
                border-bottom: 1px solid var(--border-subtle);
                transition: background 0.15s;
                &:hover { background: var(--bg-surface-hover); }
                &:last-child { border-bottom: none; }
              `}
            >
              <td css={css`padding: 0.75rem 1rem;`}>
                <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
                  {rate.isBest && <Star size={14} weight="fill" css={css`color: var(--clr-primary);`} />}
                  <span css={css`font-weight: 600; color: var(--text-primary);`}>{rate.token}</span>
                </div>
              </td>
              <td css={css`padding: 0.75rem 1rem;`}>
                <ProtocolBadge protocol={rate.protocol} size="sm" />
              </td>
              <td css={css`
                padding: 0.75rem 1rem;
                text-align: right;
                font-weight: 600;
                font-size: 0.875rem;
                color: ${type === 'supply' ? 'var(--status-success)' : 'var(--status-error)'};
              `}>
                {rate.rate.toFixed(2)}%
              </td>
              <td css={css`
                padding: 0.75rem 1rem;
                text-align: right;
                color: var(--text-secondary);
                font-size: 0.875rem;
              `}>
                {rate.utilization.toFixed(1)}%
              </td>
              <td css={css`
                padding: 0.75rem 1rem;
                text-align: right;
                color: var(--text-secondary);
                font-size: 0.875rem;
              `}>
                {rate.ltv}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RateTable;
