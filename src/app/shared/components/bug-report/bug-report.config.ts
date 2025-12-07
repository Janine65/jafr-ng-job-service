/**
 * Configuration for Bug Report Component
 *
 * This configuration defines rules and specifications for bug report generation,
 * including screenshot restrictions, required fields, and privacy controls.
 */

/**
 * Configuration for bug report behavior and content
 */
export interface BugReportConfig {
    /**
     * HTML attribute to mark sensitive content that should not be screenshot
     * Default: 'data-sensitive'
     * Usage in HTML: <div data-sensitive>Sensitive content</div>
     */
    sensitiveContentAttribute: string;

    /**
     * CSS class to mark sensitive content that should not be screenshot
     * Default: 'sensitive-content'
     * Usage in HTML: <div class="sensitive-content">Sensitive content</div>
     */
    sensitiveContentClass: string;

    /**
     * Check for sensitive content markers in DOM before capturing screenshot
     * Default: true
     */
    enableSensitiveContentDetection: boolean;

    /**
     * Message to display to users when screenshots are prohibited
     */
    screenshotProhibitedMessage: string;

    /**
     * Whether to allow users to manually disable screenshot in the dialog
     * Default: true
     */
    allowManualScreenshotToggle: boolean;

    /**
     * Whether to include screenshot by default when allowed
     * Default: true
     */
    includeScreenshotByDefault: boolean;

    /**
     * Required fields that must be filled in the bug report
     */
    requiredFields: {
        title: boolean;
        description: boolean;
        stepsToReproduce: boolean;
        expectedBehavior: boolean;
    };

    /**
     * Automatically collected system information
     */
    autoCollectInfo: {
        userAgent: boolean;
        timestamp: boolean;
        currentRoute: boolean;
        userEmail: boolean;
        applicationVersion: boolean;
        browserInfo: boolean;
        screenResolution: boolean;
    };

    /**
     * Maximum size for screenshots in KB
     * Default: 2048 (2MB)
     */
    maxScreenshotSizeKB: number;

    /**
     * Screenshot quality (0.0 to 1.0 for JPEG, only 1.0 for PNG)
     * Default: 0.8
     */
    screenshotQuality: number;
}

/**
 * Bug Report Configuration
 *
 * Define screenshot restrictions and report specifications here.
 */
export const BUG_REPORT_CONFIG: BugReportConfig = {
    /**
     * HTML attribute to mark sensitive content
     * Usage: <div data-sensitive>Sensitive health data</div>
     */
    sensitiveContentAttribute: 'data-sensitive',

    /**
     * CSS class to mark sensitive content
     * Usage: <div class="sensitive-content">Sensitive financial data</div>
     */
    sensitiveContentClass: 'sensitive-content',

    /**
     * Enable DOM scanning for sensitive content markers
     */
    enableSensitiveContentDetection: true,

    /**
     * Message shown when screenshots are prohibited
     * Note: This is used as fallback. Prefer using 'bugReport.screenshotProhibitedMessage' translation key.
     */
    screenshotProhibitedMessage: 'Screenshots are disabled on this page to protect sensitive information.',

    /**
     * User control settings
     */
    allowManualScreenshotToggle: true,
    includeScreenshotByDefault: true,

    /**
     * Required fields configuration
     */
    requiredFields: {
        title: true,
        description: true,
        stepsToReproduce: false,
        expectedBehavior: false
    },

    /**
     * Auto-collect system information
     */
    autoCollectInfo: {
        userAgent: true,
        timestamp: true,
        currentRoute: true,
        userEmail: true,
        applicationVersion: true,
        browserInfo: true,
        screenResolution: true
    },

    /**
     * Screenshot settings
     */
    maxScreenshotSizeKB: 2048, // 2MB
    screenshotQuality: 0.8
};

/**
 * Helper function to check if the current page contains sensitive content markers
 * Scans the DOM for elements with the configured sensitive content attribute or class
 * Only counts elements that are currently visible (not hidden by *ngIf, *ngSwitchCase, etc.)
 *
 * @returns Object with hasSensitiveContent flag, reason, and count of sensitive elements
 */
export function hasSensitiveContent(): { hasSensitiveContent: boolean; reason?: string; count?: number } {
    if (!BUG_REPORT_CONFIG.enableSensitiveContentDetection) {
        return { hasSensitiveContent: false };
    }

    /**
     * Helper to check if an element is actually visible and rendered
     * (not hidden by display:none, visibility:hidden, opacity:0, or Angular structural directives)
     */
    const isElementVisible = (element: Element): boolean => {
        const htmlElement = element as HTMLElement;

        // Check if element is connected to the document
        if (!htmlElement.isConnected) {
            return false;
        }

        // Get the computed style and bounding rect of the element itself
        const style = window.getComputedStyle(htmlElement);
        const rect = htmlElement.getBoundingClientRect();

        // Check if element has zero size (Angular structural directives often do this)
        if (rect.width === 0 && rect.height === 0) {
            return false;
        }

        // Check if hidden via CSS on the element itself
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        // Check all parent elements for visibility
        let currentElement = htmlElement.parentElement;
        while (currentElement && currentElement !== document.body) {
            const parentStyle = window.getComputedStyle(currentElement);
            const parentRect = currentElement.getBoundingClientRect();

            // Check if parent is hidden via CSS
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
                return false;
            }

            // Check if parent has zero size (Angular *ngIf/*ngSwitchCase containers)
            if (parentRect.width === 0 && parentRect.height === 0) {
                return false;
            }

            currentElement = currentElement.parentElement;
        }

        return true;
    };

    // Check for attribute markers (e.g., data-sensitive)
    const attributeSelector = `[${BUG_REPORT_CONFIG.sensitiveContentAttribute}]`;
    const allSensitiveByAttribute = document.querySelectorAll(attributeSelector);
    const visibleByAttribute = Array.from(allSensitiveByAttribute).filter(isElementVisible);

    // Check for class markers (e.g., .sensitive-content)
    const classSelector = `.${BUG_REPORT_CONFIG.sensitiveContentClass}`;
    const allSensitiveByClass = document.querySelectorAll(classSelector);
    const visibleByClass = Array.from(allSensitiveByClass).filter(isElementVisible);

    const totalCount = visibleByAttribute.length + visibleByClass.length;

    if (totalCount > 0) {
        const markers: string[] = [];
        if (visibleByAttribute.length > 0) {
            markers.push(`${visibleByAttribute.length} visible element(s) with "${BUG_REPORT_CONFIG.sensitiveContentAttribute}" attribute`);
        }
        if (visibleByClass.length > 0) {
            markers.push(`${visibleByClass.length} visible element(s) with "${BUG_REPORT_CONFIG.sensitiveContentClass}" class`);
        }

        return {
            hasSensitiveContent: true,
            reason: `Page contains visible sensitive content: ${markers.join(', ')}`,
            count: totalCount
        };
    }

    return { hasSensitiveContent: false };
}
