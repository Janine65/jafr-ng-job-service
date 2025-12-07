import { z } from 'zod';

import {
    nonNegativeNumber, optionalString, requiredNumber
} from '@app/shared/validation/validation-helpers';

import {
    MIN_JAHRESVERDIENST_FAMILY_MEMBERS, MIN_JAHRESVERDIENST_OWNERS
} from '../police.constants';

/**
 * Zod Schema for a single Variante (variant) data
 */
export const VarianteDataSchema = z.object({
    jahresverdienst: nonNegativeNumber('Jahresverdienst'),
    monatsverdienst: nonNegativeNumber('Monatsverdienst'),
    taggeldAb: optionalString(),
    rabatt: nonNegativeNumber('Rabatt'),
    taggeldProJahr: nonNegativeNumber('Taggeld pro Jahr'),
    taggeldProMonat: nonNegativeNumber('Taggeld pro Monat'),
    invalidenrenteProJahr: nonNegativeNumber('Invalidenrente pro Jahr'),
    invalidenrenteProMonat: nonNegativeNumber('Invalidenrente pro Monat'),
    jahresbruttopraemie: nonNegativeNumber('Jahresbruttopraemie'),
    rabattBetrag: nonNegativeNumber('Rabattbetrag'),
    jahrespraemie: nonNegativeNumber('Jahrespraemie'),
    monatspraemie: nonNegativeNumber('Monatspraemie')
});

export type VarianteData = z.infer<typeof VarianteDataSchema>;

/**
 * Zod Schema for the Varianten form data
 * This matches the actual form structure in varianten.component.ts
 */
export const VariantenFormDataSchema = z.object({
    // Grundlagen für die Prämienberechnung
    agenturkompetenz: z
        .string({
            message: 'Agenturkompetenz ist erforderlich'
        })
        .min(1, 'Agenturkompetenz ist erforderlich'),
    klasse: z.string({
        message: 'Klasse ist erforderlich'
    }),
    basisstufe: requiredNumber('Basisstufe'),
    stufe: requiredNumber('Stufe'),
    praemiensatz: z.string({
        message: 'Prämiensatz ist erforderlich'
    }),

    // Selected variant
    selectedVariante: z.enum(['A', 'B', 'C'], {
        message: 'Ausgewählte Variante ist erforderlich'
    }),

    // Variant data
    varianteA: VarianteDataSchema,
    varianteB: VarianteDataSchema,
    varianteC: VarianteDataSchema,

    // Prämienzahlung
    praemienzahlung: z.enum(['jaehrlich', 'halbjaehrlich', 'vierteljaehrlich', 'monatlich'], {
        message: 'Prämienzahlung ist erforderlich'
    }),

    // Zahlungsadresse
    nameGeldinstitut: optionalString(),
    plz: optionalString(),
    ort: optionalString(),
    iban: optionalString(),
    kontoinhaber: optionalString(),

    begleitschreiben: z.boolean()
});

/**
 * IBAN validation schema
 * Accepts IBANs from any country with the following format:
 * - 2 letter country code (uppercase)
 * - 2 check digits
 * - Up to 30 alphanumeric characters for the BBAN (Basic Bank Account Number)
 *
 * Examples:
 * - Swiss: CH13 0077 8180 2388 9200 (21 characters)
 * - German: DE89 3704 0044 0532 0130 00 (22 characters)
 * - French: FR14 2004 1010 0505 0001 3M02 606 (27 characters)
 */
export const IbanSchema = z
    .string()
    .transform((val) => val.replace(/\s+/g, '').toUpperCase()) // Remove spaces and convert to uppercase
    .refine((val) => /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(val), {
        message: 'Ungültiges IBAN-Format. IBAN muss mit 2-Buchstaben-Ländercode beginnen (z.B. CH13 0077 8180 2388 9200)'
    });

/**
 * Validate and format IBAN
 * @param iban - IBAN string (with or without spaces)
 * @returns Validation result with formatted IBAN or error message
 */
export function validateIban(iban: string): { success: boolean; formattedIban?: string; error?: string; isSwiss?: boolean } {
    const result = IbanSchema.safeParse(iban);

    if (!result.success) {
        return {
            success: false,
            error: result.error.issues[0]?.message || 'Ungültiges IBAN-Format'
        };
    }

    // Format with spaces: groups of 4 characters
    const formatted = result.data.replace(/(.{4})/g, '$1 ').trim();

    // Check if it's a Swiss IBAN
    const isSwiss = result.data.startsWith('CH') && result.data.length === 21;

    return {
        success: true,
        formattedIban: formatted,
        isSwiss
    };
}

export type VariantenFormData = z.infer<typeof VariantenFormDataSchema>;

/**
 * Extended validation schema with IBAN validation
 * Only validates if IBAN is provided (not empty)
 * Accepts IBANs from any country
 */
export const VariantenFormDataWithIbanSchema = VariantenFormDataSchema.refine(
    (data) => {
        // Only validate IBAN if it's not empty
        if (data.iban && data.iban.trim() !== '') {
            const result = validateIban(data.iban);
            return result.success;
        }
        return true;
    },
    {
        message: 'Ungültiges IBAN-Format. IBAN muss mit 2-Buchstaben-Ländercode beginnen',
        path: ['iban']
    }
);

/**
 * Create custom validation schema with dynamic max VersVerdienst value
 * This allows us to inject the maximum allowed income at runtime
 */
export function createVariantenValidationSchema(maxVersVerdienst: number | null) {
    return VariantenFormDataSchema.refine(
        (data) => {
            // Validate varianteA jahresverdienst against maximum
            if (maxVersVerdienst !== null && data.varianteA.jahresverdienst > 0) {
                return data.varianteA.jahresverdienst <= maxVersVerdienst;
            }
            return true;
        },
        {
            message: `Maximaler versicherter Verdienst ist CHF ${maxVersVerdienst?.toLocaleString('de-CH') || 'N/A'}`,
            path: ['varianteA', 'jahresverdienst']
        }
    )
        .refine(
            (data) => {
                // Validate varianteB jahresverdienst against maximum
                if (maxVersVerdienst !== null && data.varianteB.jahresverdienst > 0) {
                    return data.varianteB.jahresverdienst <= maxVersVerdienst;
                }
                return true;
            },
            {
                message: `Maximaler versicherter Verdienst ist CHF ${maxVersVerdienst?.toLocaleString('de-CH') || 'N/A'}`,
                path: ['varianteB', 'jahresverdienst']
            }
        )
        .refine(
            (data) => {
                // Validate varianteC jahresverdienst against maximum
                if (maxVersVerdienst !== null && data.varianteC.jahresverdienst > 0) {
                    return data.varianteC.jahresverdienst <= maxVersVerdienst;
                }
                return true;
            },
            {
                message: `Maximaler versicherter Verdienst ist CHF ${maxVersVerdienst?.toLocaleString('de-CH') || 'N/A'}`,
                path: ['varianteC', 'jahresverdienst']
            }
        );
}

/**
 * Validate VariantenFormData and return validation result
 *
 * @param data - The form data to validate
 * @param maxVersVerdienst - Optional maximum insured income for validation
 * @returns Zod parse result with success/error information
 */
export function validateVariantenFormData(data: unknown, maxVersVerdienst: number | null = null) {
    const schema = maxVersVerdienst !== null ? createVariantenValidationSchema(maxVersVerdienst) : VariantenFormDataSchema;
    return schema.safeParse(data);
}

/**
 * Validate VariantenFormData and throw on error
 *
 * @param data - The form data to validate
 * @param maxVersVerdienst - Optional maximum insured income for validation
 * @returns The validated and type-safe data
 * @throws ZodError if validation fails
 */
export function validateVariantenFormDataStrict(data: unknown, maxVersVerdienst: number | null = null): VariantenFormData {
    const schema = maxVersVerdienst !== null ? createVariantenValidationSchema(maxVersVerdienst) : VariantenFormDataSchema;
    return schema.parse(data);
}

/**
 * Get user-friendly error messages from Zod validation errors
 *
 * @param error - The Zod error object
 * @returns Map of field names to error messages (using dot notation for nested fields)
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

export const VALID_ZAHLUNGSWEISE = ['jaehrlich', 'halbjaehrlich', 'vierteljaehrlich', 'monatlich'] as const;
export type ZahlungsweiseValue = (typeof VALID_ZAHLUNGSWEISE)[number] | undefined;

export interface PraemienzahlungValidationResult {
    isValid: boolean;
    cleaned?: ZahlungsweiseValue;
    warningKey?: string;
    warningParams?: Record<string, string>;
}

export function validatePraemienzahlung(value: string | undefined): PraemienzahlungValidationResult {
    if (!value || value.trim() === '') {
        return { isValid: true, cleaned: undefined };
    }

    if (VALID_ZAHLUNGSWEISE.includes(value as any)) {
        return { isValid: true, cleaned: value as ZahlungsweiseValue };
    }

    return {
        isValid: false,
        cleaned: undefined,
        warningKey: 'fuv.police.varianten.validation.warnings.invalidZahlungsweise',
        warningParams: {
            value: value.trim()
        }
    };
}

export interface JahresverdienstValidationContext {
    value: number;
    maxVersVerdienst: number | null;
    isFamilyMember: boolean;
    isOwner: boolean;
    percentage: number;
    stellungLabel?: string;
}

export type JahresverdienstValidationErrorType = 'familyMemberMinimum' | 'ownerMinimum' | 'negativeValue' | 'maxExceeded';

export interface JahresverdienstValidationError {
    type: JahresverdienstValidationErrorType;
    minValue?: number;
    maxValue?: number;
    percentage?: number;
    stellungLabel?: string;
}

export interface JahresverdienstValidationResult {
    success: boolean;
    error?: JahresverdienstValidationError;
}

export function validateJahresverdienstWithContext(context: JahresverdienstValidationContext): JahresverdienstValidationResult {
    const { value, maxVersVerdienst, isFamilyMember, isOwner, percentage, stellungLabel } = context;

    if (isFamilyMember && value > 0) {
        const calculatedMinimum = Math.round(MIN_JAHRESVERDIENST_FAMILY_MEMBERS * (percentage / 100));
        if (value < calculatedMinimum) {
            return {
                success: false,
                error: {
                    type: 'familyMemberMinimum',
                    minValue: calculatedMinimum,
                    percentage,
                    stellungLabel
                }
            };
        }
    }

    if (isOwner && value > 0) {
        const calculatedMinimum = Math.round(MIN_JAHRESVERDIENST_OWNERS * (percentage / 100));
        if (value < calculatedMinimum) {
            return {
                success: false,
                error: {
                    type: 'ownerMinimum',
                    minValue: calculatedMinimum,
                    percentage,
                    stellungLabel
                }
            };
        }
    }

    const maxCheck = validateJahresverdienst(value, maxVersVerdienst);
    if (!maxCheck.success) {
        return { success: false, error: maxCheck.error };
    }

    return { success: true };
}

/**
 * Validate jahresverdienst for a specific variant
 *
 * @param jahresverdienst - The value to validate
 * @param maxVersVerdienst - Maximum allowed value
 * @returns Validation result with success flag and optional error message
 */
export function validateJahresverdienst(jahresverdienst: number, maxVersVerdienst: number | null): JahresverdienstValidationResult {
    if (jahresverdienst < 0) {
        return {
            success: false,
            error: { type: 'negativeValue' }
        };
    }

    if (maxVersVerdienst !== null && jahresverdienst > maxVersVerdienst) {
        return {
            success: false,
            error: {
                type: 'maxExceeded',
                maxValue: maxVersVerdienst
            }
        };
    }

    return { success: true };
}
