import { z } from 'zod';

/**
 * Validation schema for Nachbearbeitung step
 * Ensures that exactly one internal sales representative (Verkäufer) is selected
 */
export const nachbearbeitungValidationSchema = z.object({
    internerVermittlerVerkaeufer: z
        .object({
            name: z.string()
            // Add other properties as needed
        })
        .nullable()
        .refine((val) => val !== null, {
            message: 'Es muss immer genau ein interner Vermittler Verkäufer erfasst sein.'
        })
});

export type NachbearbeitungValidation = z.infer<typeof nachbearbeitungValidationSchema>;

/**
 * Validate nachbearbeitung data and return validation errors
 */
export function validateNachbearbeitung(data: { internerVermittlerVerkaeufer: any }): {
    isValid: boolean;
    errors: Record<string, string>;
} {
    const result = nachbearbeitungValidationSchema.safeParse(data);

    if (result.success) {
        return { isValid: true, errors: {} };
    }

    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        errors[path] = issue.message;
    });

    return { isValid: false, errors };
}
