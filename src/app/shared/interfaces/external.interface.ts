/**
 * KPM-specific interfaces for external system integrations (CRM, SYRIUS, CRIF, eDossier)
 */

/**
 * Entity that can be opened in CRIF (for Betrieb/Company)
 * Requires UID number for CRIF lookup
 */
export interface CrifBetriebEntity {
    /** UID number of the company (e.g., "CHE-123.456.789") */
    uidnr?: string;
}

/**
 * Entity that can be opened in CRIF (for Person)
 * Contains search parameters for CRIF person lookup
 */
export interface CrifPersonEntity {
    /** Last name (required for meaningful search) */
    name?: string;
    /** First name (optional) */
    vorname?: string;
    /** Street name (optional) */
    strasse?: string;
    /** House number (optional) */
    hausnr?: string;
    /** Postal code (optional) */
    plz?: string;
    /** Birth date (optional) */
    geburtstag?: Date | string;
}

/**
 * Base entity with partner number (for CRM, SYRIUS, eDossier)
 * Most KPM domain entities should implement this interface
 */
export interface PartnerEntity {
    /** Partner number used across all systems */
    partnernr?: string;
}
