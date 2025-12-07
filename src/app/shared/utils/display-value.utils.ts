import { TranslateService } from '@ngx-translate/core';

/**
 * Utility functions for converting model values to user-friendly display values
 * These functions handle null/undefined cases and provide localized text
 */

/**
 * Converts boolean audit status to localized display text
 * @param audit - Boolean audit status or null/undefined
 * @param translateService - Translation service instance
 * @returns Localized text ('Ja', 'Nein', or '-')
 */
export function getAuditDisplayValue(audit: boolean | null | undefined, translateService: TranslateService): string {
    if (audit === null || audit === undefined) {
        return '-';
    }

    const translationKey = audit ? 'common.status.yes' : 'common.status.no';
    return translateService.instant(translationKey);
}

/**
 * Converts boolean SU status to localized display text
 * SU Status indicates whether the partner's status is clear or unclear
 * @param sustatus - Boolean SU status or null/undefined
 * @param translateService - Translation service instance
 * @returns Localized text ('Klar', 'Unklar', or '-')
 */
export function getSuStatusDisplayValue(sustatus: boolean | null | undefined, translateService: TranslateService): string {
    if (sustatus === null || sustatus === undefined) {
        return 'Unklar';
    }

    const translationKey = sustatus ? 'common.partner.suStatusClear' : 'common.partner.suStatusUnclear';
    return translateService.instant(translationKey);
}

/**
 * Formats a person's full name (last name, first name)
 * @param name - Last name
 * @param vorname - First name (optional)
 * @returns Formatted name string
 */
export function formatPersonName(name: string | null | undefined, vorname?: string | null | undefined): string {
    if (!name) {
        return '';
    }

    if (vorname) {
        return `${name}, ${vorname}`;
    }

    return name;
}

/**
 * Formats a full address line
 * @param strasse - Street name
 * @param hausnr - House number (optional)
 * @returns Formatted address string
 */
export function formatAddress(strasse?: string | null, hausnr?: string | null): string {
    if (!strasse) {
        return '-';
    }

    if (hausnr) {
        return `${strasse} ${hausnr}`;
    }

    return strasse;
}

/**
 * Formats PLZ and Ort (postal code and city)
 * @param plz - Postal code
 * @param ort - City name
 * @returns Formatted location string
 */
export function formatLocation(plz?: string | null, ort?: string | null): string {
    if (!plz && !ort) {
        return '-';
    }

    if (plz && ort) {
        return `${plz} ${ort}`;
    }

    return plz || ort || '-';
}
