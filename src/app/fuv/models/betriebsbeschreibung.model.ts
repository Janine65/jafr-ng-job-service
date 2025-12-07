import { Merkmal } from './merkmal.model';
import { TeZu } from './tezu.model';

/**
 * Betriebsbeschreibung including TeZu and Merkmale
 */
export interface Betriebsbeschreibung {
    id: number;
    created: string;
    updated: string;
    boid: string;
    beschreibung: string | null;
    taetigkeit: string;
    gueltab: string;
    gueltbis: string;
    aufgenommenam: string;
    eingangskanal: string | null;
    anzahlma: string;
    stellenprozente?: number;
    basisstufe: number | null;
    agenturkompetenz: string | null;
    betrieb_boid: string | null;
    person_boid: string | null;
    updateby: string;
    vksatz: number | null;
    uvksatz: number | null;
    bruttopraemiensatz: number | null;
    nettopraemiensatz: number | null;
    bb2merkmal: Merkmal[];
    bbtezu: TeZu[];
}

/**
 * Search parameters for BB
 */
export interface BetriebsbeschreibungApiRequest {
    boid?: string;
    betrieb_boid?: string;
    person_boid?: string;
    vertrag_boid?: string;
    stichdatum?: string;
    gueltab?: string;
    gueltbis?: string;
}

/**
 * Response from calculateFuvBB endpoint
 * Returns an array of FuvBB with calculated values
 */
export type CalculateBetriebsbeschreibungApiResponse = Betriebsbeschreibung[];
