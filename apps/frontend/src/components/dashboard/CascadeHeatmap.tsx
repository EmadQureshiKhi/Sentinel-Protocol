/**
 * Cascade Heatmap Component
 * Visual grid showing accounts by risk level
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface Account {
  id: string;
  walletAddress: string;
  protocol: string;
  snapshots?: {
    riskScore: number;
    healthFactor: number;
  }[];
}

interface CascadeHeatmapProps {
  accounts: Account[];
  loading?: boolean;
}

function getRiskColor(riskScore: number): string {
  if (riskScore >= 80) return 'bg-red-500';
  if (riskScore >= 60) return 'bg-orange-500';
  if (riskScore >= 40) return 'bg-yellow-500';
  if (riskScore >= 20) return 'bg-green-400';
  return 'bg-green-500';
}

function getRiskBorderColor(riskScore: number): string {
  if (riskScore >= 80) return 'border-red-400';
  if (riskScore >= 60) return 'border-orange-400';
  if (riskScore >= 40) return 'border-yellow-400';
  if (riskScore >= 20) return 'border-green-300';
  return 'border-green-400';
}

export function CascadeHeatmap({ accounts, loading }: CascadeHeatmapProps) {
  const navigate = useNavigate();

  // Sort accounts by risk score (highest first)
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const aRisk = a.snapshots?.[0]?.riskScore || 0;
      const bRisk = b.snapshots?.[0]?.riskScore || 0;
      return bRisk - aRisk;
    });
  }, [accounts]);

  // Group by risk level
  const riskGroups = useMemo(() => {
    const groups = {
      critical: [] as Account[],
      high: [] as Account[],
      medium: [] as Account[],
      low: [] as Account[],
      safe: [] as Account[],
    };

    sortedAccounts.forEach((account) => {
      const riskScore = account.snapshots?.[0]?.riskScore || 0;
      if (riskScore >= 80) groups.critical.push(account);
      else if (riskScore >= 60) groups.high.push(account);
      else if (riskScore >= 40) groups.medium.push(account);
      else if (riskScore >= 20) groups.low.push(account);
      else groups.safe.push(account);
    });

    return groups;
  }, [sortedAccounts]);

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Cascade Risk Heatmap</h3>
        <div className="grid grid-cols-8 gap-2 animate-pulse">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Cascade Risk Heatmap</h3>
        <div className="text-center py-8 text-gray-500">
          No accounts to display
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4">Cascade Risk Heatmap</h3>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-gray-400">Critical</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500 rounded" />
          <span className="text-gray-400">High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded" />
          <span className="text-gray-400">Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-400 rounded" />
          <span className="text-gray-400">Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-gray-400">Safe</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-8 gap-2">
        {sortedAccounts.map((account) => {
          const riskScore = account.snapshots?.[0]?.riskScore || 0;
          const healthFactor = account.snapshots?.[0]?.healthFactor || 0;
          
          return (
            <button
              key={account.id}
              onClick={() => navigate(`/account/${account.walletAddress}`)}
              className={`
                aspect-square rounded border-2 transition-all duration-200
                hover:scale-110 hover:z-10 relative group
                ${getRiskColor(riskScore)}
                ${getRiskBorderColor(riskScore)}
              `}
              title={`${account.walletAddress.slice(0, 6)}... - Risk: ${riskScore}%`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                <div className="font-mono">{account.walletAddress.slice(0, 8)}...</div>
                <div>Risk: {riskScore}%</div>
                <div>HF: {healthFactor.toFixed(2)}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
        <div className="bg-red-900/30 rounded p-2">
          <div className="text-red-400 font-bold">{riskGroups.critical.length}</div>
          <div className="text-gray-500">Critical</div>
        </div>
        <div className="bg-orange-900/30 rounded p-2">
          <div className="text-orange-400 font-bold">{riskGroups.high.length}</div>
          <div className="text-gray-500">High</div>
        </div>
        <div className="bg-yellow-900/30 rounded p-2">
          <div className="text-yellow-400 font-bold">{riskGroups.medium.length}</div>
          <div className="text-gray-500">Medium</div>
        </div>
        <div className="bg-green-900/30 rounded p-2">
          <div className="text-green-400 font-bold">{riskGroups.low.length}</div>
          <div className="text-gray-500">Low</div>
        </div>
        <div className="bg-green-900/30 rounded p-2">
          <div className="text-green-300 font-bold">{riskGroups.safe.length}</div>
          <div className="text-gray-500">Safe</div>
        </div>
      </div>
    </div>
  );
}

export default CascadeHeatmap;
