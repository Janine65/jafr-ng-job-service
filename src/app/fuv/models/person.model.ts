import type { CrifPersonEntity, PartnerEntity } from '../../shared/interfaces/external.interface';

/**
 * Person model that matches the API's FuvPersonStruct
 */
export interface Person extends CrifPersonEntity, PartnerEntity {
    // Primary identifiers
    id?: number;
    boid?: string;
    partnernr?: string;

    // Personal information
    name?: string;
    vorname?: string;
    geburtstag?: Date;
    geschlecht?: string;
    svnr?: string;

    // Address information
    strasse?: string;
    hausnr?: string;
    plz?: string;
    ort?: string;

    // Contact information
    telefon?: string;
    mobiltelefon?: string;
    email?: string;

    // Additional information
    zivilstand?: string;
    todesdatum?: string;
    unfaelle?: string;

    // Status and metadata
    audit?: boolean;
    sustatus?: string;
    sprache?: string;

    // National language names
    nl_name?: string;
    nl_vorname?: string;

    // Audit fields
    created?: string;
    updated?: string;
    updatedby?: string;

    // Index signature for dynamic property access
    [key: string]: unknown;
}

/**
 * Search criteria for Person
 */
export interface PersonApiRequest {
    svnr?: string;
    partnernr?: string;
    name?: string;
    vorname?: string;
    geburtstag?: string;
    boid?: string;
    local?: boolean;
}

export type PersonApiResponse = Person[];
