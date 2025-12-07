/**
 * Shared utility functions for dashboard components
 */

/**
 * Calculate time ago in German
 * @param date The date to calculate from
 * @returns German-formatted time ago string
 */
export function getTimeAgo(date: string | Date): string {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min`;
    if (diffHours < 24) return `vor ${diffHours} Std`;
    if (diffDays === 1) return 'gestern';
    return `vor ${diffDays} Tagen`;
}

/**
 * Job status label mapping
 */
export const JOB_STATUS_LABELS: Readonly<Record<string, string>> = {
    running: 'Läuft',
    completed: 'Abgeschlossen',
    failed: 'Fehler',
    cancelled: 'Abgebrochen',
    pending: 'Wartend'
} as const;

/**
 * Job status severity mapping for PrimeNG
 */
export const JOB_STATUS_SEVERITY: Readonly<Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'>> = {
    running: 'info',
    completed: 'success',
    failed: 'danger',
    cancelled: 'warn',
    pending: 'secondary'
} as const;

/**
 * Offerte status label mapping
 */
export const OFFERTE_STATUS_LABELS: Readonly<Record<string, string>> = {
    draft: 'Entwurf',
    submitted: 'Eingereicht',
    approved: 'Genehmigt',
    rejected: 'Abgelehnt'
} as const;

/**
 * Offerte status severity mapping for PrimeNG
 */
export const OFFERTE_STATUS_SEVERITY: Readonly<Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'>> = {
    draft: 'secondary',
    submitted: 'info',
    approved: 'success',
    rejected: 'danger'
} as const;

/**
 * Service action label mapping
 */
export const SERVICE_ACTION_LABELS: Readonly<Record<string, string>> = {
    einladung: 'Neue Einladung',
    erinnerung: 'Neue Erinnerung',
    mahnung: 'Neue Mahnung',
    aufgabe: 'Neue Aufgabe',
    medikamentenrueckforderung: 'Neue Rückforderung',
    offerte: 'Neue Offerte'
} as const;

/**
 * Get job status label with fallback
 */
export function getJobStatusLabel(status: string): string {
    return JOB_STATUS_LABELS[status] || status;
}

/**
 * Get job status severity with fallback
 */
export function getJobStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    return JOB_STATUS_SEVERITY[status] || 'secondary';
}

/**
 * Get offerte status label with fallback
 */
export function getOffertenStatusLabel(status: string): string {
    return OFFERTE_STATUS_LABELS[status] || status;
}

/**
 * Get offerte status severity with fallback
 */
export function getOffertenStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    return OFFERTE_STATUS_SEVERITY[status] || 'secondary';
}

/**
 * Get service action label with fallback
 */
export function getServiceActionLabel(serviceName: string): string {
    return SERVICE_ACTION_LABELS[serviceName] || 'Neu erstellen';
}
