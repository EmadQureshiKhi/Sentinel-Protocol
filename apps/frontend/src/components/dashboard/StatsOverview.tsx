/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useStats, useMevSavings } from '../../hooks/useStats';
import { Eye, Warning, Bell, Shield } from '@phosphor-icons/react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
}

function StatCard({ title, value, subtitle, icon, accentColor = '#dcfd8f' }: StatCardProps) {
  return (
    <div
      css={css`
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: 16px;
        padding: 1.5rem;
        transition: all 0.2s;

        &:hover {
          transform: translateY(-2px);
          border-color: ${accentColor}40;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
      `}
    >
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        `}
      >
        <div css={css`flex: 1;`}>
          <p
            css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
              margin-bottom: 0.5rem;
            `}
          >
            {title}
          </p>
          <p
            css={css`
              font-size: 2rem;
              font-weight: 700;
              color: #fff;
              margin-bottom: 0.25rem;
            `}
          >
            {value}
          </p>
          {subtitle && (
            <p
              css={css`
                font-size: 0.75rem;
                color: #666;
              `}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div
          css={css`
            color: ${accentColor};
            opacity: 0.5;
          `}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatsOverview() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: mevStats, isLoading: mevLoading } = useMevSavings();

  if (statsLoading || mevLoading) {
    return (
      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        `}
      >
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid var(--border-default);
              border-radius: 16px;
              padding: 1.5rem;
              animation: pulse 2s infinite;

              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}
          >
            <div css={css`height: 80px;`} />
          </div>
        ))}
      </div>
    );
  }

  const formatMevSaved = (lamports: number) => {
    const sol = lamports / 1e9;
    return sol >= 1 ? `${sol.toFixed(2)} SOL` : `${(sol * 1000).toFixed(2)} mSOL`;
  };

  const atRisk = stats?.atRiskAccounts || 0;
  const activeAlerts = stats?.activeAlerts || 0;

  return (
    <div
      css={css`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
      `}
    >
      <StatCard
        title="Monitored Accounts"
        value={stats?.totalAccounts || 0}
        subtitle="Active positions"
        icon={<Eye size={32} weight="fill" />}
        accentColor="#dcfd8f"
      />
      <StatCard
        title="At Risk"
        value={atRisk}
        subtitle="Risk score ≥ 30"
        icon={<Warning size={32} weight="fill" />}
        accentColor={atRisk > 0 ? '#ff6464' : '#dcfd8f'}
      />
      <StatCard
        title="Active Alerts"
        value={activeAlerts}
        subtitle="Requiring attention"
        icon={<Bell size={32} weight="fill" />}
        accentColor={activeAlerts > 0 ? '#ffa500' : '#dcfd8f'}
      />
      <StatCard
        title="MEV Saved"
        value={mevStats ? formatMevSaved(mevStats.totalMevSaved) : '0 SOL'}
        subtitle={mevStats ? `~$${mevStats.totalMevSavedUsd.toFixed(2)}` : undefined}
        icon={<Shield size={32} weight="fill" />}
        accentColor="#dcfd8f"
      />
    </div>
  );
}

export default StatsOverview;
