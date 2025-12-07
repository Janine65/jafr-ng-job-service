import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PopoverModule } from 'primeng/popover';
import { take } from 'rxjs';

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { FileUploadComponent } from '@app/shared/components/file-upload/file-upload.component';
import {
    ProgressListComponent
} from '@app/shared/components/progress-list/progress-list.component';
import { ExcelService } from '@app/shared/services/excel.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LogFactoryService } from '@syrius/core';
import { JobDetailsComponent, JobDetailsResponse, JobProgress } from '@syrius/job-service';

import { VT_DEFAULT_PROGRESS_CONFIG } from '../shared/vt-progress-config';
import { AktenentscheidService } from './aktenentscheid.service';
import { AKTENENTSCHEID_COLUMNS, AKTENENTSCHEID_EXAMPLE_SHEET } from './aktenentscheid.tables';

// Define local interface for job details request since it might be component-specific
interface JobDetailsRequest {
    jobId: string;
    jobName?: string;
}

@Component({
    selector: 'app-vt-aktenentscheid',
    standalone: true,
    imports: [CommonModule, CardModule, TranslateModule, MessageModule, MessageModule, PopoverModule, FileUploadComponent, ButtonModule, ProgressListComponent, JobDetailsComponent],
    templateUrl: './aktenentscheid.component.html'
})
export class AktenentscheidComponent implements OnInit, OnDestroy {
    private excelService = inject(ExcelService);
    private translate = inject(TranslateService);
    private jobService = inject(AktenentscheidService);
    private logger = inject(LogFactoryService).createLogger('AktenentscheidComponent');

    validationError: string | null = null;
    isLoading = false;
    exampleSheetHtml!: SafeHtml;

    // Job progress properties
    runningJobs: JobProgress[] = [];
    completedJobs: JobProgress[] = [];
    jobsLoading = false;
    completedJobsLoading = false;

    // Job Details Modal State
    showJobDetails = false;
    loadingJobDetails = false;
    currentJobDetails: JobDetailsResponse | null = null;

    // Excel columns for job details display
    excelColumns = AKTENENTSCHEID_COLUMNS;

    // Progress list configuration
    progressListConfig = VT_DEFAULT_PROGRESS_CONFIG;

    ngOnInit(): void {
        this.logger.debug('Initializing AktenentscheidComponent');
        this.createExampleSheet();
        this.loadRunningJobs(true); // Show loading on initial load
        this.loadCompletedJobs(true); // Show loading on initial load

        // Subscribe to reactive running jobs stream (centralized polling via JobPollingService)
        // Polling runs in service outside Angular zone - no navigation blocking!
        this.jobService.runningJobs$.subscribe({
            next: (jobs) => {
                this.runningJobs = jobs;
                this.logger.debug(`Running jobs updated: ${jobs.length} job(s)`);
            }
        });

        // Note: Service-level polling for new completed jobs is handled by DashboardService (30s)

        this.logger.debug('AktenentscheidComponent initialization complete');
    }

    ngOnDestroy(): void {
        this.logger.debug('Destroying AktenentscheidComponent');
        // Note: Service-level polling continues (shared across components and managed by DashboardService)
    }

    /**
     * Handles Excel file selection and processing.
     * Delegates to service for parsing, validation, and job creation.
     */
    async onFileSelected(file: File): Promise<void> {
        this.logger.debug('File selected for processing', { fileName: file.name, fileSize: file.size });
        this.validationError = null;
        this.isLoading = true;

        if (!file) {
            this.logger.warn('No file provided to onFileSelected');
            this.isLoading = false;
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
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error parsing Excel file';
            this.logger.error('Error parsing Excel file', { error: errorMessage, fileName: file.name });
            this.validationError = errorMessage;
            this.isLoading = false;
        }
    }

    /**
     * Generates an HTML example sheet showing the required Excel column structure.
     */
    createExampleSheet(): void {
        this.logger.debug('Creating example Excel sheet preview');
        this.exampleSheetHtml = this.excelService.createStyledPreview(AKTENENTSCHEID_EXAMPLE_SHEET, 'Aktenentscheid');
    }

    /**
     * Downloads the example Excel file with the required column structure.
     */
    downloadExampleSheet(): void {
        this.logger.debug('Generating example Excel file for download');
        this.excelService.downloadExcelFile(AKTENENTSCHEID_EXAMPLE_SHEET, 'aktenentscheid_beispiel', 'Aktenentscheid');
        this.logger.debug('Example Excel file downloaded');
    }

    /**
     * Loads currently running jobs from the backend.
     * Called during initialization and periodically by the polling mechanism.
     * Errors during polling are logged but not shown to avoid interrupting workflow.
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
            }
        });
    }

    /**
     * Loads completed jobs from the service's reactive state.
     * The service uses a BehaviorSubject that is shared across the dashboard and all pages.
     * This ensures we don't refetch data that was already loaded (e.g., from the dashboard).
     */
    loadCompletedJobs(showLoading: boolean = false): void {
        if (showLoading) {
            this.completedJobsLoading = true;
        } else {
            this.logger.debug('Refreshing completed jobs (background)');
        }

        this.logger.debug('Subscribing to completed jobs state');

        // Trigger completed jobs loading from API
        if ((this.jobService as any).loadCompletedJobs) {
            (this.jobService as any).loadCompletedJobs();
        }

        // Subscribe to the reactive state (shared with dashboard and other pages)
        // take(1) to get current state and complete immediately
        this.jobService.completedJobs$.pipe(take(1)).subscribe({
            next: (completedJobs: JobProgress[]) => {
                this.logger.debug('Completed jobs state retrieved', { count: completedJobs.length });
                this.completedJobs = completedJobs;
                this.completedJobsLoading = false;
            },
            error: (error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                this.logger.error('Error in completed jobs stream', { error: errorMessage });
                this.completedJobsLoading = false;
            }
        });
    }

    /**
     * Handles user request to view detailed information about a specific job.
     * Delegates to service for loading job details.
     * First loads full entry data if not already cached, then loads the formatted job details.
     */
    onJobDetailsRequested(request: JobDetailsRequest): void {
        this.logger.debug('Job details requested', { jobId: request.jobId, jobName: request.jobName });
        this.showJobDetails = true;
        this.loadingJobDetails = true;
        this.currentJobDetails = null;

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
        this.loadingJobDetails = false;
    }

    /**
     * Handles user request to refresh the job details view with latest data.
     * Background refresh - no loading spinner to keep existing data visible.
     */
    onJobDetailsRefreshRequested(): void {
        if (this.currentJobDetails) {
            this.logger.debug('Job details refresh requested', { jobId: this.currentJobDetails.jobId });

            this.jobService.loadJobDetailsById(this.currentJobDetails.jobId).subscribe({
                next: (jobDetails: JobDetailsResponse) => {
                    this.logger.debug('Job details refreshed successfully', {
                        jobId: jobDetails.jobId,
                        totalEntries: jobDetails.entries.length
                    });
                    this.currentJobDetails = jobDetails;
                },
                error: (error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    this.logger.error('Error refreshing job details', { error: errorMessage, jobId: this.currentJobDetails?.jobId });
                }
            });
        }
    }
}
