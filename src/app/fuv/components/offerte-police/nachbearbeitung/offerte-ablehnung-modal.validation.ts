import { z } from 'zod';

/**
 * Offerte Ablehnung Modal Validation
 *
 * Validates the form data for rejecting an offerte (quote) and creating a follow-up task
 */

/**
 * Zod schema for Aufgabe (task) data in the ablehnung modal
 */
export const OfferteAblehnungFormSchema = z.object({
    aufgabeart: z.string().min(1, 'Aufgabeart ist erforderlich'),
    titel: z.string().min(1, 'Titel ist erforderlich'),
    faelligAm: z.coerce.date({
        message: 'Fälligkeitsdatum ist erforderlich'
    }),
    beschreibung: z.string().optional()
});

export type OfferteAblehnungFormData = z.infer<typeof OfferteAblehnungFormSchema>;

/**
 * Validate offerte ablehnung form data
 *
 * @param data - Form data to validate
 * @returns Zod validation result
 */
export function validateOfferteAblehnungForm(data: unknown) {
    return OfferteAblehnungFormSchema.safeParse(data);
}

/**
 * Simple validation check for required fields
 * Alternative to Zod validation for simpler use cases
 *
 * @param aufgabeart - Task type
 * @param titel - Task title
 * @param faelligAm - Due date
 * @returns true if all required fields are filled
 */
export function isOfferteAblehnungFormValid(aufgabeart: string | undefined, titel: string | undefined, faelligAm: Date | string | undefined): boolean {
    return !!(aufgabeart && titel && faelligAm);
}

/**
 * Get validation errors for offerte ablehnung form
 *
 * @param aufgabeart - Task type
 * @param titel - Task title
 * @param faelligAm - Due date
 * @returns Array of error messages
 */
export function getOfferteAblehnungFormErrors(aufgabeart: string | undefined, titel: string | undefined, faelligAm: Date | string | undefined): string[] {
    const errors: string[] = [];

    if (!aufgabeart) {
        errors.push('Aufgabeart ist erforderlich');
    }

    if (!titel) {
        errors.push('Titel ist erforderlich');
    }

    if (!faelligAm) {
        errors.push('Fälligkeitsdatum ist erforderlich');
    }

    return errors;
}
