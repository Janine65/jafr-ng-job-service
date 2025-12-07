import { Pipe, PipeTransform } from '@angular/core';

/**
 * Swiss Social Security Number (SV-Nr./AHV-Nr.) Formatting Pipe
 *
 * Formats a Swiss social security number according to the official standard:
 * Format: 756.XXXX.XXXX.XX
 *
 * Example:
 * - Input: "7568048680071"
 * - Output: "756.8048.6800.71"
 *
 * The Swiss SV number consists of 13 digits:
 * - First 3 digits: Country code (756 for Switzerland)
 * - Next 9 digits: Sequential number
 * - Last digit: Check digit
 */
@Pipe({
    name: 'svNrFormat',
    standalone: true
})
export class SvNrFormatPipe implements PipeTransform {
    transform(value: string | null | undefined): string {
        if (!value) {
            return '-';
        }

        // Remove all non-digit characters
        const cleanValue = value.replace(/\D/g, '');

        // Validate length (must be 13 digits)
        if (cleanValue.length !== 13) {
            // If not valid length, return original value
            return value;
        }

        // Format: 756.XXXX.XXXX.XX
        const formatted = `${cleanValue.substring(0, 3)}.${cleanValue.substring(3, 7)}.${cleanValue.substring(7, 11)}.${cleanValue.substring(11, 13)}`;

        return formatted;
    }
}
