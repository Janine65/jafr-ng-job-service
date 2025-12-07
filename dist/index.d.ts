import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import * as _angular_core from '@angular/core';
import { InjectionToken, NgZone, OnDestroy, OnInit, EventEmitter } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Configuration token for job service settings
 */
interface JobLibraryConfig {
    /** Default polling interval in milliseconds for completed jobs (default: 600000ms = 10 minutes) */
    defaultPollingInterval?: number;
    /** Polling interval for running jobs in milliseconds (default: 30000ms = 30 seconds) */
    runningJobsPollingInterval?: number;
    /** Enable debug logging */
    enableDebugLogging?: boolean;
    /** API base URL */
    apiBaseUrl?: string;
}
declare const JOB_LIBRARY_CONFIG: InjectionToken<JobLibraryConfig>;

/**
 * Job type identifier for categorizing different job workflows
 * Fully dynamic - any string can be used as job type
 */
type JobType = string;
/**
 * State for a specific job type containing running and completed jobs
 */
interface JobTypeState {
    running: JobProgress[];
    completed: JobProgress[];
    loading: boolean;
    error: string | null;
}
/**
 * Root job state containing all job types
 * Fully dynamic - job types are added at runtime
 */
type JobState = Record<JobType, JobTypeState>;
/**
 * Dynamic Job Store using Angular Signals
 *
 * Fully dynamic store that can handle any job type at runtime.
 * No hardcoded job types - everything is registered dynamically.
 */
declare class DynamicJobStore {
    private state;
    readonly allRunningJobs: _angular_core.Signal<Record<string, JobProgress[]>>;
    readonly allCompletedJobs: _angular_core.Signal<Record<string, JobProgress[]>>;
    readonly totalRunningJobsCount: _angular_core.Signal<number>;
    readonly totalCompletedJobsCount: _angular_core.Signal<number>;
    /**
     * Get running jobs for a specific job type
     */
    runningJobs(jobType: JobType): _angular_core.Signal<JobProgress[]>;
    /**
     * Get completed jobs for a specific job type
     */
    completedJobs(jobType: JobType): _angular_core.Signal<JobProgress[]>;
    /**
     * Get all jobs (running + completed) for a specific job type
     */
    allJobs(jobType: JobType): _angular_core.Signal<JobProgress[]>;
    /**
     * Get loading state for a specific job type
     */
    loading(jobType: JobType): _angular_core.Signal<boolean>;
    /**
     * Get error for a specific job type
     */
    error(jobType: JobType): _angular_core.Signal<string>;
    /**
     * Get running jobs count for a specific job type
     */
    runningJobsCount(jobType: JobType): _angular_core.Signal<number>;
    /**
     * Get completed jobs count for a specific job type
     */
    completedJobsCount(jobType: JobType): _angular_core.Signal<number>;
    /**
     * Ensure job type exists in state
     */
    private ensureJobType;
    /**
     * Set running jobs for a specific job type
     */
    setRunningJobs(jobType: JobType, jobs: JobProgress[]): void;
    /**
     * Set completed jobs for a specific job type
     */
    setCompletedJobs(jobType: JobType, jobs: JobProgress[]): void;
    /**
     * Add a new running job
     */
    addRunningJob(jobType: JobType, job: JobProgress): void;
    /**
     * Update a specific job (searches in both running and completed)
     */
    updateJob(jobType: JobType, job: JobProgress): void;
    /**
     * Move a job from running to completed
     */
    moveJobToCompleted(jobType: JobType, jobId: string): void;
    /**
     * Remove a job from running jobs
     */
    removeRunningJob(jobType: JobType, jobId: string): void;
    /**
     * Clear all jobs for a specific job type
     */
    clearJobs(jobType: JobType): void;
    /**
     * Clear all jobs (all types)
     */
    clearAllJobs(): void;
    /**
     * Set loading state for a job type
     */
    setLoading(jobType: JobType, loading: boolean): void;
    /**
     * Set error for a job type
     */
    setError(jobType: JobType, error: string | null): void;
    /**
     * Load state from sessionStorage
     */
    private loadFromStorage;
    /**
     * Save state to sessionStorage
     */
    private saveToStorage;
    /**
     * Clear all persisted state from sessionStorage
     */
    clearPersistedState(): void;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<DynamicJobStore, never>;
    static ɵprov: _angular_core.ɵɵInjectableDeclaration<DynamicJobStore>;
}

interface JobProgress {
    id: string;
    name: string;
    status: "running" | "completed" | "failed";
    progress: number;
    total: number;
    processed: number;
    errors: number;
    running: number;
    successful: number;
    failed: number;
    startTime: Date;
    endTime?: Date;
    message?: string;
    detailsLoading?: boolean;
}
interface JobDetailsResponse$1 {
    jobId: string;
    jobName: string;
    status: "pending" | "running" | "completed";
    progress: number;
    total: number;
    totalCount: number;
    successCount: number;
    failedCount: number;
    runningCount: number;
    pendingCount: number;
    entries: JobDetailEntry$1[];
}
interface JobDetailEntry$1 {
    id: string;
    itemName: string;
    status: "Success" | "Failed" | "Pending";
    errorMessage?: string;
    details: string;
    [key: string]: any;
}
declare const JOB_LOGGER_FACTORY: InjectionToken<LoggerFactoryInterface>;
interface LoggerInterface {
    debug(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
}
interface LoggerFactoryInterface {
    createLogger(name: string): LoggerInterface;
}
/**
 * Configuration interface for job-based services
 */
interface JobServiceConfig$1 {
    /** Service name for logging (e.g., 'Einladung', 'Erinnerung', 'Mahnung', 'Aufgabe', 'Medikamentenrueckforderung') */
    serviceName: string;
    /** API base path (e.g., '/bb/aktualisierung', '/medirueckforderung/medirueck') */
    apiBasePath: string;
    /** API endpoint name for processing (e.g., 'einladung', 'uploadMediRueckforderung') */
    endpointName: string;
    /** Search endpoint name (e.g., 'searchBBAktualisierungEinladung', 'searchMediRueckforderung') */
    searchEndpointName: string;
    /** Search Excel file endpoint name (e.g., 'searchExcelfile', 'searchMediRueckExcelfile') */
    searchExcelFileEndpointName: string;
    /** Translation key prefix for error messages (e.g., 'VT.BB.EINLADUNG', 'INEX.MEDIRUECK') */
    translationPrefix: string;
    /** Required columns for Excel validation */
    requiredColumns: string[];
    /** Translation key for row label in detail view */
    rowTranslationKey: string;
    /** Task name for overview searchExcelfile endpoint (e.g., 'invite', 'reminder', 'warning', 'task') - optional, not used by all services */
    taskName?: string;
}
/**
 * Base interface for job entry types
 * All entry types must have these fields for the service to work
 */
interface JobEntry$1 {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    excelfile: string;
    status: string;
    row: number;
    partnernr?: string;
    error?: string | null;
    message?: string | null;
    [key: string]: unknown;
}
/**
 * Abstract base service for job-based operations (BB Aktualisierung and Medikamentenrückforderung).
 *
 * This service implements CLIENT-SIDE job tracking with session storage persistence.
 *
 * Backend Integration Pattern:
 * 1. POST /uploadfile - Upload Excel file
 * 2. PUT /bb/aktualisierung/{endpointName} or /medirueckforderung/{endpointName} - Trigger processing
 * 3. GET /bb/aktualisierung/searchExcelfile or /medirueckforderung/searchMedRueckforderung - Get job metadata
 * 4. GET /{searchEndpointName}?filename=xxx - Get entries/status
 *
 * Session Storage: Jobs are persisted to sessionStorage and restored on page refresh.
 */
declare abstract class JobBaseService<TEntry extends JobEntry$1> {
    protected config: JobServiceConfig$1;
    protected http: HttpClient;
    protected translate: TranslateService;
    protected ngZone: NgZone;
    protected jobStore: DynamicJobStore;
    protected logFactory: LoggerFactoryInterface;
    protected libraryConfig: JobLibraryConfig;
    protected logger: LoggerInterface;
    protected apiUrl: string;
    protected readonly STORAGE_KEY_ACTIVE_JOBS: string;
    protected activeJobs: Map<string, string>;
    protected entriesCache: Map<string, TEntry[]>;
    private isLoadingOverviewSubject;
    private overviewLoadTriggered;
    private overviewDataAvailable;
    private pollingSubscription?;
    private runningJobsPollingSubscription?;
    private get POLLING_INTERVAL_MS();
    private get RUNNING_JOBS_POLLING_INTERVAL_MS();
    private backgroundLoadingSubscriptions;
    private backgroundLoadingCancelled;
    private cancelPendingRequests$;
    readonly runningJobs$: Observable<JobProgress[]>;
    readonly completedJobs$: Observable<JobProgress[]>;
    readonly isLoadingOverview$: Observable<boolean>;
    /**
     * Creates HTTP headers with X-Suppress-Error-Toast to prevent toast notifications
     * from appearing during background polling operations
     */
    private createSuppressToastHeaders;
    /**
     * Each service must specify its JobType for JobStore integration
     */
    protected abstract getJobType(): JobType;
    constructor(config: JobServiceConfig$1);
    /**
     * Step 1: Upload Excel file to backend
     * POST /uploadfile with multipart/form-data
     */
    protected uploadFile(file: File): Observable<string>;
    /**
     * Step 2: Trigger backend processing for the uploaded file
     * PUT {apiBasePath}/{endpointName}?filename=xxx
     */
    protected triggerProcessing(filename: string): Observable<{
        excelfile: string;
        entries: TEntry[];
    }>;
    /**
     * Get job entries from backend
     * GET /bb/aktualisierung/{searchEndpointName}?filename=xxx
     */
    protected getJobEntries(excelfile: string, useCache?: boolean): Observable<TEntry[]>;
    /**
     * Get all recent jobs by fetching all entries without filename filter
     * Uses configured searchExcelFileEndpointName
     */
    protected getAllRecentJobs(): Observable<TEntry[]>;
    /**
     * Calculate job progress from entries
     */
    protected calculateJobProgress(entries: TEntry[], jobId: string, excelfile: string): JobProgress;
    /**
     * Get all currently running jobs by checking active job statuses
     */
    getRunningJobs(): Observable<JobProgress[]>;
    /**
     * Validate Excel data
     */
    validateExcelData(data: Record<string, unknown>[]): {
        valid: boolean;
        error?: string;
    };
    /**
     * Process uploaded file and create job.
     * The consuming component must parse the Excel data and validate it before calling this method.
     *
     * @param file - The Excel file to upload
     * @param parsedData - Pre-parsed Excel data from the consuming component
     */
    processFileAndCreateJob(file: File, parsedData: Record<string, unknown>[]): Observable<JobProgress>;
    /**
     * Alternative method that accepts pre-validated data and filename.
     * Use this when you want to bypass file upload (e.g., file already uploaded elsewhere).
     *
     * @param filename - The filename returned from a previous upload
     * @param validatedData - Pre-validated Excel data from the consuming component
     */
    createJobFromUploadedFile(filename: string, validatedData: Record<string, unknown>[]): Observable<JobProgress>;
    /**
     * Poll job status until it's no longer running
     */
    protected pollJobStatus(excelfile: string, jobId: string): Observable<JobProgress>;
    /**
     * Load job details by ID - to be implemented by subclasses
     * Each service has slightly different field mappings for the detail view
     */
    abstract loadJobDetailsById(jobId: string): Observable<JobDetailsResponse$1>;
    /**
     * Map entry status to JobDetailEntry status
     */
    protected mapEntryStatus(entry: TEntry): "Success" | "Failed" | "Pending";
    /**
     * Start polling (simplified version for library)
     */
    startPolling(intervalMs?: number): void;
    /**
     * Stop polling
     */
    /**
     * Load completed jobs overview from API (without fetching entry details)
     * This method only fetches the job overview data, not individual entries.
     * Use loadJobDetails() to fetch full entry data for a specific job on-demand.
     */
    loadCompletedJobs(): void;
    /**
     * Load full job details (entries) for a specific job on-demand.
     * This method is intended to be called when navigating to a job detail page.
     * It fetches all entries for the specified job and caches them.
     *
     * @param jobId - The job ID or excelfile name to load details for
     * @returns Observable that emits when details are loaded
     */
    loadJobDetails(jobId: string): Observable<void>;
    /**
     * Process raw entries into completed JobProgress objects
     */
    private processEntriesIntoCompletedJobs;
    stopPolling(): void;
    /**
     * Start polling for running jobs progress updates.
     *
     * Runs OUTSIDE Angular zone to prevent:
     * - Change detection on every poll cycle
     * - Navigation blocking from pending HTTP requests
     * - Performance overhead from Zone.js tracking
     *
     * @param intervalMs - Polling interval (default: 30000 = 30 seconds)
     */
    startRunningJobsPolling(intervalMs?: number): void;
    /**
     * Stop polling for running jobs
     */
    stopRunningJobsPolling(): void;
    /**
     * Clear the entries cache to free memory
     */
    clearEntriesCache(): void;
    /**
     * Clear cache entries for a specific Excel file
     */
    clearCacheForFile(excelfile: string): void;
    /**
     * Save active jobs to sessionStorage
     */
    protected saveActiveJobsToStorage(): void;
    /**
     * Load state from sessionStorage on service initialization
     */
    protected loadStateFromStorage(): void;
    /**
     * Clear all persisted state from sessionStorage
     */
    clearPersistedState(): void;
}

/**
 * Base interface for job entry types
 * All entry types must have these fields for the service to work
 */
interface JobEntry {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    excelfile: string;
    status: string;
    row: number;
    partnernr?: string;
    error?: string | null;
    message?: string | null;
    [key: string]: unknown;
}
/**
 * Configuration for a job data provider
 * Contains all service-specific API endpoint information
 */
interface JobDataProviderConfig {
    /** Service name for logging (e.g., 'Einladung', 'Erinnerung', 'Mahnung', 'Aufgabe', 'Medikamentenrueckforderung') */
    serviceName: string;
    /** API base path (e.g., '/bb/aktualisierung', '/medirueckforderung/medirueck') */
    apiBasePath: string;
    /** API endpoint name for processing (e.g., 'einladung', 'uploadMediRueckforderung') */
    endpointName: string;
    /** Search endpoint name (e.g., 'searchBBAktualisierungEinladung', 'searchMediRueckforderung') */
    searchEndpointName: string;
    /** Search Excel file endpoint name (e.g., 'searchExcelfile', 'searchMediRueckExcelfile') */
    searchExcelFileEndpointName: string;
    /** Translation key prefix for error messages (e.g., 'VT.BB.EINLADUNG', 'INEX.MEDIRUECK') */
    translationPrefix: string;
    /** Required columns for Excel validation */
    requiredColumns: string[];
    /** Translation key for row label in detail view */
    rowTranslationKey: string;
    /** Task name for overview searchExcelfile endpoint (e.g., 'invite', 'reminder', 'warning', 'task') - optional */
    taskName?: string;
}
/**
 * Interface for job data providers.
 * Separates API-specific data fetching logic from state management.
 *
 * This interface defines the contract for fetching job data from backend APIs.
 * Each implementation (BB, Medirueck, etc.) handles its specific API endpoints.
 */
interface JobDataProvider<TEntry extends JobEntry> {
    /**
     * Get the configuration for this data provider
     */
    getConfig(): JobDataProviderConfig;
    /**
     * Upload Excel file to backend
     * @param file - The Excel file to upload
     * @returns Observable that emits the filename on the server
     */
    uploadFile(file: File): Observable<string>;
    /**
     * Trigger backend processing for the uploaded file
     * @param filename - The filename on the server to process
     * @returns Observable that emits the excelfile name and entries
     */
    triggerProcessing(filename: string): Observable<{
        excelfile: string;
        entries: TEntry[];
    }>;
    /**
     * Get job entries for a specific Excel file
     * @param excelfile - The Excel filename to get entries for
     * @param useCache - Whether to use cached entries if available
     * @returns Observable that emits the entries
     */
    getJobEntries(excelfile: string, useCache?: boolean): Observable<TEntry[]>;
    /**
     * Get all recent jobs (metadata)
     * @returns Observable that emits all recent job entries
     */
    getAllRecentJobs(): Observable<TEntry[]>;
    /**
     * Validate Excel file columns
     * @param file - The Excel file to validate
     * @returns Observable that emits validation result
     */
    validateExcelColumns(file: File): Observable<{
        valid: boolean;
        missingColumns?: string[];
    }>;
    /**
     * Clear the entries cache
     */
    clearCache(): void;
    /**
     * Cancel any pending HTTP requests
     */
    cancelPendingRequests(): void;
}

/**
 * JobStateService - Manages job state, polling, and sessionStorage persistence.
 *
 * This is a self-contained service that manages job states without external dependencies
 * beyond the pluggable logger factory.
 */
declare class JobStateService<TEntry extends JobEntry> {
    private ngZone;
    private logFactory;
    private logger;
    private STORAGE_KEY_ACTIVE_JOBS;
    private STORAGE_KEY_RUNNING_JOBS;
    private STORAGE_KEY_COMPLETED_JOBS;
    private activeJobs;
    private runningJobsSubject;
    private completedJobsSubject;
    private isLoadingOverviewSubject;
    private pollingSubscription?;
    private readonly POLLING_INTERVAL_MS;
    private backgroundLoadingSubscriptions;
    private cancelPendingRequests$;
    readonly runningJobs$: Observable<JobProgress[]>;
    readonly completedJobs$: Observable<JobProgress[]>;
    readonly isLoadingOverview$: Observable<boolean>;
    private dataProvider;
    /**
     * Initialize the state service with a data provider
     * @param dataProvider - The data provider to use for fetching job data
     */
    initialize(dataProvider: JobDataProvider<TEntry>): void;
    /**
     * Get active jobs map (for tracking running jobs)
     */
    getActiveJobs(): Map<string, string>;
    /**
     * Add an active job
     * @param jobId - The job ID
     * @param filename - The filename associated with this job
     */
    addActiveJob(jobId: string, filename: string): void;
    /**
     * Remove an active job
     * @param jobId - The job ID to remove
     */
    removeActiveJob(jobId: string): void;
    /**
     * Calculate job progress from entries
     */
    calculateJobProgress(entries: TEntry[], jobId: string, excelfile: string): JobProgress;
    /**
     * Get all currently running jobs by checking active job statuses
     */
    getRunningJobs(): Observable<JobProgress[]>;
    /**
     * Start basic polling
     */
    startPolling(intervalMs?: number): void;
    /**
     * Stop polling
     */
    stopPolling(): void;
    /**
     * Cancel background loading subscriptions
     */
    private cancelBackgroundLoadingSubscriptions;
    /**
     * Cancel pending requests
     */
    cancelPendingRequests(): void;
    /**
     * Save active jobs to sessionStorage
     */
    private saveActiveJobsToStorage;
    /**
     * Save running jobs to sessionStorage
     */
    private saveRunningJobsToStorage;
    /**
     * Save completed jobs to sessionStorage
     */
    private saveCompletedJobsToStorage;
    /**
     * Load state from sessionStorage on service initialization
     */
    private loadStateFromStorage;
    /**
     * Clear all persisted state from sessionStorage
     */
    clearPersistedState(): void;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<JobStateService<any>, never>;
    static ɵprov: _angular_core.ɵɵInjectableDeclaration<JobStateService<any>>;
}

/**
 * Configuration for a registered job service
 */
interface JobServiceConfig {
    /** Unique identifier for the service */
    name: string;
    /** Display name for logging */
    displayName: string;
    /** Service class constructor/token for dependency injection */
    serviceClass: any;
    /** Required roles to access this service */
    requiredRoles?: string[];
}
/**
 * Simplified job polling service for the library.
 * This service manages polling lifecycle for multiple job services.
 */
declare class JobPollingService implements OnDestroy {
    private logFactory;
    private libraryConfig;
    private router;
    private injector;
    private logger;
    private serviceInstances;
    private registeredServices;
    private isPollingStarted;
    private navigationSubscription?;
    constructor();
    /**
     * Register a job service for polling.
     * Should be called by feature modules during initialization.
     *
     * @param config - Service configuration
     */
    registerJobService(config: JobServiceConfig): void;
    /**
     * Get or create a service instance from the registry
     */
    private getServiceInstance;
    /**
     * Initialize polling for all authorized job services.
     *
     * @returns Promise that resolves when polling is set up
     */
    initializePolling(): Promise<void>;
    /**
     * Setup navigation listener to cancel pending HTTP requests.
     * This prevents navigation delays caused by pending polling requests.
     */
    private setupNavigationListener;
    /**
     * Cancel pending HTTP requests in all services.
     * Called automatically on navigation to prevent blocking.
     */
    private cancelAllPendingRequests;
    /**
     * Start polling for all registered services.
     * Authorization is handled by consuming components.
     *
     * @param intervalMs - Polling interval (default: 600000ms = 10 minutes)
     */
    private startPollingForAuthorizedServices;
    /**
     * Start polling for a specific service.
     *
     * @param config - Service configuration from registry
     * @param intervalMs - Polling interval for completed jobs
     */
    private startPollingForService;
    /**
     * Stop polling for all services.
     * Useful for cleanup (e.g., user logout).
     */
    stopAllPolling(): void;
    /**
     * Resume polling for all registered services.
     * Restarts polling if it was previously stopped.
     *
     * @param intervalMs - Optional polling interval (default: 600000ms = 10 minutes)
     */
    resumePolling(intervalMs?: number): void;
    /**
     * Cleanup on service destruction
     */
    ngOnDestroy(): void;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<JobPollingService, never>;
    static ɵprov: _angular_core.ɵɵInjectableDeclaration<JobPollingService>;
}

interface JobDetailEntry {
    id: string;
    itemName: string;
    status: 'Success' | 'Failed' | 'Running' | 'Pending';
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    errorMessage?: string;
    processedBy?: string;
    details?: string;
    [key: string]: any;
}
interface JobDetailsResponse {
    jobId: string;
    jobName: string;
    status: 'pending' | 'running' | 'completed';
    progress: number;
    total: number;
    entries: JobDetailEntry[];
    totalCount: number;
    successCount: number;
    failedCount: number;
    runningCount: number;
    pendingCount: number;
}

declare class JobDetailsComponent implements OnInit {
    jobDetails: JobDetailsResponse | null;
    isLoading: boolean;
    refresh: EventEmitter<void>;
    ngOnInit(): void;
    onRefresh(): void;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<JobDetailsComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<JobDetailsComponent, "syr-job-details", never, { "jobDetails": { "alias": "jobDetails"; "required": false; }; "isLoading": { "alias": "isLoading"; "required": false; }; }, { "refresh": "refresh"; }, never, never, true, never>;
}

export { JOB_LIBRARY_CONFIG, JOB_LOGGER_FACTORY, JobBaseService, JobDetailsComponent, JobPollingService, JobStateService, DynamicJobStore as JobStore };
export type { JobDataProvider, JobDataProviderConfig, JobDetailEntry$1 as JobDetailEntry, JobDetailsResponse$1 as JobDetailsResponse, JobEntry$1 as JobEntry, JobLibraryConfig, JobProgress, JobServiceConfig$1 as JobServiceConfig, JobState, JobType, JobTypeState, LoggerFactoryInterface, LoggerInterface };
