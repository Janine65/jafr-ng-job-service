import { filter, Subscription } from 'rxjs';

import { inject, Injectable, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { LogFactoryService, Logger } from '@syrius/core';
import { JobPollingService } from '@syrius/job-service';

/**
 * Guard that monitors route changes and stops job polling when navigating
 * to /fuv routes and resumes polling when leaving /fuv routes.
 *
 * This prevents unnecessary background polling when users are working within FUV
 */
@Injectable({
    providedIn: 'root'
})
export class FuvRoutePollingGuard implements OnDestroy {
    private router = inject(Router);
    private jobPollingService = inject(JobPollingService);
    private logFactory = inject(LogFactoryService);
    private logger: Logger;

    private routerSubscription?: Subscription;
    private isInFuvRoute = false;
    private wasPollingActive = false;

    constructor() {
        this.logger = this.logFactory.createLogger('FuvRoutePollingGuardService');
        this.initializeRouteMonitoring();
    }

    /**
     * Initialize route monitoring to control job polling based on current route
     */
    private initializeRouteMonitoring(): void {
        this.logger.debug('Initializing FUV route monitoring for job polling control');

        // Check the current route immediately on initialization (handles page reloads)
        const currentUrl = this.router.url;
        this.logger.debug(`Initial route check: ${currentUrl}`);
        this.checkCurrentRoute(currentUrl);

        // Subscribe to navigation events for subsequent route changes
        this.routerSubscription = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event: NavigationEnd) => {
            this.checkCurrentRoute(event.urlAfterRedirects);
        });
    }

    /**
     * Check if the current route is a /fuv route and manage polling accordingly
     */
    private checkCurrentRoute(url: string): void {
        const isCurrentlyInFuv = this.isFuvRoute(url);

        // If entering /fuv routes
        if (isCurrentlyInFuv && !this.isInFuvRoute) {
            this.logger.log(`Entering FUV route (${url}), stopping job polling`);
            this.jobPollingService.stopAllPolling();
            this.wasPollingActive = true;
            this.isInFuvRoute = true;
        }
        // If leaving /fuv routes
        else if (!isCurrentlyInFuv && this.isInFuvRoute) {
            this.logger.log(`Leaving FUV route (${url}), resuming job polling`);
            if (this.wasPollingActive) {
                this.jobPollingService.resumePolling();
            }
            this.isInFuvRoute = false;
        }
        // Log current state for debugging
        else {
            this.logger.debug(`Route change detected: ${url}, isInFuv: ${isCurrentlyInFuv}, polling: ${!isCurrentlyInFuv}`);
        }
    }

    /**
     * Check if a URL belongs to the /fuv module
     */
    private isFuvRoute(url: string): boolean {
        // Match /fuv and any sub-routes like /fuv/search/partner, /fuv/person/detail/123, etc.
        return url.startsWith('/fuv');
    }

    /**
     * Cleanup subscriptions on service destruction
     */
    ngOnDestroy(): void {
        this.logger.debug('FuvRoutePollingGuardService destroyed, cleaning up');

        if (this.routerSubscription) {
            this.routerSubscription.unsubscribe();
        }

        // Resume polling if it was stopped
        if (this.isInFuvRoute && this.wasPollingActive) {
            this.logger.debug('Service destroyed while in FUV route, resuming polling');
            // Type assertion needed because library hasn't been rebuilt yet
            (this.jobPollingService as any).resumePolling();
        }
    }
}
