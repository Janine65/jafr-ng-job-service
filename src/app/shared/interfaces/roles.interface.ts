/**
 * KPM-specific API response interface for /api/searchBerechtigung endpoint.
 * This interface represents the raw API response structure before processing.
 */
export interface BerechtigungItem {
    id: number;
    applikation: string; // Maps to internal app role
    rolle: string; // Keycloak role(s) - can contain 'or' separated roles
    funktion: string; // CRUD operations
    bereich: string; // Specific area/module
    aktiv: boolean;
    created: string;
    updated: string;
    updatedby: string;
}
