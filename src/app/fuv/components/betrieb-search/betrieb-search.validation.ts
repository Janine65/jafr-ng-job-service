import { z } from 'zod';

/**
 * Betrieb search form schema with Zod validation
 *
 * Validation rules:
 * - Name requires minimum 5 characters (if provided)
 * - At least 1 field must be filled (svnr, partnernr, uidnr, or name)
 */
export const BetriebSearchFormSchema = z
    .object({
        suvanr: z.string().optional(),
        partnernr: z.string().optional(),
        uidnr: z.string().optional(),
        name: z.string().optional()
    })
    .refine(
        (data) => {
            // At least one field must be filled
            const fieldValues = [data.suvanr?.trim(), data.partnernr?.trim(), data.uidnr?.trim(), data.name?.trim()];
            const filledCount = fieldValues.filter((val) => val && val.length > 0).length;

            return filledCount >= 1;
        },
        {
            message: 'Bitte fülle mindestens 1 Feld aus (SVNr, PartnerNr, UIDNr oder Name)',
            path: ['_form'] // Form-level error
        }
    )
    .refine(
        (data) => {
            // Validate name min length if provided
            if (data.name && data.name.trim().length > 0 && data.name.trim().length < 5) {
                return false;
            }
            return true;
        },
        {
            message: 'Name muss mindestens 5 Zeichen lang sein',
            path: ['name']
        }
    );

export type BetriebSearchFormData = z.infer<typeof BetriebSearchFormSchema>;

/**
 * Validate betrieb search form data
 * @param data - The form data to validate
 * @returns Zod parse result with success/error information
 */
export function validateBetriebSearchForm(data: unknown) {
    return BetriebSearchFormSchema.safeParse(data);
}

/**
 * Get user-friendly error messages from Zod validation result
 * @param validationResult - The Zod safeParse result
 * @returns Map of field names to error messages
 */
export function getBetriebSearchFormErrors(validationResult: ReturnType<typeof validateBetriebSearchForm>): Map<string, string> {
    const errorMap = new Map<string, string>();

    if (!validationResult.success) {
        const issues = validationResult.error.issues || [];
        issues.forEach((issue) => {
            const path = issue.path.join('.');
            errorMap.set(path, issue.message);
        });
    }

    return errorMap;
}
