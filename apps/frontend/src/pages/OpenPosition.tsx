/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretDown, Eye, Bell } from '@phosphor-icons/react';
import { useWallet } from '../contexts';
import {
  usePositionQuote,
  COLLATERAL_TOKENS,
  BORROW_TOKENS,
} from '../hooks/usePositions';
import ProtocolComparison from '../components/positions/ProtocolComparison';
import PositionPreview from '../components/positions/PositionPreview';
import OpenPositionButton from '../components/positions/OpenPositionButton';

const LEVERAGE_MARKS = [1.5, 2, 3, 4, 5, 7, 10];

const OpenPosition = () => {
  const navigate = useNavigate();
  const { connection } = useWallet();
  const walletAddress = connection?.account?.publicKey || null;

  // Form state
  const [collateralToken, setCollateralToken] = useState('SOL');
  const [collateralAmount, setCollateralAmount] = useState<string>('');
  const [borrowToken, setBorrowToken] = useState('USDC');
  const [leverage, setLeverage] = useState(2);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [autoMonitor, setAutoMonitor] = useState(true);
  const [enableAlerts, setEnableAlerts] = useState(true);

  // Build quote params
  const quoteParams = useMemo(() => {
    const amount = parseFloat(collateralAmount);
    if (!walletAddress || !amount || amount <= 0) return null;
    return {
      walletAddress,
      collateralToken,
      collateralAmount: amount,
      borrowToken,
      leverage,
    };
  }, [walletAddress, collateralToken, collateralAmount, borrowToken, leverage]);

  // Fetch quote
  const { data: quoteData, isLoading: quoteLoading } = usePositionQuote(quoteParams);

  // Get selected quote
  const selectedQuote = useMemo(() => {
    if (!quoteData?.quotes) return null;
    if (selectedProtocol) {
      return quoteData.quotes.find((q: any) => q.protocol === selectedProtocol) || null;
    }
    return quoteData.bestQuote || null;
  }, [quoteData, selectedProtocol]);

  // Auto-select best protocol when quote loads
  useMemo(() => {
    if (quoteData?.bestQuote && !selectedProtocol) {
      setSelectedProtocol(quoteData.bestQuote.protocol);
    }
  }, [quoteData]);

  const handleSuccess = () => {
    navigate('/portfolio');
  };


  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    `}>
      {/* Header */}
      <div>
        <h1 css={css`font-size: 1.5rem; font-weight: 600; color: var(--clr-primary); margin-bottom: 0.25rem;`}>
          Open Leveraged Position
        </h1>
        <p css={css`font-size: 0.875rem; color: var(--text-secondary);`}>
          Deposit collateral and borrow against it across multiple protocols
        </p>
      </div>

      <div css={css`
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 1.5rem;

        @media (max-width: 1024px) {
          grid-template-columns: 1fr;
        }
      `}>
        {/* Left Column - Form */}
        <div css={css`display: flex; flex-direction: column; gap: 1.5rem;`}>
          {/* Position Configuration - Combined Container */}
          <div css={css`
            background: var(--bg-surface);
            border: 1px solid var(--border-default);
            border-radius: 12px;
            overflow: hidden;
          `}>
            {/* Collateral Section */}
            <div css={css`padding: 1.25rem; border-bottom: 1px solid var(--border-default);`}>
              <h3 css={css`font-size: 0.875rem; font-weight: 600; color: var(--clr-primary); margin-bottom: 1rem;`}>
                Collateral
              </h3>

              <div css={css`display: flex; gap: 0.75rem;`}>
                {/* Token Selector */}
                <div css={css`position: relative; width: 140px;`}>
                  <select
                    value={collateralToken}
                    onChange={(e) => setCollateralToken(e.target.value)}
                    css={css`
                      width: 100%;
                      padding: 0.75rem 2rem 0.75rem 0.75rem;
                      background: var(--bg-header);
                      border: 1px solid var(--border-default);
                      border-radius: 8px;
                      color: var(--text-primary);
                      font-size: 0.875rem;
                      font-weight: 600;
                      cursor: pointer;
                      appearance: none;
                      &:focus { outline: none; border-color: var(--clr-primary); }
                    `}
                  >
                    {COLLATERAL_TOKENS.map(token => (
                      <option key={token} value={token}>{token}</option>
                    ))}
                  </select>
                  <CaretDown size={14} css={css`
                    position: absolute;
                    right: 0.75rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-secondary);
                    pointer-events: none;
                  `} />
                </div>

                {/* Amount Input */}
                <input
                  type="number"
                  placeholder="0.00"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  css={css`
                    flex: 1;
                    padding: 0.75rem;
                    background: var(--bg-header);
                    border: 1px solid var(--border-default);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 1rem;
                    font-weight: 600;
                    &:focus { outline: none; border-color: var(--clr-primary); }
                    &::placeholder { color: var(--text-tertiary); }
                  `}
                />
              </div>

              {quoteData?.currentPrices && collateralAmount && (
                <div css={css`
                  margin-top: 0.5rem;
                  font-size: 0.75rem;
                  color: var(--text-tertiary);
                  text-align: right;
                `}>
                  ≈ ${(parseFloat(collateralAmount) * quoteData.currentPrices.collateral).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              )}
            </div>

            {/* Borrow Section */}
            <div css={css`padding: 1.25rem; border-bottom: 1px solid var(--border-default);`}>
              <h3 css={css`font-size: 0.875rem; font-weight: 600; color: var(--clr-primary); margin-bottom: 1rem;`}>
                Borrow
              </h3>

              <div css={css`position: relative; width: 140px;`}>
                <select
                  value={borrowToken}
                  onChange={(e) => setBorrowToken(e.target.value)}
                  css={css`
                    width: 100%;
                    padding: 0.75rem 2rem 0.75rem 0.75rem;
                    background: var(--bg-header);
                    border: 1px solid var(--border-default);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    appearance: none;
                    &:focus { outline: none; border-color: var(--clr-primary); }
                  `}
                >
                  {BORROW_TOKENS.map(token => (
                    <option key={token} value={token}>{token}</option>
                  ))}
                </select>
                <CaretDown size={14} css={css`
                  position: absolute;
                  right: 0.75rem;
                  top: 50%;
                  transform: translateY(-50%);
                  color: var(--text-secondary);
                  pointer-events: none;
                `} />
              </div>
            </div>

            {/* Leverage Section */}
            <div css={css`padding: 1.25rem; border-bottom: 1px solid var(--border-default);`}>
              <div css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.75rem;
              `}>
                <h3 css={css`font-size: 0.875rem; font-weight: 600; color: var(--clr-primary);`}>
                  Leverage
                </h3>
                <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
                  <input
                    type="number"
                    min="1.1"
                    max="10"
                    step="0.1"
                    value={leverage}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 1.1 && val <= 10) {
                        setLeverage(Math.round(val * 10) / 10);
                      }
                    }}
                    css={css`
                      width: 60px;
                      padding: 0.375rem 0.5rem;
                      background: var(--bg-header);
                      border: 1px solid var(--border-default);
                      border-radius: 6px;
                      color: var(--clr-primary);
                      font-size: 0.875rem;
                      font-weight: 700;
                      text-align: center;
                      &:focus { outline: none; border-color: var(--clr-primary); }
                    `}
                  />
                  <span css={css`font-size: 0.875rem; font-weight: 600; color: var(--text-secondary);`}>x</span>
                </div>
              </div>

              <input
                type="range"
                min="1.1"
                max="10"
                step="0.1"
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                css={css`
                  width: 100%;
                  height: 4px;
                  background: linear-gradient(to right, var(--clr-primary) ${((leverage - 1.1) / 8.9) * 100}%, var(--bg-header) ${((leverage - 1.1) / 8.9) * 100}%);
                  border-radius: 2px;
                  appearance: none;
                  cursor: pointer;

                  &::-webkit-slider-thumb {
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    background: var(--clr-primary);
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  }
                `}
              />

              <div css={css`
                display: flex;
                justify-content: space-between;
                margin-top: 0.5rem;
                gap: 0.25rem;
              `}>
                {LEVERAGE_MARKS.map(mark => (
                  <button
                    key={mark}
                    onClick={() => setLeverage(mark)}
                    css={css`
                      padding: 0.2rem 0.4rem;
                      background: ${leverage === mark ? 'var(--clr-primary-bg)' : 'transparent'};
                      border: 1px solid ${leverage === mark ? 'var(--clr-primary)' : 'var(--border-default)'};
                      border-radius: 4px;
                      color: ${leverage === mark ? 'var(--clr-primary)' : 'var(--text-tertiary)'};
                      font-size: 0.625rem;
                      font-weight: 600;
                      cursor: pointer;
                      &:hover { border-color: var(--clr-primary); color: var(--text-secondary); }
                    `}
                  >
                    {mark}x
                  </button>
                ))}
              </div>
            </div>

            {/* Open Position Button */}
            <div css={css`padding: 1.25rem;`}>
              <OpenPositionButton
                quote={selectedQuote}
                walletAddress={walletAddress}
                collateralToken={collateralToken}
                collateralAmount={parseFloat(collateralAmount) || 0}
                borrowToken={borrowToken}
                leverage={leverage}
                selectedProtocol={selectedProtocol}
                autoMonitor={autoMonitor}
                enableAlerts={enableAlerts}
                onSuccess={handleSuccess}
              />
            </div>
          </div>

          {/* Protocol Comparison */}
          {quoteData?.quotes && (
            <ProtocolComparison
              quotes={quoteData.quotes}
              selectedProtocol={selectedProtocol}
              onSelectProtocol={setSelectedProtocol}
            />
          )}
        </div>

        {/* Right Column - Preview & Actions */}
        <div css={css`display: flex; flex-direction: column; gap: 1rem;`}>
          <PositionPreview
            quote={selectedQuote}
            collateralToken={collateralToken}
            collateralAmount={parseFloat(collateralAmount) || 0}
            borrowToken={borrowToken}
            currentPrices={quoteData?.currentPrices}
            isLoading={quoteLoading}
          />

          {/* Options */}
          <div css={css`
            background: var(--bg-surface);
            border: 1px solid var(--border-default);
            border-radius: 12px;
            padding: 1rem;
          `}>
            <label css={css`
              display: flex;
              align-items: center;
              gap: 0.75rem;
              padding: 0.5rem 0;
              cursor: pointer;
            `}>
              <input
                type="checkbox"
                checked={autoMonitor}
                onChange={(e) => setAutoMonitor(e.target.checked)}
                css={css`
                  width: 18px;
                  height: 18px;
                  accent-color: var(--clr-primary);
                  cursor: pointer;
                `}
              />
              <Eye size={18} css={css`color: var(--text-secondary);`} />
              <span css={css`font-size: 0.875rem; color: var(--text-primary);`}>
                Auto-monitor this position
              </span>
            </label>

            <label css={css`
              display: flex;
              align-items: center;
              gap: 0.75rem;
              padding: 0.5rem 0;
              cursor: pointer;
            `}>
              <input
                type="checkbox"
                checked={enableAlerts}
                onChange={(e) => setEnableAlerts(e.target.checked)}
                css={css`
                  width: 18px;
                  height: 18px;
                  accent-color: var(--clr-primary);
                  cursor: pointer;
                `}
              />
              <Bell size={18} css={css`color: var(--text-secondary);`} />
              <span css={css`font-size: 0.875rem; color: var(--text-primary);`}>
                Enable protection alerts
              </span>
            </label>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OpenPosition;
