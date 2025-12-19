/**
 * Arcium Privacy Module
 * Exports all privacy-related services and types
 */

export * from './types';
export * from './encryption';
export * from './privateMonitoring';
export * from './privateSwaps';
export * from './darkPool';
export * from './encryptedOrderFlow';

import { getArciumEncryption } from './encryption';
import { getPrivateMonitoringService } from './privateMonitoring';
import { getPrivateSwapService } from './privateSwaps';
import { getDarkPoolService } from './darkPool';
import { getEncryptedOrderFlowService } from './encryptedOrderFlow';
import { logger } from '../../utils/logger';

export interface ArciumPrivacyServices {
  encryption: ReturnType<typeof getArciumEncryption>;
  monitoring: ReturnType<typeof getPrivateMonitoringService>;
  swaps: ReturnType<typeof getPrivateSwapService>;
  darkPool: ReturnType<typeof getDarkPoolService>;
  orderFlow: ReturnType<typeof getEncryptedOrderFlowService>;
}

let servicesInstance: ArciumPrivacyServices | null = null;

export function initializeArciumPrivacy(): ArciumPrivacyServices {
  if (!servicesInstance) {
    servicesInstance = {
      encryption: getArciumEncryption(),
      monitoring: getPrivateMonitoringService(),
      swaps: getPrivateSwapService(),
      darkPool: getDarkPoolService(),
      orderFlow: getEncryptedOrderFlowService(),
    };

    logger.info('Arcium privacy services initialized', {
      mxeCluster: servicesInstance.encryption.getClusterId(),
    });
  }

  return servicesInstance;
}

export function getArciumPrivacyServices(): ArciumPrivacyServices {
  if (!servicesInstance) {
    return initializeArciumPrivacy();
  }
  return servicesInstance;
}
