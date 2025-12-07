/**
 * Models for Antragsfragen Component
 */

export interface AntragFrageDetails {
    antwort?: 'ja' | 'nein';
    details?: string;
    behandlung?: 'ja' | 'nein';
}

export interface AntragsfragenData {
    frage1?: AntragFrageDetails;
    frage2?: AntragFrageDetails;
    frage3?: AntragFrageDetails;
    frage4?: AntragFrageDetails;
    frage5?: AntragFrageDetails;
}

// Local interface for component UI state
export interface Antragsfrage {
    id: string;
    frageText: string;
    antwort: 'ja' | 'nein' | '';
    details: string;
    behandlung?: 'ja' | 'nein' | '';
    aufgenommenAm?: string;
    geaendertAm?: string;
    frage_boid?: string; // Link to backend question
}
