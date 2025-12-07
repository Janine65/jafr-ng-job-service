/**
 * Contact Person (for Nachbearbeitung)
 */
export interface ContactPerson {
    id: string;
    boid: string;
    name: string;
    partnernr: string;
    suvanr: string;
    plz: string;
    ort: string;
    vpartnerfunktion: string;
    searchstring?: string;
}

/**
 * Reject Reason (for Nachbearbeitung)
 */
export interface RejectReason {
    code: string;
    label: string;
    internal_name: string;
    sorter: number;
}

/**
 * Nachbearbeitung (Post-processing) - Step 6
 */
export interface NachbearbeitungData {
    kundengeschenkAbgegeben?: boolean;
    geschenkbegriffArtikel?: string;
    internerVermittlerVerkaeufer?: ContactPerson | null;
    internerVermittlerBeteiligter?: ContactPerson | null;
    externerVermittler?: ContactPerson | null;
    ablehnungsgrund?: RejectReason | null;
}
