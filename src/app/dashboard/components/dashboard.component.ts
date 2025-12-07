import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, takeUntil } from 'rxjs';

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BrowserStorageService, LogFactoryService, Logger } from '@syrius/core';

import {
    AsyncServiceDashboardData, DashboardData, ServiceRoute
} from '../interfaces/dashboard.interface';
import { DashboardService } from '../services/dashboard.service';
import { ServiceCardComponent } from './service-card/service-card.component';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, CardModule, ButtonModule, SkeletonModule, AvatarModule, ServiceCardComponent],
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
    private readonly dashboardService = inject(DashboardService);
    private readonly logFactory = inject(LogFactoryService);
    private readonly storageService = inject(BrowserStorageService);
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);
    private readonly logger: Logger = this.logFactory.createLogger('DashboardComponent');
    private readonly destroy$ = new Subject<void>();

    dashboardData: DashboardData | null = null;
    isLoading = true;
    whatsNewDismissed = false;

    // Async service data states
    serviceDataStates: Map<string, AsyncServiceDashboardData> = new Map();

    ngOnInit(): void {
        // Check if user has previously dismissed what's new
        this.whatsNewDismissed = this.storageService.getLocal<boolean>('dashboard-whats-new-dismissed') === true;
        this.loadDashboard();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadDashboard(): void {
        console.error('[DEBUG] Dashboard component loadDashboard() called');
        this.logger.debug('Loading dashboard data...');

        // Load immediate data first (fast - show welcome screen)
        this.dashboardService
            .getDashboardDataAsync()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data) => {
                    this.dashboardData = data;
                    this.isLoading = false; // Show welcome screen immediately!

                    // Start loading job services asynchronously (cards show loading skeletons)
                    if (data.permissions.canViewJobs && data.availableServices.length > 0) {
                        this.loadServicesAsync(data.availableServices);
                    }

                    // Load deferred data in background (offerten, whatsNew)
                    this.loadDeferredData(data.permissions);
                },
                error: (error) => {
                    this.logger.error('Error loading dashboard data:', error);
                    this.isLoading = false;
                    this.dashboardData = null;
                }
            });
    }

    /**
     * Load deferred dashboard data (offerten, whatsNew) in background
     * Loads independently so fast data (whatsNew config) shows immediately
     * while slow data (offerten API) loads separately
     */
    private loadDeferredData(permissions: { canViewJobs: boolean; canViewOfferten: boolean; canCreateJobs: boolean; canCreateOfferten: boolean }): void {
        this.logger.debug('Loading deferred dashboard data (offerten, whatsNew)...');

        // Load whatsNew immediately (fast - local config file)
        this.dashboardService
            .getWhatsNew()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (whatsNew) => {
                    if (this.dashboardData) {
                        this.dashboardData.whatsNew = whatsNew;
                        this.logger.debug("What's New loaded:", whatsNew.length, 'items');
                    }
                },
                error: (error) => {
                    this.logger.error("Error loading What's New:", error);
                }
            });

        // Load offerten separately (slower - API call)
        if (permissions.canViewOfferten) {
            this.dashboardService
                .getRecentOfferten()
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (offerten) => {
                        if (this.dashboardData) {
                            this.dashboardData.recentOfferten = offerten;
                            this.logger.debug('Offerten loaded:', offerten.length, 'items');
                        }
                    },
                    error: (error) => {
                        this.logger.error('Error loading offerten:', error);
                    }
                });
        }
    }

    /**
     * Load service data asynchronously - each service loads independently
     */
    private loadServicesAsync(services: ServiceRoute[]): void {
        this.logger.debug(`Loading ${services.length} services asynchronously`);

        services.forEach((service) => {
            // Initialize with loading state
            this.serviceDataStates.set(service.name, {
                service,
                loading: true,
                data: undefined
            });

            // Get the service data stream
            const stream$ = this.dashboardService.getServiceDataStream(service);

            // Subscribe to get updates
            stream$.pipe(takeUntil(this.destroy$)).subscribe({
                next: (state) => {
                    this.logger.debug(`Service ${service.name} state updated:`, state);
                    this.serviceDataStates.set(service.name, state);

                    // Update the serviceData array in dashboardData
                    if (this.dashboardData && state.data) {
                        const existingIndex = this.dashboardData.serviceData.findIndex((sd) => sd.service.name === service.name);
                        if (existingIndex >= 0) {
                            this.dashboardData.serviceData[existingIndex] = state.data;
                        } else {
                            this.dashboardData.serviceData.push(state.data);
                        }
                    }
                },
                error: (error) => {
                    this.logger.error(`Error loading service ${service.name}:`, error);
                }
            });
        });
    }

    /**
     * Get the async state for a specific service
     */
    getServiceState(serviceName: string): AsyncServiceDashboardData | undefined {
        return this.serviceDataStates.get(serviceName);
    }

    getInitials(name: string): string {
        if (!name) return 'U';

        const parts = name
            .trim()
            .split(' ')
            .filter((part) => part.length > 0);
        if (parts.length === 0) return 'U';

        if (parts.length === 1) {
            // Single name (like username), take first 2 characters
            return parts[0].substring(0, 2).toUpperCase();
        }

        // Multiple parts (first + last name), take first character of first and last part
        const firstInitial = parts[0].charAt(0).toUpperCase();
        const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
        return firstInitial + lastInitial;
    }

    getCurrentDateText(): string {
        const today = new Date();
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return today.toLocaleDateString('de-DE', options);
    }

    getGreetingMessage(): string {
        const hour = new Date().getHours();
        let key = 'menu.dashboard.greetings.afternoon'; // Default

        if (hour < 12) {
            key = 'menu.dashboard.greetings.morning';
        } else if (hour < 18) {
            key = 'menu.dashboard.greetings.afternoon';
        } else {
            key = 'menu.dashboard.greetings.evening';
        }

        return this.translate.instant(key);
    }

    getGreetingIcon(): string {
        const hour = new Date().getHours();
        if (hour < 12) return 'pi pi-sun';
        if (hour < 18) return 'pi pi-star';
        return 'pi pi-moon';
    }

    hasWhatsNew(): boolean {
        return !this.whatsNewDismissed && !!(this.dashboardData?.whatsNew && this.dashboardData.whatsNew.length > 0);
    }

    dismissWhatsNew(): void {
        this.whatsNewDismissed = true;
        // Optionally persist this in localStorage
        this.storageService.setLocal('dashboard-whats-new-dismissed', true);
    }

    getWhatsNewIcon(category: string): string {
        const iconMap: Record<string, string> = {
            feature: 'pi pi-star',
            improvement: 'pi pi-arrow-up',
            bugfix: 'pi pi-wrench',
            security: 'pi pi-shield'
        };
        return iconMap[category] || 'pi pi-info-circle';
    }

    /**
     * Navigate to a specific service creation page
     */
    navigateToService(service: ServiceRoute): void {
        this.logger.debug('Navigating to service:', service);
        this.router.navigate([service.route]);
    }

    /**
     * Navigate to offerte creation (partner search page)
     */
    navigateToOfferteCreation(): void {
        this.logger.debug('Navigating to offerte creation');
        this.router.navigate(['/fuv/search/partner']);
    }

    /**
     * Navigate to offerte search page
     */
    navigateToOfferteSearch(): void {
        this.logger.debug('Navigating to offerte search');
        this.router.navigate(['/fuv/search/offerte']);
    }

    /**
     * Navigate to offerte detail page
     */
    navigateToOfferteDetail(offertenr: string): void {
        this.logger.debug('Navigating to offerte detail:', offertenr);
        this.router.navigate(['/fuv/offerte', offertenr]);
    }
}
