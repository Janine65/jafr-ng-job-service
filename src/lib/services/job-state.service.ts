import {
    BehaviorSubject, Observable, of, Subject, Subscription, take, takeUntil, timer
} from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { inject, Injectable, NgZone } from '@angular/core';

import { JobDataProvider, JobEntry } from '../interfaces/job-provider.interface';
import { JOB_LOGGER_FACTORY, JobProgress, LoggerInterface } from './job-base.service';

/**
 * JobStateService - Manages job state, polling, and sessionStorage persistence.
 *
 * This is a self-contained service that manages job states without external dependencies
 * beyond the pluggable logger factory.
 */
@Injectable({
    providedIn: 'root'
})
export class JobStateService<TEntry extends JobEntry> {
    private ngZone = inject(NgZone);

    // Inject pluggable logger factory with fallback
    private logFactory = inject(JOB_LOGGER_FACTORY, { optional: true });
    private logger!: LoggerInterface;

    // Session storage keys - constructed from service name
    private STORAGE_KEY_ACTIVE_JOBS!: string;
    private STORAGE_KEY_RUNNING_JOBS!: string;
    private STORAGE_KEY_COMPLETED_JOBS!: string;

    // Store active jobs for polling
    private activeJobs = new Map<string, string>(); // jobId -> filename

    // BehaviorSubjects for reactive state management
    private runningJobsSubject = new BehaviorSubject<JobProgress[]>([]);
    private completedJobsSubject = new BehaviorSubject<JobProgress[]>([]);

    // Track overview loading state for dashboard
    private isLoadingOverviewSubject = new BehaviorSubject<boolean>(false);

    // Polling subscriptions for periodic updates
    private pollingSubscription?: Subscription;
    private readonly POLLING_INTERVAL_MS = 60000; // 60 seconds

    // Track background detail loading subscriptions for cancellation
    private backgroundLoadingSubscriptions: Subscription[] = [];

    // Subject to cancel ongoing HTTP requests when stopping polling or navigating
    private cancelPendingRequests$ = new Subject<void>();

    // Public observables for components to subscribe to
    public readonly runningJobs$ = this.runningJobsSubject.asObservable();
    public readonly completedJobs$ = this.completedJobsSubject.asObservable();
    public readonly isLoadingOverview$ = this.isLoadingOverviewSubject.asObservable();

    // Data provider - injected after initialization
    private dataProvider!: JobDataProvider<TEntry>;

    /**
     * Initialize the state service with a data provider
     * @param dataProvider - The data provider to use for fetching job data
     */
    initialize(dataProvider: JobDataProvider<TEntry>): void {
        this.dataProvider = dataProvider;
        const config = dataProvider.getConfig();

        // Initialize logger with fallback
        if (this.logFactory) {
            this.logger = this.logFactory.createLogger(config.serviceName + 'StateService');
        } else {
            // Fallback logger if no logger factory is provided
            this.logger = {
                debug: (message: string, ...args: any[]) => console.debug(`[${config.serviceName}StateService]`, message, ...args),
                error: (message: string, ...args: any[]) => console.error(`[${config.serviceName}StateService]`, message, ...args),
                warn: (message: string, ...args: any[]) => console.warn(`[${config.serviceName}StateService]`, message, ...args)
            };
        }

        // Initialize storage keys based on service name
        const lowerName = config.serviceName.toLowerCase();
        this.STORAGE_KEY_ACTIVE_JOBS = `${lowerName}_active_jobs`;
        this.STORAGE_KEY_RUNNING_JOBS = `${lowerName}_running_jobs`;
        this.STORAGE_KEY_COMPLETED_JOBS = `${lowerName}_completed_jobs`;

        // Load persisted state from sessionStorage on initialization
        this.loadStateFromStorage();
    }

    /**
     * Get active jobs map (for tracking running jobs)
     */
    getActiveJobs(): Map<string, string> {
        return this.activeJobs;
    }

    /**
     * Add an active job
     * @param jobId - The job ID
     * @param filename - The filename associated with this job
     */
    addActiveJob(jobId: string, filename: string): void {
        this.activeJobs.set(jobId, filename);
        this.saveActiveJobsToStorage();
    }

    /**
     * Remove an active job
     * @param jobId - The job ID to remove
     */
    removeActiveJob(jobId: string): void {
        this.activeJobs.delete(jobId);
        this.saveActiveJobsToStorage();
    }

    /**
     * Calculate job progress from entries
     */
    calculateJobProgress(entries: TEntry[], jobId: string, excelfile: string): JobProgress {
        const total = entries.length;
        const processed = entries.filter((e) => e.status === 'verarbeitet').length;
        const failed = entries.filter((e) => e.status === 'verarbeitet' && e.error !== null && e.error !== '').length;
        const successful = processed - failed;

        const progress = total > 0 ? (processed / total) * 100 : 0;
        const status: 'running' | 'completed' | 'failed' = total > 0 && processed === total ? (failed === total ? 'failed' : 'completed') : 'running';

        const startTime = entries.length > 0 ? new Date(entries[0].created) : new Date();
        const endTime = status === 'completed' || status === 'failed' ? new Date(entries[0].updated) : undefined;

        return {
            id: jobId,
            name: excelfile,
            status,
            progress: Math.round(progress),
            total,
            processed,
            errors: failed,
            running: status === 'running' ? processed : 0,
            successful,
            failed,
            startTime,
            endTime,
            message: status === 'failed' ? `${failed} error(s) occurred during processing` : undefined
        };
    }

    /**
     * Get all currently running jobs by checking active job statuses
     */
    getRunningJobs(): Observable<JobProgress[]> {
        if (this.activeJobs.size === 0) {
            const emptyJobs: JobProgress[] = [];
            this.runningJobsSubject.next(emptyJobs);
            this.saveRunningJobsToStorage(emptyJobs);
            return of(emptyJobs);
        }

        const jobStatusObservables = Array.from(this.activeJobs.entries()).map(([jobId, excelfile]) =>
            this.dataProvider.getJobEntries(excelfile, false).pipe(
                takeUntil(this.cancelPendingRequests$),
                map((entries) => {
                    if (entries.length === 0) {
                        this.removeActiveJob(jobId);
                        return null;
                    }
                    return this.calculateJobProgress(entries, jobId, excelfile);
                }),
                catchError(() => {
                    this.removeActiveJob(jobId);
                    return of(null);
                })
            )
        );

        return new Observable((observer) => {
            const jobs: JobProgress[] = [];
            let completed = 0;

            jobStatusObservables.forEach((obs) => {
                obs.subscribe({
                    next: (job: JobProgress | null) => {
                        if (job) {
                            jobs.push(job);
                            if (job.status === 'completed' || job.status === 'failed') {
                                this.removeActiveJob(job.id);
                            }
                        }
                    },
                    complete: () => {
                        completed++;
                        if (completed === jobStatusObservables.length) {
                            const runningJobs = jobs.filter((j) => j.status === 'running');
                            this.runningJobsSubject.next(runningJobs);
                            this.saveRunningJobsToStorage(runningJobs);
                            observer.next(runningJobs);
                            observer.complete();
                        }
                    },
                    error: (err: Error) => observer.error(err)
                });
            });

            if (jobStatusObservables.length === 0) {
                const emptyJobs: JobProgress[] = [];
                this.runningJobsSubject.next(emptyJobs);
                this.saveRunningJobsToStorage(emptyJobs);
                observer.next(emptyJobs);
                observer.complete();
            }
        });
    }

    /**
     * Start basic polling
     */
    startPolling(intervalMs: number = this.POLLING_INTERVAL_MS): void {
        this.stopPolling();

        this.ngZone.runOutsideAngular(() => {
            this.logger.debug(`Starting polling (interval: ${intervalMs}ms)`);

            this.pollingSubscription = timer(0, intervalMs)
                .pipe(switchMap(() => this.dataProvider.getAllRecentJobs()))
                .subscribe({
                    next: (jobs) => {
                        this.ngZone.run(() => {
                            this.logger.debug(`Polled ${jobs.length} jobs`);
                        });
                    },
                    error: (error) => {
                        this.ngZone.run(() => {
                            this.logger.error('Polling error:', error);
                        });
                    }
                });
        });
    }

    /**
     * Stop polling
     */
    stopPolling(): void {
        if (this.pollingSubscription) {
            this.logger.debug('Stopping job polling');
            this.cancelPendingRequests$.next();
            this.cancelBackgroundLoadingSubscriptions();
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = undefined;
        }
    }

    /**
     * Cancel background loading subscriptions
     */
    private cancelBackgroundLoadingSubscriptions(): void {
        this.backgroundLoadingSubscriptions.forEach((sub) => sub.unsubscribe());
        this.backgroundLoadingSubscriptions = [];
    }

    /**
     * Cancel pending requests
     */
    cancelPendingRequests(): void {
        this.cancelPendingRequests$.next();
    }

    // ==================== SessionStorage Methods ====================

    /**
     * Save active jobs to sessionStorage
     */
    private saveActiveJobsToStorage(): void {
        try {
            const activeJobsArray = Array.from(this.activeJobs.entries());
            sessionStorage.setItem(this.STORAGE_KEY_ACTIVE_JOBS, JSON.stringify(activeJobsArray));
        } catch (error) {
            this.logger.error('Failed to save active jobs to storage:', error);
        }
    }

    /**
     * Save running jobs to sessionStorage
     */
    private saveRunningJobsToStorage(jobs: JobProgress[]): void {
        try {
            sessionStorage.setItem(this.STORAGE_KEY_RUNNING_JOBS, JSON.stringify(jobs));
        } catch (error) {
            this.logger.error('Failed to save running jobs to storage:', error);
        }
    }

    /**
     * Save completed jobs to sessionStorage
     */
    private saveCompletedJobsToStorage(jobs: JobProgress[]): void {
        try {
            sessionStorage.setItem(this.STORAGE_KEY_COMPLETED_JOBS, JSON.stringify(jobs));
        } catch (error) {
            this.logger.error('Failed to save completed jobs to storage:', error);
        }
    }

    /**
     * Load state from sessionStorage on service initialization
     */
    private loadStateFromStorage(): void {
        try {
            const activeJobsData = sessionStorage.getItem(this.STORAGE_KEY_ACTIVE_JOBS);
            if (activeJobsData) {
                const activeJobsArray = JSON.parse(activeJobsData) as [string, string][];
                this.activeJobs = new Map(activeJobsArray);
            }

            const runningJobsData = sessionStorage.getItem(this.STORAGE_KEY_RUNNING_JOBS);
            if (runningJobsData) {
                const runningJobs = JSON.parse(runningJobsData) as JobProgress[];
                runningJobs.forEach((job) => {
                    job.startTime = new Date(job.startTime);
                    if (job.endTime) job.endTime = new Date(job.endTime);
                });
                this.runningJobsSubject.next(runningJobs);
            }

            const completedJobsData = sessionStorage.getItem(this.STORAGE_KEY_COMPLETED_JOBS);
            if (completedJobsData) {
                const completedJobs = JSON.parse(completedJobsData) as JobProgress[];
                completedJobs.forEach((job) => {
                    job.startTime = new Date(job.startTime);
                    if (job.endTime) job.endTime = new Date(job.endTime);
                });
                this.completedJobsSubject.next(completedJobs);
            }
        } catch (error) {
            this.logger.error('Failed to load state from storage:', error);
        }
    }

    /**
     * Clear all persisted state from sessionStorage
     */
    clearPersistedState(): void {
        try {
            sessionStorage.removeItem(this.STORAGE_KEY_ACTIVE_JOBS);
            sessionStorage.removeItem(this.STORAGE_KEY_RUNNING_JOBS);
            sessionStorage.removeItem(this.STORAGE_KEY_COMPLETED_JOBS);
        } catch (error) {
            this.logger.error('Failed to clear persisted state:', error);
        }
    }
}
