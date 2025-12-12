/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Warning, X, Coins } from '@phosphor-icons/react';
import { useState } from 'react';
import { useNetwork } from '../../contexts';

const FAUCET_LINKS = {
  sol: 'https://faucet.solana.com/',
  usdc: 'https://spl-token-faucet.com/?token-name=USDC-Dev',
};

const DevnetBanner = () => {
  const { isDevnet } = useNetwork();
  const [dismissed, setDismissed] = useState(false);

  if (!isDevnet || dismissed) return null;

  return (
    <div
      css={css`
        background: var(--status-warning-bg);
        border-bottom: 1px solid var(--status-warning-border);
        padding: 0.5rem 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--status-warning);
        `}
      >
        <Warning size={16} weight="fill" />
        <span>
          You're on <strong>Devnet</strong> - Transactions use test tokens only
        </span>
      </div>

      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
        `}
      >
        <a
          href={FAUCET_LINKS.sol}
          target="_blank"
          rel="noopener noreferrer"
          css={css`
            display: flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.5rem;
            background: var(--status-warning);
            color: var(--bg-base);
            font-size: 0.6875rem;
            font-weight: 600;
            border-radius: 4px;
            text-decoration: none;
            &:hover {
              opacity: 0.9;
            }
          `}
        >
          <Coins size={12} />
          Get SOL
        </a>
      </div>

      <button
        onClick={() => setDismissed(true)}
        css={css`
          position: absolute;
          right: 1rem;
          background: transparent;
          border: none;
          color: var(--status-warning);
          cursor: pointer;
          padding: 0.25rem;
          opacity: 0.7;
          &:hover {
            opacity: 1;
          }
        `}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default DevnetBanner;
