import { Betrieb } from './betrieb.model';
import { Person } from './person.model';

/**
 * Vertrag model using API field names directly (snake_case from FuvVertragStruct)
 * Date fields are kept as strings from API, with Date conversions available via enrichFromApi
 */
export interface Vertrag {
    // API fields (snake_case as in FuvVertragStruct) - strings from API
    id?: number;
    created?: string;
    updated?: string;
    updatedby?: string;
    boid?: string;
    vertragsnr?: string;
    gueltab?: string | Date; // API: string, UI: can be Date
    gueltbis?: string | Date; // API: string, UI: can be Date
    ablaufdatum?: string | Date; // API: string, UI: can be Date

    // Reference BOIDs
    betrieb_boid?: string;
    person_boid?: string;

    // Nested objects from API
    produkt?: VertragProdukt[];
    person?: Person;
    betrieb?: Betrieb;

    // Payment information
    iban?: string;
    kontoinhaber?: string;
    zahlungsart?: string;

    // UI-specific fields (kept for backwards compatibility and UI logic)
    vertragNr?: string; // Legacy alias for vertragsnr
    betriebName?: string; // Calculated from betrieb.name1
    gueltigAb?: Date; // UI: gueltab as Date (deprecated, use gueltab as Date)
    gueltigBis?: Date; // UI: gueltbis as Date (deprecated, use gueltbis as Date)
    vertragsbeginn?: Date; // Legacy: same as gueltigAb
    vertragsende?: Date; // Legacy: same as gueltigBis
    betriebsteil?: string; // UI field
    stufe?: string; // UI field: from produkt[0].stufe
    personName?: string; // Calculated from person
    partnernr?: string; // From person or betrieb
    status?: string; // UI calculated field
    betreuer?: string; // UI field
    agentur?: string; // UI field

    [key: string]: unknown;
}

/**
 * Vertrag Produkt model using API field names (FuvProduktStruct)
 * Date fields are kept as strings from API
 */
export interface VertragProdukt {
    id?: number;
    created?: string;
    updated?: string;
    updatedby?: string;
    gueltab?: string | Date; // API: string, UI: can be Date
    gueltbis?: string | Date; // API: string, UI: can be Date
    statefrom?: string | Date; // API: string, UI: can be Date
    stateupto?: string | Date; // API: string, UI: can be Date
    vertrag_boid?: string;
    boid?: string;
    btcode?: string;
    klasse?: string;
    stufe?: number;
    avb?: string;
    stellung_im_betrieb?: string;
    beschaeft_grad?: string;
    ruhender_vertrag?: string;
    taggeld?: string;
    verdienst?: number;
    mind_verdienst?: number;
    vksatz?: number;
    unfversatz?: number;
    teuerungszuschlagsatz?: number;
    nettopraemie?: number;
    bruttopraemiensatz?: number;
    jahrespraemie_ohne_rabatt?: number;
    taggeldaufschubrabatt?: number;
    jahrespraemie_ohne_minimal?: number;
    teuerungszuschlagpraemie?: number;
    verwaltungskostenpraemie?: number;
    jahrespraemie?: number;
    bruttopraemie?: number;
    bt_malus?: number;
}

/**
 * Utilities for handling legacy field mappings and UI enrichment for Vertrag
 * Handles date conversion from API strings to Date objects
 */
export class VertragUtils {
    /**
     * Parse a date string or return Date as-is
     */
    private static parseDateISO(dateValue: string | Date | undefined): Date | undefined {
        if (!dateValue) return undefined;
        if (dateValue instanceof Date) return dateValue;
        return new Date(dateValue);
    }

    /**
     * Format a Date to ISO string for API, or return string as-is
     */
    private static formatDate(dateValue: string | Date | undefined): string | undefined {
        if (!dateValue) return undefined;
        if (typeof dateValue === 'string') return dateValue;
        return dateValue.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    /**
     * Enrich API payloads with UI friendly aliases that the data tables expect
     */
    static enrichFromApi(vertrag: Vertrag): Vertrag {
        const gueltigAbDate = this.parseDateISO(vertrag.gueltab);
        const gueltigBisDate = this.parseDateISO(vertrag.gueltbis);
        const ablaufDatum = this.parseDateISO(vertrag.ablaufdatum);
        const primaryProdukt = vertrag.produkt?.[0];

        return {
            ...vertrag,
            vertragNr: vertrag.vertragNr ?? vertrag.vertragsnr,
            gueltigAb: vertrag.gueltigAb ?? gueltigAbDate,
            gueltigBis: vertrag.gueltigBis ?? gueltigBisDate,
            vertragsbeginn: vertrag.vertragsbeginn ?? gueltigAbDate,
            vertragsende: vertrag.vertragsende ?? gueltigBisDate,
            ablaufdatum: ablaufDatum ?? vertrag.ablaufdatum,
            betriebName: vertrag.betriebName ?? this.buildBetriebName(vertrag.betrieb),
            betriebsteil: vertrag.betriebsteil ?? primaryProdukt?.btcode,
            stufe: vertrag.stufe ?? (primaryProdukt?.stufe !== undefined ? primaryProdukt.stufe.toString() : undefined),
            personName: vertrag.personName ?? this.buildPersonName(vertrag.person),
            partnernr: vertrag.partnernr ?? vertrag.person?.partnernr ?? vertrag.betrieb?.partnernr
        };
    }

    private static buildPersonName(person?: Person | null): string | undefined {
        if (!person) {
            return undefined;
        }

        const parts = [person.name, person.vorname].map((value) => value?.trim()).filter((value): value is string => !!value);
        if (parts.length === 0) {
            return undefined;
        }

        return parts.join(', ');
    }

    private static buildBetriebName(betrieb?: Betrieb | null): string | undefined {
        if (!betrieb) {
            return undefined;
        }

        const combined = this.combineNameParts(betrieb.name1, betrieb.name2);
        if (combined) {
            return combined;
        }

        return betrieb.nl_name1?.trim() || undefined;
    }

    private static combineNameParts(name1?: string | null, name2?: string | null): string {
        const parts = [name1, name2].map((part) => part?.trim()).filter((part): part is string => !!part);
        return parts.join(' ');
    }
}

/**
 * Search criteria for FuvVertrag endpoints
 */
export interface VertragApiRequest {
    boid?: string;
    vertragsnr?: string;
    betrieb_boid?: string;
    person_boid?: string;
    person_partnernr?: string;
    betrieb_partnernr?: string;
    local?: boolean;
}
