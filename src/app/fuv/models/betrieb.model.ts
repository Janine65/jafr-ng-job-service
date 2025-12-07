import type { CrifBetriebEntity, PartnerEntity } from '../../shared/interfaces/external.interface';

/**
 * Betrieb model that matches the API's FuvBetriebStruct
 * Implements CrifBetriebEntity to enable CRIF integration via ExternalService
 * Implements PartnerEntity to enable CRM/SYRIUS/eDossier integration
 */
export interface Betrieb {
    // Primary identifiers
    id?: number; // Id like 267
    boid?: string; // BOID like "0220688000" (same as partnernr)
    partnernr?: string; // Boid like "0220688000"

    // Company information
    name1?: string; // String like "Schreiner AG"
    name2?: string; // String like "in Liquidation", may be empty
    uidnr?: string; // String like "CHE103203646"

    // Address information
    strasse?: string;
    hausnr?: string;
    plz?: string;
    ort?: string;

    // Validity period
    gueltab?: string; // Date string like "1993-07-27"
    gueltbis?: string; // Date string like "3000-01-01"

    // Status and metadata
    bonitaet?: string; // Code gruppe "BONITAET"
    bonitaet_text?: string;
    audit?: boolean;
    audit_text?: string;
    adminoe?: string; // String like "A06"
    pgen?: string; // Visum like "bp2"
    suvanr?: string; // String like "1-02206-88000"

    // National language name
    nl_name1?: string;

    // Audit fields
    created?: string; // Date string like "2025-11-21T17:01:28"
    updated?: string; // Date string like  "2025-11-21T17:01:28"
    updatedby?: string; // Visum like "bp2"

    // Index signature for dynamic property access
    [key: string]: unknown;
}

/**
 * Search criteria for Betrieb
 */
export interface BetriebApiRequest {
    partnernr?: string;
    uidnr?: string;
    suvanr?: string;
    boid?: string;
    name?: string;
    local?: boolean;
}
