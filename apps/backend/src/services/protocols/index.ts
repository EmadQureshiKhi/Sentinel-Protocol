/**
 * Protocol Services Index
 * Exports all protocol services and types
 */

export * from './types';
export * from './drift';
export * from './marginfi';
export * from './solend';
export * from './rateAggregator';

// Re-export main services
export { DriftService, createDriftService } from './drift';
export { MarginFiService, createMarginFiService } from './marginfi';
export { SolendService, createSolendService } from './solend';
export { RateAggregator, createRateAggregator, getRateAggregator } from './rateAggregator';
