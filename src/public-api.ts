/*
 * Public API Surface of @syrius/job-service
 */

// Main service
export {
  JobBaseService,
  JOB_LOGGER_FACTORY,
} from "./lib/services/job-base.service";

export type {
  JobServiceConfig,
  JobEntry,
  JobProgress,
  JobDetailsResponse,
  JobDetailEntry,
  LoggerInterface,
  LoggerFactoryInterface,
} from "./lib/services/job-base.service";

// State management
export { JobStateService } from "./lib/services/job-state.service";
export { JobStore } from "./lib/stores/job.store";
export type { JobType, JobTypeState, JobState } from "./lib/stores/job.store";

// Polling service
export { JobPollingService } from "./lib/services/job-polling.service";

// Data provider interface (different from job-base service interfaces)
export type {
  JobDataProvider,
  JobDataProviderConfig,
} from "./lib/interfaces/job-provider.interface";

// Components
export { JobDetailsComponent } from "./lib/components/job-details/job-details.component";

// Configuration tokens
export { JOB_LIBRARY_CONFIG } from "./lib/config/job-tokens";

export type { JobLibraryConfig } from "./lib/config/job-tokens";
