import { z } from 'zod';

/**
 * Zod schema for Antragsfragen validation
 *
 * Rules:
 * - All questions must have an answer (ja or nein)
 * - If a question is answered with "ja", details must be provided
 * - For Frage 1 (chronische Beschwerden), if answered with "ja", behandlung must also be answered
 */

// Schema for a single Antragsfrage
const antragfrageSchema = z.object({
    id: z.string(),
    frageText: z.string(),
    antwort: z.enum(['ja', 'nein', '']),
    details: z.string(),
    behandlung: z.enum(['ja', 'nein', '']).optional(),
    aufgenommenAm: z.string().optional(),
    geaendertAm: z.string().optional(),
    frage_boid: z.string().optional()
});

// Custom refinement to check that "ja" answers have details
export const antragsfragenFormDataSchema = z.array(antragfrageSchema).superRefine((fragen, ctx) => {
    fragen.forEach((frage, index) => {
        // Check if question is answered
        if (frage.antwort === '') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Frage ${index + 1} muss beantwortet werden`,
                path: [index, 'antwort']
            });
        }

        // If answered with "ja", details must be provided
        if (frage.antwort === 'ja') {
            if (!frage.details || frage.details.trim() === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Frage ${index + 1}: Details müssen angegeben werden, wenn mit Ja beantwortet`,
                    path: [index, 'details']
                });
            }

            // For Frage 1, also check behandlung field
            if (frage.id === 'frage1' && frage.behandlung !== undefined) {
                if (!frage.behandlung || (frage.behandlung as string) === '') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Frage 1: "Waren Sie deshalb in Behandlung?" muss beantwortet werden`,
                        path: [index, 'behandlung']
                    });
                }
            }
        }
    });
});

export type AntragsfragenFormData = z.infer<typeof antragsfragenFormDataSchema>;

/**
 * Validate antragsfragen data
 *
 * @param data - Array of antragsfragen to validate
 * @returns Zod SafeParseReturnType with validation result
 */
export function validateAntragsfragenFormData(data: unknown) {
    return antragsfragenFormDataSchema.safeParse(data);
}
