/**
 * Parameter attribute for Syrius task
 */
export interface ParamAttr {
    paramattr_def: string;
    wert: string;
}

/**
 * Request structure for creating a Syrius task (Aufgabe)
 */
export interface SyriusAufgabeRequest {
    workflow_def: string;
    partnernr: string;
    partner_id: string;
    objekt_id: string;
    objekt_meta_id: string;
    ausfuehrender: string;
    beschreibung: string;
    kategorie: string;
    prioritaet: string;
    postkorb_def: string;
    titel: string;
    kommentar_text: string;
    faelligkeits_datum: string;
    status: string;
    param_attr_list: ParamAttr[];
}

/**
 * Response structure for creating a Syrius task
 * TODO: Update this interface when actual response structure is known
 */
export interface SyriusAufgabeResponse {
    // TODO: Define response properties based on actual API response
    success?: boolean;
    message?: string;
    aufgabe_id?: string;
    [key: string]: any; // Allow additional properties for now
}

/**
 * Request structure for adding a comment to a Syrius task
 * TODO: Define actual structure when known
 */
export interface AddKommentarSyriusAufgabeRequest {
    // TODO: Define request properties based on actual API requirements
    aufgabe_id?: string;
    kommentar?: string;
    [key: string]: any;
}

/**
 * Response structure for adding a comment to a Syrius task
 * TODO: Update this interface when actual response structure is known
 */
export interface AddKommentarSyriusAufgabeResponse {
    // TODO: Define response properties based on actual API response
    success?: boolean;
    message?: string;
    [key: string]: any;
}

/**
 * Individual task item from the aufgabe details response
 */
export interface AufgabeDetailsItem {
    nr: string;
    titel: string | null;
    text: string;
    status: string;
    finishdate: string;
    oebezeichnung: string;
    userbezeichnung: string;
}

/**
 * Response structure for getting task details
 * API returns an array of task items
 */
export type AufgabeDetails = AufgabeDetailsItem[];

/**
 * Response structure for getting user info
 * TODO: Update this interface when actual response structure is known
 */
export interface UserInfo {
    // TODO: Define response properties based on actual API response
    user_id?: string;
    username?: string;
    email?: string;
    [key: string]: any;
}
