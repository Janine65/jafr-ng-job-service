/**
 * Search parameters for CRIF person lookup
 */
export interface CrifSearchPersonApiRequest {
    firstname?: string;
    lastname?: string;
    date_of_birth?: string;
    country?: string;
    city?: string;
    house_number?: string;
    street?: string;
    zipcode?: string;
}

/**
 * Search parameters for CRIF company lookup
 */
export interface CrifSearchBetriebApiRequest {
    company?: string;
    date_of_birth?: string;
    country?: string;
    city?: string;
    house_number?: string;
    street?: string;
    zipcode?: string;
}

/**
 * CRIF search result
 */
export interface CrifSearchApiResponse {
    report_id?: number;
    bonitaet?: string; // Codes: CRIF_HOCH, CRIF_MITTEL, CRIF_TIEF
    bonitaet_kommentar?: string; // Comment/description about the credit rating
    bonitaet_score?: number | null; // Numeric credit score (if available)
    audit_flag?: boolean; // Flag indicating if audit is required
    web_url?: string | null; // URL for web report (available after ~1 minute)
    pdf_url?: string | null; // URL for PDF report (available after ~1 minute)
    [key: string]: any;
}
