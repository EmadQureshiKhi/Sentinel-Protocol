import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { RISK_THRESHOLDS } from '../../config/constants';
import { CascadeRiskScore } from './cascadeDetector';

// Alert status types
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'EXPIRED';

// Alert structure
export interface Alert {
  id: string;
  walletAddress: string;
  riskScore: number;
  cascadeProbability: number;
  timeToLiquidation: number;
  estimatedLosses: number;
  recommendedAction: 'PROTECT' | 'MONITOR' | 'SAFE';
  status: AlertStatus;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

// Alert generation result
export interface AlertGenerationResult {
  newAlerts: Alert[];
  updatedAlerts: Alert[];
  totalActive: number;
}

export class AlertSystem extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private alertIdCounter: number = 0;
  
  // Deduplication: don't spam alerts for same wallet
  private lastAlertTime: Map<string, number> = new Map();
  private alertCooldownMs: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
  }

  /**
   * Generate alerts from cascade risk scores
   * Filters for high-risk accounts and creates/updates alerts
   */
  generateAlerts(riskScores: CascadeRiskScore[]): AlertGenerationResult {
    const newAlerts: Alert[] = [];
    const updatedAlerts: Alert[] = [];

    // Filter for critical accounts
    const criticalAccounts = riskScores.filter(
      (score) =>
        score.riskScore > RISK_THRESHOLDS.ALERT_RISK_THRESHOLD ||
        score.cascadeProbability > RISK_THRESHOLDS.ALERT_CASCADE_PROBABILITY
    );

    for (const riskScore of criticalAccounts) {
      const existingAlert = this.alerts.get(riskScore.walletAddress);

      if (existingAlert && existingAlert.status === 'ACTIVE') {
        // Update existing alert
        const updated = this._updateAlert(existingAlert, riskScore);
        updatedAlerts.push(updated);
      } else if (this._canCreateAlert(riskScore.walletAddress)) {
        // Create new alert
        const alert = this._createAlert(riskScore);
        newAlerts.push(alert);
        this._sendAlert(alert);
      }
    }

    return {
      newAlerts,
      updatedAlerts,
      totalActive: this.getActiveAlerts().length,
    };
  }

  /**
   * Check if we can create a new alert (deduplication)
   */
  private _canCreateAlert(walletAddress: string): boolean {
    const lastTime = this.lastAlertTime.get(walletAddress);
    if (!lastTime) return true;
    
    return Date.now() - lastTime > this.alertCooldownMs;
  }

  /**
   * Create a new alert
   */
  private _createAlert(riskScore: CascadeRiskScore): Alert {
    const alert: Alert = {
      id: `alert_${++this.alertIdCounter}_${Date.now()}`,
      walletAddress: riskScore.walletAddress,
      riskScore: riskScore.riskScore,
      cascadeProbability: riskScore.cascadeProbability,
      timeToLiquidation: riskScore.timeToLiquidation,
      estimatedLosses: riskScore.estimatedLosses,
      recommendedAction: riskScore.recommendedAction,
      status: 'ACTIVE',
      createdAt: new Date(),
    };

    this.alerts.set(riskScore.walletAddress, alert);
    this.alertHistory.push(alert);
    this.lastAlertTime.set(riskScore.walletAddress, Date.now());

    logger.info(`🚨 New alert created for ${riskScore.walletAddress}`, {
      riskScore: riskScore.riskScore,
      timeToLiquidation: riskScore.timeToLiquidation,
    });

    return alert;
  }

  /**
   * Update an existing alert
   */
  private _updateAlert(alert: Alert, riskScore: CascadeRiskScore): Alert {
    alert.riskScore = riskScore.riskScore;
    alert.cascadeProbability = riskScore.cascadeProbability;
    alert.timeToLiquidation = riskScore.timeToLiquidation;
    alert.estimatedLosses = riskScore.estimatedLosses;
    alert.recommendedAction = riskScore.recommendedAction;

    this.alerts.set(alert.walletAddress, alert);

    return alert;
  }

  /**
   * Send alert notification
   */
  private _sendAlert(alert: Alert): void {
    // Log to console
    const message = `
    🚨 LIQUIDATION ALERT 🚨
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Wallet: ${alert.walletAddress}
    Risk Score: ${alert.riskScore}/100
    Cascade Probability: ${(alert.cascadeProbability * 100).toFixed(1)}%
    Time to Liquidation: ${alert.timeToLiquidation} hours
    Estimated Losses: $${alert.estimatedLosses.toFixed(2)}
    
    ✅ Recommended Action: ${alert.recommendedAction}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;

    logger.warn(message);

    // Emit event for WebSocket broadcast
    this.emit('alert:new', alert);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.status === 'ACTIVE'
    );
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alertHistory.find((a) => a.id === alertId);
  }

  /**
   * Get alert by wallet address
   */
  getAlertByWallet(walletAddress: string): Alert | undefined {
    return this.alerts.get(walletAddress);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): Alert | null {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    if (!alert) return null;

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedAt = new Date();

    logger.info(`Alert acknowledged: ${alertId}`);
    this.emit('alert:acknowledged', alert);

    return alert;
  }

  /**
   * Resolve an alert (after protection executed)
   */
  resolveAlert(alertId: string): Alert | null {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    if (!alert) return null;

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date();

    // Remove from active alerts
    this.alerts.delete(alert.walletAddress);

    logger.info(`Alert resolved: ${alertId}`);
    this.emit('alert:resolved', alert);

    return alert;
  }

  /**
   * Clear alert for a wallet (after protection executed)
   */
  clearAlert(walletAddress: string): void {
    const alert = this.alerts.get(walletAddress);
    if (alert) {
      alert.status = 'RESOLVED';
      alert.resolvedAt = new Date();
      this.alerts.delete(walletAddress);
      
      logger.info(`Alert cleared for wallet: ${walletAddress}`);
      this.emit('alert:resolved', alert);
    }
  }

  /**
   * Expire old alerts
   */
  expireOldAlerts(maxAgeHours: number = 24): number {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let expiredCount = 0;

    for (const [walletAddress, alert] of this.alerts) {
      if (alert.createdAt.getTime() < cutoffTime && alert.status === 'ACTIVE') {
        alert.status = 'EXPIRED';
        this.alerts.delete(walletAddress);
        expiredCount++;
        
        this.emit('alert:expired', alert);
      }
    }

    if (expiredCount > 0) {
      logger.info(`Expired ${expiredCount} old alerts`);
    }

    return expiredCount;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    totalActive: number;
    totalAcknowledged: number;
    totalResolved: number;
    totalExpired: number;
    avgRiskScore: number;
  } {
    const active = this.alertHistory.filter((a) => a.status === 'ACTIVE');
    const acknowledged = this.alertHistory.filter((a) => a.status === 'ACKNOWLEDGED');
    const resolved = this.alertHistory.filter((a) => a.status === 'RESOLVED');
    const expired = this.alertHistory.filter((a) => a.status === 'EXPIRED');

    const avgRiskScore =
      active.length > 0
        ? active.reduce((sum, a) => sum + a.riskScore, 0) / active.length
        : 0;

    return {
      totalActive: active.length,
      totalAcknowledged: acknowledged.length,
      totalResolved: resolved.length,
      totalExpired: expired.length,
      avgRiskScore,
    };
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alert severity color
   */
  getAlertColor(riskScore: number): string {
    if (riskScore >= 80) return '#ef4444'; // red - critical
    if (riskScore >= 60) return '#f97316'; // orange - high
    if (riskScore >= 40) return '#eab308'; // yellow - medium
    return '#22c55e'; // green - low
  }
}

export default AlertSystem;
