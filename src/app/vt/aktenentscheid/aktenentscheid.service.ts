import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Injectable } from '@angular/core';
import {
    JobBaseService, JobDetailsResponse, JobProgress, JobServiceConfig, JobType
} from '@syrius/job-service';

import { Aktenentscheid } from './aktenentscheid.model';
import { AKTENENTSCHEID_REQUIRED_COLUMNS } from './aktenentscheid.tables';

/**
 * Service configuration for Aktenentscheid
 */
const AKTENENTSCHEID_CONFIG: JobServiceConfig = {
    serviceName: 'Aktenentscheid',
    apiBasePath: '/bbakt/aktenentscheid',
    endpointName: 'uploadBBAktAufgaben',
    searchEndpointName: 'searchExcelfile',
    searchExcelFileEndpointName: 'searchAktenentscheidExcelfile',
    translationPrefix: 'VT.AKTENENTSCHEID',
    requiredColumns: AKTENENTSCHEID_REQUIRED_COLUMNS,
    rowTranslationKey: 'VT.AKTENENTSCHEID.TABLE.ROW',
    taskName: 'aktenentscheid_task'
};

/**
 * Service for Aktenentscheid (BB Task Decision) operations with backend API integration.
 *
 * Backend Integration:
 * 1. POST /uploadfile - Upload Excel file
 * 2. PUT /bbakt/aktenentscheid/uploadBBAktAufgaben?filename=xxx - Trigger processing
 * 3. GET /bbakt/aktenentscheid/searchAktenentscheid?filename=xxx - Get entries/status
 * 4. GET /bbakt/aktenentscheid/searchAktenentscheidExcelfile?task=aktenentscheid_task - Get overview
 */
@Injectable({
    providedIn: 'root'
})
export class AktenentscheidService extends JobBaseService<Aktenentscheid> {
    constructor() {
        super(AKTENENTSCHEID_CONFIG);
    }

    getJobType(): JobType {
        return 'aktenentscheid';
    }

    /**
     * Load job details by ID for Aktenentscheid
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
                        btcode: entry.btcode || '',
                        experte: entry.experte || '',
                        bb_datum: entry.bb_datum || '',
                        aufgabe_boid: entry.aufgabe_boid || '',
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
