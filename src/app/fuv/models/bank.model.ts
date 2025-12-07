/**
 * Bank API Response Model
 * Maps to the backend bank entity structure
 */
export interface Bank {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    boid: string;
    gueltab: string;
    gueltbis: string;
    bankengruppe: string;
    clearingnummer: string;
    filial_id: string;
    bc_nummerneu: string | null;
    sic_nummer: string;
    hauptsitz: string;
    bc_art: string;
    sic_teilnahme: string;
    eurosic_teiln: string;
    kurzbezeichnung: string;
    bank_institut: string;
    quartier: string;
    postadresse: string;
    plz: string;
    ort: string;
    telefon: string;
    fax: string | null;
    landcode: string;
    postkonto: string | null;
    swiftadresse: string;
    formatpruefen: string;
    herkunft: string;
    bankschluessel: string;
    syncautomatisch: string;
    bankcode: string | null;
    archivetag: string | null;
    itsjurperson: string | null;
    mdbid: string | null;
    languagetag: string;
}
