import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { DashboardPermissions } from '../../interfaces/dashboard-permissions.interface';
import {
    AsyncServiceDashboardData, ServiceDashboardData, ServiceRoute
} from '../../interfaces/dashboard.interface';
import {
    getJobStatusLabel, getJobStatusSeverity, getServiceActionLabel, getTimeAgo
} from '../../utils/dashboard.utils';

@Component({
    selector: 'app-service-card',
    standalone: true,
    imports: [CommonModule, CardModule, ButtonModule, ProgressBarModule, TagModule, TooltipModule, SkeletonModule],
    templateUrl: './service-card.component.html'
})
export class ServiceCardComponent {
    @Input() serviceData?: ServiceDashboardData;
    @Input() asyncState?: AsyncServiceDashboardData;
    @Input() permissions!: DashboardPermissions;

    @Output() navigateToService = new EventEmitter<ServiceRoute>();

    /**
     * Get the service metadata (either from asyncState or serviceData)
     */
    getService(): ServiceRoute {
        return this.asyncState?.service || this.serviceData?.service || { name: '', displayName: '', route: '', icon: 'pi pi-question', description: '' };
    }

    /**
     * Check if the service is currently loading
     */
    isLoading(): boolean {
        return this.asyncState?.loading === true;
    }

    onNavigateToService(service: ServiceRoute): void {
        this.navigateToService.emit(service);
    }

    getJobStatusLabel(status: string): string {
        return getJobStatusLabel(status);
    }

    getJobStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
        return getJobStatusSeverity(status);
    }

    getTimeAgo(date: string | Date): string {
        return getTimeAgo(date);
    }

    getServiceActionLabel(serviceName: string): string {
        return getServiceActionLabel(serviceName);
    }
}
