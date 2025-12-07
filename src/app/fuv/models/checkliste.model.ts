/**
 * Checkliste model
 */
export interface Checkliste {
    id?: number;
    created?: string;
    updated?: string;
    updatedby?: string;
    gueltig_ab?: string;
    alter_versicherter?: number;
    anzahl_unfaelle?: boolean;
    laufende_unfaelle?: boolean;
    bonitaet_syrius?: string;
    bonitaet_crif?: string;
    bonitaet_crif_bemerkung?: string;
    audit?: boolean;
    offerte_id?: number;
    vertrag_boid?: string;
    valid?: boolean;
    dokumentnr?: string;
    vttanfrage?: boolean;
    sprache?: string;
    aufgabe_boid?: string;
    genehmigung_art?: string;
    genehmigung_bemerkung?: string;
    bt_malus?: number;
}

/**
 * Search parameters for Checkliste
 */
export interface ChecklisteApiRequest {
    id?: number;
    offerte_id?: number;
    vertrag_boid?: string;
}

/**
 * Response from Checkliste API endpoints
 */
export type ChecklisteApiResponse = Checkliste[];
