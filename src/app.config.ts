import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { DialogService } from 'primeng/dynamicdialog';
import { ToastModule } from 'primeng/toast';

import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
    ApplicationConfig, importProvidersFrom, inject, Injector, provideAppInitializer
} from '@angular/core';
// TODO: provideAnimationsAsync is marked as deprecated, but is still needed for now for PrimeNG
// It will be availlable until Angular 23, so this is perfectly fine for now
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
    provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling
} from '@angular/router';
import { KpmRoleDataProviderService } from '@app/shared/providers/role-provider.service';
import { KpmVersionDataProviderService } from '@app/shared/providers/version-provider.service';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import Aura from '@primeng/themes/aura';
import {
    API_BASE_URL, apiBaseUrlFactory, apiInterceptor, apiLoggingInterceptor, AppLoadingService,
    AppMessageService, authInterceptor, AuthService, COLOR_PALETTE, CoreEnvironment, DEV_CONFIG,
    EnvironmentService, errorInterceptor, LogFactoryService, MENU_CONFIG, ROLE_DATA_PROVIDER,
    ROLES_CONFIG, RolesService, STYLE_CONFIG, THEME_CONFIG, VERSION_DATA_PROVIDER
} from '@syrius/core';
import { JOB_LIBRARY_CONFIG, JOB_LOGGER_FACTORY } from '@syrius/job-service';

import { appRoutes } from './app.routes';
import { AVAILABLE_STAGES } from './app/config/dev.config';
// Import app-specific configs
import { menuStructure } from './app/config/menu.config';
import { ROLE_CONSTANTS, ROUTE_ROLE_MAPPINGS } from './app/config/roles.config';
import {
    DEFAULT_STYLE_CONFIG, SUVA_COLOR_PALETTE, SUVA_THEME_CONFIG
} from './app/config/style.config';

// AoT requires an exported function for factories
export function HttpLoaderFactory(httpClient: HttpClient) {
    return new TranslateHttpLoader(httpClient, '/assets/i18n/', '.json');
}

// Factory function for initializing AuthService
export function initializeAuthService(authService: AuthService): Promise<any> {
    return authService
        .init()
        .then((result) => {
            return result;
        })
        .catch((error: any) => {
            return Promise.reject(error);
        });
}

function appCoreEnvironmentFactory(environmentService: EnvironmentService): () => Promise<void> {
    return async (): Promise<void> => {
        try {
            // Prefer developer override if present in this session
            const developerOverride = ((): Partial<CoreEnvironment> | null => {
                try {
                    const override = sessionStorage.getItem('developer-environment-override');
                    if (override) {
                        const config = JSON.parse(override);
                        return config;
                    }
                } catch (_e) {
                    sessionStorage.removeItem('developer-environment-override');
                }
                return null;
            })();

            if (developerOverride) {
                environmentService.updateFromRuntimeConfig(developerOverride);
                return;
            }

            // Load base runtime config
            const baseResp = await fetch('/assets/config/environment.json');
            if (!baseResp.ok) {
                if (baseResp.status === 404) {
                    console.warn('Runtime config file not found!');
                } else {
                    console.error(`Failed to fetch runtime config: HTTP ${baseResp.status}: ${baseResp.statusText}`);
                }
                // Redirect to error page and halt bootstrap
                window.location.href = '/500';
                await new Promise(() => {});
                return;
            }
            const baseConfig = await baseResp.json();

            // Try merging local overrides if present
            let finalConfig: Partial<CoreEnvironment> = baseConfig;
            try {
                const localResp = await fetch('/assets/config/environment.local.json');
                if (localResp.ok) {
                    const localConfig = await localResp.json();
                    finalConfig = { ...baseConfig, ...localConfig };
                }
            } catch (_e) {
                // optional override, ignore errors
            }

            environmentService.updateFromRuntimeConfig(finalConfig);
        } catch (error) {
            console.warn('Failed to load runtime configuration, using defaults:', error);
        }
    };
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(appRoutes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }), withEnabledBlockingInitialNavigation()),

        // IMPORTANT: Order of Interceptors matters!
        // 1. apiLoggingInterceptor: Logs API requests and responses.
        // 2. errorInterceptor: Catches errors from the mock or real backend.
        // 3. authInterceptor: Adds authentication tokens.
        // 4. apiInterceptor: Unwraps the { meta, data } envelope from successful responses.
        provideHttpClient(withInterceptors([apiLoggingInterceptor, errorInterceptor, authInterceptor, apiInterceptor]), withFetch()),
        provideAnimationsAsync(),
        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    darkModeSelector: '.app-dark'
                }
            }
        }),
        AuthService,
        AppMessageService,
        importProvidersFrom(
            TranslateModule.forRoot({
                loader: {
                    provide: TranslateLoader,
                    useFactory: HttpLoaderFactory,
                    deps: [HttpClient]
                }
            })
        ),
        importProvidersFrom(ToastModule),
        MessageService,
        DialogService, // Required for PrimeNG DynamicDialog (used by ChecklisteModalService, OfferteAblehnungModalService)

        // API URL Provider
        {
            provide: API_BASE_URL,
            useFactory: (env: EnvironmentService) => apiBaseUrlFactory(env.environment as CoreEnvironment),
            deps: [EnvironmentService]
        },

        // App-specific configuration overrides
        { provide: MENU_CONFIG, useValue: menuStructure },
        { provide: ROLES_CONFIG, useValue: { ROLE_CONSTANTS, ROUTE_ROLE_MAPPINGS } },
        { provide: STYLE_CONFIG, useValue: DEFAULT_STYLE_CONFIG },
        { provide: THEME_CONFIG, useValue: SUVA_THEME_CONFIG },
        { provide: COLOR_PALETTE, useValue: SUVA_COLOR_PALETTE },
        { provide: DEV_CONFIG, useValue: { AVAILABLE_STAGES } },

        // App-specific data providers
        { provide: ROLE_DATA_PROVIDER, useClass: KpmRoleDataProviderService },
        { provide: VERSION_DATA_PROVIDER, useClass: KpmVersionDataProviderService },

        // Provide custom logger factory for job-service library
        {
            provide: JOB_LOGGER_FACTORY,
            useFactory: () => inject(LogFactoryService)
        },

        // Configure job service polling intervals
        {
            provide: JOB_LIBRARY_CONFIG,
            useValue: {
                defaultPollingInterval: 1800000, // 30 minutes for completed jobs
                runningJobsPollingInterval: 15000, // 15 seconds for running jobs
                enableDebugLogging: false
            }
        },

        // Combined initializer to ensure sequential execution:
        // 1. Load environment config
        // 2. Initialize auth
        // 3. Load roles
        provideAppInitializer(() => {
            const injector = inject(Injector);
            const environmentService = inject(EnvironmentService);
            const appLoadingService = inject(AppLoadingService);

            appLoadingService.forceShow();

            // Load environment configuration
            return appCoreEnvironmentFactory(environmentService)()
                .then(() => {
                    // Get AuthService and RolesService lazily using injector
                    const authService = injector.get(AuthService);
                    const rolesService = injector.get(RolesService);

                    // Only initialize auth if keycloakUrl is configured and not in mock mode
                    if (environmentService.keycloakUrl && !environmentService.isMock()) {
                        // Initialize auth, then load roles
                        return initializeAuthService(authService).then(() => {
                            // After auth is initialized, load user roles
                            return rolesService.ensureRolesLoaded();
                        });
                    } else {
                        // In mock mode, still load roles but skip auth
                        return rolesService.ensureRolesLoaded();
                    }
                })
                .then(() => {
                    appLoadingService.clearForce();
                })
                .catch((error: any) => {
                    console.error('Failed to initialize application:', error);
                    appLoadingService.clearForce();
                    throw error;
                });
        })
    ]
};
