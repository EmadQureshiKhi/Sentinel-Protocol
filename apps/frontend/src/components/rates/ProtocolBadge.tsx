/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

interface ProtocolBadgeProps {
  protocol: 'DRIFT' | 'KAMINO' | 'SAVE' | 'LOOPSCALE';
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const protocolColors: Record<string, { bg: string; text: string; border: string }> = {
  DRIFT: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa', border: 'rgba(139, 92, 246, 0.3)' },
  KAMINO: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  SAVE: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.3)' },
  LOOPSCALE: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' },
};

const ProtocolBadge = ({ protocol, size = 'md', showName = true }: ProtocolBadgeProps) => {
  const colors = protocolColors[protocol] || protocolColors.DRIFT;
  
  const sizes = {
    sm: { padding: '0.125rem 0.375rem', fontSize: '0.625rem' },
    md: { padding: '0.25rem 0.5rem', fontSize: '0.75rem' },
    lg: { padding: '0.375rem 0.75rem', fontSize: '0.875rem' },
  };

  return (
    <span
      css={css`
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: ${sizes[size].padding};
        font-size: ${sizes[size].fontSize};
        font-weight: 600;
        color: ${colors.text};
        background: ${colors.bg};
        border: 1px solid ${colors.border};
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.025em;
      `}
    >
      {showName && protocol}
    </span>
  );
};

export default ProtocolBadge;
