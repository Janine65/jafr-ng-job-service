import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Injectable } from '@angular/core';
import { JobBaseService, JobProgress, JobServiceConfig, JobType } from '@syrius/job-service';

import { MEDIRUECK_REQUIRED_COLUMNS } from './medirueck.tables';

import type { JobDetailsResponse } from '@syrius/job-service';
import type { MediRueckEntry } from './medirueck.model';

/**
 * Service configuration for Medikamentenrückforderung
 */
const MEDIRUECK_CONFIG: JobServiceConfig = {
    serviceName: 'Medikamentenrueckforderung',
    apiBasePath: '/medirueckforderung/medirueck',
    endpointName: 'uploadMediRueckforderung',
    searchEndpointName: 'searchMediRueckforderung',
    searchExcelFileEndpointName: 'searchMediRueckExcelfile',
    translationPrefix: 'INEX.MEDIRUECK',
    requiredColumns: MEDIRUECK_REQUIRED_COLUMNS,
    rowTranslationKey: 'INEX.MEDIRUECK.TABLE.ROW'
};

/**
 * Service for Medikamentenrückforderung operations.
 * Extends JobBaseService for shared job management functionality including:
 * - BehaviorSubject state management (runningJobs$, completedJobs$)
 * - Session storage persistence
 * - Idempotent loading with ensureCompletedJobsLoaded()
 * - Non-blocking dashboard loading
 */
@Injectable({
    providedIn: 'root'
})
export class MedikamentenrueckforderungService extends JobBaseService<MediRueckEntry> {
    constructor() {
        super(MEDIRUECK_CONFIG);
    }

    getJobType(): JobType {
        return 'medikamentenrueckforderung';
    }

    /**
     * Override: Calculate job progress from entries array
     *
     * Medirueck uses 'message' field for errors instead of 'error' field.
     *
     * Entry status values:
     * - 'neu': Just uploaded, not yet processed
     * - 'verarbeitet': Has been processed (may have succeeded or failed)
     *   - If 'message' field is non-empty, it indicates an error
     */
    protected override calculateJobProgress(entries: MediRueckEntry[], jobId: string, excelfile: string): JobProgress {
        const total = entries.length;

        // Count entries by status
        const processedEntries = entries.filter((e) => e.status === 'verarbeitet');
        const processed = processedEntries.length;

        // Errors are entries with 'verarbeitet' status AND a non-empty message
        const failed = entries.filter((e) => e.status === 'verarbeitet' && e.message !== null && e.message !== '').length;

        // Successful entries are those with 'verarbeitet' status but no error message
        const successful = entries.filter((e) => e.status === 'verarbeitet' && (e.message === null || e.message === '')).length;

        const progress = total > 0 ? (processed / total) * 100 : 0;

        // Determine overall status
        let status: 'running' | 'completed' | 'failed';
        if (processed === total) {
            // All entries processed
            status = failed > 0 ? 'failed' : 'completed';
        } else {
            // Still processing
            status = 'running';
        }

        // Get earliest and latest timestamps
        const sortedByCreated = [...entries].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
        const startTime = sortedByCreated.length > 0 ? new Date(sortedByCreated[0].created) : new Date();
        const endTime = status === 'completed' || status === 'failed' ? (sortedByCreated.length > 0 ? new Date(sortedByCreated[sortedByCreated.length - 1].updated) : undefined) : undefined;

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
     * Override: Map entry status to detail view status
     * Medirueck uses 'message' field for errors instead of 'error' field
     */
    protected override mapEntryStatus(entry: MediRueckEntry): 'Success' | 'Failed' | 'Pending' {
        if (entry.status === 'verarbeitet') {
            // Check if there's an error message
            return entry.message && entry.message.trim() !== '' ? 'Failed' : 'Success';
        }
        return 'Pending';
    }

    /**
     * Format entry details for display
     * Medirueck-specific field formatting
     */
    protected formatEntryDetails(entry: MediRueckEntry): string {
        return [
            `Falldossier: ${entry.falldossier || '-'}`,
            `Rückzahler: ${entry.rueckzahler || '-'}`,
            `Behandlungsbeginn: ${entry.behandlungsbeginn || '-'}`,
            `Behandlungsende: ${entry.behandlungsende || '-'}`,
            `Rechnungsbetrag: ${entry.rechnungsbetrag || '-'}`,
            `Rechnungstyp: ${entry.rechnungstyp || '-'}`
        ].join(', ');
    }

    /**
     * Load job details by ID (required abstract method implementation)
     * Gets the current job status and details from the backend
     *
     * @param jobId - The ID of the job to load details for (either generated jobId or excelfile name)
     * @returns Observable that emits the job details response
     */
    loadJobDetailsById(jobId: string): Observable<JobDetailsResponse> {
        // Check if it's an active job first, otherwise use jobId as excelfile name
        const excelfile = this.activeJobs.get(jobId) || jobId;

        // Get job entries to calculate statistics
        return this.getJobEntries(excelfile).pipe(
            map((entries) => {
                const total = entries.length;
                // Processed entries have status 'verarbeitet'
                const processed = entries.filter((e) => e.status === 'verarbeitet').length;
                // Errors are entries with 'verarbeitet' status AND a non-empty message
                const errors = entries.filter((e) => e.status === 'verarbeitet' && e.message !== null && e.message !== '').length;
                const successCount = processed - errors;
                const pendingCount = total - processed;

                // Map entries to JobDetailEntry format
                const detailEntries = entries
                    .filter((e) => e.row > 0) // Exclude metadata entry (row=0)
                    .map((entry) => ({
                        id: entry.id.toString(),
                        itemName: `${this.translate.instant('INEX.MEDIRUECK.TABLE.ROW')} ${entry.row}: ${entry.falldossier || 'N/A'}`,
                        status: this.mapEntryStatus(entry),
                        errorMessage: entry.message || undefined,
                        details: this.formatEntryDetails(entry),
                        // Include all entry fields for the data table
                        row: entry.row,
                        falldossier: entry.falldossier || '',
                        rueckzahler: entry.rueckzahler || '',
                        behandlungsbeginn: entry.behandlungsbeginn || '',
                        behandlungsende: entry.behandlungsende || '',
                        rechnungsbetrag: entry.rechnungsbetrag || '',
                        rechnungstyp: entry.rechnungstyp || '',
                        kommentar: entry.kommentar || '',
                        message: entry.message || ''
                    }));

                return {
                    jobId,
                    jobName: excelfile,
                    status: (total > 0 && processed === total ? 'completed' : processed > 0 ? 'running' : 'pending') as 'completed' | 'running' | 'pending',
                    progress: total > 0 ? Math.round((processed / total) * 100) : 0,
                    total,
                    totalCount: total - 1, // Exclude metadata entry from count
                    successCount: Math.max(0, successCount),
                    failedCount: errors,
                    runningCount: processed > 0 && processed < total ? 1 : 0,
                    pendingCount: Math.max(0, pendingCount),
                    entries: detailEntries
                };
            }),
            catchError((error: Error) => {
                this.logger.error('Error loading job details:', error);
                const errorMessage = this.translate.instant('INEX.MEDIRUECK.ERRORS.DETAILS_LOAD_FAILED');
                return throwError(() => new Error(errorMessage));
            })
        );
    }

    // Note: All other methods (getRunningJobs, getCompletedJobs, getAllJobs, getJobDetails,
    // processExcelFileAndCreateJob, etc.) are inherited from JobBaseService and work automatically!
}
