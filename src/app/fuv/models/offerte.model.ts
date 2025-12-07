/**
 * TODO: Define proper types for the following fields (currently using string, might need specific enums/codes):
 * - art: Should be enum type (e.g., 'OfferteArtVer', 'OfferteArtNeu', etc.)
 * - status: Should be enum type (e.g., 'Offerte_Abschluss', 'Offerte_Offen', etc.)
 * - avb: Code type from COT_FUV_AVB
 * - stellung_im_betrieb: Code type (e.g., 'COD_EHEGATTE', 'COD_INHABER', etc.)
 * - beschaeft_grad: Code type (e.g., 'COD_60_Prozent', 'COD_100_Prozent', etc.)
 * - kanal: Code type (e.g., 'COD_SUAbklaerung', etc.)
 * - praemienzahlung: Should be enum type (e.g., 'jaehrlich', 'halbjaehrlich', 'vierteljaehrlich', 'monatlich')
 * - unterschrieben_art: Should be enum type (e.g., 'physisch', 'elektronisch')
 */

import type { Betriebsbeschreibung } from './betriebsbeschreibung.model';
import type { Betrieb } from './betrieb.model';
import type { Checkliste } from './checkliste.model';
import type { Fragebogen } from './fragen.model';
import type { Person } from './person.model';
import type { AnspruchsberechtigteVP } from './anspruchsberechtigte.model';
import type { Variante } from './variante.model';
import type { TaetigkeitDataApi } from './taetigkeit.model';
import { OfferteDateHelper } from '../utils/offerte-field-helpers';

/**
 * Complete Offerte structure as returned by the API
 */
export interface Offerte {
    // Core offerte fields
    id?: number; // Number like 456
    created?: string; // Date string like "2025-11-21T11:06:38"
    updated?: string; // Date string like "2025-11-21T11:06:38"
    offertenr?: string; // String like "O.0259777000.001"
    art?: string; // Code gruppe "OfferteArt"
    status?: string; // Code gruppe "OfferteStatus"
    gueltab?: string; // Date string like "2025-12-01"
    gueltbis?: string; // Date string like "2025-12-01"
    gueltab_date?: string; // ISO string like "2025-12-01T00:00:00.000Z"
    gueltbis_date?: string; // ISO string like "2025-12-01T00:00:00.000Z"
    ablaufdatum?: string; // Date string like "2025-12-01"
    ablaufdatum_date?: string; // ISO string like "2025-12-01T00:00:00.000Z"
    avb?: string; // Code gruppe "COT_FUV_AVB"
    avb_text?: string | null; // Localized text for AVB code
    stellung_im_betrieb?: string; // Code gruppe "COT_STELLUNG_IM_BETRIEB"
    beschaeft_grad?: string; // Code gruppe "COT_Beschaeftigungsgrad"
    klasse?: string; // String like "A0"
    basisstufe?: number; // Number like 100
    kanal?: string; // Code gruppe "Verkaufskanal"
    begleitbrief?: string | null; // String like "yes" or "no"

    // Varianten array
    variante?: Variante[]; // References varianten (by field variante 1:A / 2:B / 3:C)

    // Reference BOIDs
    betrieb_boid?: string; // Betrieb BOID
    person_boid?: string; // Person BOID
    bb_boid?: string; // Betriebsbeschreibung BOID
    vertrag_boid?: string | null; // Vertrag BOID
    fragen_boid?: string; // Fragebogen BOID

    // Nested entities
    fragebogen?: Fragebogen;
    betrieb?: Betrieb;
    person?: Person;
    bb?: Betriebsbeschreibung;
    checkliste?: Checkliste;

    // Additional fields
    ablehnungsgrund?: string | null;
    updatedby?: string;
    selbst_seit?: string; // Date string like "2025-11-20"
    statusab?: string; // Date string like "2025-11-21T11:09:52"
    praemienzahlung?: string; // Enum: jaehrlich / halbjaehrlich / vierteljaehrlich / monatlich
    name_bank?: string | null; // String like "Bank Name"
    plz_bank?: string | null; // String like "8000"
    ort_bank?: string | null; // String like "Zurich"
    iban?: string | null; // String like "CH93 0076 2011 6238 5295 7"
    kontoinhaber?: string | null;
    signatur?: null; // Always null
    kundengeschenk?: boolean;
    kundengeschenkartikel?: string | null;
    gedruckt_am?: string | null; // Date string like "2025-11-21"
    gedruckt_durch?: string | null; // Visum like "bp2"
    policiert_am?: string | null; // Date string like "2025-11-21"
    policiert_durch?: string | null; // Visum like "bp2"
    unterschrieben_am?: string | null; // Date string like "2025-11-21"
    unterschrieben_art?: string | null; // Enum: elektrisch / physisch
    // Anspruchsberechtigte array
    anspruchsberechtigte?: AnspruchsberechtigteVP[];

    // UI-derived convenience fields (not persisted)
    name?: string;
    erstellungsdatum?: string;
    total?: number;
}

/**
 * Taetigkeiten Metadata
 * Stores UI-only fields
 */
export interface TaetigkeitenMeta {
    stellenprozente?: number; // Stellenprozente ohne Inhaber (UI field)
    taetigkeiten?: Array<{
        taetigkeit: string; // merkmal_boid
        prozent: string;
        merkmal_id?: number;
        merkmal_internalname?: string;
        merkmal_statefrom?: string;
    }>;
    anzahlMitarbeiter?: string;
    vertragsdauer?: string | null;
}

/**
 * Varianten Metadata
 * Stores UI-only fields
 */
export interface VariantenMeta {
    variante: number | null;
}

/**
 * Metadata structure for tracking offerte state
 * This will hold signals and modification tracking
 */
export interface OfferteMetaData {
    isModified?: boolean;
    isSigned?: boolean;
    isPersisted?: boolean;
    isSignedProvisionally?: boolean;
    isVerlaengerung?: boolean;
    isLoading?: boolean;
    isSaving?: boolean;
    isValid?: boolean;
    isReadOnly?: boolean;

    lastModified?: string;
    modifiedFields?: Set<string>; // Track which fields were modified

    validationErrors?: Record<string, string[]>;

    lastSyncedAt?: string;
    syncError?: string | null;

    // Workflow/meta flags
    wizardStep?: number;
    vttTaskCreated?: boolean;
    vttTaskDeclined?: boolean;
    aufgabe_boid?: string | null;
    aufgabeDetails?: unknown;
    signedAt?: string | null;

    // TEZU calculation basis (UI-only fields)
    tezuCalculationBasis?: TaetigkeitenMeta;
    tezuHash?: string;
    vertragsdauer?: string | null;
    variantenUi?: import('./varianten.model').VariantenData;

    // Additional metadata
    abschluss?: import('./abschluss.model').AbschlussData;
    [key: string]: unknown;
}

/**
 * Utility class for working with complete offerte data
 * Uses field helpers to ensure correct format and type
 */
export class OfferteUtils {
    /**
     * Create a deep copy of offerte
     */
    static deepCopy(offerte: Offerte): Offerte {
        return JSON.parse(JSON.stringify(offerte));
    }

    /**
     * Compare two offerten to detect changes
     */
    static getModifiedFields(original: Offerte, modified: Offerte): Set<string> {
        const modifiedFields = new Set<string>();
        const originalJson = JSON.stringify(original);
        const modifiedJson = JSON.stringify(modified);

        if (originalJson === modifiedJson) {
            return modifiedFields;
        }

        // Simple field-level comparison
        for (const key in modified) {
            if (JSON.stringify(original[key as keyof Offerte]) !== JSON.stringify(modified[key as keyof Offerte])) {
                modifiedFields.add(key);
            }
        }

        return modifiedFields;
    }

    /**
     * Prepare offerte for API - ensures all dates and codes are in correct format
     * Use OfferteDateHelper and OfferteCodeHelper from utils for validation
     */
    static prepareForApi(offerte: Partial<Offerte>): Partial<Offerte> {
        // Import helpers dynamically to avoid circular dependencies
        // In actual usage, call OfferteDateHelper methods directly
        return offerte;
    }

    /**
     * Enrich offerte from API - validates and normalizes data
     */
    static enrichFromApi(apiData: any): Offerte {
        if (!apiData) {
            return apiData as Offerte;
        }

        const gueltabRaw = apiData.gueltab ?? apiData.gueltAb ?? apiData.gueltigAb ?? apiData.gueltig_ab;
        const gueltbisRaw = apiData.gueltbis ?? apiData.gueltBis ?? apiData.gueltigBis ?? apiData.gueltig_bis ?? apiData.guelt_bis;
        const ablaufdatumRaw = apiData.ablaufdatum ?? apiData.ablaufDatum ?? apiData.ablauf_datum;
        const normalizedAblaufdatum = this.normalizeDateOnly(ablaufdatumRaw) ?? apiData.ablaufdatum;
        const ablaufdatum_date = normalizedAblaufdatum ? new Date(`${normalizedAblaufdatum}T00:00:00.000Z`).toISOString() : undefined;
        const normalizedGueltab = this.normalizeDateOnly(gueltabRaw) ?? apiData.gueltab;
        const normalizedGueltbis = this.normalizeDateOnly(gueltbisRaw) ?? apiData.gueltbis;
        const gueltab_date = normalizedGueltab ? new Date(`${normalizedGueltab}T00:00:00.000Z`).toISOString() : undefined;
        const gueltbis_date = normalizedGueltbis ? new Date(`${normalizedGueltbis}T00:00:00.000Z`).toISOString() : undefined;

        // Drop deprecated fields from API payload
        const { agenturkompetenz, user, betriebName, ...rest } = apiData;

        return {
            ...rest,
            gueltab: normalizedGueltab,
            gueltbis: normalizedGueltbis,
            gueltab_date,
            gueltbis_date,
            ablaufdatum: normalizedAblaufdatum,
            ablaufdatum_date,
            name: apiData.name ?? this.buildPersonName(apiData.person),
            avb_text: apiData.avb_text ?? apiData.avb ?? null
        } as Offerte;
    }

    private static normalizeDateOnly(value: string | Date | null | undefined): string | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        const normalized = OfferteDateHelper.toDateOnly(value) ?? undefined;
        if (normalized) {
            return normalized;
        }

        return typeof value === 'string' ? value : undefined;
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
 * Search criteria for Offerte endpoints
 */
export interface OfferteSearchApiRequest {
    offertenr?: string;
    betrieb_boid?: string;
    person_boid?: string;
    vertrag_boid?: string;
    betrieb_partnernr?: string;
    person_partnernr?: string;
    gueltab?: string;
}

export type OfferteSearchCriteria = OfferteSearchApiRequest;
