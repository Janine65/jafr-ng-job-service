import { Vertriebspartner } from './vertriebspartner.model';

/**
 * FuvAnspruchsberechtigte
 */
export interface Anspruchsberechtigte {
    id: number;
    created: string;
    updated: string;
    boid: string;
    person_boid: string;
    offerte_boid: string;
    nachname: string;
    vorname: string;
    geburtsdatum: string;
    strasse: string;
    hausnummer: string;
    plz: string;
    ort: string;
    land: string;
    email: string;
    telefon: string;
    updateby: string;
}

/**
 * FUV Anspruchsberechtigte with Vertriebspartner
 */
export interface AnspruchsberechtigteVP {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    itsvpartner: string;
    itskvprodanon: string | null;
    offerteid: number;
    vpartnerfunktion: string;
    vertriebspartner: Vertriebspartner;
}

/**
 * Search parameters for FuvAnspruchsberechtigte
 */
export interface AnspruchsberechtigteApiRequest {
    boid?: string;
    person_boid?: string;
    offerte_boid?: string;
    nachname?: string;
    vorname?: string;
    stichdatum?: string;
}

export type AnspruchsberechtigteApiResponse = Anspruchsberechtigte[];

/**
 * Request payload for saving FuvAnspruchsberechtigte
 */
export interface SaveAnspruchsberechtigteRequest {
    offerteid: number;
}
