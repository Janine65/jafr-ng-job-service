/**
 * Interface for a Frage
 */
export interface Frage {
    id: number; // Number like 6
    created: string; // Date string like "2023-11-13T10:49:26"
    updated: string; // Date string like "2023-11-13T10:49:26"
    boid: string; // Boid like 5675
    kurzbez: string; // String like "AntrF" (Antragsfragen)
    bezeichnungdt: string; // German question
    bezeichnungfr: string; // French question
    bezeichnungit: string; // Italien question
    gueltab: string; // Date string like "1900-01-01"
    gueltbis: string; // Date string like "30000-01-01"
    statefrom: string; // Date string like "1900-01-01"
    stateupto: string; // Date string like "30000-01-01"
    variabletyp: string; // "CodeTyp" or "Text"
    mandatory: boolean; // Boolen that indicates that Frage is mandatory
    sort: string; // Display sorting
    titel_boid: string; // String like "4563"
    titel_bezeichnungdt: string; // German question title like "Frage 1"
    titel_bezeichnungfr: string; // French question title
    titel_bezeichnungit: string; // Italian question title
    updatedby: string; // Visum like "bp2"
    source: string; // String like "Syrius"
    updateable: boolean; // Boolean that indicated, if an answer can be updated after it has been answered
}

/**
 * Interface for an Antwort within a Fragebogen
 */
export interface Antwort {
    id: number; // Id like 1930
    created: string; // Date string like "2025-11-21T11:09:20"
    updated: string; // Date string like "2025-11-21T11:09:20"
    codevalue: string | null; // For CodeTyp questions (e.g., "-10110" = ja, "-10111" = nein)
    textvalue: string | null; // For Text questions
    fragebogen_boid: string; // BOID reference to Fragebogen like "fb20fea6-2b69-4db9-ba5a-34a704de56d1"
    frage_boid: string; // References the boid from FuvFrage
    frage_statefrom: string; // Date string like "1900-01-01"
    updatedby: string; // Visum like "bp2"
}

/**
 * Interface for a Fragebogen
 */
export interface Fragebogen {
    id: number;
    created: string; // Date like "2025-11-21T11:09:20"
    updated: string; // Date like "2025-11-21T11:09:20"
    boid: string; // BOID like "fb20fea6-2b69-4db9-ba5a-34a704de56d1"
    gueltab: string; // Date like "2025-11-01"
    gueltbis: string; // Date like "3000-01-01"
    person_boid: string; // BOID like "2001459664"
    antworten: Antwort[];
    updatedby: string; // Visum like "bp2"
    aufgabe_boid: string | null; // Reference to a VTT Aufgabe (if needed)
    genehmigung_art: string; // Code gruppe "GenehmigungOfferte" for a VTT Aufgabe
    genehmigung_bemerkung: string; // String of VTT Aufgabe
}
