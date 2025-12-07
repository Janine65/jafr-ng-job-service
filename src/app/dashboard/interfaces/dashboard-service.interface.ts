import { Observable } from 'rxjs';

import { InjectionToken, Type } from '@angular/core';
import { JobProgress } from '@syrius/job-service';

/**
 * Interface that all job services must implement for dashboard integration
 */
export interface DashboardJobService {
    /**
     * Get currently running jobs
     */
    getRunningJobs(): Observable<JobProgress[]>;

    /**
     * Get completed jobs (overview or full list)
     */
    getCompletedJobsOverview?(): Observable<JobProgress[]>;
    getCompletedJobs?(): Observable<JobProgress[]>;

    /**
     * Observable that emits completed jobs (for reactive updates)
     */
    completedJobs$: Observable<JobProgress[]>;

    /**
     * Observable that indicates if the service is loading data
     */
    isLoadingOverview$: Observable<boolean>;

    /**
     * Ensure completed jobs are loaded (idempotent)
     * Optional method for backward compatibility
     */
    ensureCompletedJobsLoaded?(): void;

    /**
     * Start polling for job updates
     * Optional method for job-service library compatibility
     */
    startPolling?(intervalMs?: number): void;

    /**
     * Load completed jobs from API
     * Optional method for job-service library compatibility
     */
    loadCompletedJobs?(): void;
}

/**
 * Configuration for a single service that appears on the dashboard
 */
export interface DashboardServiceConfig {
    /**
     * Unique identifier for the service
     */
    name: string;

    /**
     * Display name shown in the UI
     */
    displayName: string;

    /**
     * Route to navigate to when creating new jobs
     */
    route: string;

    /**
     * PrimeNG icon class
     */
    icon: string;

    /**
     * Description shown in the UI
     */
    description: string;

    /**
     * Roles required to access this service
     */
    requiredRoles: string[];

    /**
     * Reference to the Angular service class
     */
    serviceClass: Type<DashboardJobService>;

    /**
     * Job type identifier used in job summaries
     */
    jobType: string;
}

/**
 * Injection token for dashboard services configuration
 */
export const DASHBOARD_SERVICES_CONFIG = new InjectionToken<DashboardServiceConfig[]>('DASHBOARD_SERVICES_CONFIG');
