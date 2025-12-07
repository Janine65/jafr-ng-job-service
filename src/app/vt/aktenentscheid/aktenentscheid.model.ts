// Interface for Aktenentscheid data
export interface Aktenentscheid {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    excelfile: string;
    status: string;
    row: number;
    partnernr: string;
    btcode: string;
    experte: string;
    bb_datum: string; // New field: BB Datum
    aufgabe_boid: string;
    error: string;
    message: string;
    request: string;
    [key: string]: unknown; // Allow additional properties
}
