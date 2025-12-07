import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PopoverModule } from 'primeng/popover';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FileUploadComponent } from '@app/shared/components/file-upload/file-upload.component';
import {
    ProgressListComponent
} from '@app/shared/components/progress-list/progress-list.component';
import {
    ProgressListConfiguration
} from '@app/shared/components/progress-list/progress-list.model';
import { ExcelService } from '@app/shared/services/excel.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LogFactoryService } from '@syrius/core';
import { JobDetailsComponent, JobProgress } from '@syrius/job-service';

import { MedikamentenrueckforderungService } from './medirueck.service';
import { MEDIRUECK_COLUMNS, MEDIRUECK_EXAMPLE_SHEET } from './medirueck.tables';

import type { SafeHtml } from '@angular/platform-browser';
import type { JobDetailsResponse } from '@syrius/job-service';

// Define local interface for job details request since it might be component-specific
interface JobDetailsRequest {
    jobId: string;
    jobName?: string;
}
@Component({
    selector: 'app-medirueck',
    standalone: true,
    imports: [CommonModule, CardModule, TranslateModule, MessageModule, MessageModule, PopoverModule, FileUploadComponent, ButtonModule, ProgressListComponent, JobDetailsComponent],
    templateUrl: './medirueck.component.html'
})
export class MedikamentenrueckforderungComponent implements OnInit, OnDestroy {
    private excelService = inject(ExcelService);
    private translate = inject(TranslateService);
    private jobService = inject(MedikamentenrueckforderungService);
    private logger = inject(LogFactoryService).createLogger('MedikamentenrueckforderungComponent');

    validationError: string | null = null;
    isLoading = false;
    exampleSheetHtml!: SafeHtml;

    // Job progress properties
    runningJobs: JobProgress[] = [];
    completedJobs: JobProgress[] = [];
    jobsLoading = false;
    completedJobsLoading = false; // Track loading state for completed jobs
    completedJobsLoaded = false; // Track if completed jobs have been loaded

    // Job Details Modal State
    showJobDetails = false;
    loadingJobDetails = false;
    currentJobDetails: JobDetailsResponse | null = null;

    // Excel columns for job details display
    excelColumns = MEDIRUECK_COLUMNS;

    // Progress list configuration
    progressListConfig: ProgressListConfiguration = {
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

    ngOnInit(): void {
        this.logger.debug('Initializing MedikamentenrueckforderungComponent');
        this.createExampleSheet();
        this.loadRunningJobs(true); // Show loading on initial load
        this.loadCompletedJobs(true); // Show loading on initial load

        // Subscribe to reactive running jobs stream (centralized polling via JobPollingService)
        this.jobService.runningJobs$.subscribe({
            next: (jobs) => {
                this.runningJobs = jobs;
                this.logger.debug(`Running jobs updated: ${jobs.length} job(s)`);
            }
        });

        this.logger.debug('MedikamentenrueckforderungComponent initialization complete');
    }

    ngOnDestroy(): void {
        this.logger.debug('Destroying MedikamentenrueckforderungComponent');
    }

    /**
     * Handles Excel file selection and processing.
     * Delegates to service for parsing, validation, and job creation.
     *
     * @param file - The Excel file selected by the user (.xlsx or .xls)
     */
    async onFileSelected(file: File): Promise<void> {
        this.logger.debug('File selected for processing', { fileName: file.name, fileSize: file.size });
        this.validationError = null;
        this.isLoading = true;
        // Show spinner immediately in running jobs list
        this.jobsLoading = true;

        if (!file) {
            this.logger.warn('No file provided to onFileSelected');
            this.isLoading = false;
            this.jobsLoading = false;
            return;
        }

        try {
            // Parse Excel file first
            const parsedData = await this.excelService.parseExcel(file);
            this.logger.debug('Excel file parsed successfully', { rowCount: parsedData.length, fileName: file.name });

            // Process file with parsed data using updated library method
            this.jobService.processFileAndCreateJob(file, parsedData).subscribe({
                next: (newJob: JobProgress) => {
                    this.logger.debug('Job created successfully from Excel file', {
                        jobId: newJob.id,
                        jobName: newJob.name,
                        fileName: file.name
                    });
                    this.loadRunningJobs(true); // Show loading spinner when refreshing after new job creation
                    this.validationError = null;
                    this.isLoading = false;
                },
                error: (error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    this.logger.error('Error processing Excel file with job service', { error: errorMessage, fileName: file.name });
                    this.validationError = errorMessage;
                    this.isLoading = false;
                    this.jobsLoading = false;
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error parsing Excel file';
            this.logger.error('Error parsing Excel file', { error: errorMessage, fileName: file.name });
            this.validationError = errorMessage;
            this.isLoading = false;
            this.jobsLoading = false;
        }
    }

    /**
     * Generates an HTML example sheet showing the required Excel column structure.
     */
    createExampleSheet(): void {
        this.logger.debug('Creating example Excel sheet preview');
        this.exampleSheetHtml = this.excelService.createStyledPreview(MEDIRUECK_EXAMPLE_SHEET, 'Medikamentenrückforderung');
    }

    /**
     * Downloads the example Excel file with the required column structure.
     */
    downloadExampleSheet(): void {
        this.logger.debug('Generating example Excel file for download');
        this.excelService.downloadExcelFile(MEDIRUECK_EXAMPLE_SHEET, 'medirueck_beispiel', 'Medikamentenrückforderung');
        this.logger.debug('Example Excel file downloaded');
    }

    /**
     * Loads currently running jobs from the backend.
     * Called during initialization and periodically by the polling mechanism.
     *
     * @param showLoading - If true, displays a loading spinner. If false, refreshes silently (used for polling).
     *
     * @remarks
     * Errors during polling are logged but not shown to the user to avoid interrupting their workflow.
     * The loading state is automatically reset after completion or error.
     */
    loadRunningJobs(showLoading: boolean = false): void {
        if (showLoading) {
            this.jobsLoading = true;
        } else {
            this.logger.debug('Refreshing running jobs (polling)');
        }

        this.jobService.getRunningJobs().subscribe({
            next: (jobs: JobProgress[]) => {
                this.logger.debug('Running jobs loaded', { count: jobs.length });
                this.runningJobs = jobs;
                this.jobsLoading = false;
            },
            error: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                this.logger.error('Error loading running jobs', { error: errorMessage });
                this.jobsLoading = false;
                // Don't show error to user during polling, just log it
            }
        });
    }

    /**
     * Loads previously completed jobs from the backend.
     * Called once during component initialization to populate the completed jobs list.
     * Uses shared state management via BehaviorSubject.
     *
     * Flow:
     * 1. Call ensureCompletedJobsLoaded() to trigger load if not already loaded (idempotent)
     * 2. Subscribe to completedJobs$ BehaviorSubject to get current state
     * 3. Data is shared with dashboard and persisted in session storage
     *
     * @param showLoading - If true, displays a loading spinner. If false, refreshes silently (used for background updates).
     *
     * @remarks
     * The service uses a BehaviorSubject that is shared across the dashboard and all pages.
     * Errors are logged but not displayed to the user since this is a background operation.
     * Completed jobs are not polled as frequently as running jobs to reduce server load.
     */
    loadCompletedJobs(showLoading: boolean = false): void {
        if (showLoading) {
            this.completedJobsLoading = true;
        } else {
            this.logger.debug('Refreshing completed jobs (background)');
        }

        // The job service automatically manages completed jobs loading

        this.logger.debug('Loading completed jobs from BehaviorSubject');
        // Subscribe to BehaviorSubject for instant access to cached data
        // Using take(1) gets the current value and completes the subscription.
        this.jobService.completedJobs$.pipe(take(1)).subscribe({
            next: (completedJobs: JobProgress[]) => {
                this.logger.debug('Completed jobs loaded', { count: completedJobs.length });
                this.completedJobs = completedJobs;
                this.completedJobsLoaded = true;
                this.completedJobsLoading = false;
            },
            error: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                this.logger.error('Error loading completed jobs', { error: errorMessage });
                this.completedJobsLoaded = true; // Mark as loaded even on error to prevent retry loops
                this.completedJobsLoading = false;
                // Don't show error to user for background loading
            }
        });
    }

    /**
     * Handles user request to view detailed information about a specific job.
     * Delegates to service for loading job details.
     * First loads full entry data if not already cached, then loads the formatted job details.
     *
     * @param request - Contains jobId and jobName for the job to display
     */
    onJobDetailsRequested(request: JobDetailsRequest): void {
        this.logger.debug('Job details requested', { jobId: request.jobId, jobName: request.jobName });
        this.showJobDetails = true;
        this.loadingJobDetails = true;
        this.currentJobDetails = null; // Clear previous data on new request

        // First, ensure full job details (entries) are loaded from API
        (this.jobService as any).loadJobDetails(request.jobId).subscribe({
            next: () => {
                this.logger.debug('Full job entries loaded, now loading formatted details');

                // Then load the formatted job details (uses cached entries)
                this.jobService.loadJobDetailsById(request.jobId).subscribe({
                    next: (jobDetails: JobDetailsResponse) => {
                        this.logger.debug('Job details loaded successfully', {
                            jobId: jobDetails.jobId,
                            totalEntries: jobDetails.entries.length
                        });
                        this.currentJobDetails = jobDetails;
                        this.loadingJobDetails = false;
                    },
                    error: (error: unknown) => {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        this.logger.error('Error loading formatted job details', { error: errorMessage, jobId: request.jobId });
                        this.validationError = errorMessage;
                        this.loadingJobDetails = false;
                    }
                });
            },
            error: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                this.logger.error('Error loading job entries', { error: errorMessage, jobId: request.jobId });
                this.validationError = errorMessage;
                this.loadingJobDetails = false;
            }
        });
    }

    /**
     * Handles the closing of the job details modal dialog.
     * Resets the modal state and clears current job details data.
     */
    onJobDetailsDialogClosed(): void {
        this.logger.debug('Job details dialog closed');
        this.showJobDetails = false;
        this.currentJobDetails = null;
        this.loadingJobDetails = false; // Reset loading state
    }

    /**
     * Handles user request to refresh the job details view with latest data.
     * Re-fetches the job details from the backend to show current processing status.
     * This is a background refresh, so we don't show the loading spinner.
     */
    onJobDetailsRefreshRequested(): void {
        if (this.currentJobDetails) {
            this.logger.debug('Job details refresh requested', { jobId: this.currentJobDetails.jobId });

            // Refresh in background without showing loading spinner
            this.jobService.loadJobDetailsById(this.currentJobDetails.jobId).subscribe({
                next: (jobDetails: JobDetailsResponse) => {
                    this.logger.debug('Job details refreshed successfully', {
                        jobId: jobDetails.jobId,
                        totalEntries: jobDetails.entries.length
                    });
                    this.currentJobDetails = jobDetails;
                    // Don't touch loadingJobDetails - keep existing data visible during refresh
                },
                error: (error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    this.logger.error('Error refreshing job details', { error: errorMessage, jobId: this.currentJobDetails?.jobId });
                    // Don't show error to user for background refresh, just log it
                }
            });
        }
    }
}
