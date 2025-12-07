import {
    catchError, combineLatest, filter, forkJoin, map, merge, Observable, of, switchMap, take, tap
} from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Injector } from '@angular/core';
import { Offerte } from '@app/fuv/models/offerte.model';
import { OfferteService } from '@app/fuv/services/offerte.service';
import { TranslateService } from '@ngx-translate/core';
import {
    AuthService, EnvironmentService, LogFactoryService, Logger, RolesService
} from '@syrius/core';
import { JobProgress } from '@syrius/job-service';

import { DASHBOARD_SERVICES } from '../config/dashboard.config';
import { DashboardPermissions } from '../interfaces/dashboard-permissions.interface';
import {
    DashboardJobService, DashboardServiceConfig
} from '../interfaces/dashboard-service.interface';
import {
    AsyncServiceDashboardData, DashboardData, DashboardJobSummary, DashboardOffertenSummary,
    ServiceDashboardData, ServiceRoute, WhatsNewItem
} from '../interfaces/dashboard.interface';

/**
 * Interface for multilingual What's New config structure
 */
interface MultilingualText {
    de: string;
    en: string;
    fr: string;
    it: string;
}

interface WhatsNewConfigItem {
    version: string;
    date: string;
    category: 'feature' | 'improvement' | 'bugfix' | 'security';
    important: boolean;
    title: MultilingualText;
    description: MultilingualText;
}

interface DashboardConfig {
    whatsNew: WhatsNewConfigItem[];
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private http = inject(HttpClient);
    private translate = inject(TranslateService);
    private authService = inject(AuthService);
    private environmentService = inject(EnvironmentService);
    private logFactory = inject(LogFactoryService);
    private logger: Logger = this.logFactory.createLogger('DashboardService');
    private injector = inject(Injector);

    // Inject offerte service separately as it's not a job service
    private offerteService = inject(OfferteService);

    // Cache for service instances to avoid repeated injections
    private serviceInstances = new Map<string, DashboardJobService>();

    /**
     * Get service configuration from centralized config
     */
    private get servicesConfig(): DashboardServiceConfig[] {
        return DASHBOARD_SERVICES;
    }

    /**
     * Dynamically get a service instance by config
     */
    private getServiceInstance(config: DashboardServiceConfig): DashboardJobService {
        if (!this.serviceInstances.has(config.name)) {
            const instance = this.injector.get(config.serviceClass);
            this.serviceInstances.set(config.name, instance);
        }
        return this.serviceInstances.get(config.name)!;
    }

    getDashboardData(): Observable<DashboardData> {
        this.logger.debug('Loading dashboard data...');

        return forkJoin({
            userInfo: this.getUserInfo(),
            permissions: this.getUserPermissions(),
            runningJobs: this.getRunningJobs(),
            recentJobs: this.getRecentCompletedJobs(),
            offerten: this.getRecentOfferten(),
            whatsNew: this.getWhatsNew(),
            services: this.getAvailableServices()
        }).pipe(
            map(({ userInfo, permissions, runningJobs, recentJobs, offerten, whatsNew, services }) => {
                const serviceData = this.groupJobsByService(services, runningJobs, recentJobs);

                return {
                    userDisplayName: userInfo.displayName,
                    runningJobs: permissions.canViewJobs ? runningJobs : [],
                    recentCompletedJobs: permissions.canViewJobs ? recentJobs : [],
                    recentOfferten: permissions.canViewOfferten ? offerten : [],
                    whatsNew: whatsNew,
                    availableServices: permissions.canCreateJobs ? services : [],
                    serviceData: permissions.canViewJobs ? serviceData : [],
                    permissions: permissions
                };
            })
        );
    }

    /**
     * Get immediate dashboard data (user info, permissions, services)
     */
    getDashboardDataAsync(): Observable<DashboardData> {
        this.logger.debug('Loading immediate dashboard data...');

        // Load only fast, critical data needed for welcome screen
        return forkJoin({
            userInfo: this.getUserInfo(),
            permissions: this.getUserPermissions(),
            services: this.getAvailableServices()
        }).pipe(
            map(({ userInfo, permissions, services }) => {
                // Return dashboard data with deferred content as empty
                // Component will call getDeferredDashboardData() to populate these
                return {
                    userDisplayName: userInfo.displayName,
                    runningJobs: [],
                    recentCompletedJobs: [],
                    recentOfferten: [], // Loaded separately via getDeferredDashboardData()
                    whatsNew: [], // Loaded separately via getDeferredDashboardData()
                    availableServices: permissions.canCreateJobs ? services : [],
                    serviceData: [], // Will be populated by individual streams
                    permissions: permissions
                };
            })
        );
    }

    /**
     * Get deferred dashboard data (offerten, whatsNew, ...)
     */
    getDeferredDashboardData(permissions: DashboardPermissions): Observable<{ offerten: DashboardOffertenSummary[]; whatsNew: WhatsNewItem[] }> {
        this.logger.debug('Loading deferred dashboard data (offerten, whatsNew)...');

        return forkJoin({
            offerten: permissions.canViewOfferten ? this.getRecentOfferten() : of([]),
            whatsNew: this.getWhatsNew()
        });
    }

    /**
     * Get a stream of service data that emits each service as it loads
     * This allows the dashboard to show loading states and display services as they become available
     */
    getServiceDataStream(service: ServiceRoute): Observable<AsyncServiceDashboardData> {
        console.error(`[DEBUG] getServiceDataStream called for service: ${service.name}`);
        this.logger.debug(`Loading data for service: ${service.name}`);

        // Find the service config
        const serviceConfig = this.servicesConfig.find((s) => s.name === service.name);
        if (!serviceConfig) {
            return of({
                service,
                loading: false,
                error: `Service ${service.name} not found in configuration`,
                data: undefined
            });
        }

        // Get the service instance
        const serviceInstance = this.getServiceInstance(serviceConfig);

        // Load completed jobs from API if method exists
        console.error(`[DEBUG] Checking loadCompletedJobs for ${serviceConfig.name}: ${!!serviceInstance.loadCompletedJobs}`);
        if (serviceInstance.loadCompletedJobs) {
            console.error(`[DEBUG] Calling loadCompletedJobs for ${serviceConfig.name}`);
            serviceInstance.loadCompletedJobs();
        } else {
            console.error(`[DEBUG] loadCompletedJobs method NOT found for ${serviceConfig.name}`);
        }

        // Get observables from the service instance
        const running$ = serviceInstance.getRunningJobs().pipe(
            map((jobs) => this.mapJobsToDashboard(jobs, serviceConfig.jobType as any)),
            catchError(() => of([]))
        );

        // Subscribe to BehaviorSubject for reactive updates (load triggered above)
        const completed$ = serviceInstance.completedJobs$.pipe(
            map((jobs) => this.mapJobsToDashboard(jobs, serviceConfig.jobType as any)),
            catchError(() => of([]))
        );

        const isLoading$ = serviceInstance.isLoadingOverview$;

        // Start with loading state
        return new Observable<AsyncServiceDashboardData>((observer) => {
            // Emit initial loading state immediately
            observer.next({
                service,
                loading: true,
                data: undefined
            });

            // Combine loading state with data streams
            combineLatest({
                isLoading: isLoading$,
                running: running$,
                completed: completed$
            })
                .pipe(
                    tap((state) => {
                        this.logger.debug(`[${service.name}] combineLatest emitted:`, {
                            isLoading: state.isLoading,
                            runningCount: state.running.length,
                            completedCount: state.completed.length
                        });
                    }),
                    // Wait until loading is complete
                    filter(({ isLoading }) => !isLoading),
                    tap(() => {
                        this.logger.debug(`[${service.name}] Loading complete, filter passed`);
                    }),
                    // Take only the first emission after loading completes
                    take(1)
                )
                .subscribe({
                    next: ({ running, completed }) => {
                        this.logger.debug(`[${service.name}] Processing data:`, {
                            running: running.length,
                            completed: completed.length
                        });

                        // Take the most recent 3 completed jobs
                        const recentCompleted = completed.slice(0, 3);

                        this.logger.debug(`[${service.name}] After limiting to top 3:`, {
                            totalCompleted: completed.length,
                            showing: recentCompleted.length
                        });

                        const serviceData: ServiceDashboardData = {
                            service,
                            runningJobs: running,
                            recentCompletedJobs: recentCompleted,
                            hasRunningJobs: running.length > 0,
                            hasRecentJobs: recentCompleted.length > 0
                        };

                        this.logger.debug(`[${service.name}] Emitting service data:`, {
                            hasRunning: serviceData.hasRunningJobs,
                            hasRecent: serviceData.hasRecentJobs
                        });

                        // Emit loaded state with data
                        observer.next({
                            service,
                            loading: false,
                            data: serviceData
                        });
                        observer.complete();
                    },
                    error: (error) => {
                        this.logger.error(`Error loading service ${service.name}:`, error);
                        // Emit error state
                        observer.next({
                            service,
                            loading: false,
                            error: error.message || 'Failed to load service data',
                            data: undefined
                        });
                        observer.complete();
                    }
                });
        });
    }

    private getUserInfo(): Observable<{ displayName: string; firstName?: string; lastName?: string; email?: string }> {
        // Wait for actual user profile data (filter out initial null value)
        this.logger.debug('Getting user info - waiting for userProfile$');
        return this.authService.userProfile$.pipe(
            tap((profile: any) => this.logger.debug('UserProfile$ emitted:', profile)),
            filter((userProfile) => userProfile !== null), // Wait for actual profile
            take(1), // Take only the first non-null value
            map((userProfile) => {
                let displayName = 'Benutzer';
                if (userProfile?.firstName && userProfile?.lastName) {
                    displayName = `${userProfile.firstName} ${userProfile.lastName}`;
                } else if (userProfile?.firstName) {
                    displayName = userProfile.firstName;
                } else if (userProfile?.username) {
                    displayName = userProfile.username;
                }

                this.logger.debug('User info:', {
                    displayName,
                    firstName: userProfile?.firstName,
                    lastName: userProfile?.lastName,
                    email: userProfile?.email
                });

                return {
                    displayName,
                    firstName: userProfile?.firstName,
                    lastName: userProfile?.lastName,
                    email: userProfile?.email
                };
            })
        );
    }

    private getUserPermissions(): Observable<{
        canViewJobs: boolean;
        canViewOfferten: boolean;
        canCreateJobs: boolean;
        canCreateOfferten: boolean;
    }> {
        return this.authService.userProfile$.pipe(
            filter((userProfile) => userProfile !== null), // Wait for actual profile
            take(1), // Take only the first non-null value
            map((userProfile) => {
                const isLoggedIn = !!userProfile;
                const userRoles = this.getCurrentUserRoles();

                this.logger.debug('Auth status check:', { isLoggedIn, userRoles });

                // Check specific role-based permissions
                const hasJobRoles = this.hasAnyRole(userRoles, ['aktenentscheid', 'aktenentscheid_bbakt', 'medirueck', RolesService.ADMIN_ROLE]);
                const hasOfferteRoles = this.hasAnyRole(userRoles, ['fuv_offerte', RolesService.ADMIN_ROLE]);

                const permissions = {
                    canViewJobs: hasJobRoles,
                    canViewOfferten: hasOfferteRoles,
                    canCreateJobs: isLoggedIn && hasJobRoles,
                    canCreateOfferten: isLoggedIn && hasOfferteRoles
                };

                this.logger.debug('User permissions:', permissions);
                return permissions;
            })
        );
    }

    private getRunningJobs(): Observable<DashboardJobSummary[]> {
        // Dynamically build forkJoin from all configured services
        const serviceObservables: Record<string, Observable<JobProgress[]>> = {};

        this.servicesConfig.forEach((config) => {
            const serviceInstance = this.getServiceInstance(config);
            serviceObservables[config.name] = serviceInstance.getRunningJobs().pipe(catchError(() => of([])));
        });

        return forkJoin(serviceObservables).pipe(
            map((results) => {
                const allJobs: DashboardJobSummary[] = [];

                // Map each service's jobs to dashboard format
                this.servicesConfig.forEach((config) => {
                    const jobs = results[config.name] || [];
                    allJobs.push(...this.mapJobsToDashboard(jobs, config.jobType as any));
                });

                this.logger.debug(`Found ${allJobs.length} running jobs across all services`);
                return allJobs;
            })
        );
    }

    private getRecentCompletedJobs(): Observable<DashboardJobSummary[]> {
        // Dynamically build forkJoin from all configured services
        const serviceObservables: Record<string, Observable<JobProgress[]>> = {};

        this.servicesConfig.forEach((config) => {
            const serviceInstance = this.getServiceInstance(config);
            // Note: Job-service library services load from session storage automatically
            // Use the completedJobs$ BehaviorSubject for reactive data
            serviceObservables[config.name] = serviceInstance.completedJobs$.pipe(
                take(1), // Take the current value
                catchError(() => of([]))
            );
        });

        return forkJoin(serviceObservables).pipe(
            map((results) => {
                const allJobs: DashboardJobSummary[] = [];

                // Map each service's jobs to dashboard format
                this.servicesConfig.forEach((config) => {
                    const jobs = results[config.name] || [];
                    allJobs.push(...this.mapJobsToDashboard(jobs, config.jobType as any));
                });

                // Sort by end time (most recent first) and limit to 10
                const sortedJobs = allJobs
                    .sort((a, b) => {
                        const aTime = a.endTime || a.startTime;
                        const bTime = b.endTime || b.startTime;
                        return bTime.getTime() - aTime.getTime();
                    })
                    .slice(0, 10);

                this.logger.debug(`Found ${sortedJobs.length} recent completed jobs across all services`);
                return sortedJobs;
            })
        );
    }

    /**
     * Get recent offerten for dashboard display
     * Public so it can be called independently for non-blocking loads
     *
     * TEMPORARILY DEACTIVATED - Returns empty array instead of calling searchFuvOfferte
     */
    getRecentOfferten(): Observable<DashboardOffertenSummary[]> {
        // DEACTIVATED: Temporarily disabled to avoid searchFuvOfferte API call
        this.logger.debug('getRecentOfferten() is temporarily deactivated, returning empty array');
        return of([]);

        // Original implementation (commented out):
        // return this.offerteService.getOfferten().pipe(
        //     map((offerten: Offerte[]) => {
        //         // Convert to dashboard format and sort by creation date
        //         const dashboardOfferten = offerten
        //             .map((offerte) => this.mapOfferteToDashboard(offerte))
        //             .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())
        //             .slice(0, 5); // Limit to 5 most recent

        //         this.logger.debug(`Found ${dashboardOfferten.length} recent offerten`);
        //         return dashboardOfferten;
        //     }),
        //     catchError((error) => {
        //         this.logger.error('Error loading offerten:', error);
        //         return of([]);
        //     })
        // );
    }

    /**
     * Get What's New items from config file
     * Public so it can be called independently for instant loading
     * Automatically uses the current language from TranslateService
     */
    getWhatsNew(): Observable<WhatsNewItem[]> {
        this.logger.debug("Loading What's New from config file");

        // Get current language, fallback to 'de' if not set
        const currentLang = this.translate.currentLang || this.translate.defaultLang || 'de';
        this.logger.debug(`Using language: ${currentLang}`);

        return this.http.get<DashboardConfig>('/assets/config/dashboard.json').pipe(
            map((config) => {
                // Convert multilingual config to single-language items
                const items: WhatsNewItem[] = config.whatsNew.map((item) => ({
                    version: item.version,
                    date: new Date(item.date),
                    category: item.category,
                    important: item.important,
                    // Get title and description for current language, fallback to German
                    title: item.title[currentLang as keyof MultilingualText] || item.title.de,
                    description: item.description[currentLang as keyof MultilingualText] || item.description.de
                }));

                // Sort by date (newest first) and take only the 5 most recent
                const sortedItems = items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

                this.logger.debug(`Loaded ${sortedItems.length} What's New items (${currentLang})`);
                return sortedItems;
            }),
            catchError((error) => {
                this.logger.error("Failed to load What's New config:", error);
                // Return empty array if config file cannot be loaded
                return of([]);
            })
        );
    }

    private getAvailableServices(): Observable<ServiceRoute[]> {
        // Get current user roles
        const userRoles = this.getCurrentUserRoles();

        // Filter services from config based on user roles
        const availableServices: ServiceRoute[] = this.servicesConfig
            .filter((service) => this.hasAnyRole(userRoles, service.requiredRoles))
            .map((config) => ({
                name: config.name,
                displayName: config.displayName,
                route: config.route,
                icon: config.icon,
                description: config.description
            }));

        console.error(`[DEBUG] User roles: ${JSON.stringify(userRoles)}`);
        console.error(`[DEBUG] Available services: ${availableServices.length} out of ${this.servicesConfig.length} total services`);
        console.error(`[DEBUG] Available service names: ${availableServices.map((s) => s.name).join(', ')}`);
        this.logger.debug(`Loaded ${availableServices.length} available services for user roles:`, userRoles);
        return of(availableServices);
    }

    /**
     * Get current user roles (including simulated roles in mock mode)
     */
    private getCurrentUserRoles(): string[] {
        // In production, get mapped internal roles from Keycloak
        return this.authService.getUserRoles();
    }

    /**
     * Check if user has any of the required roles
     */
    private hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
        return requiredRoles.some((role) => userRoles.includes(role));
    }

    /**
     * Map JobProgress from backend to DashboardJobSummary format
     */
    private mapJobsToDashboard(jobs: JobProgress[], type: 'einladung' | 'erinnerung' | 'mahnung' | 'aufgabe' | 'aktenentscheid' | 'medikamentenrueckforderung'): DashboardJobSummary[] {
        return jobs.map((job) => {
            // Calculate progress percentage
            const progress = job.total > 0 ? Math.round(((job.successful + job.failed) / job.total) * 100) : 0;

            return {
                id: job.id,
                name: job.name,
                type: type,
                status: job.status as 'running' | 'completed' | 'failed',
                startTime: job.startTime,
                endTime: job.endTime,
                progress: progress,
                totalItems: job.total,
                successCount: job.successful,
                failedCount: job.failed,
                createdBy: 'System' // Default since backend doesn't provide this info
            };
        });
    }

    /**
     * Map Offerte from backend to DashboardOffertenSummary format
     */
    private mapOfferteToDashboard(offerte: Offerte): DashboardOffertenSummary {
        const offertenr = offerte.offertenr || offerte.offertenr || 'N/A';
        const kundenName = offerte.betrieb?.name1 || offerte.name || 'Unbekannt';
        const status = offerte.status || 'Entwurf';
        const createdDate = offerte.erstellungsdatum ? new Date(offerte.erstellungsdatum) : (offerte.created ? new Date(offerte.created) : new Date());

        return {
            id: offertenr,
            offertenNummer: offertenr,
            kundenName: kundenName,
            status: this.mapOfferteStatus(status),
            createdDate: createdDate,
            amount: offerte.total || 0,
            currency: 'CHF'
        };
    }

    /**
     * Map backend offerte status to dashboard status
     */
    private mapOfferteStatus(status: string | undefined): 'draft' | 'submitted' | 'approved' | 'rejected' {
        if (!status) return 'draft';

        const statusMap: Record<string, 'draft' | 'submitted' | 'approved' | 'rejected'> = {
            Entwurf: 'draft',
            Draft: 'draft',
            Eingereicht: 'submitted',
            Submitted: 'submitted',
            Genehmigt: 'approved',
            Approved: 'approved',
            Abgelehnt: 'rejected',
            Rejected: 'rejected'
        };
        // status is guaranteed to be a string here due to the guard above
        return statusMap[status as string] || 'draft';
    }

    private groupJobsByService(services: ServiceRoute[], runningJobs: DashboardJobSummary[], recentJobs: DashboardJobSummary[]): ServiceDashboardData[] {
        // Calculate date threshold for "recent" jobs (past 10 days)
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        return services.map((service) => {
            // Find the config for this service to get the job type
            const config = this.servicesConfig.find((s) => s.name === service.name);
            if (!config) {
                this.logger.warn(`No config found for service: ${service.name}`);
                return {
                    service,
                    runningJobs: [],
                    recentCompletedJobs: [],
                    hasRunningJobs: false,
                    hasRecentJobs: false
                };
            }

            const serviceRunningJobs = runningJobs.filter((job) => job.type === config.jobType);

            // Filter recent jobs by service type and date (past 10 days), then limit to 3
            const serviceRecentJobs = recentJobs
                .filter((job) => {
                    const isCorrectType = job.type === config.jobType;
                    const completionTime = job.endTime || job.startTime;
                    const isRecent = completionTime >= tenDaysAgo;
                    return isCorrectType && isRecent;
                })
                .slice(0, 3); // Limit to 3 most recent per service

            return {
                service,
                runningJobs: serviceRunningJobs,
                recentCompletedJobs: serviceRecentJobs,
                hasRunningJobs: serviceRunningJobs.length > 0,
                hasRecentJobs: serviceRecentJobs.length > 0
            };
        });
    }
}
