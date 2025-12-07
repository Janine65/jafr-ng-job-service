import { ExtendedEnvironment } from '@syrius/core';

/**
 * KPM-specific environment interface that extends the core environment
 * with KPM-specific external system URLs
 */
export interface KpmEnvironment extends ExtendedEnvironment {
    crifUrl?: string;
    syriusUrl?: string;
    crmUrl?: string;
    idmsUrl?: string;
}
