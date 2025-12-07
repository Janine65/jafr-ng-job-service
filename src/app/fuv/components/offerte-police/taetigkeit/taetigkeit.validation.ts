import { z } from 'zod';

import { CodeTableEntry } from '@app/fuv/models/codetable.model';
import { TaetigkeitData } from '@app/fuv/models/taetigkeit.model';
import { calculateContractEndDate, validateContractEndDate } from '@app/shared/utils/date-helpers';
import { optionalString } from '@app/shared/validation/validation-helpers';

/**
 * Note: Validation messages in this file use translation keys.
 * These keys correspond to translations in:
 * - fuv.police.taetigkeit.validation.*
 *
 * The component should use TranslateService to resolve these keys when displaying errors.
 */

const requiredTranslatedString = (messageKey: string) => z.string({ message: messageKey }).trim().min(1, messageKey);

/**
 * Zod Schema for a single Taetigkeit (activity) item in the form
 */
export const TaetigkeitFormItemSchema = z.object({
    taetigkeit: requiredTranslatedString('fuv.police.taetigkeit.validation.taetigkeitRequired'),
    prozent: z
        .union([z.string(), z.number()])
        .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
        .pipe(z.number({ message: 'fuv.police.taetigkeit.validation.prozentMustBeNumber' }).min(0, 'fuv.police.taetigkeit.validation.prozentMinValue').max(100, 'fuv.police.taetigkeit.validation.prozentMaxValue'))
});

export type TaetigkeitFormItem = z.infer<typeof TaetigkeitFormItemSchema>;

/**
 * Build Zod Schema for the Taetigkeit form data
 * This matches the actual form structure in taetigkeit.component.ts
 *
 * @param allowPastDates - If true, allows past dates for vertragGueltigAb (for existing offerten)
 * @param isVerlaengerung - If true, makes selbststaendigSeit optional (not required for Verlängerung)
 */
export const buildTaetigkeitFormDataSchema = (allowPastDates: boolean = false, isVerlaengerung: boolean = false) => {
    const vertragGueltigAbSchema = allowPastDates
        ? z.date({ message: 'fuv.police.taetigkeit.validation.vertragGueltigAbRequired' })
        : z.date({ message: 'fuv.police.taetigkeit.validation.vertragGueltigAbRequired' }).refine((date) => date >= new Date(new Date().setHours(0, 0, 0, 0)), {
              message: 'fuv.police.taetigkeit.validation.vertragGueltigAbNotInPast'
          });

    return (
        z
            .object({
                // Date fields - allow past dates for existing offerten
                vertragGueltigAb: vertragGueltigAbSchema,
                vertragGueltigBis: z.date({ message: 'fuv.police.taetigkeit.validation.vertragGueltigBisRequired' }),

                // Dropdown fields
                vertragsdauer: requiredTranslatedString('fuv.police.taetigkeit.validation.vertragsdauerRequired'),
                verkaufskanal: requiredTranslatedString('fuv.police.taetigkeit.validation.verkaufskanalRequired'),
                stellungImBetrieb: requiredTranslatedString('fuv.police.taetigkeit.validation.stellungImBetriebRequired'),
                arbeitspensum: requiredTranslatedString('fuv.police.taetigkeit.validation.arbeitspensumRequired'),

                // Text fields
                taetigkeitsbeschreibung: z
                    .string({ message: 'fuv.police.taetigkeit.validation.taetigkeitsbeschreibungInvalid' })
                    .min(1, 'fuv.police.taetigkeit.validation.taetigkeitsbeschreibungInvalid')
                    .refine(
                        (value) => {
                            const words = value
                                .trim()
                                .split(/\s+/)
                                .filter((w) => w.length > 0);
                            // Check if there is at least one word with at least 5 letters
                            return words.some((word) => word.length >= 5);
                        },
                        {
                            message: 'fuv.police.taetigkeit.validation.taetigkeitsbeschreibungInvalid'
                        }
                    ),
                avb: optionalString(), // Auto-populated

                // Activities array
                taetigkeiten: z.array(TaetigkeitFormItemSchema, { message: 'fuv.police.taetigkeit.validation.taetigkeitenRequired' }).min(1, 'fuv.police.taetigkeit.validation.taetigkeitenRequired'),

                // Additional fields
                // selbststaendigSeit is optional for Verlängerung (isVerlaengerung=true)
                selbststaendigSeit: isVerlaengerung
                    ? z
                          .date({
                              message: 'fuv.police.taetigkeit.validation.selbststaendigSeitRequired'
                          })
                          .optional()
                    : z.date({
                          message: 'fuv.police.taetigkeit.validation.selbststaendigSeitRequired'
                      }),
                anzahlMitarbeiter: requiredTranslatedString('fuv.police.taetigkeit.validation.anzahlMitarbeiterRequired'),
                stellenprozente: z
                    .union([z.string(), z.number(), z.null(), z.undefined()])
                    .refine(
                        (val) => {
                            // Check if value is empty/null/undefined
                            if (val === '' || val === null || val === undefined) {
                                return false;
                            }
                            return true;
                        },
                        {
                            message: 'fuv.police.taetigkeit.validation.stellenprozenteRequired'
                        }
                    )
                    .transform((val) => {
                        return typeof val === 'string' ? parseFloat(val) : (val as number);
                    })
                    .pipe(
                        z.number({ message: 'fuv.police.taetigkeit.validation.stellenprozenteMustBeNumber' }).min(0, 'fuv.police.taetigkeit.validation.stellenprozenteNotNegative').max(9999, 'fuv.police.taetigkeit.validation.stellenprozenteMaxValue')
                    )
            })
            // Cross-field validations
            .refine(
                (data) => {
                    // Validate that vertragGueltigBis is after vertragGueltigAb
                    if (data.vertragGueltigAb && data.vertragGueltigBis) {
                        return data.vertragGueltigBis > data.vertragGueltigAb;
                    }
                    return true;
                },
                {
                    message: 'fuv.police.taetigkeit.validation.vertragGueltigBisMustBeAfter',
                    path: ['vertragGueltigBis']
                }
            )
            .refine(
                (data) => {
                    // Validate that contract duration is exactly 1, 2, 3, or 4 years
                    // End date must be December 31st of the year (startYear + duration)
                    if (data.vertragGueltigAb && data.vertragGueltigBis) {
                        const startDate = new Date(data.vertragGueltigAb);
                        const endDate = new Date(data.vertragGueltigBis);

                        // Check if end date is December 31st of the year that includes at least X full years
                        // For example: Start 15.03.2024 + 4 years = End 31.12.2027
                        // This covers at least 4 full years (2024, 2025, 2026, 2027) and ends at year boundary
                        const validDurations = [1, 2, 3, 4];

                        for (const years of validDurations) {
                            const expectedYear = startDate.getFullYear() + years;

                            // Check if end date is December 31st of the expected year
                            if (endDate.getFullYear() === expectedYear && endDate.getMonth() === 11 && endDate.getDate() === 31) {
                                return true;
                            }
                        }

                        return false;
                    }
                    return true;
                },
                {
                    message: 'fuv.police.taetigkeit.validation.vertragMustCoverYears',
                    path: ['vertragGueltigBis']
                }
            )
            .refine(
                (data) => {
                    // Validate that tätigkeiten sum to exactly 100%
                    if (!data.taetigkeiten || data.taetigkeiten.length === 0) {
                        return false;
                    }

                    const sum = data.taetigkeiten.reduce((total, item) => {
                        const prozent = typeof item.prozent === 'string' ? parseFloat(item.prozent) : item.prozent;
                        return total + (isNaN(prozent) ? 0 : prozent);
                    }, 0);

                    return Math.abs(sum - 100) < 0.001; // Handle floating point precision
                },
                {
                    message: 'fuv.police.taetigkeit.validation.taetigkeitenSumMust100',
                    path: ['taetigkeiten']
                }
            )
    );
};

/**
 * Default schema for new offerten (enforces no past dates)
 */
export const TaetigkeitFormDataSchema = buildTaetigkeitFormDataSchema(false);

export type TaetigkeitFormData = z.infer<typeof TaetigkeitFormDataSchema>;

/**
 * Validate TaetigkeitFormData and return validation result
 *
 * @param data - The form data to validate
 * @param allowPastDates - If true, allows past dates for vertragGueltigAb (for existing offerten)
 * @param isVerlaengerung - If true, makes selbststaendigSeit optional (not required for Verlängerung)
 * @returns Zod parse result with success/error information
 */
export function validateTaetigkeitFormData(data: unknown, allowPastDates: boolean = false, isVerlaengerung: boolean = false) {
    const schema = buildTaetigkeitFormDataSchema(allowPastDates, isVerlaengerung);
    return schema.safeParse(data);
}

/**
 * Validate TaetigkeitFormData and throw on error
 *
 * @param data - The form data to validate
 * @param allowPastDates - If true, allows past dates for vertragGueltigAb (for existing offerten)
 * @param isVerlaengerung - If true, makes selbststaendigSeit optional (not required for Verlängerung)
 * @returns The validated and type-safe data
 * @throws ZodError if validation fails
 */
export function validateTaetigkeitFormDataStrict(data: unknown, allowPastDates: boolean = false, isVerlaengerung: boolean = false): TaetigkeitFormData {
    const schema = buildTaetigkeitFormDataSchema(allowPastDates, isVerlaengerung);
    return schema.parse(data);
}

export interface EndDateValidationInput {
    vertragGueltigAb?: Date | null;
    vertragGueltigBis?: Date | null;
    vertragsdauerCode?: string | null;
    getDurationYearsFromCode: (internalName: string | null) => number | null;
    isReadOnly?: boolean;
}

export interface EndDateValidationResult {
    isValid: boolean;
    shouldCorrect: boolean;
    expectedEndDate?: Date;
    currentEndDate?: Date;
}

export function validateAndCorrectEndDate(input: EndDateValidationInput): EndDateValidationResult {
    if (input.isReadOnly) {
        return { isValid: true, shouldCorrect: false };
    }

    const { vertragGueltigAb, vertragGueltigBis, vertragsdauerCode, getDurationYearsFromCode } = input;

    if (!vertragGueltigAb || !vertragGueltigBis || !vertragsdauerCode) {
        return { isValid: true, shouldCorrect: false };
    }

    const years = getDurationYearsFromCode(vertragsdauerCode);
    if (!years) {
        return { isValid: true, shouldCorrect: false };
    }

    const expectedEndDate = calculateContractEndDate(vertragGueltigAb, years);
    if (!expectedEndDate) {
        return { isValid: true, shouldCorrect: false };
    }

    const currentEndDate = vertragGueltigBis instanceof Date ? vertragGueltigBis : new Date(vertragGueltigBis);
    const isValid = validateContractEndDate(vertragGueltigAb, currentEndDate, years);

    return {
        isValid,
        shouldCorrect: !isValid,
        expectedEndDate: isValid ? undefined : expectedEndDate,
        currentEndDate: isValid ? undefined : currentEndDate
    };
}

function getLatestActiveAvbCode(avbCodeMap: Map<string, CodeTableEntry>): string | null {
    if (!avbCodeMap || avbCodeMap.size === 0) {
        return null;
    }

    const codesArray = Array.from(avbCodeMap.values()).filter((code) => code.aktiv === true);
    if (codesArray.length === 0) {
        return null;
    }

    const sortedCodes = codesArray.sort((a, b) => {
        const sorterA = typeof a.sorter === 'number' ? a.sorter : parseInt(a.sorter as any, 10);
        const sorterB = typeof b.sorter === 'number' ? b.sorter : parseInt(b.sorter as any, 10);
        return sorterB - sorterA;
    });

    return sortedCodes[0].internal_name;
}

export interface AvbValidationResult {
    isValid: boolean;
    shouldUpdate: boolean;
    latestAvb?: string | null;
    currentAvb?: string | null;
}

export function validateAndCorrectAvb(input: { currentAvb?: string | null; avbCodeMap: Map<string, CodeTableEntry>; isReadOnly?: boolean }): AvbValidationResult {
    if (input.isReadOnly) {
        return { isValid: true, shouldUpdate: false, currentAvb: input.currentAvb ?? null };
    }

    if (!input.currentAvb || input.avbCodeMap.size === 0) {
        return { isValid: true, shouldUpdate: false, currentAvb: input.currentAvb ?? null };
    }

    const latestAvb = getLatestActiveAvbCode(input.avbCodeMap);
    if (!latestAvb || latestAvb === input.currentAvb) {
        return {
            isValid: true,
            shouldUpdate: false,
            latestAvb: latestAvb ?? input.currentAvb ?? null,
            currentAvb: input.currentAvb ?? null
        };
    }

    return {
        isValid: false,
        shouldUpdate: true,
        latestAvb,
        currentAvb: input.currentAvb ?? null
    };
}

export interface TaetigkeitFormValidationOptions {
    isReadOnly?: boolean;
    allowPastDates?: boolean;
    isVerlaengerung?: boolean;
}

export interface TaetigkeitFormValidationResult {
    isValid: boolean;
    errors: Map<string, string>;
    zodError?: z.ZodError;
}

export function runTaetigkeitFormValidation(data: TaetigkeitData, options: TaetigkeitFormValidationOptions): TaetigkeitFormValidationResult {
    if (options.isReadOnly) {
        return { isValid: true, errors: new Map() };
    }

    const result = validateTaetigkeitFormData(data, !!options.allowPastDates, !!options.isVerlaengerung);

    if (result.success) {
        return { isValid: true, errors: new Map() };
    }

    return {
        isValid: false,
        errors: getFormValidationErrors(result.error),
        zodError: result.error
    };
}

/**
 * Get user-friendly error messages from Zod validation errors
 *
 * @param error - The Zod error object
 * @returns Map of field names to error messages
 */
export function getFormValidationErrors(error: z.ZodError): Map<string, string> {
    const errorMap = new Map<string, string>();

    const issues = error.issues || [];
    issues.forEach((issue) => {
        const path = issue.path.join('.');
        errorMap.set(path, issue.message);
    });

    return errorMap;
}

/**
 * Get flattened validation errors by field
 *
 * @param error - The Zod error object
 * @returns Object with field paths as keys and error messages as values
 */
export function getFormFlattenedErrors(error: z.ZodError) {
    const flattened: Record<string, string[]> = {};

    const issues = error.issues || [];
    issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!flattened[path]) {
            flattened[path] = [];
        }
        flattened[path].push(issue.message);
    });

    return flattened;
}

/**
 * Validate a single field from the form
 *
 * @param fieldName - The field to validate
 * @param value - The value to validate
 * @returns Validation result for that specific field
 */
export function validateFormField<K extends keyof TaetigkeitFormData>(fieldName: K, value: TaetigkeitFormData[K]): { success: boolean; error?: string } {
    const fieldSchema = TaetigkeitFormDataSchema.shape[fieldName];
    const result = fieldSchema.safeParse(value);

    if (result.success) {
        return { success: true };
    } else {
        const firstIssue = result.error.issues?.[0];
        return {
            success: false,
            error: firstIssue?.message || 'common.validation.invalidInput'
        };
    }
}
