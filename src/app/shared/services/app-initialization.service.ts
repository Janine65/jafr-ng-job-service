import { filter, take } from 'rxjs';

import { inject, Injectable } from '@angular/core';
import { PrefetchService } from '@app/fuv/services/prefetch.service';
import { AuthService, LogFactoryService } from '@syrius/core';

/**
 * Service to manage app-level initialization tasks that should run
 * after authentication and roles are loaded but in the background.
 *
 * This provides a centralized place for non-blocking initialization tasks
 * similar to how JobPollingService manages background polling tasks.
 *
 * Now delegates FUV-specific prefetching to PrefetchService when user has FUV permissions.
 */
@Injectable({
    providedIn: 'root'
})
export class AppInitializationService {
    private logger = inject(LogFactoryService).createLogger('AppInitializationService');
    private authService = inject(AuthService);
    private prefetchService = inject(PrefetchService);

    private isInitialized = false;

    /**
     * Initialize all background tasks after app loading is complete
     * This should be called from AppComponent after auth and roles are ready
     *
     * Uses reactive approach: waits for authentication to complete before checking permissions
     */
    async initializeBackgroundTasks(): Promise<void> {
        if (this.isInitialized) {
            this.logger.debug('Background tasks already initialized, skipping...');
            return;
        }

        this.logger.debug('Starting background initialization tasks...');

        // Wait for authentication to complete before checking roles
        // This ensures roles are available when we check FUV access
        this.logger.debug('Waiting for authentication to complete...');

        return new Promise((resolve) => {
            // Wait for authenticated=true, then take first emission and unsubscribe
            this.authService.isAuthenticated$
                .pipe(
                    filter((isAuthenticated) => isAuthenticated === true), // Wait until authenticated
                    take(1) // Take first emission and auto-unsubscribe
                )
                .subscribe({
                    next: async () => {
                        this.logger.debug('✅ Authentication complete, checking FUV permissions...');

                        // Now check if user has FUV permissions
                        const userHasFuvAccess = this.checkFuvAccess();

                        if (userHasFuvAccess) {
                            this.logger.debug('✅ User has FUV permissions - initializing FUV prefetch service');
                            try {
                                await this.prefetchService.initializePrefetch();
                                this.logger.debug('FUV prefetch service initialized successfully');
                            } catch (error) {
                                this.logger.error('Error initializing FUV prefetch service:', error);
                                // Don't throw - app should work without prefetch
                            }
                        } else {
                            this.logger.debug('⏭️ User does not have FUV permissions - skipping FUV prefetch');
                        }

                        // Add other non-FUV initialization tasks here in the future
                        // Example:
                        // await this.initializeOtherModuleData();

                        this.isInitialized = true;
                        this.logger.debug('Background initialization tasks completed');
                        resolve();
                    },
                    error: (error) => {
                        this.logger.error('Error waiting for authentication:', error);
                        this.isInitialized = true; // Mark as initialized even on error
                        resolve();
                    }
                });
        });
    }

    /**
     * Check if user has access to FUV module
     * User needs at least one of the FUV-related roles
     */
    private checkFuvAccess(): boolean {
        // Get roles using both methods to debug
        const keycloakRoles = this.authService.getRoles();
        const internalRoles = this.authService.getUserRoles();

        const fuvRoles = [
            'fuv_offerte_offerte',
            'fuv_offerte_offerte_vtt',
            'fuv_offerte_antragsfragen',
            'kpm_tool_berechtigung' // Admin role
        ];

        // Check internal roles (these are mapped from Keycloak roles)
        const hasFuvAccess = internalRoles.some((role) => fuvRoles.includes(role));

        this.logger.debug('FUV access check:', {
            keycloakRoles,
            internalRoles,
            fuvRoles,
            hasFuvAccess
        });

        return hasFuvAccess;
    }

    /**
     * Clear all cached data and reinitialize
     * Useful for logout or data refresh scenarios
     */
    async reinitialize(): Promise<void> {
        this.logger.debug('Reinitializing background tasks...');
        this.isInitialized = false;

        // Delegate to FUV prefetch service
        await this.prefetchService.reinitialize();

        await this.initializeBackgroundTasks();
    }

    /**
     * Clear all cached data
     */
    clearAllCaches(): void {
        this.logger.debug('Clearing all cached data...');

        // Delegate to FUV prefetch service
        this.prefetchService.clearCache();

        this.isInitialized = false;
    }
}
