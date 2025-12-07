export interface Mahnung {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    excelfile: string;
    status: string;
    row: number;
    partnernr: string;
    partner_boid: string;
    btcode: string;
    dokbestellid: string;
    error: string;
    message: string;
    request: string;
    [key: string]: unknown;
}
