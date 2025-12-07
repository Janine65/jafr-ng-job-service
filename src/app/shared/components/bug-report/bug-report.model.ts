import { Preferences } from '@syrius/core';

export interface BugReport {
    id?: number;
    userDescription: string;
    screenshot?: string;
    collectedInfo: {
        timestamp: string;
        currentUrl: string;
        userAgent: string;
        viewportSize: string;
        screenResolution: string;
        preferences: Preferences;
        systemInfo?: unknown;
        layoutInfo?: unknown;
        authInfo?: unknown;
        osInfo?: string;
    };
    sessionId?: string;
}
