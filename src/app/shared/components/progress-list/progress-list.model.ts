import type { JobProgress } from '@syrius/job-service';

/**
 * UI-specific extension of JobProgress for the progress-list component
 * Extends the core JobProgress interface with UI component fields
 */
export interface ProgressItem extends JobProgress {
    // All fields inherited from JobProgress:
    // - id, name, total, running, successful, failed
    // - status, startTime, endTime, processingRate, detailsLoading
    // - [key: string]: unknown (allows additional custom properties)
}

export interface ProgressListConfiguration {
    // Display options
    showTiming?: boolean;
    showLegend?: boolean;
    showProgressBar?: boolean;
    showSelection?: boolean;
    showCompletedJobs?: boolean;
    showLoadMore?: boolean;

    // Styling options
    compact?: boolean;
    enableHover?: boolean;

    // Functionality options
    selectable?: boolean;
    maxVisibleCompleted?: number;
    pageSize?: number;
    showEmailNotification?: boolean;

    // Text customization
    noRunningJobsText?: string;
    noRunningJobsDescText?: string;
    loadingText?: string;
    showCompletedText?: string;
    hideCompletedText?: string;
    loadMoreText?: string;
    noCompletedJobsText?: string;
    emailNotificationText?: string;

    // Icon customization
    noJobsIcon?: string;
    loadingIcon?: string;
    completedIcon?: string;
    historyIcon?: string;
    loadMoreIcon?: string;
}

export interface ProgressListEvents {
    itemSelected?: (item: ProgressItem) => void;
    completedToggled?: (showing: boolean) => void;
    loadMoreRequested?: () => void;
}

export const DEFAULT_PROGRESS_LIST_CONFIG: ProgressListConfiguration = {
    showTiming: true,
    showLegend: true,
    showProgressBar: true,
    showSelection: true,
    showCompletedJobs: true,
    showLoadMore: true,
    compact: false,
    enableHover: true,
    selectable: true,
    maxVisibleCompleted: 20,
    pageSize: 20,
    showEmailNotification: true,
    noJobsIcon: 'pi-info-circle',
    loadingIcon: 'pi-spinner',
    completedIcon: 'pi-check-circle',
    historyIcon: 'pi-history',
    loadMoreIcon: 'pi-angle-down'
};
