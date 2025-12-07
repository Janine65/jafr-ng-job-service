import { Betriebsbeschreibung } from './betriebsbeschreibung.model';
import { Merkmal } from './merkmal.model';
import { TeZu } from './tezu.model';

// Legacy alias file kept for compatibility with existing components/services.
export type BB2Merkmal = Merkmal;
export type BBTeZu = TeZu;

// Full Betriebsbeschreibung entity (alias to the canonical model)
export type BB = Betriebsbeschreibung;

export interface BBSearchParams {
    boid?: string;
    betrieb_boid?: string;
    person_boid?: string;
    vertrag_boid?: string;
    stichdatum?: string;
    gueltab?: string;
    gueltbis?: string;
}

export type CalculateBBRequest = Betriebsbeschreibung & {
    bb2merkmal: Array<Partial<BB2Merkmal> & { prozent: number; merkmal_boid: string }>;
    bbtezu?: BBTeZu[];
};

export type CalculateBBResponse = BB[];
