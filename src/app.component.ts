import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogService } from 'primeng/dynamicdialog';
import { ToastModule } from 'primeng/toast';
import { filter, Observable, Subscription, take } from 'rxjs';

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FuvRoutePollingGuard } from '@app/fuv/guards/fuv-route-polling.guard';
import { BugReportDialogComponent } from '@app/shared/components/bug-report/bug-report.component';
import { OnboardingComponent } from '@app/shared/components/onboarding/onboarding.component';
import { TestFilesComponent } from '@app/shared/components/test-files/test-files.component';
import { AppInitializationService } from '@app/shared/services/app-initialization.service';
import { TranslateService } from '@ngx-translate/core';
import {
    AppBannerComponent, AppLoadingService, LoadingComponent, LogFactoryService, Logger, Preferences,
    PreferencesService
} from '@syrius/core';
import { JobPollingService } from '@syrius/job-service';

import { registerDashboardServices } from './app/dashboard/config/dashboard.config';
import { OnboardingService } from './app/shared/components/onboarding/onboarding.service';
import { onboardingSteps } from './app/shared/components/onboarding/onboarding.steps';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterModule, BugReportDialogComponent, LoadingComponent, AppBannerComponent, OnboardingComponent, ConfirmDialogModule, ToastModule, TestFilesComponent],
    providers: [DialogService, ConfirmationService],
    template: `
        <app-banner></app-banner>
        <p-toast></p-toast>
        <app-loading-page *ngIf="isLoading | async"></app-loading-page>
        <ng-container *ngIf="(isLoading | async) === false">
            <router-outlet></router-outlet>
            <app-bug-report-dialog></app-bug-report-dialog>
            <app-onboarding></app-onboarding>
            <app-test-files></app-test-files>
            <p-confirmDialog key="appOnboardingDialog"></p-confirmDialog>
            <p-confirmDialog key="reset-prefs"></p-confirmDialog>
        </ng-container>
    `
})
export class AppComponent implements OnInit, OnDestroy {
    private preferencesSubscription!: Subscription;
    public readonly isLoading: Observable<boolean>;
    private logger: Logger;

    private translate = inject(TranslateService);
    private userPreferencesService = inject(PreferencesService);
    private appLoadingService = inject(AppLoadingService);
    private onboardingService = inject(OnboardingService);
    private confirmationService = inject(ConfirmationService);
    private logFactory = inject(LogFactoryService);
    private jobPollingService = inject(JobPollingService);
    private appInitializationService = inject(AppInitializationService);
    private fuvRouteGuard = inject(FuvRoutePollingGuard); // Inject to activate route monitoring

    constructor() {
        this.logger = this.logFactory.createLogger('AppComponent');
        this.isLoading = this.appLoadingService.isLoading$;
        this.translate.addLangs(['en', 'de', 'fr', 'it']);
        this.translate.setFallbackLang('de');

        // Keep loading screen visible until translations are loaded
        this.appLoadingService.forceShow();

        // Register dashboard services with JobPollingService (dependency inversion)
        // Feature modules register themselves with core services
        registerDashboardServices(this.jobPollingService);

        // Start background tasks AFTER app loading is complete (non-blocking)
        // This ensures auth and roles are initialized before background tasks start
        this.appLoadingService.isLoading$
            .pipe(
                filter((loading) => !loading),
                take(1)
            )
            .subscribe(() => {
                // Delay background tasks slightly to let initial page render
                setTimeout(() => {
                    // Start job polling (for async job tracking)
                    this.logger.debug('App loaded, starting background job polling...');
                    this.jobPollingService.initializePolling().catch((error) => {
                        this.logger.error('Failed to initialize job polling:', error);
                    });

                    // Start app initialization tasks (code table prefetch, etc.)
                    this.logger.debug('App loaded, starting background initialization tasks...');
                    this.appInitializationService.initializeBackgroundTasks().catch((error) => {
                        this.logger.error('Failed to initialize background tasks:', error);
                    });
                }, 1000); // 1 second delay after loading screen disappears
            });
    }

    ngOnInit(): void {
        this.preferencesSubscription = this.userPreferencesService.preferences$.subscribe((prefs: Preferences) => {
            const supportedLangs = ['en', 'de', 'fr', 'it'];
            const browserLang = this.translate.getBrowserLang();
            let langToUse: string | undefined = 'en';

            if (prefs && prefs.language && supportedLangs.includes(prefs.language)) {
                langToUse = prefs.language;
                this.logger.log(`Using language from user preferences: ${langToUse}`);
            } else if (browserLang && supportedLangs.includes(browserLang)) {
                langToUse = browserLang;
                this.logger.debug(`User preference for language not set or not supported. Using browser language: ${langToUse}`);
            } else {
                this.logger.debug(`User preference and browser language not set or not supported. Using default language: ${langToUse}`);
            }

            if (langToUse) {
                this.translate.use(langToUse).subscribe({
                    next: () => {
                        this.logger.debug(`Language successfully set to: ${langToUse}`);
                        // Clear the forced loading state now that translations are loaded
                        this.appLoadingService.clearForce();

                        this.appLoadingService.isLoading$
                            .pipe(
                                filter((loading) => !loading),
                                take(1)
                            )
                            .subscribe(() => {
                                this.initializeOnboarding();
                            });
                    },
                    error: (err) => {
                        this.logger.error(`Error setting language to ${langToUse}:`, err);
                        // Clear the forced loading state even on error to prevent indefinite loading
                        this.appLoadingService.clearForce();
                    }
                });
            } else {
                this.logger.warn('langToUse is undefined, cannot set language.');
                // Clear the forced loading state if no language to load
                this.appLoadingService.clearForce();
            }
        });
    }

    private initializeOnboarding(): void {
        // Onboarding
        this.onboardingService.registerSteps(onboardingSteps);
        const firstVisit = this.onboardingService.isFirstVisit();

        if (firstVisit) {
            this.logger.debug('Attempting to show onboarding confirmation dialog.');
            this.translate.get(['onboarding.initialDialog.title', 'onboarding.initialDialog.content', 'onboarding.buttons.start', 'onboarding.buttons.skip']).subscribe({
                next: (translations) => {
                    setTimeout(() => {
                        this.confirmationService.confirm({
                            message: translations['onboarding.initialDialog.content'],
                            header: translations['onboarding.initialDialog.title'],
                            icon: 'pi pi-info-circle',
                            acceptLabel: translations['onboarding.buttons.start'],
                            rejectLabel: translations['onboarding.buttons.skip'],
                            rejectButtonStyleClass: 'p-button-text',
                            accept: () => {
                                this.logger.log('Onboarding accepted by user.');
                                this.onboardingService.startOnboarding();
                            },
                            reject: () => {
                                this.logger.log('Onboarding rejected by user.');
                                this.onboardingService.skipOnboarding();
                            },
                            key: 'appOnboardingDialog'
                        });
                    }, 100);
                }
            });
        }
    }

    ngOnDestroy(): void {
        if (this.preferencesSubscription) {
            this.preferencesSubscription.unsubscribe();
        }
    }
}
