/**
 * Print parameters for FuvOfferte
 */
export interface PrintOfferteApiRequest {
    vorlage: string; // Template identifier (e.g., "V9554")
    sprache: string; // Language code (e.g., "DE", "FR", "IT")
    art: string; // Offerte type (e.g., "OfferteArtUnv", "OfferteArtVerb")
    antragsfragen: string; // "ohne" or "mit" depending on whether questionnaire is answered
    variante: string; // Selected variante number ("0" for A, "1" for B, "2" for C)
    unterschrift: string; // Signature flag ("0" or "1")
    begleitbrief: string; // Cover letter flag ("0" or "1")
    offerte: any; // The full offerte object from store
}

/**
 * SOAP envelope request for OPUS service
 */
export interface OpusSoapApiRequest {
    payload: string; // Base64 encoded XML payload
    prozessId: string; // Process ID (e.g., "KPM")
}
