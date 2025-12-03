// ===========================================
// Account Types
// ===========================================

export type Protocol = 'DRIFT' | 'MARGINFI' | 'SOLEND';

export type HealthTier = 'SAFE' | 'CAUTION' | 'DANGER' | 'CRITICAL';

export interface UserAccount {
  id: string;
  walletAddress: string;
  protocol: Protocol;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountSnapshot {
  id: string;
  accountId: string;

  // Position data
  collateralValue: number; // USD
  borrowedValue: number; // USD
  leverage: number;
  healthFactor: number;
  maintenanceMarginRatio: number;
  currentMarginRatio: number;
  liquidationPrice: number;
  oraclePrice: number;

  // Risk metrics
  riskScore: number; // 0-100
  hvixValue: number;
  cascadeProbability: number; // 0-1
  timeToLiquidation: number; // hours

  createdAt: Date;
}

export interface AccountWithSnapshot extends UserAccount {
  latestSnapshot?: AccountSnapshot;
}

// ===========================================
// Health Factor Helpers
// ===========================================

export function getHealthTier(healthFactor: number): HealthTier {
  if (healthFactor >= 1.0) return 'SAFE';
  if (healthFactor >= 0.5) return 'CAUTION';
  if (healthFactor >= 0.25) return 'DANGER';
  return 'CRITICAL';
}

export function getHealthColor(healthFactor: number): string {
  const tier = getHealthTier(healthFactor);
  switch (tier) {
    case 'SAFE':
      return '#22c55e'; // green
    case 'CAUTION':
      return '#eab308'; // yellow
    case 'DANGER':
      return '#f97316'; // orange
    case 'CRITICAL':
      return '#ef4444'; // red
  }
}
