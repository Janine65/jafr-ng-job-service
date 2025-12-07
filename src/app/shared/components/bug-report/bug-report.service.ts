import html2canvas from 'html2canvas-pro';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import {
    ApiService, AuthService, EnvironmentService, LayoutService, LogFactoryService, Logger,
    PreferencesService
} from '@syrius/core';

import { BUG_REPORT_CONFIG, hasSensitiveContent } from './bug-report.config';
import { BugReport } from './bug-report.model';

interface NavigatorWithUAData extends Navigator {
    readonly userAgentData?: {
        readonly platform: string;
    };
}

interface ReportData {
    collectedInfo: BugReport['collectedInfo'] | null;
    screenshot: string | undefined | null;
    screenshotProhibited?: boolean;
    screenshotProhibitedReason?: string;
}

@Injectable({
    providedIn: 'root'
})
export class BugReportService {
    private http = inject(HttpClient);
    private userPreferencesService = inject(PreferencesService);
    private environmentService = inject(EnvironmentService);
    private layoutService = inject(LayoutService);
    private authService = inject(AuthService);
    private apiMetaService = inject(ApiService);
    private logFactory = inject(LogFactoryService);
    private logger: Logger;

    private bugReportApiEndpoint = 'api/bugs'; // TODO: Endpoint for submitting bug reports

    showDialogSignal = signal<boolean>(false);
    reportDataSignal: WritableSignal<ReportData | null> = signal(null);

    constructor() {
        this.logger = this.logFactory.createLogger('BugReportService');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async openBugReportDialog(_additionalContext?: any) {
        this.reportDataSignal.set(null); // Reset previous data

        // Check if page contains sensitive content markers
        const contentCheck = hasSensitiveContent();

        // Determine if screenshot should be prohibited
        const isProhibited = contentCheck.hasSensitiveContent;
        const prohibitionReason = contentCheck.reason;

        if (isProhibited) {
            this.logger.log(`Screenshots prohibited. Reason: ${prohibitionReason}`);
        }

        // Capture screenshot before showing the dialog (only if not prohibited)
        let screenshot: string | undefined;
        let collectedInfo: BugReport['collectedInfo'] | null = null;
        try {
            collectedInfo = this.collectApplicationInfo();

            // Only capture screenshot if not prohibited
            if (!isProhibited) {
                screenshot = await this.captureScreenshot();
            }
        } catch (error) {
            this.logger.error('Error preparing initial bug report data (pre-dialog):', error);
            // Ensure collectedInfo is populated even if screenshot fails
            if (!collectedInfo) {
                collectedInfo = this.collectApplicationInfo();
            }
        } finally {
            this.reportDataSignal.set({
                collectedInfo,
                screenshot,
                screenshotProhibited: isProhibited,
                screenshotProhibitedReason: prohibitionReason
            });
            this.showDialogSignal.set(true);
        }
    }

    closeBugReportDialog() {
        this.showDialogSignal.set(false);
        this.reportDataSignal.set(null); // Clear data on close
    }

    async captureScreenshot(): Promise<string | undefined> {
        try {
            const canvas = await html2canvas(document.body, {
                scale: BUG_REPORT_CONFIG.screenshotQuality
            });
            return canvas.toDataURL('image/png');
        } catch (error) {
            this.logger.error('Error capturing screenshot:', error);
            return undefined;
        }
    }

    collectApplicationInfo(): BugReport['collectedInfo'] {
        const prefs = this.userPreferencesService.getPreferences();
        const layoutConfig = this.layoutService.layoutConfig();
        const layoutState = this.layoutService.layoutState();
        const userProfile = this.authService.getUserProfile();
        const tokenParsed = this.authService.getParsedToken();

        return {
            timestamp: new Date().toISOString(),
            currentUrl: window.location.href,
            userAgent: navigator.userAgent,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            screenResolution: `${screen.width}x${screen.height}`,
            preferences: { ...prefs },
            systemInfo: {
                appVersion: this.environmentService.getAppVersion(),
                production: this.environmentService.isProduction(),
                stage: this.environmentService.stage,
                apiUrl: this.environmentService.apiUrl,
                useMock: this.environmentService.isMock(),
                keycloakUrl: this.environmentService.keycloakUrl,
                keycloakRealm: this.environmentService.keycloakRealm,
                keycloakClientId: this.environmentService.keycloakClientId,
                keycloakOnLoad: this.environmentService.keycloakOnLoad,
                keycloakPkceMethod: this.environmentService.keycloakPkceMethod
            },
            layoutInfo: {
                config: { ...layoutConfig },
                state: { ...layoutState },
                isSidebarActive: this.layoutService.isSidebarActive(),
                isDarkTheme: this.layoutService.isDarkTheme(),
                isOverlay: this.layoutService.isOverlay(),
                isDesktop: this.layoutService.isDesktop(),
                isMobile: this.layoutService.isMobile()
            },
            authInfo: {
                isAuthenticated: this.authService.isAuthenticated(),
                isKeycloakActive: this.authService.isKeycloakActive(),
                username: userProfile?.username,
                firstName: userProfile?.firstName,
                lastName: userProfile?.lastName,
                email: userProfile?.email,
                emailVerified: userProfile?.emailVerified,
                roles: tokenParsed?.realm_access?.roles,
                clientRoles: tokenParsed?.resource_access?.[this.environmentService.keycloakClientId || '']?.roles
            }
        };
    }

    submitBugReport(report: BugReport): Observable<BugReport> {
        const finalReport: BugReport = {
            ...report,
            collectedInfo: {
                ...report.collectedInfo,
                osInfo: (navigator as NavigatorWithUAData).userAgentData?.platform || navigator.platform
            },
            sessionId: this.apiMetaService.getSessionId() ?? undefined
        };

        this.logger.log('Submitting bug report:', finalReport);
        return this.http.post<BugReport>(this.bugReportApiEndpoint, finalReport).pipe(catchError(this.handleError));
    }

    private handleError = (error: HttpErrorResponse) => {
        this.logger.error('Error submitting bug report:', error);
        return throwError(() => new Error('Failed to submit bug report. Please try again later.'));
    };
}
