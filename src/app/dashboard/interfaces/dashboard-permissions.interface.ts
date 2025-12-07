/**
 * Dashboard permissions interface
 * Defines what actions a user can perform on the dashboard
 */
export interface DashboardPermissions {
    canViewJobs: boolean;
    canViewOfferten: boolean;
    canCreateJobs: boolean;
    canCreateOfferten: boolean;
}
