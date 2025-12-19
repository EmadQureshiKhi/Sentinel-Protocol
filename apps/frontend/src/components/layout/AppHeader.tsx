/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { MagnifyingGlass, Gear, Shield } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WalletSidebar from './WalletSidebar';
import AccountSidebar from './AccountSidebar';
import WatchlistBar from './WatchlistBar';
import { useWallet, useNetwork } from '../../contexts';

type NavItem = {
  id: string;
  label: string;
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'open-position', label: 'Position' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'rates', label: 'Rates' },
  { id: 'history', label: 'History' },
];

interface AppHeaderProps {
  onPageChange: (page: string) => void;
}

const AppHeader = ({ onPageChange }: AppHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection } = useWallet();
  const { network, toggleNetwork } = useNetwork();
  
  const [activeItem, setActiveItem] = useState(() => {
    return localStorage.getItem('liquidation_shield_active_page') || 'dashboard';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletSidebarOpen, setIsWalletSidebarOpen] = useState(false);
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);

  // Sync active item with route
  useEffect(() => {
    const path = location.pathname.split('/')[1] || 'dashboard';
    setActiveItem(path);
  }, [location.pathname]);

  const handleNavClick = (itemId: string) => {
    setActiveItem(itemId);
    localStorage.setItem('liquidation_shield_active_page', itemId);
    onPageChange(itemId);
    navigate(`/${itemId === 'dashboard' ? '' : itemId}`);
  };



  const handleWalletButtonClick = () => {
    if (connection) {
      setIsAccountSidebarOpen(true);
    } else {
      setIsWalletSidebarOpen(true);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <>
      {/* Main Header */}
      <header
        css={css`
          background: var(--bg-header);
          border-bottom: 1px solid var(--border-subtle);
          padding: 0.25rem 0.75rem;
          position: sticky;
          top: 0;
          z-index: 100;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 2rem;
            max-width: 1600px;
            margin: 0;
            width: 100%;
          `}
        >
          {/* Left: Logo + Navigation */}
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            {/* Logo */}
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.25rem;
                padding-right: 0.5rem;
                margin-right: 0.25rem;
                border-right: 1px solid var(--border-subtle);
              `}
            >
              <img 
                src="/sentinel-icon.png" 
                alt="Sentinel" 
                css={css`
                  width: 42px;
                  height: 42px;
                  object-fit: contain;
                `}
              />
              <span css={css`
                font-size: 0.9375rem;
                font-weight: 800;
                letter-spacing: -0.5px;
                background: linear-gradient(135deg, var(--clr-primary) 0%, #f5d742 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                @media (max-width: 768px) {
                  display: none;
                }
              `}>
                Sentinel
              </span>
            </div>

            {/* Navigation */}
            <nav
              css={css`
                display: flex;
                align-items: center;
                height: 100%;
              `}
            >
              {navItems.map((item) => {
                const isActive = activeItem === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    css={css`
                      display: flex;
                      height: 100%;
                      align-items: center;
                      justify-content: center;
                      font-size: 0.8125rem;
                      line-height: 1.25rem;
                      font-weight: 500;
                      color: ${isActive ? 'var(--clr-primary)' : 'var(--text-secondary)'};
                      width: auto;
                      padding: 0.375rem 0.5rem;
                      background: transparent;
                      border: none;
                      outline: 2px solid transparent;
                      outline-offset: 2px;
                      cursor: pointer;
                      transition: color 0.15s;
                      white-space: nowrap;
                      position: relative;

                      &:hover {
                        color: var(--clr-primary);
                      }
                    `}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Center: Search Bar */}
          <div
            css={css`
              position: absolute;
              left: 50%;
              transform: translateX(-50%);
              width: 100%;
              max-width: 480px;
              display: flex;
              justify-content: center;

              @media (max-width: 1024px) {
                display: none;
              }
            `}
          >
            <div
              css={css`
                width: 100%;
                position: relative;
              `}
            >
              <MagnifyingGlass
                size={14}
                css={css`
                  position: absolute;
                  left: 0.75rem;
                  top: 50%;
                  transform: translateY(-50%);
                  color: #6b6b6b;
                  pointer-events: none;
                `}
              />
              <input
                type="text"
                placeholder="Search accounts, alerts, or features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                css={css`
                  width: 100%;
                  background: transparent;
                  border: 1px solid var(--border-default);
                  color: var(--text-secondary);
                  padding: 0.4rem 0.75rem 0.4rem 2rem;
                  border-radius: 20px;
                  font-size: 0.75rem;
                  outline: none;
                  transition: all 0.15s;

                  &::placeholder {
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                  }

                  &:focus {
                    border-color: var(--border-strong);
                    background: var(--bg-surface);
                  }
                `}
              />
            </div>
          </div>

          {/* Right: Network, Settings & Connect */}
          <div
            css={css`
              display: flex;
              align-items: center;
              height: 100%;
              gap: 0.5rem;
            `}
          >
            {/* Network Switcher */}
            <button
              onClick={toggleNetwork}
              css={css`
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 600;
                color: ${network === 'mainnet-beta' ? 'var(--status-success)' : 'var(--status-warning)'};
                padding: 0.375rem 0.75rem;
                background: ${network === 'mainnet-beta' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)'};
                border: 1px solid ${network === 'mainnet-beta' ? 'var(--status-success-border)' : 'var(--status-warning-border)'};
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;
                gap: 0.375rem;

                &:hover {
                  opacity: 0.9;
                }
              `}
            >
              <span css={css`
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${network === 'mainnet-beta' ? 'var(--status-success)' : 'var(--status-warning)'};
              `} />
              {network === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
            </button>

            {/* Settings Dropdown */}
            <div
              css={css`
                position: relative;
              `}
            >
              <button
                onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                css={css`
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 0.875rem;
                  color: ${location.pathname === '/settings' || location.pathname === '/privacy' ? 'var(--clr-primary)' : 'var(--text-secondary)'};
                  width: 2.75rem;
                  padding: 0.5rem 0.75rem;
                  background: transparent;
                  border: none;
                  cursor: pointer;
                  transition: color 0.15s;

                  &:hover {
                    color: var(--clr-primary);
                  }
                `}
              >
                <Gear size={20} weight="bold" />
              </button>
              
              {isSettingsDropdownOpen && (
                <>
                  <div
                    css={css`
                      position: fixed;
                      inset: 0;
                      z-index: 40;
                    `}
                    onClick={() => setIsSettingsDropdownOpen(false)}
                  />
                  <div
                    css={css`
                      position: absolute;
                      top: 100%;
                      right: 0;
                      margin-top: 0.5rem;
                      background: var(--bg-surface);
                      border: 1px solid var(--border-default);
                      border-radius: 0.5rem;
                      min-width: 160px;
                      z-index: 50;
                      overflow: hidden;
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    `}
                  >
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setIsSettingsDropdownOpen(false);
                      }}
                      css={css`
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        width: 100%;
                        padding: 0.75rem 1rem;
                        background: transparent;
                        border: none;
                        color: ${location.pathname === '/settings' ? 'var(--clr-primary)' : 'var(--text-primary)'};
                        font-size: 0.8125rem;
                        cursor: pointer;
                        transition: background 0.15s;
                        text-align: left;

                        &:hover {
                          background: var(--bg-hover);
                        }
                      `}
                    >
                      <Gear size={16} />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        navigate('/privacy');
                        setIsSettingsDropdownOpen(false);
                      }}
                      css={css`
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        width: 100%;
                        padding: 0.75rem 1rem;
                        background: transparent;
                        border: none;
                        color: ${location.pathname === '/privacy' ? 'var(--clr-primary)' : 'var(--text-primary)'};
                        font-size: 0.8125rem;
                        cursor: pointer;
                        transition: background 0.15s;
                        text-align: left;

                        &:hover {
                          background: var(--bg-hover);
                        }
                      `}
                    >
                      <Shield size={16} />
                      Arcium Privacy
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Wallet Connect Button */}
            <button
              onClick={handleWalletButtonClick}
              css={css`
                display: flex;
                height: 2rem;
                min-width: 2rem;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--clr-primary);
                width: auto;
                padding: 0 0.75rem;
                background: var(--clr-primary-bg);
                border: 1px solid transparent;
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;

                &:hover {
                  border-color: var(--clr-primary);
                }

                @media (min-width: 768px) {
                  height: 2.25rem;
                }
              `}
            >
              {connection
                ? truncateAddress(connection.account.publicKey)
                : 'Connect'}
            </button>
          </div>
        </div>
      </header>

      {/* Watchlist Bar */}
      <WatchlistBar />

      {/* Wallet Connect Sidebar */}
      <WalletSidebar
        isOpen={isWalletSidebarOpen}
        onClose={() => setIsWalletSidebarOpen(false)}
      />

      {/* Account Details Sidebar */}
      <AccountSidebar
        isOpen={isAccountSidebarOpen}
        onClose={() => setIsAccountSidebarOpen(false)}
      />
    </>
  );
};

export default AppHeader;
