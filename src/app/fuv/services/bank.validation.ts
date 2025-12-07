/**
 * Bank Service Validation
 *
 * Validates IBAN formats and bank account details
 */

/**
 * Swiss IBAN format validation
 * Format: CH + 2 check digits + 5 digit bank code + 12 digit account number (21 characters total)
 * Example: CH93 0076 2011 6238 5295 7
 */
const SWISS_IBAN_REGEX = /^CH\d{19}$/;

/**
 * Generic IBAN format validation (any country)
 * Format: 2 letter country code + 2 check digits + up to 30 alphanumeric characters
 */
const GENERIC_IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;

export interface IbanValidationResult {
    success: boolean;
    error?: string;
    isSwiss?: boolean;
    formatted?: string;
}

/**
 * Validate Swiss IBAN format
 *
 * @param iban - IBAN string (with or without spaces)
 * @returns true if valid Swiss IBAN, false otherwise
 */
export function isValidSwissIban(iban: string): boolean {
    if (!iban) return false;
    const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
    return SWISS_IBAN_REGEX.test(cleanIban);
}

/**
 * Validate generic IBAN format (any country)
 *
 * @param iban - IBAN string (with or without spaces)
 * @returns true if valid IBAN format, false otherwise
 */
export function isValidIban(iban: string): boolean {
    if (!iban) return false;
    const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
    return GENERIC_IBAN_REGEX.test(cleanIban);
}

/**
 * Format IBAN with spaces (groups of 4 characters)
 *
 * @param iban - IBAN string (with or without spaces)
 * @returns Formatted IBAN with spaces
 */
export function formatIban(iban: string): string {
    const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
    return cleanIban.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Validate IBAN and return detailed result
 *
 * @param iban - IBAN string (with or without spaces)
 * @returns Validation result with formatted IBAN and additional info
 */
export function validateIban(iban: string): IbanValidationResult {
    if (!iban || iban.trim() === '') {
        return {
            success: false,
            error: 'IBAN ist erforderlich'
        };
    }

    const cleanIban = iban.replace(/\s+/g, '').toUpperCase();

    if (!isValidIban(cleanIban)) {
        return {
            success: false,
            error: 'Ungültiges IBAN-Format. IBAN muss mit 2-Buchstaben-Ländercode beginnen (z.B. CH13 0077 8180 2388 9200)'
        };
    }

    const isSwiss = cleanIban.startsWith('CH') && cleanIban.length === 21;
    const formatted = formatIban(cleanIban);

    return {
        success: true,
        isSwiss,
        formatted
    };
}

/**
 * Extract bank clearing number from Swiss IBAN
 * The clearing number is positions 5-9 (5 digits) after removing spaces
 *
 * @param iban - Swiss IBAN string
 * @returns Bank clearing number or null if not valid Swiss IBAN
 */
export function extractBankClearingNumber(iban: string): string | null {
    if (!isValidSwissIban(iban)) {
        return null;
    }

    const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
    // CH + 2 check digits + 5 bank code digits
    return cleanIban.substring(4, 9);
}
