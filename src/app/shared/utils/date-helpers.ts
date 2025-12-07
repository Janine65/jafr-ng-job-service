/**
 * Date helper functions for contract date calculations
 * All dates follow Swiss/German date formats (DD.MM.YYYY)
 *
 * These utilities handle common date operations for insurance contracts,
 * particularly contract duration calculations and date formatting.
 */

/**
 * Calculate contract end date based on start date and duration
 * Contract must cover at least X full calendar years and end on December 31st
 *
 * @example
 * calculateContractEndDate(new Date('2024-03-15'), 4)
 * // Returns: 2027-12-31 (covers 2024-2027, at least 4 full years)
 *
 * @param startDate - Contract start date
 * @param years - Number of years duration
 * @returns Date set to December 31st of the end year, or undefined if invalid input
 */
export function calculateContractEndDate(startDate: Date | undefined, years: number): Date | undefined {
    if (!startDate) return undefined;
    const date = startDate instanceof Date ? startDate : new Date(startDate);
    if (isNaN(date.getTime())) return undefined;

    const endDate = new Date(date);
    endDate.setFullYear(endDate.getFullYear() + years);
    endDate.setMonth(11); // December (0-indexed)
    endDate.setDate(31);
    return endDate;
}

/**
 * Calculate duration in years between two dates
 * Simply calculates the difference in years (end year - start year)
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of years difference
 */
export function calculateYearsBetween(startDate: Date | undefined, endDate: Date | undefined): number {
    if (!startDate || !endDate) return 0;
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    return end.getFullYear() - start.getFullYear();
}

/**
 * Parse various date formats to Date object
 * Handles: Date objects, ISO strings (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss.sssZ)
 * For date-only strings (YYYY-MM-DD), creates a Date in local timezone to avoid date shifts
 *
 * @param date - Date in various formats
 * @returns Date object or undefined if parsing fails
 */
export function parseDate(date: string | Date | undefined | null): Date | undefined {
    if (!date) return undefined;

    // If it's already a Date object, return it
    if (date instanceof Date) {
        return isNaN(date.getTime()) ? undefined : date;
    }

    // If it's a string, parse it to Date
    if (typeof date === 'string') {
        // For ISO date strings (YYYY-MM-DD), parse in local timezone to avoid date shifts
        const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (isoDatePattern.test(date)) {
            const [year, month, day] = date.split('-').map(Number);
            const parsed = new Date(year, month - 1, day); // month is 0-indexed
            return isNaN(parsed.getTime()) ? undefined : parsed;
        }

        // For other formats (including timestamps), use standard parsing
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? undefined : parsed;
    }

    return undefined;
}

/**
 * Convert Date to ISO string (YYYY-MM-DD) for API/storage
 * Uses local timezone to avoid date shifts
 *
 * @param date - Date object
 * @returns ISO string in format YYYY-MM-DD, or undefined if invalid
 */
export function formatDateToISO(date: Date | undefined | null): string | undefined {
    if (!date || !(date instanceof Date)) return undefined;
    if (isNaN(date.getTime())) return undefined;

    // Use local date components to avoid timezone shifts
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Format date for Swiss display (DD.MM.YYYY)
 *
 * @param date - Date object
 * @returns Formatted string in format DD.MM.YYYY
 */
export function formatDateSwiss(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Check if date is December 31st
 * Used for validating contract end dates
 *
 * @param date - Date to check
 * @returns True if date is December 31st
 */
export function isDecember31(date: Date): boolean {
    return date.getMonth() === 11 && date.getDate() === 31;
}

/**
 * Validate that end date is correct based on start date and duration
 * Contract end dates must be December 31st of the calculated year
 *
 * @param startDate - Contract start date
 * @param endDate - Contract end date to validate
 * @param durationYears - Number of years duration
 * @returns True if end date is correct (December 31st of start year + duration)
 */
export function validateContractEndDate(startDate: Date, endDate: Date, durationYears: number): boolean {
    const expected = calculateContractEndDate(startDate, durationYears);
    if (!expected) return false;

    return endDate.getFullYear() === expected.getFullYear() && endDate.getMonth() === expected.getMonth() && endDate.getDate() === expected.getDate();
}

/**
 * Check if two dates are equal (same year, month, day)
 * Ignores time component
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if dates are equal (ignoring time)
 */
export function areDatesEqual(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
}

/**
 * Get today's date with time set to midnight (00:00:00)
 * Useful for date comparisons
 *
 * @returns Today's date at midnight
 */
export function getTodayAtMidnight(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

/**
 * Check if a date is in the past (before today)
 *
 * @param date - Date to check
 * @returns True if date is before today
 */
export function isDateInPast(date: Date): boolean {
    const today = getTodayAtMidnight();
    return date.getTime() < today.getTime();
}

/**
 * Check if a date is in the future (after today)
 *
 * @param date - Date to check
 * @returns True if date is after today
 */
export function isDateInFuture(date: Date): boolean {
    const today = getTodayAtMidnight();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.getTime() >= tomorrow.getTime();
}

/**
 * Check if a date is today or in the future
 *
 * @param date - Date to check
 * @returns True if date is today or future
 */
export function isDateTodayOrFuture(date: Date): boolean {
    const today = getTodayAtMidnight();
    return date.getTime() >= today.getTime();
}
