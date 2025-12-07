export interface Aufgabe {
    id: number;
    created: string;
    updated: string;
    updatedby: string;
    excelfile: string;
    status: string;
    row: number;
    partnernr: string;
    error: string;
    message: string;
    request: string;
    [key: string]: unknown;
}
