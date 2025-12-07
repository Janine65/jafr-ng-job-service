export interface JobDetailEntry {
    id: string;
    itemName: string;
    status: 'Success' | 'Failed' | 'Running' | 'Pending';
    startTime?: Date;
    endTime?: Date;
    duration?: number; // in milliseconds
    errorMessage?: string;
    processedBy?: string;
    details?: string;
    [key: string]: any; // Allow additional fields for entry data
}

export interface JobDetailsRequest {
    jobId: string;
    jobName: string;
}

export interface JobDetailsResponse {
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