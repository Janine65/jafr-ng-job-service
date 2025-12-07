import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { SplitButtonModule } from 'primeng/splitbutton';

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
    AppLoadingService, BannerService, LayoutService, LogFactoryService, Logger, LoggerService,
    LogLevel, PreferencesService
} from '@syrius/core';

interface WindowWithMockApiError extends Window {
    mockApiError?: boolean;
    mockApiErrorStatus?: number;
    mockApiErrorDelay?: number;
}

@Component({
    selector: 'app-component-testing',
    standalone: true,
    imports: [CommonModule, ButtonModule, DividerModule, SplitButtonModule, FormsModule],
    templateUrl: './component-testing.component.html'
})
export class ComponentTestingComponent implements OnInit {
    private appLoadingService = inject(AppLoadingService);
    private router = inject(Router);
    private userPreferencesService = inject(PreferencesService);
    private loggerService = inject(LoggerService);
    private logFactory = inject(LogFactoryService);
    private layoutService = inject(LayoutService);
    private bannerService = inject(BannerService);
    private logger: Logger;

    currentTestRole: string | undefined;
    logLevel: LogLevel;
    logLevelMenuItems: MenuItem[];
    mockError = { enabled: false, status: 500, delay: 300 };
    mockErrorMenuItems: MenuItem[];
    roleMenuItems: MenuItem[];

    // Dark mode testing
    darkModeTestActive = false;
    darkModeTestValue = false;
    autoDarkModeEnabled = false;
    osDarkModePreference = false;

    constructor() {
        this.logger = this.logFactory.createLogger('ComponentTestingComponent');
        this.logLevel = this.loggerService.getLogLevel();
        this.logLevelMenuItems = Object.values(LogLevel).map((level) => ({
            label: level,
            command: () => {
                this.setLogLevel(level);
            }
        }));

        this.mockErrorMenuItems = [
            { label: 'Service Unavailable (503)', command: () => this.setMockErrorPreset(503) },
            { label: 'Internal Server Error (500)', command: () => this.setMockErrorPreset(500) },
            { label: 'Forbidden (403)', command: () => this.setMockErrorPreset(403) },
            { label: 'Not Found (404)', command: () => this.setMockErrorPreset(404) },
            { label: 'Timeout (20s)', command: () => this.setMockErrorPreset(503, 20000) },
            { separator: true },
            { label: 'Reset', command: () => this.resetMockError(), icon: 'pi pi-replay' }
        ];

        this.roleMenuItems = [{ label: 'Admin', command: () => this.setTestRole('admin') }, { label: 'FUV', command: () => this.setTestRole('FUV') }, { separator: true }, { label: 'Reset', command: () => this.resetTestRole(), icon: 'pi pi-replay' }];
    }

    ngOnInit(): void {
        this.userPreferencesService.preferences$.subscribe((prefs) => {
            this.currentTestRole = prefs.testRole;
            this.autoDarkModeEnabled = prefs.autoDarkMode ?? false;
        });

        // Get current OS dark mode preference
        this.osDarkModePreference = this.layoutService.getOSDarkModePreference();
    }

    reloadApplication() {
        window.location.reload();
    }

    showStatusPage(status: '403' | '404' | '500') {
        this.router.navigate(['/status', status]);
    }

    navigateTo(route: string) {
        this.router.navigate([route]);
    }

    setTestRole(role: string) {
        this.userPreferencesService.updatePreference('testRole', role);
    }

    resetTestRole() {
        this.userPreferencesService.updatePreference('testRole', undefined);
    }

    toggleMockError() {
        if (this.mockError.enabled) {
            this.resetMockError();
        } else {
            // Use the existing status and delay to re-enable
            this.setMockErrorPreset(this.mockError.status, this.mockError.delay);
        }
    }

    setMockErrorPreset(status: number, delay: number = 300) {
        this.mockError = { enabled: true, status, delay };
        const win = window as WindowWithMockApiError;
        win.mockApiError = true;
        win.mockApiErrorStatus = status;
        win.mockApiErrorDelay = delay;
    }

    resetMockError() {
        this.mockError = { enabled: false, status: 500, delay: 300 };
        const win = window as WindowWithMockApiError;
        win.mockApiError = false;
    }

    forceShowLoading() {
        this.appLoadingService.forceShow();
    }

    showLoadingForDuration() {
        this.appLoadingService.forceShow();
        setTimeout(() => this.appLoadingService.forceHide(), 10000);
    }

    setLogLevel(level: LogLevel) {
        this.loggerService.setLogLevel(level);
        this.logLevel = level;
        this.logger.debug(`Log level set to ${level}`);
    }

    /**
     * Test OS dark mode by simulating a media query change
     * @param forceDark If true, simulates dark mode; if false, simulates light mode; if undefined, restores OS preference
     */
    testDarkMode(forceDark?: boolean): void {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        if (forceDark === undefined) {
            // Restore original behavior
            this.logger.log('Restoring real OS dark mode preference');
            this.darkModeTestActive = false;
            // Trigger a change event with actual OS preference
            const event = new MediaQueryListEvent('change', {
                matches: mediaQuery.matches,
                media: mediaQuery.media
            });
            mediaQuery.dispatchEvent(event);
            this.osDarkModePreference = mediaQuery.matches;
        } else {
            // Simulate OS preference
            this.logger.log(`Simulating OS dark mode preference: ${forceDark}`);
            this.darkModeTestActive = true;
            this.darkModeTestValue = forceDark;
            const event = new MediaQueryListEvent('change', {
                matches: forceDark,
                media: mediaQuery.media
            });
            mediaQuery.dispatchEvent(event);
        }
    }

    /**
     * Force dark mode simulation
     */
    forceDarkMode(): void {
        this.testDarkMode(true);
    }

    /**
     * Force light mode simulation
     */
    forceLightMode(): void {
        this.testDarkMode(false);
    }

    /**
     * Restore OS preference
     */
    restoreOSPreference(): void {
        this.testDarkMode();
    }

    /**
     * Toggle auto dark mode preference
     */
    toggleAutoDarkMode(): void {
        const newValue = !this.autoDarkModeEnabled;
        this.userPreferencesService.updatePreference('autoDarkMode', newValue);
        this.logger.log(`Auto dark mode ${newValue ? 'enabled' : 'disabled'}`);
    }

    /**
     * Test banner - show error banner
     */
    testErrorBanner(): void {
        this.logger.log('Testing error banner');
        this.bannerService.showError('Service Störung', 'Es liegt eine Störung vor. Bitte versuchen Sie es später erneut.');
    }

    /**
     * Test banner - show warning banner
     */
    testWarningBanner(): void {
        this.logger.log('Testing warning banner');
        this.bannerService.showWarning('Warnung', 'Dies ist eine Testwarnung. Das System funktioniert möglicherweise eingeschränkt.');
    }

    /**
     * Test banner - show info banner
     */
    testInfoBanner(): void {
        this.logger.log('Testing info banner');
        this.bannerService.showInfo('Information', 'Dies ist eine Testinformation. Alle Systeme funktionieren normal.');
    }

    /**
     * Test banner - show success banner
     */
    testSuccessBanner(): void {
        this.logger.log('Testing success banner');
        this.bannerService.showSuccess('Erfolg', 'Der Test wurde erfolgreich abgeschlossen!');
    }

    /**
     * Test banner - hide current banner
     */
    hideBanner(): void {
        this.logger.log('Hiding banner');
        this.bannerService.hide();
    }

    /**
     * Test banner - register multiple errors to trigger banner
     */
    triggerErrorBanner(): void {
        this.logger.log('Triggering error banner via registerError (5 errors)');
        // Register 5 errors quickly to trigger the banner
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.bannerService.registerError({
                    type: 'error',
                    title: 'Service Störung',
                    message: 'Mehrere Fehler wurden erkannt. Bitte überprüfen Sie die Systemstatus.'
                });
            }, i * 100);
        }
    }
}
