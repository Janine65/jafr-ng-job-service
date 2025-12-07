import {
    BehaviorSubject, Observable, of, Subject, Subscription, take, takeUntil, throwError, timer
} from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, InjectionToken, NgZone } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { JOB_LIBRARY_CONFIG, JobLibraryConfig } from '../config/job-tokens';
import { JobStore, JobType } from '../stores/job.store';

// Local interfaces for the library
export interface JobProgress {
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

export interface JobDetailsResponse {
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
  entries: JobDetailEntry[];
}

export interface JobDetailEntry {
  id: string;
  itemName: string;
  status: "Success" | "Failed" | "Pending";
  errorMessage?: string;
  details: string;
  [key: string]: any; // Allow additional fields for entry data
}

// Injection tokens for pluggable dependencies
export const JOB_LOGGER_FACTORY = new InjectionToken<LoggerFactoryInterface>(
  "JOB_LOGGER_FACTORY"
);

// Optional logger interfaces - only dependency we keep
export interface LoggerInterface {
  debug(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
}

export interface LoggerFactoryInterface {
  createLogger(name: string): LoggerInterface;
}

/**
 * Configuration interface for job-based services
 */
export interface JobServiceConfig {
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
export interface JobEntry {
  id: number;
  created: string;
  updated: string;
  updatedby: string;
  excelfile: string;
  status: string;
  row: number;
  partnernr?: string; // Optional - some services don't have this field
  error?: string | null; // Optional - some services use 'message' instead
  message?: string | null; // Error/info message
  [key: string]: unknown; // Allow additional fields
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
export abstract class JobBaseService<TEntry extends JobEntry> {
  protected http = inject(HttpClient);
  protected translate = inject(TranslateService);
  protected ngZone = inject(NgZone);
  protected jobStore = inject(JobStore);

  // Inject pluggable dependencies with fallbacks
  protected logFactory = inject(JOB_LOGGER_FACTORY, { optional: true });
  protected libraryConfig = inject(JOB_LIBRARY_CONFIG, { optional: true });
  protected logger!: LoggerInterface;

  protected apiUrl = `/api`;

  // Session storage key for active jobs only - JobStore handles running/completed
  protected readonly STORAGE_KEY_ACTIVE_JOBS: string;

  // Store active jobs for polling
  protected activeJobs = new Map<string, string>(); // jobId -> filename

  // Cache for job entries to avoid redundant API calls
  protected entriesCache = new Map<string, TEntry[]>(); // excelfile -> entries

  // Track overview loading state for dashboard
  private isLoadingOverviewSubject = new BehaviorSubject<boolean>(false);

  // Track if overview has been loaded to prevent duplicate calls
  private overviewLoadTriggered = false;
  private overviewDataAvailable = false;

  // Polling subscriptions for periodic updates
  private pollingSubscription?: Subscription; // For completed jobs (10 minutes)
  private runningJobsPollingSubscription?: Subscription; // For running jobs (30 seconds by default)

  // Get polling intervals from config or use defaults
  private get POLLING_INTERVAL_MS(): number {
    return this.libraryConfig?.defaultPollingInterval ?? 600000; // 10 minutes default
  }

  private get RUNNING_JOBS_POLLING_INTERVAL_MS(): number {
    return this.libraryConfig?.runningJobsPollingInterval ?? 30000; // 30 seconds default
  }

  // Track background detail loading subscriptions for cancellation
  private backgroundLoadingSubscriptions: Subscription[] = [];
  private backgroundLoadingCancelled = false;

  // Subject to cancel ongoing HTTP requests when stopping polling or navigating
  private cancelPendingRequests$ = new Subject<void>();

  // Public Observable API for components (converted from JobStore Signals)
  public readonly runningJobs$ = toObservable(
    this.jobStore.runningJobs(this.getJobType())
  );
  public readonly completedJobs$ = toObservable(
    this.jobStore.completedJobs(this.getJobType())
  );
  public readonly isLoadingOverview$ =
    this.isLoadingOverviewSubject.asObservable();

  /**
   * Creates HTTP headers with X-Suppress-Error-Toast to prevent toast notifications
   * from appearing during background polling operations
   */
  private createSuppressToastHeaders(): HttpHeaders {
    const headers = new HttpHeaders({ "X-Suppress-Error-Toast": "true" });
    return headers;
  }

  /**
   * Each service must specify its JobType for JobStore integration
   */
  protected abstract getJobType(): JobType;

  constructor(protected config: JobServiceConfig) {
    // Initialize logger with fallback
    if (this.logFactory) {
      this.logger = this.logFactory.createLogger(
        config.serviceName + "Service"
      );
    } else {
      // Fallback logger if no logger factory is provided
      this.logger = {
        debug: (message: string, ...args: any[]) =>
          console.debug(`[${config.serviceName}Service]`, message, ...args),
        error: (message: string, ...args: any[]) =>
          console.error(`[${config.serviceName}Service]`, message, ...args),
        warn: (message: string, ...args: any[]) =>
          console.warn(`[${config.serviceName}Service]`, message, ...args),
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
  protected uploadFile(file: File): Observable<string> {
    const formData = new FormData();
    formData.append("files", file);

    return this.http
      .post<any>(`${this.apiUrl}/uploadfile`, formData, {
        headers: this.createSuppressToastHeaders(),
      })
      .pipe(
        map((response) => {
          return response.filename || file.name;
        }),
        catchError((error) => {
          this.logger.error("File upload failed:", error);
          return throwError(
            () =>
              new Error(
                this.translate.instant(
                  `${this.config.translationPrefix}.ERRORS.FILE_UPLOAD_FAILED`
                )
              )
          );
        })
      );
  }

  /**
   * Step 2: Trigger backend processing for the uploaded file
   * PUT {apiBasePath}/{endpointName}?filename=xxx
   */
  protected triggerProcessing(
    filename: string
  ): Observable<{ excelfile: string; entries: TEntry[] }> {
    const url = `${this.apiUrl}${this.config.apiBasePath}/${this.config.endpointName}`;

    return this.http
      .put<TEntry[]>(url, null, {
        params: { filename },
        headers: this.createSuppressToastHeaders(),
      })
      .pipe(
        map((entries) => {
          const excelfile =
            entries.length > 0 ? entries[0].excelfile : filename;
          this.logger.debug(
            `Processing triggered. Excelfile: ${excelfile}, Entries: ${entries.length}`
          );
          this.entriesCache.set(excelfile, entries);
          return { excelfile, entries };
        }),
        catchError((error) => {
          this.logger.error("Processing trigger failed:", error);
          return throwError(
            () =>
              new Error(
                this.translate.instant(
                  `${this.config.translationPrefix}.ERRORS.PROCESSING_TRIGGER_FAILED`
                )
              )
          );
        })
      );
  }

  /**
   * Get job entries from backend
   * GET /bb/aktualisierung/{searchEndpointName}?filename=xxx
   */
  protected getJobEntries(
    excelfile: string,
    useCache: boolean = true
  ): Observable<TEntry[]> {
    if (useCache && this.entriesCache.has(excelfile)) {
      return of(this.entriesCache.get(excelfile)!);
    }

    const url = `${this.apiUrl}${this.config.apiBasePath}/${this.config.searchEndpointName}`;

    return this.http
      .get<TEntry[]>(url, {
        params: { filename: excelfile },
        headers: this.createSuppressToastHeaders(),
      })
      .pipe(
        // Cancel this request if navigation occurs
        takeUntil(this.cancelPendingRequests$),
        map((entries) => {
          this.entriesCache.set(excelfile, entries);
          return entries;
        }),
        catchError((error) => {
          this.logger.error(
            `Error getting job entries for ${excelfile}:`,
            error
          );
          return of([]);
        })
      );
  }

  /**
   * Get all recent jobs by fetching all entries without filename filter
   * Uses configured searchExcelFileEndpointName
   */
  protected getAllRecentJobs(): Observable<TEntry[]> {
    const url = `${this.apiUrl}${this.config.apiBasePath}/${this.config.searchExcelFileEndpointName}`;

    // Build params - only include taskName if it's defined
    const params: Record<string, string> = { filename: "" };
    if (this.config.taskName) {
      params["task"] = this.config.taskName;
    }

    return this.http
      .get<TEntry[]>(url, {
        params,
        headers: this.createSuppressToastHeaders(),
      })
      .pipe(
        // Cancel this request if navigation occurs
        takeUntil(this.cancelPendingRequests$),
        map((entries) => entries),
        catchError((error) => {
          this.logger.error("Error getting all recent jobs:", error);
          return of([]);
        })
      );
  }

  /**
   * Calculate job progress from entries
   */
  protected calculateJobProgress(
    entries: TEntry[],
    jobId: string,
    excelfile: string
  ): JobProgress {
    const total = entries.length;
    const processed = entries.filter((e) => e.status === "verarbeitet").length;
    const failed = entries.filter(
      (e) => e.status === "verarbeitet" && e.error !== null && e.error !== ""
    ).length;
    const successful = processed - failed;

    const progress = total > 0 ? (processed / total) * 100 : 0;
    const status: "running" | "completed" | "failed" =
      total > 0 && processed === total
        ? failed === total
          ? "failed"
          : "completed"
        : "running";

    const startTime =
      entries.length > 0 ? new Date(entries[0].created) : new Date();
    const endTime =
      status === "completed" || status === "failed"
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
      message:
        status === "failed"
          ? `${failed} error(s) occurred during processing`
          : undefined,
    };
  }

  /**
   * Get all currently running jobs by checking active job statuses
   */
  getRunningJobs(): Observable<JobProgress[]> {
    if (this.activeJobs.size === 0) {
      const emptyJobs: JobProgress[] = [];
      this.jobStore.setRunningJobs(this.getJobType(), emptyJobs);
      return of(emptyJobs);
    }

    const jobStatusObservables = Array.from(this.activeJobs.entries()).map(
      ([jobId, excelfile]) =>
        this.getJobEntries(excelfile, false).pipe(
          // Cancel this request if navigation occurs
          takeUntil(this.cancelPendingRequests$),
          map((entries) => {
            if (entries.length === 0) {
              this.activeJobs.delete(jobId);
              this.saveActiveJobsToStorage();
              return null;
            }
            return this.calculateJobProgress(entries, jobId, excelfile);
          }),
          catchError(() => {
            this.activeJobs.delete(jobId);
            this.saveActiveJobsToStorage();
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
          error: (err: Error) => observer.error(err),
        });
      });

      if (jobStatusObservables.length === 0) {
        const emptyJobs: JobProgress[] = [];
        this.jobStore.setRunningJobs(this.getJobType(), emptyJobs);
        observer.next(emptyJobs);
        observer.complete();
      }
    });
  }

  /**
   * Validate Excel data
   */
  validateExcelData(data: Record<string, unknown>[]): {
    valid: boolean;
    error?: string;
  } {
    if (!data || data.length === 0) {
      return {
        valid: false,
        error: this.translate.instant("common.error.emptyFile"),
      };
    }

    const firstRow = data[0];
    const missingColumns = this.config.requiredColumns.filter(
      (col) => !(col in firstRow)
    );

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
  processFileAndCreateJob(
    file: File,
    parsedData: Record<string, unknown>[]
  ): Observable<JobProgress> {
    const validation = this.validateExcelData(parsedData);

    if (!validation.valid) {
      this.logger.error("Validation failed:", validation.error);
      return throwError(
        () => new Error(validation.error || "Validation failed")
      );
    }

    return this.uploadFile(file).pipe(
      switchMap((filename) => this.triggerProcessing(filename)),
      switchMap((response) => {
        const jobId = `${this.config.serviceName.toLowerCase()}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`;
        this.activeJobs.set(jobId, response.excelfile);
        this.saveActiveJobsToStorage();

        return this.pollJobStatus(response.excelfile, jobId);
      }),
      catchError((err: Error) => {
        this.logger.error(`Error in ${this.config.serviceName} workflow:`, err);
        const errorMessage =
          err.message ||
          this.translate.instant(
            `${this.config.translationPrefix}.ERRORS.JOB_CREATION_FAILED`
          );
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Alternative method that accepts pre-validated data and filename.
   * Use this when you want to bypass file upload (e.g., file already uploaded elsewhere).
   *
   * @param filename - The filename returned from a previous upload
   * @param validatedData - Pre-validated Excel data from the consuming component
   */
  createJobFromUploadedFile(
    filename: string,
    validatedData: Record<string, unknown>[]
  ): Observable<JobProgress> {
    const validation = this.validateExcelData(validatedData);

    if (!validation.valid) {
      this.logger.error("Validation failed:", validation.error);
      return throwError(
        () => new Error(validation.error || "Validation failed")
      );
    }

    return this.triggerProcessing(filename).pipe(
      switchMap((response) => {
        const jobId = `${this.config.serviceName.toLowerCase()}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`;
        this.activeJobs.set(jobId, response.excelfile);
        this.saveActiveJobsToStorage();

        return this.pollJobStatus(response.excelfile, jobId);
      }),
      catchError((err: Error) => {
        this.logger.error(`Error creating job from uploaded file:`, err);
        const errorMessage =
          err.message ||
          this.translate.instant(
            `${this.config.translationPrefix}.ERRORS.JOB_CREATION_FAILED`
          );
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Poll job status until it's no longer running
   */
  protected pollJobStatus(
    excelfile: string,
    jobId: string
  ): Observable<JobProgress> {
    return this.getJobEntries(excelfile).pipe(
      map((entries) => this.calculateJobProgress(entries, jobId, excelfile)),
      catchError((error: Error) => {
        this.logger.error("Error polling job status:", error);
        return throwError(
          () =>
            new Error(
              this.translate.instant(
                `${this.config.translationPrefix}.ERRORS.STATUS_FETCH_FAILED`
              )
            )
        );
      })
    );
  }

  /**
   * Load job details by ID - to be implemented by subclasses
   * Each service has slightly different field mappings for the detail view
   */
  abstract loadJobDetailsById(jobId: string): Observable<JobDetailsResponse>;

  /**
   * Map entry status to JobDetailEntry status
   */
  protected mapEntryStatus(entry: TEntry): "Success" | "Failed" | "Pending" {
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
  startPolling(intervalMs: number = this.POLLING_INTERVAL_MS): void {
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
  loadCompletedJobs(): void {
    this.logger.debug(
      "loadCompletedJobs() called - loading job overview only (no details)"
    );
    this.isLoadingOverviewSubject.next(true);

    this.getAllRecentJobs()
      .pipe(
        tap((entries: TEntry[]) =>
          this.logger.debug(
            `API returned ${entries.length} raw entries (overview only)`
          )
        ),
        map((entries: TEntry[]) =>
          this.processEntriesIntoCompletedJobs(entries)
        ),
        tap((jobs: JobProgress[]) =>
          this.logger.debug(
            `Processed into ${jobs.length} completed jobs (overview only)`,
            jobs
          )
        ),
        catchError((error) => {
          this.logger.error("Failed to load completed jobs overview:", error);
          this.isLoadingOverviewSubject.next(false);
          return of([]);
        })
      )
      .subscribe((completedJobs: JobProgress[]) => {
        // Update JobStore with completed jobs (overview only, details not loaded)
        this.jobStore.setCompletedJobs(this.getJobType(), completedJobs);
        this.logger.debug(
          `Successfully loaded ${completedJobs.length} job overviews to store`
        );
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
  loadJobDetails(jobId: string): Observable<void> {
    this.logger.debug(`loadJobDetails() called for jobId: ${jobId}`);

    // For jobIds that are sanitized (underscores), we need to find the original excelfile name
    // Check if this is an active job first
    const excelfile = this.activeJobs.get(jobId) || jobId;

    this.logger.debug(`Loading full entry details for excelfile: ${excelfile}`);

    return this.getJobEntries(excelfile, false).pipe(
      map(() => {
        this.logger.debug(
          `Successfully loaded ${
            this.entriesCache.get(excelfile)?.length || 0
          } entries for ${excelfile}`
        );
        return undefined;
      }),
      catchError((error) => {
        this.logger.error(`Failed to load job details for ${jobId}:`, error);
        return of(undefined);
      })
    );
  }

  /**
   * Process raw entries into completed JobProgress objects
   */
  private processEntriesIntoCompletedJobs(entries: TEntry[]): JobProgress[] {
    this.logger.debug("Processing entries into completed jobs", {
      totalEntries: entries.length,
    });
    const jobGroups = new Map<string, TEntry[]>();

    entries.forEach((entry) => {
      if (!jobGroups.has(entry.excelfile)) {
        jobGroups.set(entry.excelfile, []);
      }
      jobGroups.get(entry.excelfile)!.push(entry);
    });

    this.logger.debug(`Grouped into ${jobGroups.size} job groups`);
    const completedJobs: JobProgress[] = [];

    jobGroups.forEach((groupEntries, excelfile) => {
      const jobId = excelfile.replace(/[^a-zA-Z0-9]/g, "_");
      const jobProgress = this.calculateJobProgress(
        groupEntries,
        jobId,
        excelfile
      );

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

  stopPolling(): void {
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
  startRunningJobsPolling(
    intervalMs: number = this.RUNNING_JOBS_POLLING_INTERVAL_MS
  ): void {
    this.stopRunningJobsPolling();

    // Run polling OUTSIDE Angular zone for true background behavior
    this.ngZone.runOutsideAngular(() => {
      this.logger.debug(
        `Starting running jobs polling OUTSIDE Angular zone (interval: ${intervalMs}ms)`
      );

      this.runningJobsPollingSubscription = timer(0, intervalMs)
        .pipe(
          takeUntil(this.cancelPendingRequests$),
          switchMap(() => this.getRunningJobs())
        )
        .subscribe({
          next: (runningJobs) => {
            if (runningJobs.length > 0) {
              this.ngZone.run(() => {
                this.logger.debug(
                  `Running jobs update: ${runningJobs.length} job(s)`
                );
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
  stopRunningJobsPolling(): void {
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
  clearEntriesCache(): void {
    this.entriesCache.clear();
  }

  /**
   * Clear cache entries for a specific Excel file
   */
  clearCacheForFile(excelfile: string): void {
    this.entriesCache.delete(excelfile);
  }

  /**
   * Save active jobs to sessionStorage
   */
  protected saveActiveJobsToStorage(): void {
    try {
      const activeJobsArray = Array.from(this.activeJobs.entries());
      sessionStorage.setItem(
        this.STORAGE_KEY_ACTIVE_JOBS,
        JSON.stringify(activeJobsArray)
      );
    } catch (error) {
      this.logger.error("Failed to save active jobs to storage:", error);
    }
  }

  // JobStore handles running/completed jobs session storage automatically

  /**
   * Load state from sessionStorage on service initialization
   */
  protected loadStateFromStorage(): void {
    try {
      const activeJobsData = sessionStorage.getItem(
        this.STORAGE_KEY_ACTIVE_JOBS
      );
      if (activeJobsData) {
        const activeJobsArray = JSON.parse(activeJobsData) as [
          string,
          string
        ][];
        this.activeJobs = new Map(activeJobsArray);
      }

      // JobStore handles its own session storage automatically
    } catch (error) {
      this.logger.error("Failed to load state from storage:", error);
    }
  }

  /**
   * Clear all persisted state from sessionStorage
   */
  clearPersistedState(): void {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY_ACTIVE_JOBS);
      // JobStore clears its own state
      this.jobStore.clearPersistedState();
    } catch (error) {
      this.logger.error("Failed to clear persisted state:", error);
    }
  }
}
