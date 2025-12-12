/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState, useEffect } from 'react';

interface WatchlistToken {
  id: string;
  symbol: string;
  name: string;
  coingeckoId?: string;
  price: number;
  change24h: number;
}

const WatchlistBar = () => {
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [watchlistTokens, setWatchlistTokens] = useState<WatchlistToken[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('liquidation_shield_watchlist');
      return saved ? JSON.parse(saved) : [
        { id: 'solana', symbol: 'SOL', name: 'Solana', coingeckoId: 'solana', price: 0, change24h: 0 },
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin', price: 0, change24h: 0 },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum', price: 0, change24h: 0 },
      ];
    }
    return [];
  });

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('liquidation_shield_watchlist', JSON.stringify(watchlistTokens));
  }, [watchlistTokens]);

  // Fetch prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      if (watchlistTokens.length === 0) return;

      try {
        setIsLoadingPrices(true);
        const coingeckoIds = watchlistTokens
          .filter(token => token.coingeckoId)
          .map(token => token.coingeckoId)
          .join(',');

        if (!coingeckoIds) {
          setIsLoadingPrices(false);
          return;
        }

        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd&include_24hr_change=true`
        );
        const data = await response.json();

        const updatedTokens = watchlistTokens.map(token => ({
          ...token,
          price: data[token.coingeckoId!]?.usd || token.price,
          change24h: data[token.coingeckoId!]?.usd_24h_change || token.change24h,
        }));

        setWatchlistTokens(updatedTokens);
      } catch (error) {
        console.error('Error fetching watchlist prices:', error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [watchlistTokens.length]);

  return (
    <div
      css={css`
        background: var(--bg-header);
        border-bottom: 1px solid var(--border-subtle);
        padding: 0.25rem 1rem;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.6875rem;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 0.375rem;
            color: var(--text-muted);
            padding-right: 0.75rem;
            border-right: 1px solid var(--border-hover);
          `}
        >
          <span css={css`font-size: 0.6875rem;`}>Watchlist</span>
          <button
            css={css`
              background: transparent;
              border: none;
              color: var(--text-muted);
              cursor: pointer;
              padding: 0;
              display: flex;
              align-items: center;
              font-size: 0.75rem;

              &:hover {
                color: var(--text-primary);
              }
            `}
          >
            ⋮
          </button>
        </div>

        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 0.75rem;
            overflow-x: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
            
            &::-webkit-scrollbar {
              display: none;
            }
          `}
        >
          {watchlistTokens.map((token, index) => (
            <div
              key={token.id}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.375rem;
                padding-right: ${index < watchlistTokens.length - 1 ? '0.75rem' : '0'};
                border-right: ${index < watchlistTokens.length - 1 ? '1px solid var(--border-hover)' : 'none'};
                white-space: nowrap;
                flex-shrink: 0;
              `}
            >
              <span css={css`color: var(--text-muted);`}>{token.symbol}</span>
              <span css={css`color: var(--text-primary);`}>
                {isLoadingPrices ? '...' : `$${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
              {!isLoadingPrices && token.price > 0 && (
                <span css={css`color: ${token.change24h >= 0 ? 'var(--status-success)' : 'var(--status-danger)'};`}>
                  {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                </span>
              )}
            </div>
          ))}

          {watchlistTokens.length === 0 && (
            <div css={css`color: var(--text-muted); font-size: 0.75rem;`}>
              Click ⋮ to add tokens to your watchlist
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchlistBar;
