/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState, useEffect } from 'react';
import {
  Bell,
  Shield,
  Sliders,
  Globe,
  FloppyDisk,
  ArrowCounterClockwise,
  CloudCheck,
  CloudSlash,
  Timer,
} from '@phosphor-icons/react';

interface Settings {
  riskScoreThreshold: number;
  healthFactorThreshold: number;
  cascadeProbabilityThreshold: number;
  autoProtect: boolean;
  defaultSwapPercent: number;
  maxSlippageBps: number;
  defaultTipLamports: number;
  useJitoBundle: boolean;
  browserNotifications: boolean;
  soundAlerts: boolean;
  emailAlerts: boolean;
  network: 'mainnet' | 'devnet';
  rpcEndpoint: string;
}

const DEFAULT_SETTINGS: Settings = {
  riskScoreThreshold: 60,
  healthFactorThreshold: 1.2,
  cascadeProbabilityThreshold: 0.5,
  autoProtect: false,
  defaultSwapPercent: 10,
  maxSlippageBps: 100,
  defaultTipLamports: 10000,
  useJitoBundle: true,
  browserNotifications: true,
  soundAlerts: false,
  emailAlerts: false,
  network: 'mainnet',
  rpcEndpoint: '',
};

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('liquidation-shield-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const [saved, setSaved] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    status: 'checking' | 'online' | 'offline';
    uptime?: string;
    orchestrator?: {
      running: boolean;
      uptimeFormatted: string | null;
      autoShutdown: { remainingFormatted: string | null };
    };
  }>({ status: 'checking' });
  const [orchestratorLoading, setOrchestratorLoading] = useState(false);

  // Check backend status
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/server/status`, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          const data = await response.json();
          setBackendStatus({
            status: 'online',
            uptime: data.data.uptimeFormatted,
            orchestrator: data.data.orchestrator,
          });
        } else {
          setBackendStatus({ status: 'offline' });
        }
      } catch {
        setBackendStatus({ status: 'offline' });
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000); // Check every 5 seconds for orchestrator status
    return () => clearInterval(interval);
  }, []);

  const handleOrchestratorToggle = async () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const isRunning = backendStatus.orchestrator?.running;
    
    setOrchestratorLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/server/orchestrator/${isRunning ? 'stop' : 'start'}`, {
        method: 'POST',
      });
      if (response.ok) {
        // Refresh status
        const statusResponse = await fetch(`${apiUrl}/api/server/status`);
        if (statusResponse.ok) {
          const data = await statusResponse.json();
          setBackendStatus({
            status: 'online',
            uptime: data.data.uptimeFormatted,
            orchestrator: data.data.orchestrator,
          });
        }
      }
    } catch (error) {
      console.error('Failed to toggle orchestrator:', error);
    } finally {
      setOrchestratorLoading(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem('liquidation-shield-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('liquidation-shield-settings');
  };


  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const ToggleSwitch = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      css={css`
        position: relative;
        width: 48px;
        height: 24px;
        background: ${value ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s;
      `}
    >
      <span
        css={css`
          position: absolute;
          top: 2px;
          left: ${value ? '26px' : '2px'};
          width: 20px;
          height: 20px;
          background: ${value ? '#0a0e27' : '#fff'};
          border-radius: 50%;
          transition: left 0.2s;
        `}
      />
    </button>
  );

  return (
    <div
      css={css`
        min-height: 100vh;
        padding: 2rem;
      `}
    >
      <div
        css={css`
          max-width: 900px;
          margin: 0 auto;
        `}
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
          `}
        >
          <div>
            <h1
              css={css`
                font-size: 2rem;
                font-weight: 700;
                color: #fff;
                margin-bottom: 0.5rem;
              `}
            >
              Settings
            </h1>
            <p
              css={css`
                color: #a0a0a0;
                font-size: 0.9375rem;
              `}
            >
              Configure your protection preferences
            </p>
          </div>
          <div
            css={css`
              display: flex;
              gap: 0.75rem;
            `}
          >
            <button
              onClick={handleReset}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.25rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                color: #fff;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 255, 255, 0.1);
                }
              `}
            >
              <ArrowCounterClockwise size={18} />
              Reset
            </button>
            <button
              onClick={handleSave}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.25rem;
                background: ${saved ? '#dcfd8f' : '#dcfd8f'};
                color: #0a0e27;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 8px 24px rgba(220, 253, 143, 0.3);
                }
              `}
            >
              <FloppyDisk size={18} weight="fill" />
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          `}
        >
          {/* Backend Status */}
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid ${backendStatus.status === 'online' ? 'rgba(220, 253, 143, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1rem;
              `}
            >
              {backendStatus.status === 'online' ? (
                <CloudCheck size={24} color="#dcfd8f" weight="fill" />
              ) : backendStatus.status === 'checking' ? (
                <CloudCheck size={24} color="#a0a0a0" weight="fill" />
              ) : (
                <CloudSlash size={24} color="#ef4444" weight="fill" />
              )}
              <h2
                css={css`
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: #fff;
                `}
              >
                Backend Server
              </h2>
              <span
                css={css`
                  margin-left: auto;
                  padding: 0.25rem 0.75rem;
                  border-radius: 9999px;
                  font-size: 0.75rem;
                  font-weight: 600;
                  background: ${backendStatus.status === 'online' ? 'rgba(220, 253, 143, 0.2)' : backendStatus.status === 'checking' ? 'rgba(160, 160, 160, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                  color: ${backendStatus.status === 'online' ? '#dcfd8f' : backendStatus.status === 'checking' ? '#a0a0a0' : '#ef4444'};
                `}
              >
                {backendStatus.status === 'online' ? '● Online' : backendStatus.status === 'checking' ? '● Checking...' : '● Offline'}
              </span>
            </div>

            {backendStatus.status === 'online' && (
              <>
                {/* Orchestrator Control */}
                <div
                  css={css`
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: ${backendStatus.orchestrator?.running ? 'rgba(220, 253, 143, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
                    border: 1px solid ${backendStatus.orchestrator?.running ? 'rgba(220, 253, 143, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
                    border-radius: 12px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 1rem;
                  `}
                >
                  <div>
                    <div css={css`font-size: 0.9375rem; font-weight: 600; color: #fff; margin-bottom: 0.25rem;`}>
                      Monitoring Service
                    </div>
                    <div css={css`font-size: 0.75rem; color: #a0a0a0;`}>
                      {backendStatus.orchestrator?.running 
                        ? `Running for ${backendStatus.orchestrator.uptimeFormatted} • Auto-stops in ${backendStatus.orchestrator.autoShutdown?.remainingFormatted || '~1hr'}`
                        : 'Start to enable Drift monitoring, alerts, and health checks'}
                    </div>
                  </div>
                  <button
                    onClick={handleOrchestratorToggle}
                    disabled={orchestratorLoading}
                    css={css`
                      padding: 0.625rem 1.25rem;
                      background: ${backendStatus.orchestrator?.running ? 'rgba(239, 68, 68, 0.2)' : '#dcfd8f'};
                      color: ${backendStatus.orchestrator?.running ? '#ef4444' : '#0a0e27'};
                      border: 1px solid ${backendStatus.orchestrator?.running ? 'rgba(239, 68, 68, 0.3)' : 'transparent'};
                      border-radius: 8px;
                      font-weight: 600;
                      font-size: 0.875rem;
                      cursor: pointer;
                      transition: all 0.2s;
                      min-width: 80px;

                      &:hover {
                        transform: translateY(-1px);
                        box-shadow: ${backendStatus.orchestrator?.running ? '0 4px 12px rgba(239, 68, 68, 0.2)' : '0 4px 12px rgba(220, 253, 143, 0.3)'};
                      }

                      &:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                        transform: none;
                      }
                    `}
                  >
                    {orchestratorLoading ? '...' : backendStatus.orchestrator?.running ? 'Stop' : 'Start'}
                  </button>
                </div>

                <div
                  css={css`
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                  `}
                >
                  <div
                    css={css`
                      background: rgba(255, 255, 255, 0.05);
                      border-radius: 8px;
                      padding: 1rem;
                    `}
                  >
                    <div css={css`display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;`}>
                      <Timer size={16} color="#a0a0a0" />
                      <span css={css`font-size: 0.75rem; color: #a0a0a0;`}>Session Uptime</span>
                    </div>
                    <span css={css`font-size: 1.25rem; font-weight: 600; color: ${backendStatus.orchestrator?.running ? '#dcfd8f' : '#a0a0a0'};`}>
                      {backendStatus.orchestrator?.running ? backendStatus.orchestrator.uptimeFormatted || '0m 0s' : '-'}
                    </span>
                  </div>
                  <div
                    css={css`
                      background: rgba(255, 255, 255, 0.05);
                      border-radius: 8px;
                      padding: 1rem;
                    `}
                  >
                    <div css={css`display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;`}>
                      <Shield size={16} color="#a0a0a0" weight="fill" />
                      <span css={css`font-size: 0.75rem; color: #a0a0a0;`}>Monitoring Status</span>
                    </div>
                    <span css={css`font-size: 1.25rem; font-weight: 600; color: ${backendStatus.orchestrator?.running ? '#dcfd8f' : '#a0a0a0'};`}>
                      {backendStatus.orchestrator?.running ? 'Active' : 'Stopped'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {backendStatus.status === 'offline' && (
              <div
                css={css`
                  background: rgba(239, 68, 68, 0.1);
                  border: 1px solid rgba(239, 68, 68, 0.2);
                  border-radius: 8px;
                  padding: 1rem;
                `}
              >
                <p css={css`font-size: 0.875rem; color: #ef4444; margin-bottom: 0.5rem;`}>
                  Backend server is not running
                </p>
                <p css={css`font-size: 0.75rem; color: #a0a0a0;`}>
                  Start the backend on Railway or locally to use all features. 
                  The server auto-shuts down after 1 hour to save credits.
                </p>
              </div>
            )}
          </div>

          {/* Alert Thresholds */}
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1.5rem;
              `}
            >
              <Bell size={24} color="#ffa500" weight="fill" />
              <h2
                css={css`
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: #fff;
                `}
              >
                Alert Thresholds
              </h2>
            </div>

            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
              `}
            >
              <div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                  `}
                >
                  <label css={css`font-size: 0.875rem; color: #a0a0a0;`}>
                    Risk Score Threshold
                  </label>
                  <span css={css`font-size: 0.875rem; font-weight: 600; color: #fff;`}>
                    {settings.riskScoreThreshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={90}
                  value={settings.riskScoreThreshold}
                  onChange={(e) => updateSetting('riskScoreThreshold', Number(e.target.value))}
                  css={css`
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    outline: none;
                    -webkit-appearance: none;

                    &::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                    }

                    &::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                      border: none;
                    }
                  `}
                />
                <p css={css`font-size: 0.75rem; color: #666; margin-top: 0.5rem;`}>
                  Trigger alerts when risk score exceeds this value
                </p>
              </div>

              <div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                  `}
                >
                  <label css={css`font-size: 0.875rem; color: #a0a0a0;`}>
                    Health Factor Threshold
                  </label>
                  <span css={css`font-size: 0.875rem; font-weight: 600; color: #fff;`}>
                    {settings.healthFactorThreshold.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={200}
                  value={settings.healthFactorThreshold * 100}
                  onChange={(e) => updateSetting('healthFactorThreshold', Number(e.target.value) / 100)}
                  css={css`
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    outline: none;
                    -webkit-appearance: none;

                    &::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                    }

                    &::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                      border: none;
                    }
                  `}
                />
                <p css={css`font-size: 0.75rem; color: #666; margin-top: 0.5rem;`}>
                  Alert when health factor drops below this value
                </p>
              </div>

              <div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                  `}
                >
                  <label css={css`font-size: 0.875rem; color: #a0a0a0;`}>
                    Cascade Probability Threshold
                  </label>
                  <span css={css`font-size: 0.875rem; font-weight: 600; color: #fff;`}>
                    {(settings.cascadeProbabilityThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={settings.cascadeProbabilityThreshold * 100}
                  onChange={(e) => updateSetting('cascadeProbabilityThreshold', Number(e.target.value) / 100)}
                  css={css`
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    outline: none;
                    -webkit-appearance: none;

                    &::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                    }

                    &::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                      border: none;
                    }
                  `}
                />
                <p css={css`font-size: 0.75rem; color: #666; margin-top: 0.5rem;`}>
                  Alert when cascade probability exceeds this value
                </p>
              </div>
            </div>
          </div>

          {/* Protection Settings */}
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1.5rem;
              `}
            >
              <Shield size={24} color="#dcfd8f" weight="fill" />
              <h2
                css={css`
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: #fff;
                `}
              >
                Protection Settings
              </h2>
            </div>

            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
              `}
            >
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}
              >
                <div>
                  <label css={css`font-size: 0.875rem; font-weight: 600; color: #fff; display: block; margin-bottom: 0.25rem;`}>
                    Auto-Protect
                  </label>
                  <p css={css`font-size: 0.75rem; color: #666;`}>
                    Automatically execute protection when thresholds are exceeded
                  </p>
                </div>
                <ToggleSwitch
                  value={settings.autoProtect}
                  onChange={() => updateSetting('autoProtect', !settings.autoProtect)}
                />
              </div>

              <div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                  `}
                >
                  <label css={css`font-size: 0.875rem; color: #a0a0a0;`}>
                    Default Swap Percentage
                  </label>
                  <span css={css`font-size: 0.875rem; font-weight: 600; color: #fff;`}>
                    {settings.defaultSwapPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={settings.defaultSwapPercent}
                  onChange={(e) => updateSetting('defaultSwapPercent', Number(e.target.value))}
                  css={css`
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    outline: none;
                    -webkit-appearance: none;

                    &::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                    }

                    &::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                      border: none;
                    }
                  `}
                />
                <p css={css`font-size: 0.75rem; color: #666; margin-top: 0.5rem;`}>
                  Default percentage of collateral to swap for protection
                </p>
              </div>

              <div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                  `}
                >
                  <label css={css`font-size: 0.875rem; color: #a0a0a0;`}>
                    Max Slippage (bps)
                  </label>
                  <span css={css`font-size: 0.875rem; font-weight: 600; color: #fff;`}>
                    {settings.maxSlippageBps} bps
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={settings.maxSlippageBps}
                  onChange={(e) => updateSetting('maxSlippageBps', Number(e.target.value))}
                  css={css`
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    outline: none;
                    -webkit-appearance: none;

                    &::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                    }

                    &::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      cursor: pointer;
                      border: none;
                    }
                  `}
                />
                <p css={css`font-size: 0.75rem; color: #666; margin-top: 0.5rem;`}>
                  Maximum allowed slippage for swaps (100 bps = 1%)
                </p>
              </div>

              <div>
                <label css={css`font-size: 0.875rem; color: #a0a0a0; display: block; margin-bottom: 0.5rem;`}>
                  Jito Tip (lamports)
                </label>
                <input
                  type="number"
                  value={settings.defaultTipLamports}
                  onChange={(e) => updateSetting('defaultTipLamports', Number(e.target.value))}
                  min={1000}
                  step={1000}
                  css={css`
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: #fff;
                    font-size: 0.9375rem;

                    &:focus {
                      outline: none;
                      border-color: #dcfd8f;
                    }
                  `}
                />
                <p css={css`font-size: 0.75rem; color: #666; margin-top: 0.5rem;`}>
                  Tip amount for Jito bundle priority (10000 = 0.00001 SOL)
                </p>
              </div>

              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}
              >
                <div>
                  <label css={css`font-size: 0.875rem; font-weight: 600; color: #fff; display: block; margin-bottom: 0.25rem;`}>
                    Use Jito Bundles
                  </label>
                  <p css={css`font-size: 0.75rem; color: #666;`}>
                    Send transactions via Jito for MEV protection
                  </p>
                </div>
                <ToggleSwitch
                  value={settings.useJitoBundle}
                  onChange={() => updateSetting('useJitoBundle', !settings.useJitoBundle)}
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1.5rem;
              `}
            >
              <Sliders size={24} color="#a78bfa" weight="fill" />
              <h2
                css={css`
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: #fff;
                `}
              >
                Notifications
              </h2>
            </div>

            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 1.25rem;
              `}
            >
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}
              >
                <div>
                  <label css={css`font-size: 0.875rem; font-weight: 600; color: #fff; display: block; margin-bottom: 0.25rem;`}>
                    Browser Notifications
                  </label>
                  <p css={css`font-size: 0.75rem; color: #666;`}>
                    Show desktop notifications for alerts
                  </p>
                </div>
                <ToggleSwitch
                  value={settings.browserNotifications}
                  onChange={() => updateSetting('browserNotifications', !settings.browserNotifications)}
                />
              </div>

              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}
              >
                <div>
                  <label css={css`font-size: 0.875rem; font-weight: 600; color: #fff; display: block; margin-bottom: 0.25rem;`}>
                    Sound Alerts
                  </label>
                  <p css={css`font-size: 0.75rem; color: #666;`}>
                    Play sound when critical alerts occur
                  </p>
                </div>
                <ToggleSwitch
                  value={settings.soundAlerts}
                  onChange={() => updateSetting('soundAlerts', !settings.soundAlerts)}
                />
              </div>
            </div>
          </div>

          {/* Network Settings */}
          <div
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1.5rem;
              `}
            >
              <Globe size={24} color="#10b981" weight="fill" />
              <h2
                css={css`
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: #fff;
                `}
              >
                Network
              </h2>
            </div>

            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 1.25rem;
              `}
            >
              <div>
                <label css={css`font-size: 0.875rem; color: #a0a0a0; display: block; margin-bottom: 0.5rem;`}>
                  Network
                </label>
                <div
                  css={css`
                    display: flex;
                    gap: 0.75rem;
                  `}
                >
                  <button
                    onClick={() => updateSetting('network', 'mainnet')}
                    css={css`
                      flex: 1;
                      padding: 0.75rem;
                      background: ${settings.network === 'mainnet' ? '#dcfd8f' : 'rgba(255, 255, 255, 0.05)'};
                      color: ${settings.network === 'mainnet' ? '#0a0e27' : '#a0a0a0'};
                      border: 1px solid ${settings.network === 'mainnet' ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
                      border-radius: 8px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;

                      &:hover {
                        background: ${settings.network === 'mainnet' ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
                      }
                    `}
                  >
                    Mainnet
                  </button>
                  <button
                    onClick={() => updateSetting('network', 'devnet')}
                    css={css`
                      flex: 1;
                      padding: 0.75rem;
                      background: ${settings.network === 'devnet' ? '#dcfd8f' : 'rgba(255, 255, 255, 0.05)'};
                      color: ${settings.network === 'devnet' ? '#0a0e27' : '#a0a0a0'};
                      border: 1px solid ${settings.network === 'devnet' ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
                      border-radius: 8px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;

                      &:hover {
                        background: ${settings.network === 'devnet' ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
                      }
                    `}
                  >
                    Devnet
                  </button>
                </div>
              </div>

              <div>
                <label css={css`font-size: 0.875rem; color: #a0a0a0; display: block; margin-bottom: 0.5rem;`}>
                  Custom RPC Endpoint (optional)
                </label>
                <input
                  type="text"
                  value={settings.rpcEndpoint}
                  onChange={(e) => updateSetting('rpcEndpoint', e.target.value)}
                  placeholder="https://api.mainnet-beta.solana.com"
                  css={css`
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: #fff;
                    font-size: 0.9375rem;

                    &::placeholder {
                      color: #666;
                    }

                    &:focus {
                      outline: none;
                      border-color: #dcfd8f;
                    }
                  `}
                />
                <p css={css`font-size: 0.75rem; color: #666; margin-top: 0.5rem;`}>
                  Leave empty to use default RPC endpoint
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
