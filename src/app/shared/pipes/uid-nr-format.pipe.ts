import { Pipe, PipeTransform } from '@angular/core';

/**
 * Swiss UID Number (Unternehmens-Identifikationsnummer) Formatting Pipe
 *
 * Formats a Swiss company identification number according to the international standard:
 * Format: CHE-XXX.XXX.XXX
 *
 * Example:
 * - Input: "CHE480430214" or "CHE-480430214"
 * - Output: "CHE-480.430.214"
 *
 * The Swiss UID consists of:
 * - CHE: Country code for Switzerland (Confoederatio Helvetica Enterprise)
 * - 9 digits: Company identification number (last digit is check digit)
 * - Formatted with dots after every 3 digits
 */
@Pipe({
    name: 'uidNrFormat',
    standalone: true
})
export class UidNrFormatPipe implements PipeTransform {
    transform(value: string | null | undefined): string {
        if (!value) {
            return '-';
        }

        // Remove all non-alphanumeric characters
        const cleanValue = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();

        // Validate format (must start with CHE and have 9 digits)
        if (!cleanValue.match(/^CHE\d{9}$/)) {
            // If not valid format, return original value
            return value;
        }

        // Extract country code and digits
        const countryCode = cleanValue.substring(0, 3); // CHE
        const digits = cleanValue.substring(3); // 9 digits

        // Format: CHE-XXX.XXX.XXX
        const formatted = `${countryCode}-${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}`;

        return formatted;
    }
}
