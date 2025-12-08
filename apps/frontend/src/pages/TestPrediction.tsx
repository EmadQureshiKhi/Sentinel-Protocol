import { useState } from 'react';
import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';

interface TestData {
  solPrice: number;
  hvix: {
    value: number;
    level: string;
  };
  accounts: Array<{
    wallet: string;
    riskScore: number;
    healthFactor: number;
    recommendedAction: string;
    cascadeProbability: number;
    timeToLiquidation: number;
    estimatedLosses: number;
  }>;
  alerts: {
    newAlerts: number;
    totalActive: number;
    activeAlerts: Array<{
      id: string;
      wallet: string;
      riskScore: number;
      recommendedAction: string;
    }>;
  };
}

export default function TestPrediction() {
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTestData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test/prediction');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Test Prediction Engine</h2>
        <p className="text-slate-500">Test Layer 1: Prediction Engine with mock data</p>
      </div>

      {/* Test Button */}
      <button
        onClick={fetchTestData}
        disabled={loading}
        className="px-6 py-3 bg-shield-500 text-white rounded-lg hover:bg-shield-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Loading...' : 'Run Prediction Test'}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error: {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Market Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-slate-900">SOL Price</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">${data.solPrice.toFixed(2)}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-slate-900">HVIX (Volatility)</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{data.hvix.value.toFixed(2)}</p>
              <p className="text-sm text-slate-500 mt-1">Level: {data.hvix.level}</p>
            </div>
          </div>

          {/* Accounts */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Monitored Accounts</h3>
            <div className="space-y-4">
              {data.accounts.map((account) => (
                <div
                  key={account.wallet}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-sm text-slate-600">
                        {account.wallet.slice(0, 8)}...{account.wallet.slice(-8)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Health Factor: {account.healthFactor.toFixed(2)}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        account.recommendedAction === 'PROTECT'
                          ? 'bg-red-100 text-red-700'
                          : account.recommendedAction === 'MONITOR'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {account.recommendedAction}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Risk Score</p>
                      <p className="font-semibold text-slate-900">{account.riskScore}/100</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Cascade Prob.</p>
                      <p className="font-semibold text-slate-900">
                        {(account.cascadeProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Time to Liq.</p>
                      <p className="font-semibold text-slate-900">{account.timeToLiquidation}h</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Est. Losses</p>
                      <p className="font-semibold text-slate-900">
                        ${account.estimatedLosses.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-slate-900">Active Alerts</h3>
              <span className="ml-auto bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                {data.alerts.totalActive}
              </span>
            </div>

            {data.alerts.activeAlerts.length > 0 ? (
              <div className="space-y-2">
                {data.alerts.activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div>
                      <p className="font-mono text-sm text-slate-700">
                        {alert.wallet.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-slate-500">Risk: {alert.riskScore}/100</p>
                    </div>
                    <span className="text-xs font-medium text-red-700">
                      {alert.recommendedAction}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No active alerts</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
