import { z } from 'zod';

/**
 * Reusable validation helper functions for common validation scenarios
 * These provide high-level validation methods that can be used in validation rules or Zod schemas
 */

/**
 * Check if a value is filled (not null, undefined, or empty string)
 */
export const isFilled = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !isNaN(value);
    return true;
};

/**
 * Check if a number is between min and max (inclusive)
 */
export const isBetween = (value: number, min: number, max: number): boolean => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    return value >= min && value <= max;
};

/**
 * Check if a date is between two dates (inclusive)
 */
export const isDateBetween = (date: Date | null | undefined, startDate: Date, endDate: Date): boolean => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    const time = date.getTime();
    return time >= startDate.getTime() && time <= endDate.getTime();
};

/**
 * Check if a date is not in the past (today or future)
 */
export const isDateNotPast = (date: Date | null | undefined): boolean => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
};

/**
 * Check if a date is in the past (before today)
 */
export const isDatePast = (date: Date | null | undefined): boolean => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
};

/**
 * Check if a date is in the future (after today)
 */
export const isDateFuture = (date: Date | null | undefined): boolean => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date >= tomorrow;
};

/**
 * Check if a number meets minimum value
 */
export const isMin = (value: number, min: number): boolean => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    return value >= min;
};

/**
 * Check if a number meets maximum value
 */
export const isMax = (value: number, max: number): boolean => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    return value <= max;
};

/**
 * Check if a string has minimum length
 */
export const hasMinLength = (value: string | null | undefined, minLength: number): boolean => {
    if (!value) return false;
    return value.trim().length >= minLength;
};

/**
 * Check if a string has maximum length
 */
export const hasMaxLength = (value: string | null | undefined, maxLength: number): boolean => {
    if (!value) return true; // Empty string is valid for max length
    return value.trim().length <= maxLength;
};

/**
 * Check if a string has minimum word count
 */
export const hasMinWords = (value: string | null | undefined, minWords: number): boolean => {
    if (!value) return false;
    const words = value
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);
    return words.length >= minWords;
};

/**
 * Get word count from a string
 */
export const getWordCount = (value: string | null | undefined): number => {
    if (!value) return 0;
    const words = value
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);
    return words.length;
};

/**
 * Check if a string matches a pattern
 */
export const matchesPattern = (value: string | null | undefined, pattern: RegExp): boolean => {
    if (!value) return false;
    return pattern.test(value);
};

/**
 * Check if an email is valid
 */
export const isValidEmail = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
};

/**
 * Check if a phone number is valid (Swiss format)
 */
export const isValidPhoneNumber = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const phonePattern = /^(\+41|0041|0)[1-9]\d{1,2}\s?\d{3}\s?\d{2}\s?\d{2}$/;
    return phonePattern.test(value.replace(/\s+/g, ''));
};

/**
 * Check if an array has minimum length
 */
export const hasMinItems = <T>(array: T[] | null | undefined, minItems: number): boolean => {
    if (!array) return false;
    return array.length >= minItems;
};

/**
 * Check if an array has maximum length
 */
export const hasMaxItems = <T>(array: T[] | null | undefined, maxItems: number): boolean => {
    if (!array) return true;
    return array.length <= maxItems;
};

/**
 * Check if an array has exact length
 */
export const hasExactItems = <T>(array: T[] | null | undefined, exactItems: number): boolean => {
    if (!array) return exactItems === 0;
    return array.length === exactItems;
};

/**
 * Check if all items in an array are filled
 */
export const allItemsFilled = <T>(array: T[] | null | undefined, fieldName?: keyof T): boolean => {
    if (!array || array.length === 0) return false;
    return array.every((item) => {
        if (fieldName) {
            return isFilled(item[fieldName]);
        }
        return isFilled(item);
    });
};

/**
 * Check if any item in array matches condition
 */
export const anyItemMatches = <T>(array: T[] | null | undefined, predicate: (item: T) => boolean): boolean => {
    if (!array || array.length === 0) return false;
    return array.some(predicate);
};

/**
 * Check if all items in array match condition
 */
export const allItemsMatch = <T>(array: T[] | null | undefined, predicate: (item: T) => boolean): boolean => {
    if (!array || array.length === 0) return false;
    return array.every(predicate);
};

/**
 * Sum numeric values in array (supports string numbers)
 */
export const sumArray = <T>(array: T[] | null | undefined, fieldName?: keyof T): number => {
    if (!array) return 0;
    return array.reduce((sum, item) => {
        const value = fieldName ? item[fieldName] : item;
        const num = typeof value === 'string' ? parseFloat(value) : (value as number);
        return sum + (isNaN(num) ? 0 : num);
    }, 0);
};

/**
 * Check if array values sum to a specific total
 */
export const sumEquals = <T>(array: T[] | null | undefined, target: number, fieldName?: keyof T, tolerance: number = 0.001): boolean => {
    const total = sumArray(array, fieldName);
    return Math.abs(total - target) < tolerance;
};

/**
 * Check if array values sum to at least a minimum
 */
export const sumMin = <T>(array: T[] | null | undefined, min: number, fieldName?: keyof T): boolean => {
    const total = sumArray(array, fieldName);
    return total >= min;
};

/**
 * Check if array values sum to at most a maximum
 */
export const sumMax = <T>(array: T[] | null | undefined, max: number, fieldName?: keyof T): boolean => {
    const total = sumArray(array, fieldName);
    return total <= max;
};

/**
 * Check if value is one of allowed values
 */
export const isOneOf = <T>(value: T | null | undefined, allowedValues: T[]): boolean => {
    if (value === null || value === undefined) return false;
    return allowedValues.includes(value);
};

/**
 * Check if value is not one of forbidden values
 */
export const isNotOneOf = <T>(value: T | null | undefined, forbiddenValues: T[]): boolean => {
    if (value === null || value === undefined) return false;
    return !forbiddenValues.includes(value);
};

/**
 * Composite validation: All conditions must pass
 */
export const allPass = (validators: Array<() => boolean>): boolean => {
    return validators.every((validator) => validator());
};

/**
 * Composite validation: At least one condition must pass
 */
export const anyPass = (validators: Array<() => boolean>): boolean => {
    return validators.some((validator) => validator());
};

/**
 * Conditional validation: Only validate if condition is true
 */
export const validateIf = (condition: boolean, validator: () => boolean): boolean => {
    if (!condition) return true; // If condition false, validation passes
    return validator();
};

/**
 * Compare two dates
 */
export const isDateAfter = (date: Date | null | undefined, compareDate: Date): boolean => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    return date.getTime() > compareDate.getTime();
};

export const isDateBefore = (date: Date | null | undefined, compareDate: Date): boolean => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    return date.getTime() < compareDate.getTime();
};

export const isDateEqual = (date: Date | null | undefined, compareDate: Date): boolean => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    return date.toDateString() === compareDate.toDateString();
};

/**
 * Check if a value is a valid number (including string numbers)
 */
export const isValidNumber = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return typeof num === 'number' && !isNaN(num);
};

/**
 * Check if a value is an integer
 */
export const isInteger = (value: any): boolean => {
    if (!isValidNumber(value)) return false;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return Number.isInteger(num);
};

/**
 * Check if a value is positive
 */
export const isPositive = (value: number): boolean => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    return value > 0;
};

/**
 * Check if a value is negative
 */
export const isNegative = (value: number): boolean => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    return value < 0;
};

/**
 * Check if a value is zero or positive
 */
export const isNonNegative = (value: number): boolean => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    return value >= 0;
};

/**
 * =============================================================================
 * ZOD CUSTOM REFINEMENTS AND SCHEMA BUILDERS
 * =============================================================================
 */

/**
 * Zod refinement: Check if date is not in the past
 */
export const zodDateNotPast = () => {
    return z.date().refine((date) => isDateNotPast(date), {
        message: 'Datum darf nicht in der Vergangenheit liegen'
    });
};

/**
 * Zod refinement: Check if date is not in the future (today or past)
 */
export const zodDateNotFuture = (fieldName: string = 'Datum') => {
    return z.date().refine((date) => !isDateFuture(date), {
        message: `${fieldName} darf nicht in der Zukunft liegen`
    });
};

/**
 * Zod refinement: Check if date is between two dates
 */
export const zodDateBetween = (startDate: Date, endDate: Date, message?: string) => {
    return z.date().refine((date) => isDateBetween(date, startDate, endDate), {
        message: message || `Datum muss zwischen ${startDate.toLocaleDateString('de-CH')} und ${endDate.toLocaleDateString('de-CH')} liegen`
    });
};

/**
 * Zod refinement: Check minimum word count
 */
export const zodMinWords = (minWords: number, message?: string) => {
    return z.string().refine((value) => hasMinWords(value, minWords), {
        message: message || `Mindestens ${minWords} Wörter erforderlich`
    });
};

/**
 * Zod refinement: Date is after another date
 */
export const zodDateAfter = (compareDate: Date, fieldName: string = 'Datum') => {
    return z.date().refine((date) => isDateAfter(date, compareDate), {
        message: `${fieldName} muss nach ${compareDate.toLocaleDateString('de-CH')} liegen`
    });
};

/**
 * Zod refinement: Date is before another date
 */
export const zodDateBefore = (compareDate: Date, fieldName: string = 'Datum') => {
    return z.date().refine((date) => isDateBefore(date, compareDate), {
        message: `${fieldName} muss vor ${compareDate.toLocaleDateString('de-CH')} liegen`
    });
};

/**
 * =============================================================================
 * ZOD SCHEMA BUILDERS
 * =============================================================================
 */

/**
 * Create a required string schema with trimming and German error messages
 */
export const requiredString = (fieldName: string = 'Feld') => {
    return z
        .string({
            message: `${fieldName} ist erforderlich`
        })
        .trim()
        .min(1, `${fieldName} ist erforderlich`);
};

/**
 * Create an optional string schema with trimming
 */
export const optionalString = () => {
    return z.string().trim().optional().nullable();
};

/**
 * Create a required date schema with German error messages
 */
export const requiredDate = (fieldName: string = 'Datum') => {
    return z.date({
        message: `${fieldName} ist erforderlich`
    });
};

/**
 * Create an optional date schema
 */
export const optionalDate = () => {
    return z.date().optional().nullable();
};

/**
 * Create a required number schema with German error messages
 */
export const requiredNumber = (fieldName: string = 'Zahl') => {
    return z.number({
        message: `${fieldName} ist erforderlich`
    });
};

/**
 * Create an optional number schema
 */
export const optionalNumber = () => {
    return z.number().optional().nullable();
};

/**
 * Create a percentage number schema (0-100) with German error messages
 */
export const percentage = (fieldName: string = 'Prozentsatz') => {
    return z
        .number({
            message: `${fieldName} ist erforderlich`
        })
        .min(0, `${fieldName} muss mindestens 0 sein`)
        .max(100, `${fieldName} darf höchstens 100 sein`);
};

/**
 * Create a positive integer schema with German error messages
 */
export const positiveInteger = (fieldName: string = 'Zahl') => {
    return z
        .number({
            message: `${fieldName} ist erforderlich`
        })
        .int(`${fieldName} muss eine Ganzzahl sein`)
        .positive(`${fieldName} muss positiv sein`);
};

/**
 * Create a non-negative number schema
 */
export const nonNegativeNumber = (fieldName: string = 'Zahl') => {
    return z
        .number({
            message: `${fieldName} ist erforderlich`
        })
        .nonnegative(`${fieldName} darf nicht negativ sein`);
};

/**
 * Create an email schema with German error messages
 */
export const email = (fieldName: string = 'E-Mail') => {
    return z
        .string({
            message: `${fieldName} ist erforderlich`
        })
        .email(`${fieldName} muss eine gültige E-Mail-Adresse sein`);
};

/**
 * Create a Swiss phone number schema
 */
export const swissPhoneNumber = (fieldName: string = 'Telefonnummer') => {
    return z
        .string({
            message: `${fieldName} ist erforderlich`
        })
        .refine((value) => isValidPhoneNumber(value), {
            message: `${fieldName} muss eine gültige Schweizer Telefonnummer sein`
        });
};

/**
 * Create an array schema with minimum items validation
 */
export const requiredArray = <T extends z.ZodTypeAny>(itemSchema: T, minItems: number = 1, fieldName: string = 'Liste') => {
    return z
        .array(itemSchema, {
            message: `${fieldName} ist erforderlich`
        })
        .min(minItems, `${fieldName} muss mindestens ${minItems} ${minItems === 1 ? 'Element' : 'Elemente'} enthalten`);
};

/**
 * Create an enum schema with German error messages
 */
export const requiredEnum = <T extends [string, ...string[]]>(values: T, fieldName: string = 'Auswahl') => {
    return z.enum(values, {
        message: `${fieldName} ist erforderlich`
    });
};

/**
 * =============================================================================
 * ZOD CUSTOM VALIDATORS FOR CROSS-FIELD VALIDATION
 * =============================================================================
 */

/**
 * Validate that end date is after start date
 */
export const validateDateRange = <T extends { startDate: Date | null; endDate: Date | null }>(data: T, startField: string = 'startDate', endField: string = 'endDate', startLabel: string = 'Startdatum', endLabel: string = 'Enddatum') => {
    if (!data.startDate || !data.endDate) return true;
    return isDateAfter(data.endDate, data.startDate);
};

/**
 * Validate that array sum equals target
 */
export const validateArraySum = <T>(array: T[] | null | undefined, target: number, fieldName?: keyof T, tolerance: number = 0.001): boolean => {
    return sumEquals(array, target, fieldName, tolerance);
};
