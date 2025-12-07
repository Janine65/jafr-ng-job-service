import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Injectable } from '@angular/core';
import { JobBaseService, JobProgress, JobServiceConfig, JobType } from '@syrius/job-service';

import { EINLADUNG_REQUIRED_COLUMNS } from './einladung.tables';

import type { JobDetailsResponse } from '@syrius/job-service';
import type { Einladung } from './einladung.model';

/**
 * Service configuration for Einladung
 */
const EINLADUNG_CONFIG: JobServiceConfig = {
    serviceName: 'Einladung',
    apiBasePath: '/bb/aktualisierung',
    endpointName: 'einladung',
    searchEndpointName: 'searchBBAktualisierungEinladung',
    searchExcelFileEndpointName: 'searchExcelfile',
    translationPrefix: 'VT.BB.EINLADUNG',
    requiredColumns: EINLADUNG_REQUIRED_COLUMNS,
    rowTranslationKey: 'VT.BB.EINLADUNG.TABLE.ROW',
    taskName: 'invite'
};

/**
 * Service for Einladung (BB Invitation) operations with backend API integration.
 *
 * Backend Integration:
 * 1. POST /uploadfile - Upload Excel file
 * 2. PUT /bb/aktualisierung/einladung?filename=xxx - Trigger processing
 * 3. GET /bb/aktualisierung/searchBBAktualisierungEinladung?filename=xxx - Get entries/status
 */
@Injectable({
    providedIn: 'root'
})
export class EinladungService extends JobBaseService<Einladung> {
    constructor() {
        super(EINLADUNG_CONFIG);
    }

    getJobType(): JobType {
        return 'einladung';
    }

    /**
     * Load job details by ID for Einladung
     */
    loadJobDetailsById(jobId: string): Observable<JobDetailsResponse> {
        const excelfile = this.activeJobs.get(jobId) || jobId;

        return this.getJobEntries(excelfile).pipe(
            map((entries) => {
                const total = entries.length;
                const processed = entries.filter((e) => e.status === 'verarbeitet').length;
                const errors = entries.filter((e) => e.status === 'verarbeitet' && e.error !== null && e.error !== '').length;
                const successCount = processed - errors;
                const pendingCount = total - processed;

                const detailEntries = entries
                    .filter((e) => e.row >= 0)
                    .map((entry) => ({
                        id: entry.id.toString(),
                        itemName: entry.row === 0 ? 'Metadata' : `${this.translate.instant(this.config.rowTranslationKey)} ${entry.row}: ${entry.partnernr}`,
                        status: this.mapEntryStatus(entry),
                        errorMessage: entry.error || undefined,
                        details: entry.message || entry.error || '', // Added required details field
                        row: entry.row,
                        partnernr: entry.partnernr || '',
                        partner_boid: entry.partner_boid || '',
                        btcode: entry.btcode || '',
                        dokbestellid: entry.dokbestellid || '',
                        message: entry.message || ''
                    }));

                return {
                    jobId,
                    jobName: excelfile,
                    status: total > 0 && processed === total ? 'completed' : processed > 0 ? 'running' : 'pending',
                    progress: total > 0 ? Math.round((processed / total) * 100) : 0,
                    total,
                    totalCount: total - 1,
                    successCount: Math.max(0, successCount),
                    failedCount: errors,
                    runningCount: processed > 0 && processed < total ? 1 : 0,
                    pendingCount: Math.max(0, pendingCount),
                    entries: detailEntries
                };
            })
        );
    }
}
