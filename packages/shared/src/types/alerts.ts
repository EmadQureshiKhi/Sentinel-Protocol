// ===========================================
// Alert Types
// ===========================================

export type RecommendedAction = 'PROTECT' | 'MONITOR' | 'SAFE';

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'EXPIRED';

export interface Alert {
  id: string;
  accountId: string;
  walletAddress: string;

  // Risk data
  riskScore: number; // 0-100
  cascadeProbability: number; // 0-1
  timeToLiquidation: number; // hours
  estimatedLosses: number; // USD
  recommendedAction: RecommendedAction;

  // Status
  status: AlertStatus;
  acknowledgedAt?: Date;
  resolvedAt?: Date;

  createdAt: Date;
}

export interface CascadeRiskScore {
  walletAddress: string;
  riskScore: number; // 0-100
  hvixValue: number;
  cascadeProbability: number; // 0-1
  timeToLiquidation: number; // hours
  recommendedAction: RecommendedAction;
  estimatedLosses: number; // USD
}

// ===========================================
// Alert Helpers
// ===========================================

export function getRecommendedAction(riskScore: number): RecommendedAction {
  if (riskScore >= 70) return 'PROTECT';
  if (riskScore >= 40) return 'MONITOR';
  return 'SAFE';
}

export function getAlertSeverity(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}

export function getAlertColor(riskScore: number): string {
  const severity = getAlertSeverity(riskScore);
  switch (severity) {
    case 'critical':
      return '#ef4444'; // red
    case 'high':
      return '#f97316'; // orange
    case 'medium':
      return '#eab308'; // yellow
    case 'low':
      return '#22c55e'; // green
  }
}
