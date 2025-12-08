/**
 * Risk Gauge Component
 * Circular gauge showing risk score 0-100
 */

interface RiskGaugeProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

function getRiskLevel(value: number): { label: string; color: string } {
  if (value >= 80) return { label: 'Critical', color: '#ef4444' };
  if (value >= 60) return { label: 'High', color: '#f97316' };
  if (value >= 40) return { label: 'Medium', color: '#eab308' };
  if (value >= 20) return { label: 'Low', color: '#22c55e' };
  return { label: 'Safe', color: '#10b981' };
}

const sizeConfig = {
  sm: { size: 80, strokeWidth: 6, fontSize: 'text-lg' },
  md: { size: 120, strokeWidth: 8, fontSize: 'text-2xl' },
  lg: { size: 160, strokeWidth: 10, fontSize: 'text-3xl' },
};

export function RiskGauge({ value, size = 'md', showLabel = true, label }: RiskGaugeProps) {
  const config = sizeConfig[size];
  const { label: riskLabel, color } = getRiskLevel(value);
  
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  const center = config.size / 2;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: config.size, height: config.size }}>
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${config.fontSize}`} style={{ color }}>
            {Math.round(value)}
          </span>
          {showLabel && (
            <span className="text-xs text-gray-400">{riskLabel}</span>
          )}
        </div>
      </div>
      
      {label && (
        <p className="mt-2 text-sm text-gray-400">{label}</p>
      )}
    </div>
  );
}

export default RiskGauge;
