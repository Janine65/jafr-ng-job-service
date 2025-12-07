import { z } from 'zod';

/**
 * Regress (Recourse) Search Form Validation
 *
 * Validates the search form for regress functionality
 */

/**
 * Schadennummer format validation
 * Format: XX.XXXXX.XX.X (10 digits with dots)
 * Example: 12.34567.89.0
 */
export const schadenNrPattern = /^\d{2}\.\d{5}\.\d{2}\.\d{1}$/;

/**
 * Zod schema for Regress search form
 */
export const RegressSearchFormSchema = z.object({
    schadenNr: z.string().min(1, 'Schadennummer ist erforderlich').regex(schadenNrPattern, 'Schadennummer muss im Format XX.XXXXX.XX.X eingegeben werden (z.B. 12.34567.89.0)')
});

export type RegressSearchFormData = z.infer<typeof RegressSearchFormSchema>;

/**
 * Validate Regress search form data
 *
 * @param data - Form data to validate
 * @returns Zod validation result
 */
export function validateRegressSearchForm(data: unknown) {
    return RegressSearchFormSchema.safeParse(data);
}

/**
 * Validate schadennummer format
 *
 * @param schadenNr - Schadennummer string
 * @returns true if valid format, false otherwise
 */
export function isValidSchadenNr(schadenNr: string): boolean {
    return schadenNrPattern.test(schadenNr);
}

/**
 * Get validation error message for schadennummer
 *
 * @param schadenNr - Schadennummer string
 * @returns Error message or null if valid
 */
export function getSchadenNrError(schadenNr: string | undefined | null): string | null {
    if (!schadenNr || schadenNr.trim() === '') {
        return 'Schadennummer ist erforderlich';
    }

    if (!isValidSchadenNr(schadenNr)) {
        return 'Schadennummer muss genau 10 Ziffern haben im Format XX.XXXXX.XX.X (z.B. 12.34567.89.0)';
    }

    return null;
}

/**
 * Format schadennummer with dots (if not already formatted)
 *
 * @param schadenNr - Schadennummer string (with or without dots)
 * @returns Formatted schadennummer
 */
export function formatSchadenNr(schadenNr: string): string {
    // Remove all non-digit characters
    const digits = schadenNr.replace(/\D/g, '');

    // If we have exactly 10 digits, format them
    if (digits.length === 10) {
        return `${digits.substring(0, 2)}.${digits.substring(2, 7)}.${digits.substring(7, 9)}.${digits.substring(9)}`;
    }

    // Return original if not exactly 10 digits
    return schadenNr;
}
