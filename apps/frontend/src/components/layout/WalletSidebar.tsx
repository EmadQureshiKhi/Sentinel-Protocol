/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react';
import { X } from '@phosphor-icons/react';
import { useWallet } from '../../contexts';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

interface WalletSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletSidebar = ({ isOpen, onClose }: WalletSidebarProps) => {
  const { connect, isConnecting, error, installedWallets, clearError } = useWallet();

  const handleConnect = async (walletId: 'phantom' | 'solflare') => {
    try {
      await connect(walletId);
      onClose();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        onClick={onClose}
        css={css`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 999;
        `}
      />

      {/* Sidebar */}
      <div
        css={css`
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 400px;
          background: var(--bg-header);
          border-left: 1px solid var(--border-subtle);
          z-index: 1000;
          overflow-y: auto;
          animation: ${slideIn} 0.3s ease-out;
        `}
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-subtle);
          `}
        >
          <h2
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: var(--text-primary);
              margin: 0;
            `}
          >
            Connect Wallet
          </h2>
          <button
            onClick={onClose}
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background: var(--bg-surface);
              border: 1px solid var(--border-hover);
              border-radius: 8px;
              color: var(--text-secondary);
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                background: var(--bg-surface-hover);
                color: var(--text-primary);
              }
            `}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div css={css`padding: 1.5rem;`}>
          {/* Error Message */}
          {error && (
            <div
              css={css`
                padding: 1rem;
                background: var(--status-danger-bg);
                border: 1px solid var(--status-danger-border);
                border-radius: 12px;
                color: var(--status-danger);
                font-size: 0.875rem;
                margin-bottom: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <span>{error}</span>
              <button
                onClick={clearError}
                css={css`
                  background: transparent;
                  border: none;
                  color: var(--status-danger);
                  cursor: pointer;
                  padding: 0.25rem;
                  &:hover { opacity: 0.7; }
                `}
              >
                ✕
              </button>
            </div>
          )}

          {/* Wallet Options */}
          <div css={css`display: flex; flex-direction: column; gap: 0.75rem;`}>
            {/* Phantom - Recommended */}
            <button
              onClick={() => handleConnect('phantom')}
              disabled={isConnecting}
              css={css`
                width: 100%;
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: var(--bg-surface);
                border: 1px solid var(--clr-primary-border);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                overflow: hidden;
                opacity: ${isConnecting ? 0.5 : 1};

                &:disabled { cursor: not-allowed; }

                &:hover {
                  background: var(--bg-surface-hover);
                  border-color: var(--clr-primary);
                  box-shadow: 0 0 20px rgba(220, 253, 143, 0.2);
                }
              `}
            >
              <img
                src="/phantom-logo.svg"
                alt="Phantom"
                css={css`
                  width: 40px;
                  height: 40px;
                  border-radius: 8px;
                `}
              />
              <div css={css`flex: 1; text-align: left;`}>
                <div css={css`font-size: 0.9375rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;`}>
                  Phantom
                </div>
                <div css={css`font-size: 0.75rem; color: var(--text-secondary);`}>
                  Connect with Phantom wallet
                </div>
              </div>
              <span
                css={css`
                  position: absolute;
                  top: 0.75rem;
                  right: 0.75rem;
                  background: var(--clr-primary-bg);
                  color: var(--clr-primary);
                  font-size: 0.625rem;
                  font-weight: 700;
                  padding: 0.25rem 0.5rem;
                  border-radius: 4px;
                `}
              >
                Recommended
              </span>
            </button>

            {/* Solflare */}
            <button
              onClick={() => handleConnect('solflare')}
              disabled={isConnecting}
              css={css`
                width: 100%;
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: var(--bg-surface);
                border: 1px solid var(--border-default);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                opacity: ${isConnecting ? 0.5 : 1};

                &:hover {
                  background: var(--bg-surface-hover);
                  border-color: var(--clr-primary-border);
                }

                &:disabled { cursor: not-allowed; }
              `}
            >
              <img
                src="/solflare-logo.svg"
                alt="Solflare"
                css={css`
                  width: 40px;
                  height: 40px;
                  border-radius: 8px;
                `}
              />
              <div css={css`flex: 1; text-align: left;`}>
                <div css={css`font-size: 0.9375rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;`}>
                  Solflare
                </div>
                <div css={css`font-size: 0.75rem; color: var(--text-secondary);`}>
                  Connect with Solflare wallet
                </div>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div css={css`height: 1px; background: var(--border-subtle); margin: 1.5rem 0;`} />

          {/* Installed Wallets */}
          <div>
            <h3 css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); margin: 0 0 1rem 0;`}>
              Detected Wallets
            </h3>

            {installedWallets.length > 0 ? (
              <div css={css`display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;`}>
                {installedWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet.id)}
                    disabled={isConnecting}
                    css={css`
                      aspect-ratio: 1;
                      background: var(--bg-surface);
                      border: 1px solid var(--border-default);
                      border-radius: 12px;
                      cursor: pointer;
                      transition: all 0.2s;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 0.5rem;
                      opacity: ${isConnecting ? 0.5 : 1};

                      &:hover {
                        background: var(--bg-surface-hover);
                        border-color: var(--clr-primary-border);
                      }

                      &:disabled { cursor: not-allowed; }
                    `}
                  >
                    <img
                      src={wallet.id === 'phantom' ? '/phantom-logo.svg' : '/solflare-logo.svg'}
                      alt={wallet.id}
                      css={css`width: 28px; height: 28px;`}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div css={css`text-align: center; color: var(--text-secondary); font-size: 0.875rem; padding: 1rem;`}>
                No wallets detected. Please install Phantom or Solflare.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default WalletSidebar;
