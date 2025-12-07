// Tätigkeit (Activity) - Step 2
export interface TaetigkeitItem {
    taetigkeit: string; // merkmal_boid
    prozent: string;

    // Merkmal metadata (needed for BB calculation)
    merkmal_id?: number;
    merkmal_internalname?: string;
    merkmal_statefrom?: string;
}

/**
 * Taetigkeit data for UI - uses Date objects for calendar widgets
 */
export interface TaetigkeitData {
    vertragGueltigAb?: Date;
    avb?: string;
    vertragsdauer?: string;
    vertragGueltigBis?: Date;
    verkaufskanal?: string;
    taetigkeitsbeschreibung?: string;
    stellungImBetrieb?: string;
    arbeitspensum?: string;
    taetigkeiten?: TaetigkeitItem[];
    selbststaendigSeit?: Date;
    anzahlMitarbeiter?: string;
    stellenprozente?: string;
}

/**
 * Taetigkeit data for API/Storage - uses ISO string dates (YYYY-MM-DD)
 */
export interface TaetigkeitDataApi {
    vertragGueltigAb?: string;
    avb?: string;
    vertragsdauer?: string;
    vertragGueltigBis?: string;
    verkaufskanal?: string;
    taetigkeitsbeschreibung?: string;
    stellungImBetrieb?: string;
    arbeitspensum?: string;
    taetigkeiten?: TaetigkeitItem[];
    selbststaendigSeit?: string;
    anzahlMitarbeiter?: string;
    stellenprozente?: string;
}
