/**
 * FuvVertriebspartner (Sales Partner) information
 */
export interface Vertriebspartner {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    boid: string;
    gueltab: string;
    gueltbis: string;
    vertriebspartnr: string;
    itsvtriebppartner: string;
    vp_partnernr: string;
    vp_name: string;
    vp_vorname: string | null;
    vp_plz: string;
    vp_ort: string;
    vp_suvanr: string;
    vp_visum: string | null;
    itsvtriebpvpdef: string;
    vermittlertyp: string;
    vermvertragstatus: string;
    searchstring: string;
}

/**
 * Search parameters for FuvVertriebspartner
 */
export interface VertriebspartnerSearchParams {
    stichdatum?: string;
    vertriebspartnr?: string;
    vp_partnernr?: string;
    vp_name?: string;
    vp_suvanr?: string;
    itsvtriebpvpdef?: string;
}
