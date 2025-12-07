import { BehaviorSubject, Subject, throwError, of, takeUntil, Observable, timer } from 'rxjs';
import { map, catchError, switchMap, tap, filter } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as i0 from '@angular/core';
import { InjectionToken, signal, computed, Injectable, inject, NgZone, Injector, EventEmitter, Output, Input, Component } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Router, NavigationStart } from '@angular/router';
import * as i1 from '@angular/common';
import { CommonModule } from '@angular/common';

const JOB_LIBRARY_CONFIG = new InjectionToken("JOB_LIBRARY_CONFIG");

/**
 * Initial state for a single job type
 */
const initialJobTypeState = {
    running: [],
    completed: [],
    loading: false,
    error: null,
};
/**
 * Session storage key for job state persistence
 */
const STORAGE_KEY = "job_state";
/**
 * Dynamic Job Store using Angular Signals
 *
 * Fully dynamic store that can handle any job type at runtime.
 * No hardcoded job types - everything is registered dynamically.
 */
class DynamicJobStore {
    // Internal reactive state
    state = signal(this.loadFromStorage(), ...(ngDevMode ? [{ debugName: "state" }] : []));
    // Computed selectors
    allRunningJobs = computed(() => {
        const result = {};
        const currentState = this.state();
        Object.keys(currentState).forEach((jobType) => {
            result[jobType] = currentState[jobType].running;
        });
        return result;
    }, ...(ngDevMode ? [{ debugName: "allRunningJobs" }] : []));
    allCompletedJobs = computed(() => {
        const result = {};
        const currentState = this.state();
        Object.keys(currentState).forEach((jobType) => {
            result[jobType] = currentState[jobType].completed;
        });
        return result;
    }, ...(ngDevMode ? [{ debugName: "allCompletedJobs" }] : []));
    totalRunningJobsCount = computed(() => {
        const currentState = this.state();
        return Object.values(currentState).reduce((total, jobTypeState) => total + jobTypeState.running.length, 0);
    }, ...(ngDevMode ? [{ debugName: "totalRunningJobsCount" }] : []));
    totalCompletedJobsCount = computed(() => {
        const currentState = this.state();
        return Object.values(currentState).reduce((total, jobTypeState) => total + jobTypeState.completed.length, 0);
    }, ...(ngDevMode ? [{ debugName: "totalCompletedJobsCount" }] : []));
    /**
     * Get running jobs for a specific job type
     */
    runningJobs(jobType) {
        return computed(() => {
            const currentState = this.state();
            return currentState[jobType]?.running || [];
        });
    }
    /**
     * Get completed jobs for a specific job type
     */
    completedJobs(jobType) {
        return computed(() => {
            const currentState = this.state();
            return currentState[jobType]?.completed || [];
        });
    }
    /**
     * Get all jobs (running + completed) for a specific job type
     */
    allJobs(jobType) {
        return computed(() => {
            const currentState = this.state();
            const jobTypeState = currentState[jobType];
            if (!jobTypeState)
                return [];
            return [...jobTypeState.running, ...jobTypeState.completed];
        });
    }
    /**
     * Get loading state for a specific job type
     */
    loading(jobType) {
        return computed(() => {
            const currentState = this.state();
            return currentState[jobType]?.loading || false;
        });
    }
    /**
     * Get error for a specific job type
     */
    error(jobType) {
        return computed(() => {
            const currentState = this.state();
            return currentState[jobType]?.error || null;
        });
    }
    /**
     * Get running jobs count for a specific job type
     */
    runningJobsCount(jobType) {
        return computed(() => {
            const currentState = this.state();
            return currentState[jobType]?.running.length || 0;
        });
    }
    /**
     * Get completed jobs count for a specific job type
     */
    completedJobsCount(jobType) {
        return computed(() => {
            const currentState = this.state();
            return currentState[jobType]?.completed.length || 0;
        });
    }
    /**
     * Ensure job type exists in state
     */
    ensureJobType(jobType) {
        const currentState = this.state();
        if (!currentState[jobType]) {
            this.state.update((state) => ({
                ...state,
                [jobType]: { ...initialJobTypeState },
            }));
        }
    }
    /**
     * Set running jobs for a specific job type
     */
    setRunningJobs(jobType, jobs) {
        this.ensureJobType(jobType);
        this.state.update((state) => ({
            ...state,
            [jobType]: {
                ...state[jobType],
                running: jobs,
                loading: false,
                error: null,
            },
        }));
        this.saveToStorage();
    }
    /**
     * Set completed jobs for a specific job type
     */
    setCompletedJobs(jobType, jobs) {
        this.ensureJobType(jobType);
        this.state.update((state) => ({
            ...state,
            [jobType]: {
                ...state[jobType],
                completed: jobs,
                loading: false,
                error: null,
            },
        }));
        this.saveToStorage();
    }
    /**
     * Add a new running job
     */
    addRunningJob(jobType, job) {
        this.ensureJobType(jobType);
        this.state.update((state) => ({
            ...state,
            [jobType]: {
                ...state[jobType],
                running: [...state[jobType].running, job],
            },
        }));
        this.saveToStorage();
    }
    /**
     * Update a specific job (searches in both running and completed)
     */
    updateJob(jobType, job) {
        this.ensureJobType(jobType);
        this.state.update((state) => {
            const currentJobState = state[jobType];
            const runningIndex = currentJobState.running.findIndex((j) => j.id === job.id);
            const completedIndex = currentJobState.completed.findIndex((j) => j.id === job.id);
            if (runningIndex !== -1) {
                const updatedRunning = [...currentJobState.running];
                updatedRunning[runningIndex] = job;
                return {
                    ...state,
                    [jobType]: {
                        ...currentJobState,
                        running: updatedRunning,
                    },
                };
            }
            else if (completedIndex !== -1) {
                const updatedCompleted = [...currentJobState.completed];
                updatedCompleted[completedIndex] = job;
                return {
                    ...state,
                    [jobType]: {
                        ...currentJobState,
                        completed: updatedCompleted,
                    },
                };
            }
            return state;
        });
        this.saveToStorage();
    }
    /**
     * Move a job from running to completed
     */
    moveJobToCompleted(jobType, jobId) {
        this.ensureJobType(jobType);
        this.state.update((state) => {
            const currentJobState = state[jobType];
            const jobIndex = currentJobState.running.findIndex((j) => j.id === jobId);
            if (jobIndex !== -1) {
                const job = currentJobState.running[jobIndex];
                const updatedRunning = currentJobState.running.filter((j) => j.id !== jobId);
                const updatedCompleted = [job, ...currentJobState.completed];
                return {
                    ...state,
                    [jobType]: {
                        ...currentJobState,
                        running: updatedRunning,
                        completed: updatedCompleted,
                    },
                };
            }
            return state;
        });
        this.saveToStorage();
    }
    /**
     * Remove a job from running jobs
     */
    removeRunningJob(jobType, jobId) {
        this.ensureJobType(jobType);
        this.state.update((state) => ({
            ...state,
            [jobType]: {
                ...state[jobType],
                running: state[jobType].running.filter((j) => j.id !== jobId),
            },
        }));
        this.saveToStorage();
    }
    /**
     * Clear all jobs for a specific job type
     */
    clearJobs(jobType) {
        this.state.update((state) => ({
            ...state,
            [jobType]: { ...initialJobTypeState },
        }));
        this.saveToStorage();
    }
    /**
     * Clear all jobs (all types)
     */
    clearAllJobs() {
        this.state.set({});
        this.saveToStorage();
    }
    /**
     * Set loading state for a job type
     */
    setLoading(jobType, loading) {
        this.ensureJobType(jobType);
        this.state.update((state) => ({
            ...state,
            [jobType]: {
                ...state[jobType],
                loading,
            },
        }));
    }
    /**
     * Set error for a job type
     */
    setError(jobType, error) {
        this.ensureJobType(jobType);
        this.state.update((state) => ({
            ...state,
            [jobType]: {
                ...state[jobType],
                error,
                loading: false,
            },
        }));
    }
    /**
     * Load state from sessionStorage
     */
    loadFromStorage() {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Convert date strings back to Date objects
                Object.values(parsed).forEach((jobTypeState) => {
                    jobTypeState.running.forEach((job) => {
                        job.startTime = new Date(job.startTime);
                        if (job.endTime)
                            job.endTime = new Date(job.endTime);
                    });
                    jobTypeState.completed.forEach((job) => {
                        job.startTime = new Date(job.startTime);
                        if (job.endTime)
                            job.endTime = new Date(job.endTime);
                    });
                });
                return parsed;
            }
        }
        catch (error) {
            console.error("[DynamicJobStore] Failed to load state from storage:", error);
        }
        return {};
    }
    /**
     * Save state to sessionStorage
     */
    saveToStorage() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
        }
        catch (error) {
            console.error("[DynamicJobStore] Failed to save state to storage:", error);
        }
    }
    /**
     * Clear all persisted state from sessionStorage
     */
    clearPersistedState() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
            this.state.set({});
        }
        catch (error) {
            console.error("[DynamicJobStore] Failed to clear persisted state:", error);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: DynamicJobStore, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: DynamicJobStore, providedIn: "root" });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: DynamicJobStore, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: "root",
                }]
        }] });
// Re-export as JobStore for compatibility
const JobStore = DynamicJobStore;

// Re-export the dynamic job store as the main JobStore

// Injection tokens for pluggable dependencies
const JOB_LOGGER_FACTORY = new InjectionToken("JOB_LOGGER_FACTORY");
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
class JobBaseService {
    config;
    http = inject(HttpClient);
    translate = inject(TranslateService);
    ngZone = inject(NgZone);
    jobStore = inject(DynamicJobStore);
    // Inject pluggable dependencies with fallbacks
    logFactory = inject(JOB_LOGGER_FACTORY, { optional: true });
    libraryConfig = inject(JOB_LIBRARY_CONFIG, { optional: true });
    logger;
    apiUrl = `/api`;
    // Session storage key for active jobs only - JobStore handles running/completed
    STORAGE_KEY_ACTIVE_JOBS;
    // Store active jobs for polling
    activeJobs = new Map(); // jobId -> filename
    // Cache for job entries to avoid redundant API calls
    entriesCache = new Map(); // excelfile -> entries
    // Track overview loading state for dashboard
    isLoadingOverviewSubject = new BehaviorSubject(false);
    // Track if overview has been loaded to prevent duplicate calls
    overviewLoadTriggered = false;
    overviewDataAvailable = false;
    // Polling subscriptions for periodic updates
    pollingSubscription; // For completed jobs (10 minutes)
    runningJobsPollingSubscription; // For running jobs (30 seconds by default)
    // Get polling intervals from config or use defaults
    get POLLING_INTERVAL_MS() {
        return this.libraryConfig?.defaultPollingInterval ?? 600000; // 10 minutes default
    }
    get RUNNING_JOBS_POLLING_INTERVAL_MS() {
        return this.libraryConfig?.runningJobsPollingInterval ?? 30000; // 30 seconds default
    }
    // Track background detail loading subscriptions for cancellation
    backgroundLoadingSubscriptions = [];
    backgroundLoadingCancelled = false;
    // Subject to cancel ongoing HTTP requests when stopping polling or navigating
    cancelPendingRequests$ = new Subject();
    // Public Observable API for components (converted from JobStore Signals)
    runningJobs$ = toObservable(this.jobStore.runningJobs(this.getJobType()));
    completedJobs$ = toObservable(this.jobStore.completedJobs(this.getJobType()));
    isLoadingOverview$ = this.isLoadingOverviewSubject.asObservable();
    /**
     * Creates HTTP headers with X-Suppress-Error-Toast to prevent toast notifications
     * from appearing during background polling operations
     */
    createSuppressToastHeaders() {
        const headers = new HttpHeaders({ "X-Suppress-Error-Toast": "true" });
        return headers;
    }
    constructor(config) {
        this.config = config;
        // Initialize logger with fallback
        if (this.logFactory) {
            this.logger = this.logFactory.createLogger(config.serviceName + "Service");
        }
        else {
            // Fallback logger if no logger factory is provided
            this.logger = {
                debug: (message, ...args) => console.debug(`[${config.serviceName}Service]`, message, ...args),
                error: (message, ...args) => console.error(`[${config.serviceName}Service]`, message, ...args),
                warn: (message, ...args) => console.warn(`[${config.serviceName}Service]`, message, ...args),
            };
        }
        // Initialize storage keys based on service name
        const lowerName = config.serviceName.toLowerCase();
        this.STORAGE_KEY_ACTIVE_JOBS = `${lowerName}_active_jobs`;
        // Load persisted state from sessionStorage on initialization
        this.loadStateFromStorage();
    }
    /**
     * Step 1: Upload Excel file to backend
     * POST /uploadfile with multipart/form-data
     */
    uploadFile(file) {
        const formData = new FormData();
        formData.append("files", file);
        return this.http
            .post(`${this.apiUrl}/uploadfile`, formData, {
            headers: this.createSuppressToastHeaders(),
        })
            .pipe(map((response) => {
            return response.filename || file.name;
        }), catchError((error) => {
            this.logger.error("File upload failed:", error);
            return throwError(() => new Error(this.translate.instant(`${this.config.translationPrefix}.ERRORS.FILE_UPLOAD_FAILED`)));
        }));
    }
    /**
     * Step 2: Trigger backend processing for the uploaded file
     * PUT {apiBasePath}/{endpointName}?filename=xxx
     */
    triggerProcessing(filename) {
        const url = `${this.apiUrl}${this.config.apiBasePath}/${this.config.endpointName}`;
        return this.http
            .put(url, null, {
            params: { filename },
            headers: this.createSuppressToastHeaders(),
        })
            .pipe(map((entries) => {
            const excelfile = entries.length > 0 ? entries[0].excelfile : filename;
            this.logger.debug(`Processing triggered. Excelfile: ${excelfile}, Entries: ${entries.length}`);
            this.entriesCache.set(excelfile, entries);
            return { excelfile, entries };
        }), catchError((error) => {
            this.logger.error("Processing trigger failed:", error);
            return throwError(() => new Error(this.translate.instant(`${this.config.translationPrefix}.ERRORS.PROCESSING_TRIGGER_FAILED`)));
        }));
    }
    /**
     * Get job entries from backend
     * GET /bb/aktualisierung/{searchEndpointName}?filename=xxx
     */
    getJobEntries(excelfile, useCache = true) {
        if (useCache && this.entriesCache.has(excelfile)) {
            return of(this.entriesCache.get(excelfile));
        }
        const url = `${this.apiUrl}${this.config.apiBasePath}/${this.config.searchEndpointName}`;
        return this.http
            .get(url, {
            params: { filename: excelfile },
            headers: this.createSuppressToastHeaders(),
        })
            .pipe(
        // Cancel this request if navigation occurs
        takeUntil(this.cancelPendingRequests$), map((entries) => {
            this.entriesCache.set(excelfile, entries);
            return entries;
        }), catchError((error) => {
            this.logger.error(`Error getting job entries for ${excelfile}:`, error);
            return of([]);
        }));
    }
    /**
     * Get all recent jobs by fetching all entries without filename filter
     * Uses configured searchExcelFileEndpointName
     */
    getAllRecentJobs() {
        const url = `${this.apiUrl}${this.config.apiBasePath}/${this.config.searchExcelFileEndpointName}`;
        // Build params - only include taskName if it's defined
        const params = { filename: "" };
        if (this.config.taskName) {
            params["task"] = this.config.taskName;
        }
        return this.http
            .get(url, {
            params,
            headers: this.createSuppressToastHeaders(),
        })
            .pipe(
        // Cancel this request if navigation occurs
        takeUntil(this.cancelPendingRequests$), map((entries) => entries), catchError((error) => {
            this.logger.error("Error getting all recent jobs:", error);
            return of([]);
        }));
    }
    /**
     * Calculate job progress from entries
     */
    calculateJobProgress(entries, jobId, excelfile) {
        const total = entries.length;
        const processed = entries.filter((e) => e.status === "verarbeitet").length;
        const failed = entries.filter((e) => e.status === "verarbeitet" && e.error !== null && e.error !== "").length;
        const successful = processed - failed;
        const progress = total > 0 ? (processed / total) * 100 : 0;
        const status = total > 0 && processed === total
            ? failed === total
                ? "failed"
                : "completed"
            : "running";
        const startTime = entries.length > 0 ? new Date(entries[0].created) : new Date();
        const endTime = status === "completed" || status === "failed"
            ? new Date(entries[0].updated)
            : undefined;
        return {
            id: jobId,
            name: excelfile,
            status,
            progress: Math.round(progress),
            total,
            processed,
            errors: failed,
            running: status === "running" ? processed : 0,
            successful,
            failed,
            startTime,
            endTime,
            message: status === "failed"
                ? `${failed} error(s) occurred during processing`
                : undefined,
        };
    }
    /**
     * Get all currently running jobs by checking active job statuses
     */
    getRunningJobs() {
        if (this.activeJobs.size === 0) {
            const emptyJobs = [];
            this.jobStore.setRunningJobs(this.getJobType(), emptyJobs);
            return of(emptyJobs);
        }
        const jobStatusObservables = Array.from(this.activeJobs.entries()).map(([jobId, excelfile]) => this.getJobEntries(excelfile, false).pipe(
        // Cancel this request if navigation occurs
        takeUntil(this.cancelPendingRequests$), map((entries) => {
            if (entries.length === 0) {
                this.activeJobs.delete(jobId);
                this.saveActiveJobsToStorage();
                return null;
            }
            return this.calculateJobProgress(entries, jobId, excelfile);
        }), catchError(() => {
            this.activeJobs.delete(jobId);
            this.saveActiveJobsToStorage();
            return of(null);
        })));
        return new Observable((observer) => {
            const jobs = [];
            let completed = 0;
            jobStatusObservables.forEach((obs) => {
                obs.subscribe({
                    next: (job) => {
                        if (job) {
                            jobs.push(job);
                            if (job.status === "completed" || job.status === "failed") {
                                this.activeJobs.delete(job.id);
                                this.saveActiveJobsToStorage();
                            }
                        }
                    },
                    complete: () => {
                        completed++;
                        if (completed === jobStatusObservables.length) {
                            const runningJobs = jobs.filter((j) => j.status === "running");
                            this.jobStore.setRunningJobs(this.getJobType(), runningJobs);
                            observer.next(runningJobs);
                            observer.complete();
                        }
                    },
                    error: (err) => observer.error(err),
                });
            });
            if (jobStatusObservables.length === 0) {
                const emptyJobs = [];
                this.jobStore.setRunningJobs(this.getJobType(), emptyJobs);
                observer.next(emptyJobs);
                observer.complete();
            }
        });
    }
    /**
     * Validate Excel data
     */
    validateExcelData(data) {
        if (!data || data.length === 0) {
            return {
                valid: false,
                error: this.translate.instant("common.error.emptyFile"),
            };
        }
        const firstRow = data[0];
        const missingColumns = this.config.requiredColumns.filter((col) => !(col in firstRow));
        if (missingColumns.length > 0) {
            return {
                valid: false,
                error: this.translate.instant("common.error.requiredColumns", {
                    columns: missingColumns.join(", "),
                }),
            };
        }
        return { valid: true };
    }
    /**
     * Process uploaded file and create job.
     * The consuming component must parse the Excel data and validate it before calling this method.
     *
     * @param file - The Excel file to upload
     * @param parsedData - Pre-parsed Excel data from the consuming component
     */
    processFileAndCreateJob(file, parsedData) {
        const validation = this.validateExcelData(parsedData);
        if (!validation.valid) {
            this.logger.error("Validation failed:", validation.error);
            return throwError(() => new Error(validation.error || "Validation failed"));
        }
        return this.uploadFile(file).pipe(switchMap((filename) => this.triggerProcessing(filename)), switchMap((response) => {
            const jobId = `${this.config.serviceName.toLowerCase()}-${Date.now()}-${Math.random()
                .toString(36)
                .substring(7)}`;
            this.activeJobs.set(jobId, response.excelfile);
            this.saveActiveJobsToStorage();
            return this.pollJobStatus(response.excelfile, jobId);
        }), catchError((err) => {
            this.logger.error(`Error in ${this.config.serviceName} workflow:`, err);
            const errorMessage = err.message ||
                this.translate.instant(`${this.config.translationPrefix}.ERRORS.JOB_CREATION_FAILED`);
            return throwError(() => new Error(errorMessage));
        }));
    }
    /**
     * Alternative method that accepts pre-validated data and filename.
     * Use this when you want to bypass file upload (e.g., file already uploaded elsewhere).
     *
     * @param filename - The filename returned from a previous upload
     * @param validatedData - Pre-validated Excel data from the consuming component
     */
    createJobFromUploadedFile(filename, validatedData) {
        const validation = this.validateExcelData(validatedData);
        if (!validation.valid) {
            this.logger.error("Validation failed:", validation.error);
            return throwError(() => new Error(validation.error || "Validation failed"));
        }
        return this.triggerProcessing(filename).pipe(switchMap((response) => {
            const jobId = `${this.config.serviceName.toLowerCase()}-${Date.now()}-${Math.random()
                .toString(36)
                .substring(7)}`;
            this.activeJobs.set(jobId, response.excelfile);
            this.saveActiveJobsToStorage();
            return this.pollJobStatus(response.excelfile, jobId);
        }), catchError((err) => {
            this.logger.error(`Error creating job from uploaded file:`, err);
            const errorMessage = err.message ||
                this.translate.instant(`${this.config.translationPrefix}.ERRORS.JOB_CREATION_FAILED`);
            return throwError(() => new Error(errorMessage));
        }));
    }
    /**
     * Poll job status until it's no longer running
     */
    pollJobStatus(excelfile, jobId) {
        return this.getJobEntries(excelfile).pipe(map((entries) => this.calculateJobProgress(entries, jobId, excelfile)), catchError((error) => {
            this.logger.error("Error polling job status:", error);
            return throwError(() => new Error(this.translate.instant(`${this.config.translationPrefix}.ERRORS.STATUS_FETCH_FAILED`)));
        }));
    }
    /**
     * Map entry status to JobDetailEntry status
     */
    mapEntryStatus(entry) {
        if (entry.status === "neu") {
            return "Pending";
        }
        if (entry.status === "verarbeitet") {
            return entry.message && entry.message !== "" ? "Failed" : "Success";
        }
        return "Pending";
    }
    /**
     * Start polling (simplified version for library)
     */
    startPolling(intervalMs = this.POLLING_INTERVAL_MS) {
        this.stopPolling();
        this.ngZone.runOutsideAngular(() => {
            this.logger.debug(`Starting polling (interval: ${intervalMs}ms)`);
            this.pollingSubscription = timer(0, intervalMs)
                .pipe(switchMap(() => this.getAllRecentJobs()))
                .subscribe({
                next: (jobs) => {
                    this.ngZone.run(() => {
                        // Basic polling implementation - can be extended
                        this.logger.debug(`Polled ${jobs.length} jobs`);
                    });
                },
                error: (error) => {
                    this.ngZone.run(() => {
                        this.logger.error("Polling error:", error);
                    });
                },
            });
        });
    }
    /**
     * Stop polling
     */
    /**
     * Load completed jobs overview from API (without fetching entry details)
     * This method only fetches the job overview data, not individual entries.
     * Use loadJobDetails() to fetch full entry data for a specific job on-demand.
     */
    loadCompletedJobs() {
        this.logger.debug("loadCompletedJobs() called - loading job overview only (no details)");
        this.isLoadingOverviewSubject.next(true);
        this.getAllRecentJobs()
            .pipe(tap((entries) => this.logger.debug(`API returned ${entries.length} raw entries (overview only)`)), map((entries) => this.processEntriesIntoCompletedJobs(entries)), tap((jobs) => this.logger.debug(`Processed into ${jobs.length} completed jobs (overview only)`, jobs)), catchError((error) => {
            this.logger.error("Failed to load completed jobs overview:", error);
            this.isLoadingOverviewSubject.next(false);
            return of([]);
        }))
            .subscribe((completedJobs) => {
            // Update JobStore with completed jobs (overview only, details not loaded)
            this.jobStore.setCompletedJobs(this.getJobType(), completedJobs);
            this.logger.debug(`Successfully loaded ${completedJobs.length} job overviews to store`);
            this.isLoadingOverviewSubject.next(false);
        });
    }
    /**
     * Load full job details (entries) for a specific job on-demand.
     * This method is intended to be called when navigating to a job detail page.
     * It fetches all entries for the specified job and caches them.
     *
     * @param jobId - The job ID or excelfile name to load details for
     * @returns Observable that emits when details are loaded
     */
    loadJobDetails(jobId) {
        this.logger.debug(`loadJobDetails() called for jobId: ${jobId}`);
        // For jobIds that are sanitized (underscores), we need to find the original excelfile name
        // Check if this is an active job first
        const excelfile = this.activeJobs.get(jobId) || jobId;
        this.logger.debug(`Loading full entry details for excelfile: ${excelfile}`);
        return this.getJobEntries(excelfile, false).pipe(map(() => {
            this.logger.debug(`Successfully loaded ${this.entriesCache.get(excelfile)?.length || 0} entries for ${excelfile}`);
            return undefined;
        }), catchError((error) => {
            this.logger.error(`Failed to load job details for ${jobId}:`, error);
            return of(undefined);
        }));
    }
    /**
     * Process raw entries into completed JobProgress objects
     */
    processEntriesIntoCompletedJobs(entries) {
        this.logger.debug("Processing entries into completed jobs", {
            totalEntries: entries.length,
        });
        const jobGroups = new Map();
        entries.forEach((entry) => {
            if (!jobGroups.has(entry.excelfile)) {
                jobGroups.set(entry.excelfile, []);
            }
            jobGroups.get(entry.excelfile).push(entry);
        });
        this.logger.debug(`Grouped into ${jobGroups.size} job groups`);
        const completedJobs = [];
        jobGroups.forEach((groupEntries, excelfile) => {
            const jobId = excelfile.replace(/[^a-zA-Z0-9]/g, "_");
            const jobProgress = this.calculateJobProgress(groupEntries, jobId, excelfile);
            this.logger.debug(`Job ${excelfile} has status: ${jobProgress.status}`);
            if (jobProgress.status === "completed") {
                completedJobs.push(jobProgress);
            }
        });
        const sortedJobs = completedJobs.sort((a, b) => {
            const aTime = a.endTime || a.startTime;
            const bTime = b.endTime || b.startTime;
            return bTime.getTime() - aTime.getTime();
        });
        this.logger.debug(`Returning ${sortedJobs.length} sorted completed jobs`);
        return sortedJobs;
    }
    stopPolling() {
        if (this.pollingSubscription) {
            this.logger.debug("Stopping job polling");
            this.cancelPendingRequests$.next();
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = undefined;
        }
    }
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
    startRunningJobsPolling(intervalMs = this.RUNNING_JOBS_POLLING_INTERVAL_MS) {
        this.stopRunningJobsPolling();
        // Run polling OUTSIDE Angular zone for true background behavior
        this.ngZone.runOutsideAngular(() => {
            this.logger.debug(`Starting running jobs polling OUTSIDE Angular zone (interval: ${intervalMs}ms)`);
            this.runningJobsPollingSubscription = timer(0, intervalMs)
                .pipe(takeUntil(this.cancelPendingRequests$), switchMap(() => this.getRunningJobs()))
                .subscribe({
                next: (runningJobs) => {
                    if (runningJobs.length > 0) {
                        this.ngZone.run(() => {
                            this.logger.debug(`Running jobs update: ${runningJobs.length} job(s)`);
                        });
                    }
                },
                error: (error) => {
                    this.ngZone.run(() => {
                        this.logger.error("Running jobs polling error:", error);
                    });
                },
            });
        });
    }
    /**
     * Stop polling for running jobs
     */
    stopRunningJobsPolling() {
        if (this.runningJobsPollingSubscription) {
            this.logger.debug("Stopping running jobs polling");
            this.cancelPendingRequests$.next();
            this.runningJobsPollingSubscription.unsubscribe();
            this.runningJobsPollingSubscription = undefined;
        }
    }
    /**
     * Clear the entries cache to free memory
     */
    clearEntriesCache() {
        this.entriesCache.clear();
    }
    /**
     * Clear cache entries for a specific Excel file
     */
    clearCacheForFile(excelfile) {
        this.entriesCache.delete(excelfile);
    }
    /**
     * Save active jobs to sessionStorage
     */
    saveActiveJobsToStorage() {
        try {
            const activeJobsArray = Array.from(this.activeJobs.entries());
            sessionStorage.setItem(this.STORAGE_KEY_ACTIVE_JOBS, JSON.stringify(activeJobsArray));
        }
        catch (error) {
            this.logger.error("Failed to save active jobs to storage:", error);
        }
    }
    // JobStore handles running/completed jobs session storage automatically
    /**
     * Load state from sessionStorage on service initialization
     */
    loadStateFromStorage() {
        try {
            const activeJobsData = sessionStorage.getItem(this.STORAGE_KEY_ACTIVE_JOBS);
            if (activeJobsData) {
                const activeJobsArray = JSON.parse(activeJobsData);
                this.activeJobs = new Map(activeJobsArray);
            }
            // JobStore handles its own session storage automatically
        }
        catch (error) {
            this.logger.error("Failed to load state from storage:", error);
        }
    }
    /**
     * Clear all persisted state from sessionStorage
     */
    clearPersistedState() {
        try {
            sessionStorage.removeItem(this.STORAGE_KEY_ACTIVE_JOBS);
            // JobStore clears its own state
            this.jobStore.clearPersistedState();
        }
        catch (error) {
            this.logger.error("Failed to clear persisted state:", error);
        }
    }
}

/**
 * JobStateService - Manages job state, polling, and sessionStorage persistence.
 *
 * This is a self-contained service that manages job states without external dependencies
 * beyond the pluggable logger factory.
 */
class JobStateService {
    ngZone = inject(NgZone);
    // Inject pluggable logger factory with fallback
    logFactory = inject(JOB_LOGGER_FACTORY, { optional: true });
    logger;
    // Session storage keys - constructed from service name
    STORAGE_KEY_ACTIVE_JOBS;
    STORAGE_KEY_RUNNING_JOBS;
    STORAGE_KEY_COMPLETED_JOBS;
    // Store active jobs for polling
    activeJobs = new Map(); // jobId -> filename
    // BehaviorSubjects for reactive state management
    runningJobsSubject = new BehaviorSubject([]);
    completedJobsSubject = new BehaviorSubject([]);
    // Track overview loading state for dashboard
    isLoadingOverviewSubject = new BehaviorSubject(false);
    // Polling subscriptions for periodic updates
    pollingSubscription;
    POLLING_INTERVAL_MS = 60000; // 60 seconds
    // Track background detail loading subscriptions for cancellation
    backgroundLoadingSubscriptions = [];
    // Subject to cancel ongoing HTTP requests when stopping polling or navigating
    cancelPendingRequests$ = new Subject();
    // Public observables for components to subscribe to
    runningJobs$ = this.runningJobsSubject.asObservable();
    completedJobs$ = this.completedJobsSubject.asObservable();
    isLoadingOverview$ = this.isLoadingOverviewSubject.asObservable();
    // Data provider - injected after initialization
    dataProvider;
    /**
     * Initialize the state service with a data provider
     * @param dataProvider - The data provider to use for fetching job data
     */
    initialize(dataProvider) {
        this.dataProvider = dataProvider;
        const config = dataProvider.getConfig();
        // Initialize logger with fallback
        if (this.logFactory) {
            this.logger = this.logFactory.createLogger(config.serviceName + 'StateService');
        }
        else {
            // Fallback logger if no logger factory is provided
            this.logger = {
                debug: (message, ...args) => console.debug(`[${config.serviceName}StateService]`, message, ...args),
                error: (message, ...args) => console.error(`[${config.serviceName}StateService]`, message, ...args),
                warn: (message, ...args) => console.warn(`[${config.serviceName}StateService]`, message, ...args)
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
    getActiveJobs() {
        return this.activeJobs;
    }
    /**
     * Add an active job
     * @param jobId - The job ID
     * @param filename - The filename associated with this job
     */
    addActiveJob(jobId, filename) {
        this.activeJobs.set(jobId, filename);
        this.saveActiveJobsToStorage();
    }
    /**
     * Remove an active job
     * @param jobId - The job ID to remove
     */
    removeActiveJob(jobId) {
        this.activeJobs.delete(jobId);
        this.saveActiveJobsToStorage();
    }
    /**
     * Calculate job progress from entries
     */
    calculateJobProgress(entries, jobId, excelfile) {
        const total = entries.length;
        const processed = entries.filter((e) => e.status === 'verarbeitet').length;
        const failed = entries.filter((e) => e.status === 'verarbeitet' && e.error !== null && e.error !== '').length;
        const successful = processed - failed;
        const progress = total > 0 ? (processed / total) * 100 : 0;
        const status = total > 0 && processed === total ? (failed === total ? 'failed' : 'completed') : 'running';
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
    getRunningJobs() {
        if (this.activeJobs.size === 0) {
            const emptyJobs = [];
            this.runningJobsSubject.next(emptyJobs);
            this.saveRunningJobsToStorage(emptyJobs);
            return of(emptyJobs);
        }
        const jobStatusObservables = Array.from(this.activeJobs.entries()).map(([jobId, excelfile]) => this.dataProvider.getJobEntries(excelfile, false).pipe(takeUntil(this.cancelPendingRequests$), map((entries) => {
            if (entries.length === 0) {
                this.removeActiveJob(jobId);
                return null;
            }
            return this.calculateJobProgress(entries, jobId, excelfile);
        }), catchError(() => {
            this.removeActiveJob(jobId);
            return of(null);
        })));
        return new Observable((observer) => {
            const jobs = [];
            let completed = 0;
            jobStatusObservables.forEach((obs) => {
                obs.subscribe({
                    next: (job) => {
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
                    error: (err) => observer.error(err)
                });
            });
            if (jobStatusObservables.length === 0) {
                const emptyJobs = [];
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
    startPolling(intervalMs = this.POLLING_INTERVAL_MS) {
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
    stopPolling() {
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
    cancelBackgroundLoadingSubscriptions() {
        this.backgroundLoadingSubscriptions.forEach((sub) => sub.unsubscribe());
        this.backgroundLoadingSubscriptions = [];
    }
    /**
     * Cancel pending requests
     */
    cancelPendingRequests() {
        this.cancelPendingRequests$.next();
    }
    // ==================== SessionStorage Methods ====================
    /**
     * Save active jobs to sessionStorage
     */
    saveActiveJobsToStorage() {
        try {
            const activeJobsArray = Array.from(this.activeJobs.entries());
            sessionStorage.setItem(this.STORAGE_KEY_ACTIVE_JOBS, JSON.stringify(activeJobsArray));
        }
        catch (error) {
            this.logger.error('Failed to save active jobs to storage:', error);
        }
    }
    /**
     * Save running jobs to sessionStorage
     */
    saveRunningJobsToStorage(jobs) {
        try {
            sessionStorage.setItem(this.STORAGE_KEY_RUNNING_JOBS, JSON.stringify(jobs));
        }
        catch (error) {
            this.logger.error('Failed to save running jobs to storage:', error);
        }
    }
    /**
     * Save completed jobs to sessionStorage
     */
    saveCompletedJobsToStorage(jobs) {
        try {
            sessionStorage.setItem(this.STORAGE_KEY_COMPLETED_JOBS, JSON.stringify(jobs));
        }
        catch (error) {
            this.logger.error('Failed to save completed jobs to storage:', error);
        }
    }
    /**
     * Load state from sessionStorage on service initialization
     */
    loadStateFromStorage() {
        try {
            const activeJobsData = sessionStorage.getItem(this.STORAGE_KEY_ACTIVE_JOBS);
            if (activeJobsData) {
                const activeJobsArray = JSON.parse(activeJobsData);
                this.activeJobs = new Map(activeJobsArray);
            }
            const runningJobsData = sessionStorage.getItem(this.STORAGE_KEY_RUNNING_JOBS);
            if (runningJobsData) {
                const runningJobs = JSON.parse(runningJobsData);
                runningJobs.forEach((job) => {
                    job.startTime = new Date(job.startTime);
                    if (job.endTime)
                        job.endTime = new Date(job.endTime);
                });
                this.runningJobsSubject.next(runningJobs);
            }
            const completedJobsData = sessionStorage.getItem(this.STORAGE_KEY_COMPLETED_JOBS);
            if (completedJobsData) {
                const completedJobs = JSON.parse(completedJobsData);
                completedJobs.forEach((job) => {
                    job.startTime = new Date(job.startTime);
                    if (job.endTime)
                        job.endTime = new Date(job.endTime);
                });
                this.completedJobsSubject.next(completedJobs);
            }
        }
        catch (error) {
            this.logger.error('Failed to load state from storage:', error);
        }
    }
    /**
     * Clear all persisted state from sessionStorage
     */
    clearPersistedState() {
        try {
            sessionStorage.removeItem(this.STORAGE_KEY_ACTIVE_JOBS);
            sessionStorage.removeItem(this.STORAGE_KEY_RUNNING_JOBS);
            sessionStorage.removeItem(this.STORAGE_KEY_COMPLETED_JOBS);
        }
        catch (error) {
            this.logger.error('Failed to clear persisted state:', error);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobStateService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobStateService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobStateService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }] });

/**
 * Simplified job polling service for the library.
 * This service manages polling lifecycle for multiple job services.
 */
class JobPollingService {
    // Inject pluggable dependencies with fallbacks
    logFactory = inject(JOB_LOGGER_FACTORY, { optional: true });
    libraryConfig = inject(JOB_LIBRARY_CONFIG, { optional: true });
    router = inject(Router, { optional: true });
    injector = inject(Injector);
    logger;
    // Service instances - injected directly (not lazy-loaded)
    serviceInstances = new Map();
    // Registered service configurations (populated by feature modules)
    registeredServices = [];
    isPollingStarted = false;
    navigationSubscription;
    constructor() {
        // Initialize logger with fallback
        if (this.logFactory) {
            this.logger = this.logFactory.createLogger("JobPollingService");
        }
        else {
            this.logger = {
                debug: (message, ...args) => console.debug("[JobPollingService]", message, ...args),
                error: (message, ...args) => console.error("[JobPollingService]", message, ...args),
                warn: (message, ...args) => console.warn("[JobPollingService]", message, ...args),
            };
        }
        // Setup navigation listener if router is available
        this.setupNavigationListener();
    }
    /**
     * Register a job service for polling.
     * Should be called by feature modules during initialization.
     *
     * @param config - Service configuration
     */
    registerJobService(config) {
        this.logger.debug(`Registering job service: ${config.displayName}`);
        this.registeredServices.push(config);
        // If polling already started, start polling for this new service immediately
        if (this.isPollingStarted) {
            this.startPollingForService(config, 600000);
        }
    }
    /**
     * Get or create a service instance from the registry
     */
    getServiceInstance(config) {
        if (!this.serviceInstances.has(config.name)) {
            const instance = this.injector.get(config.serviceClass);
            this.serviceInstances.set(config.name, instance);
        }
        return this.serviceInstances.get(config.name);
    }
    /**
     * Initialize polling for all authorized job services.
     *
     * @returns Promise that resolves when polling is set up
     */
    async initializePolling() {
        if (this.isPollingStarted) {
            this.logger.debug("Polling already started, skipping initialization");
            return;
        }
        this.logger.debug("Initializing job polling service...");
        this.startPollingForAuthorizedServices();
    }
    /**
     * Setup navigation listener to cancel pending HTTP requests.
     * This prevents navigation delays caused by pending polling requests.
     */
    setupNavigationListener() {
        if (!this.router) {
            return; // No router available
        }
        this.navigationSubscription = this.router.events
            .pipe(filter((event) => event instanceof NavigationStart))
            .subscribe(() => {
            this.logger.debug("Navigation detected, cancelling pending HTTP requests");
            this.cancelAllPendingRequests();
        });
    }
    /**
     * Cancel pending HTTP requests in all services.
     * Called automatically on navigation to prevent blocking.
     */
    cancelAllPendingRequests() {
        this.logger.debug("Cancelling all pending HTTP requests for navigation");
        // Stop all polling and cancel requests in all cached service instances
        for (const [name, service] of this.serviceInstances) {
            if (service.stopPolling)
                service.stopPolling();
            if (service.stopRunningJobsPolling)
                service.stopRunningJobsPolling();
        }
        // Restart polling after navigation completes
        setTimeout(() => {
            if (this.isPollingStarted) {
                this.logger.debug("Restarting polling after navigation");
                this.startPollingForAuthorizedServices();
            }
        }, 1000);
    }
    /**
     * Start polling for all registered services.
     * Authorization is handled by consuming components.
     *
     * @param intervalMs - Polling interval (default: 600000ms = 10 minutes)
     */
    startPollingForAuthorizedServices(intervalMs = 600000) {
        this.logger.debug("Starting polling for all registered job services...");
        const registeredServiceNames = [];
        // Start polling for all registered services
        this.registeredServices.forEach((config) => {
            registeredServiceNames.push(config.name);
            this.startPollingForService(config, intervalMs);
        });
        this.isPollingStarted = true;
        this.logger.debug(`Polling started for ${registeredServiceNames.length} services:`, registeredServiceNames);
    }
    /**
     * Start polling for a specific service.
     *
     * @param config - Service configuration from registry
     * @param intervalMs - Polling interval for completed jobs
     */
    startPollingForService(config, intervalMs) {
        this.logger.debug(`Starting polling for ${config.displayName}`);
        const service = this.getServiceInstance(config);
        if (service.startPolling)
            service.startPolling(intervalMs);
        // Start running jobs polling with configured interval (default 30 seconds)
        const runningJobsInterval = this.libraryConfig?.runningJobsPollingInterval ?? 30000;
        if (service.startRunningJobsPolling) {
            this.logger.debug(`Starting running jobs polling for ${config.displayName} (interval: ${runningJobsInterval}ms)`);
            service.startRunningJobsPolling(runningJobsInterval);
        }
    }
    /**
     * Stop polling for all services.
     * Useful for cleanup (e.g., user logout).
     */
    stopAllPolling() {
        this.logger.debug("Stopping all job polling");
        // Stop all polling in all cached service instances
        for (const [name, service] of this.serviceInstances) {
            if (service.stopPolling)
                service.stopPolling();
            if (service.stopRunningJobsPolling)
                service.stopRunningJobsPolling();
        }
        this.isPollingStarted = false;
    }
    /**
     * Resume polling for all registered services.
     * Restarts polling if it was previously stopped.
     *
     * @param intervalMs - Optional polling interval (default: 600000ms = 10 minutes)
     */
    resumePolling(intervalMs = 600000) {
        if (!this.isPollingStarted) {
            this.logger.debug("Resuming job polling");
            this.startPollingForAuthorizedServices(intervalMs);
        }
        else {
            this.logger.debug("Polling already started, skipping resume");
        }
    }
    /**
     * Cleanup on service destruction
     */
    ngOnDestroy() {
        this.logger.debug("JobPollingService destroyed, cleaning up");
        this.stopAllPolling();
        if (this.navigationSubscription) {
            this.navigationSubscription.unsubscribe();
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobPollingService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobPollingService, providedIn: "root" });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobPollingService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: "root",
                }]
        }], ctorParameters: () => [] });

class JobDetailsComponent {
    jobDetails = null;
    isLoading = false;
    refresh = new EventEmitter();
    ngOnInit() {
        // Component initialization
    }
    onRefresh() {
        this.refresh.emit();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobDetailsComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "20.3.9", type: JobDetailsComponent, isStandalone: true, selector: "syr-job-details", inputs: { jobDetails: "jobDetails", isLoading: "isLoading" }, outputs: { refresh: "refresh" }, ngImport: i0, template: "<div class=\"p-4 border border-gray-300 rounded-lg bg-white\">\n  <div\n    class=\"flex justify-between items-center mb-4 pb-2 border-b border-gray-300\"\n  >\n    <h3 class=\"m-0 text-gray-800\">\n      {{ jobDetails?.jobName || \"Job Details\" }}\n    </h3>\n    <div\n      class=\"px-3 py-1 rounded-full text-xs font-bold uppercase\"\n      [ngClass]=\"{\n        'bg-yellow-100 text-yellow-700': jobDetails?.status === 'pending',\n        'bg-blue-100 text-blue-700': jobDetails?.status === 'running',\n        'bg-green-100 text-green-700': jobDetails?.status === 'completed'\n      }\"\n    >\n      {{ jobDetails?.status | titlecase }}\n    </div>\n  </div>\n\n  <div class=\"flex gap-6 mb-6 flex-wrap\" *ngIf=\"jobDetails\">\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Progress:</span>\n      <span class=\"text-lg font-bold\">{{ jobDetails.progress }}%</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Total:</span>\n      <span class=\"text-lg font-bold\">{{ jobDetails.total }}</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Success:</span>\n      <span class=\"text-lg font-bold text-green-600\">{{\n        jobDetails.successCount\n      }}</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Failed:</span>\n      <span class=\"text-lg font-bold text-red-600\">{{\n        jobDetails.failedCount\n      }}</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Pending:</span>\n      <span class=\"text-lg font-bold text-yellow-500\">{{\n        jobDetails.pendingCount\n      }}</span>\n    </div>\n  </div>\n\n  <div *ngIf=\"jobDetails?.entries?.length\">\n    <h4 class=\"m-0 mb-4 text-gray-800\">Job Entries</h4>\n    <div class=\"max-h-96 overflow-y-auto\">\n      <div\n        *ngFor=\"let entry of jobDetails?.entries\"\n        class=\"p-3 mb-2 border border-gray-300 rounded-md bg-gray-50\"\n        [ngClass]=\"{\n          'border-l-4 border-l-green-500':\n            entry.status.toLowerCase() === 'success',\n          'border-l-4 border-l-red-500':\n            entry.status.toLowerCase() === 'failed',\n          'border-l-4 border-l-yellow-500':\n            entry.status.toLowerCase() === 'pending',\n          'border-l-4 border-l-blue-500':\n            entry.status.toLowerCase() === 'running'\n        }\"\n      >\n        <div\n          class=\"flex justify-between items-center mb-2 md:flex-row flex-col md:gap-0 gap-2 md:items-center items-start\"\n        >\n          <span class=\"font-medium text-gray-800\">{{ entry.itemName }}</span>\n          <span\n            class=\"px-2 py-1 rounded-xl text-xs font-bold uppercase\"\n            [ngClass]=\"{\n              'bg-green-100 text-green-700':\n                entry.status.toLowerCase() === 'success',\n              'bg-red-100 text-red-800':\n                entry.status.toLowerCase() === 'failed',\n              'bg-yellow-100 text-yellow-700':\n                entry.status.toLowerCase() === 'pending',\n              'bg-blue-100 text-blue-700':\n                entry.status.toLowerCase() === 'running'\n            }\"\n          >\n            {{ entry.status }}\n          </span>\n        </div>\n\n        <div class=\"text-sm text-gray-600 mb-2\" *ngIf=\"entry.details\">\n          {{ entry.details }}\n        </div>\n\n        <div\n          class=\"bg-red-100 text-red-800 p-2 rounded text-sm mb-2\"\n          *ngIf=\"entry.errorMessage\"\n        >\n          <strong>Error:</strong> {{ entry.errorMessage }}\n        </div>\n\n        <div\n          class=\"text-gray-500 text-xs\"\n          *ngIf=\"entry.startTime || entry.endTime\"\n        >\n          <small>\n            <span *ngIf=\"entry.startTime\"\n              >Started: {{ entry.startTime | date : \"short\" }}</span\n            >\n            <span *ngIf=\"entry.endTime\">\n              | Ended: {{ entry.endTime | date : \"short\" }}</span\n            >\n            <span *ngIf=\"entry.duration\">\n              | Duration: {{ entry.duration }}ms</span\n            >\n          </small>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <div\n    class=\"text-center py-8 text-gray-600\"\n    *ngIf=\"\n      jobDetails && (!jobDetails.entries || jobDetails.entries.length === 0)\n    \"\n  >\n    <p>No job entries available.</p>\n  </div>\n\n  <div class=\"text-center py-8 text-gray-600\" *ngIf=\"isLoading\">\n    <p>Loading job details...</p>\n  </div>\n</div>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "pipe", type: i1.TitleCasePipe, name: "titlecase" }, { kind: "pipe", type: i1.DatePipe, name: "date" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.9", ngImport: i0, type: JobDetailsComponent, decorators: [{
            type: Component,
            args: [{ selector: "syr-job-details", standalone: true, imports: [CommonModule], template: "<div class=\"p-4 border border-gray-300 rounded-lg bg-white\">\n  <div\n    class=\"flex justify-between items-center mb-4 pb-2 border-b border-gray-300\"\n  >\n    <h3 class=\"m-0 text-gray-800\">\n      {{ jobDetails?.jobName || \"Job Details\" }}\n    </h3>\n    <div\n      class=\"px-3 py-1 rounded-full text-xs font-bold uppercase\"\n      [ngClass]=\"{\n        'bg-yellow-100 text-yellow-700': jobDetails?.status === 'pending',\n        'bg-blue-100 text-blue-700': jobDetails?.status === 'running',\n        'bg-green-100 text-green-700': jobDetails?.status === 'completed'\n      }\"\n    >\n      {{ jobDetails?.status | titlecase }}\n    </div>\n  </div>\n\n  <div class=\"flex gap-6 mb-6 flex-wrap\" *ngIf=\"jobDetails\">\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Progress:</span>\n      <span class=\"text-lg font-bold\">{{ jobDetails.progress }}%</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Total:</span>\n      <span class=\"text-lg font-bold\">{{ jobDetails.total }}</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Success:</span>\n      <span class=\"text-lg font-bold text-green-600\">{{\n        jobDetails.successCount\n      }}</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Failed:</span>\n      <span class=\"text-lg font-bold text-red-600\">{{\n        jobDetails.failedCount\n      }}</span>\n    </div>\n    <div class=\"flex flex-col gap-1\">\n      <span class=\"text-xs text-gray-600 font-medium\">Pending:</span>\n      <span class=\"text-lg font-bold text-yellow-500\">{{\n        jobDetails.pendingCount\n      }}</span>\n    </div>\n  </div>\n\n  <div *ngIf=\"jobDetails?.entries?.length\">\n    <h4 class=\"m-0 mb-4 text-gray-800\">Job Entries</h4>\n    <div class=\"max-h-96 overflow-y-auto\">\n      <div\n        *ngFor=\"let entry of jobDetails?.entries\"\n        class=\"p-3 mb-2 border border-gray-300 rounded-md bg-gray-50\"\n        [ngClass]=\"{\n          'border-l-4 border-l-green-500':\n            entry.status.toLowerCase() === 'success',\n          'border-l-4 border-l-red-500':\n            entry.status.toLowerCase() === 'failed',\n          'border-l-4 border-l-yellow-500':\n            entry.status.toLowerCase() === 'pending',\n          'border-l-4 border-l-blue-500':\n            entry.status.toLowerCase() === 'running'\n        }\"\n      >\n        <div\n          class=\"flex justify-between items-center mb-2 md:flex-row flex-col md:gap-0 gap-2 md:items-center items-start\"\n        >\n          <span class=\"font-medium text-gray-800\">{{ entry.itemName }}</span>\n          <span\n            class=\"px-2 py-1 rounded-xl text-xs font-bold uppercase\"\n            [ngClass]=\"{\n              'bg-green-100 text-green-700':\n                entry.status.toLowerCase() === 'success',\n              'bg-red-100 text-red-800':\n                entry.status.toLowerCase() === 'failed',\n              'bg-yellow-100 text-yellow-700':\n                entry.status.toLowerCase() === 'pending',\n              'bg-blue-100 text-blue-700':\n                entry.status.toLowerCase() === 'running'\n            }\"\n          >\n            {{ entry.status }}\n          </span>\n        </div>\n\n        <div class=\"text-sm text-gray-600 mb-2\" *ngIf=\"entry.details\">\n          {{ entry.details }}\n        </div>\n\n        <div\n          class=\"bg-red-100 text-red-800 p-2 rounded text-sm mb-2\"\n          *ngIf=\"entry.errorMessage\"\n        >\n          <strong>Error:</strong> {{ entry.errorMessage }}\n        </div>\n\n        <div\n          class=\"text-gray-500 text-xs\"\n          *ngIf=\"entry.startTime || entry.endTime\"\n        >\n          <small>\n            <span *ngIf=\"entry.startTime\"\n              >Started: {{ entry.startTime | date : \"short\" }}</span\n            >\n            <span *ngIf=\"entry.endTime\">\n              | Ended: {{ entry.endTime | date : \"short\" }}</span\n            >\n            <span *ngIf=\"entry.duration\">\n              | Duration: {{ entry.duration }}ms</span\n            >\n          </small>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <div\n    class=\"text-center py-8 text-gray-600\"\n    *ngIf=\"\n      jobDetails && (!jobDetails.entries || jobDetails.entries.length === 0)\n    \"\n  >\n    <p>No job entries available.</p>\n  </div>\n\n  <div class=\"text-center py-8 text-gray-600\" *ngIf=\"isLoading\">\n    <p>Loading job details...</p>\n  </div>\n</div>\n" }]
        }], propDecorators: { jobDetails: [{
                type: Input
            }], isLoading: [{
                type: Input
            }], refresh: [{
                type: Output
            }] } });

/*
 * Public API Surface of @syrius/job-service
 */
// Main service

/**
 * Generated bundle index. Do not edit.
 */

export { JOB_LIBRARY_CONFIG, JOB_LOGGER_FACTORY, JobBaseService, JobDetailsComponent, JobPollingService, JobStateService, DynamicJobStore as JobStore };
//# sourceMappingURL=syrius-job-service.mjs.map
