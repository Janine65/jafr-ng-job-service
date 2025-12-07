/**
 * Interface for Regress data from /api/ielisten/getopzahlungenregress endpoint
 * Represents payment/regress information for damage claims
 */
export interface Regress {
    metabo: string;
    boid: string;
    schadennr: string;
    gvorfall: string;
    paymentid: string;
    meldungsid: string;
    rechnungsnr: string;
    erstelldatum: string;
    urbetrag: number;
    partnernr: string;
    name: string;
    zahlernr: string;
    zahlungsdatum: string;
    [key: string]: unknown;
}
