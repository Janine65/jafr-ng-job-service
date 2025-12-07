import {
    ProgressListConfiguration
} from '@app/shared/components/progress-list/progress-list.model';

/**
 * Default progress list configuration for VT components.
 * Shared across all VT job management components (Aktenentscheid, Einladung, Erinnerung, Mahnung, Aufgabe).
 */
export const VT_DEFAULT_PROGRESS_CONFIG: ProgressListConfiguration = {
    showTiming: true,
    showLegend: true,
    showProgressBar: true,
    selectable: true,
    showCompletedJobs: true,
    showLoadMore: true,
    enableHover: true,
    maxVisibleCompleted: 20,
    emailNotificationText: undefined
};
