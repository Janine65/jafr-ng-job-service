/**
 * Merkmal - Association between Betriebsbeschreibug and Merkmal
 */
export interface Merkmal {
    id: number;
    created: string;
    updated: string;
    prozent: number;
    bb_boid: string;
    merkmal_boid: string;
    merkmal_statefrom: string;
    merkmal_internalname: string;
    updatedby: string;
    merkmal?: any;
}

/**
 * Search parameters for Merkmal service
 */
export interface MerkmalApiRequest {
    boid?: string;
    kurzbez?: string;
    bezeichnung?: string;
    stichdatum?: string;
}

/**
 * Merkmal model representing characteristics/features
 * Used in Tätigkeit step of offerte creation
 */
export interface MerkmalApiResponse {
    id: number;
    created: string;
    updated: string;
    boid: string;
    kurzbez: string;
    bezeichnungdt: string;
    bezeichnungfr: string;
    bezeichnungit: string;
    gueltab: string;
    gueltbis: string;
    statefrom: string;
    stateupto: string;
    klasse: string;
    stufe: number;
    profil_internalname: string;
    internalname: string;
    aktiv: boolean;
    experte: string;
    tarifgruppe: string;
    updatedby: string;
    nettopraemiensatz: number;
}

/**
 * Index structure for fast lookup of Merkmale by kurzbez or boid
 */
export interface MerkmalIndex {
    [key: string]: MerkmalApiResponse;
}
