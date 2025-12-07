import { Observable } from 'rxjs';

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
 * Configuration for a job data provider
 * Contains all service-specific API endpoint information
 */
export interface JobDataProviderConfig {
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
export interface JobDataProvider<TEntry extends JobEntry> {
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
    triggerProcessing(filename: string): Observable<{ excelfile: string; entries: TEntry[] }>;

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
    validateExcelColumns(file: File): Observable<{ valid: boolean; missingColumns?: string[] }>;

    /**
     * Clear the entries cache
     */
    clearCache(): void;

    /**
     * Cancel any pending HTTP requests
     */
    cancelPendingRequests(): void;
}