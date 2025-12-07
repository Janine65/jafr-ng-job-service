import { InjectionToken } from '@angular/core';

// Re-export logger token from services for convenience (optional dependency)
export { JOB_LOGGER_FACTORY } from "../services/job-base.service";
export type {
  LoggerInterface,
  LoggerFactoryInterface,
} from "../services/job-base.service";

/**
 * Configuration token for job service settings
 */
export interface JobLibraryConfig {
  /** Default polling interval in milliseconds for completed jobs (default: 600000ms = 10 minutes) */
  defaultPollingInterval?: number;
  /** Polling interval for running jobs in milliseconds (default: 30000ms = 30 seconds) */
  runningJobsPollingInterval?: number;
  /** Enable debug logging */
  enableDebugLogging?: boolean;
  /** API base URL */
  apiBaseUrl?: string;
}

export const JOB_LIBRARY_CONFIG = new InjectionToken<JobLibraryConfig>(
  "JOB_LIBRARY_CONFIG"
);
