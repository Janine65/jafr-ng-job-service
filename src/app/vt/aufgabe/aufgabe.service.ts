import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Injectable } from '@angular/core';
import { JobBaseService, JobServiceConfig, JobType } from '@syrius/job-service';

import { AUFGABE_REQUIRED_COLUMNS } from './aufgabe.tables';

import type { JobDetailsResponse } from '@syrius/job-service';
import type { Aufgabe } from './aufgabe.model';

/**
 * Service configuration for Aufgabe
 */
const AUFGABE_CONFIG: JobServiceConfig = {
    serviceName: 'Aufgabe',
    apiBasePath: '/bb/aktualisierung',
    endpointName: 'aufgabe',
    searchEndpointName: 'searchBBAktualisierungAufgaben',
    searchExcelFileEndpointName: 'searchExcelfile',
    translationPrefix: 'VT.BB.AUFGABE',
    requiredColumns: AUFGABE_REQUIRED_COLUMNS,
    rowTranslationKey: 'VT.BB.AUFGABE.TABLE.ROW',
    taskName: 'task'
};

/**
 * Service for Aufgabe (BB Task) operations with backend API integration.
 *
 * Backend Integration:
 * 1. POST /uploadfile - Upload Excel file
 * 2. PUT /bb/aktualisierung/aufgabe?filename=xxx - Trigger processing
 * 3. GET /bb/aktualisierung/searchBBAktualisierungAufgaben?filename=xxx - Get entries/status (note: plural!)
 */
@Injectable({
    providedIn: 'root'
})
export class AufgabeService extends JobBaseService<Aufgabe> {
    constructor() {
        super(AUFGABE_CONFIG);
    }

    getJobType(): JobType {
        return 'aufgabe';
    }

    /**
     * Load job details by ID for Aufgabe
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
