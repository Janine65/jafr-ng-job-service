export interface DashboardJobSummary {
    id: string;
    name: string;
    type: 'einladung' | 'erinnerung' | 'mahnung' | 'aufgabe' | 'aktenentscheid' | 'medikamentenrueckforderung' | 'regress';
    status: 'running' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
    progress?: number;
    totalItems?: number;
    successCount?: number;
    failedCount?: number;
    createdBy: string;
}

export interface DashboardOffertenSummary {
    id: string;
    offertenNummer: string;
    kundenName: string;
    status: 'draft' | 'submitted' | 'approved' | 'rejected';
    createdDate: Date;
    amount?: number;
    currency?: string;
}

export interface WhatsNewItem {
    version: string;
    date: Date;
    title: string;
    description: string;
    category: 'feature' | 'improvement' | 'bugfix' | 'security';
    important: boolean;
}

export interface ServiceRoute {
    name: string;
    displayName: string;
    route: string;
    icon: string;
    description: string;
}

export interface ServiceDashboardData {
    service: ServiceRoute;
    runningJobs: DashboardJobSummary[];
    recentCompletedJobs: DashboardJobSummary[];
    hasRunningJobs: boolean;
    hasRecentJobs: boolean;
}

/**
 * Async service data with loading state for individual service cards
 */
export interface AsyncServiceDashboardData {
    service: ServiceRoute;
    loading: boolean;
    error?: string;
    data?: ServiceDashboardData;
}

export interface DashboardData {
    userDisplayName: string;
    runningJobs: DashboardJobSummary[];
    recentCompletedJobs: DashboardJobSummary[];
    recentOfferten: DashboardOffertenSummary[];
    whatsNew: WhatsNewItem[];
    availableServices: ServiceRoute[];
    serviceData: ServiceDashboardData[];
    permissions: {
        canViewJobs: boolean;
        canViewOfferten: boolean;
        canCreateJobs: boolean;
        canCreateOfferten: boolean;
    };
}
