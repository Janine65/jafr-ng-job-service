import { z } from 'zod';

/**
 * Person search form schema with Zod validation
 *
 * Validation rules:
 * - Name and Vorname require minimum 3 characters (if provided)
 * - Geburtstag must match DD.MM.YYYY format (if provided)
 * - At least 2 fields must be filled (name, vorname, geburtstag)
 * - UNLESS svnr or partnernr is provided (then no minimum fields required)
 */
export const PersonSearchFormSchema = z
    .object({
        name: z.string().optional(),
        vorname: z.string().optional(),
        geburtstag: z.string().optional(),
        svnr: z.string().optional(),
        partnernr: z.string().optional()
    })
    .refine(
        (data) => {
            // If svnr or partnernr is provided, allow search
            if (data.svnr?.trim() || data.partnernr?.trim()) {
                return true;
            }

            // Count filled fields from name, vorname, geburtstag
            const fieldValues = [data.name?.trim(), data.vorname?.trim(), data.geburtstag?.trim()];
            const filledCount = fieldValues.filter((val) => val && val.length > 0).length;

            // At least 2 of these fields must be filled
            return filledCount >= 2;
        },
        {
            message: 'Bitte fülle mindestens 2 Felder aus (Name, Vorname, Geburtstag) oder gebe SVNr/PartnerNr ein',
            path: ['_form'] // Form-level error
        }
    )
    .refine(
        (data) => {
            // Validate name min length if provided
            if (data.name && data.name.trim().length > 0 && data.name.trim().length < 3) {
                return false;
            }
            return true;
        },
        {
            message: 'Name muss mindestens 3 Zeichen lang sein',
            path: ['name']
        }
    )
    .refine(
        (data) => {
            // Validate vorname min length if provided
            if (data.vorname && data.vorname.trim().length > 0 && data.vorname.trim().length < 3) {
                return false;
            }
            return true;
        },
        {
            message: 'Vorname muss mindestens 3 Zeichen lang sein',
            path: ['vorname']
        }
    )
    .refine(
        (data) => {
            // Validate geburtstag format if provided (DD.MM.YYYY)
            if (data.geburtstag && data.geburtstag.trim().length > 0) {
                const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
                return datePattern.test(data.geburtstag.trim());
            }
            return true;
        },
        {
            message: 'Geburtstag muss im Format TT.MM.JJJJ sein (z.B. 01.01.1990)',
            path: ['geburtstag']
        }
    );

export type PersonSearchFormData = z.infer<typeof PersonSearchFormSchema>;

/**
 * Validate person search form data
 * @param data - The form data to validate
 * @returns Zod parse result with success/error information
 */
export function validatePersonSearchForm(data: unknown) {
    return PersonSearchFormSchema.safeParse(data);
}

/**
 * Get user-friendly error messages from Zod validation errors
 * @param error - The Zod error object
 * @returns Map of field names to error messages
 */
export function getPersonSearchFormErrors(error: z.ZodError): Map<string, string> {
    const errorMap = new Map<string, string>();

    const issues = error.issues || [];
    issues.forEach((issue) => {
        const path = issue.path.join('.');
        errorMap.set(path, issue.message);
    });

    return errorMap;
}
