/**
 * Constants for Police (Offerte) Component
 * Consolidated constants from taetigkeit and varianten subcomponents
 */

// ============================================================================
// Print Constants
// ============================================================================

/**
 * Vorlage (template) identifier for FUV Unverbindliche Offerte printing
 */
export const FUV_OFFERTE_VORLAGE_UNVERBINDLICH = 'V9554';

/**
 * Vorlage (template) identifier for FUV Offertantrag printing
 */
export const FUV_OFFERTE_VORLAGE_ANTRAG = 'V9550';

/**
 * Workflow definition for "Offerte nachfassen" task
 * This task type is used when printing unverbindliche offerte
 */
export const WFD_FUV_OFFERTE_NACHFASSEN = 'WFD_FUVOff_Offerte_nachfassen';

/**
 * Workflow definition for "Offerte abgelehnt - nachfassen" task
 * This task type is used when rejecting an offerte in nachbearbeitung step
 */
export const WFD_FUV_OFFERTE_ABGELEHNT_NACHFASSEN = 'WFD_FUVOff_Offerte_abgelehnt_nachfassen';

/**
 * Workflow definition for "Offerte prüfen durch VTT" task
 * This task type is used when 3+ antragsfragen are answered with "ja"
 */
export const WFD_FUV_OFFERTE_PRUEFEN_VTT = 'WFD_FUVOff_Offerte_pruefen_VTT';

/**
 * Default assignee (Zugewiesen an / ausfuehrender) for Syrius Aufgaben
 * This value is automatically filled when creating new  Syrius Aufgabe in checkliste or antragsfragen
 */
export const DEFAULT_AUFGABE_AUSFUEHRENDER = 'sir';

/**
 * Offerte Status constants
 * These values represent the different states an offerte can be in
 */
export const OFFERTE_STATUS_SIGNED_PHYSICALLY = 'Offerte_SignedP';
export const OFFERTE_STATUS_SIGNED_ELECTRONICALLY = 'Offerte_SignedE';
export const OFFERTE_STATUS_REJECTED = 'Offerte_Abgelehnt';
export const OFFERTE_STATUS_ABSCHLUSS = 'Offerte_Abschluss';
export const OFFERTE_STATUS_NEU = 'Offerte_Neu';
export const OFFERTE_STATUS_BEARBEITUNG = 'Offerte_Offen';

/**
 * Ablehnungsgrund (Rejection Reason) constants
 * These codes represent specific rejection reasons from the KvOfferteAblehnungsgrund code table
 */
export const ABLEHNUNGSGRUND_ANTRAGSFRAGEN = 'COD_06_AblehnungFUV_Antragsfragen';

/**
 * Genehmigung Art (Approval Type) constants from codes.service.ts gruppe "GenehmigungOfferte"
 * These values indicate whether the VTT expert approved or rejected the questionnaire
 */
export const GENEHMIGUNG_ART_OK = 'ExperteGenehmigung_OK';
export const GENEHMIGUNG_ART_OK_ARZT = 'ExperteGenehmigung_OKArzt';
export const GENEHMIGUNG_ART_NOK = 'ExperteGenehmigung_NOK';
export const GENEHMIGUNG_ART_NOK_ARZT = 'ExperteGenehmigung_NOKArzt';

/**
 * Array of all approved genehmigung_art values
 * Used to check if VTT expert has approved the questionnaire
 */
export const GENEHMIGUNG_ART_APPROVED = [GENEHMIGUNG_ART_OK, GENEHMIGUNG_ART_OK_ARZT];

/**
 * Array of all rejected genehmigung_art values
 * Used to check if VTT expert has rejected the questionnaire
 */
export const GENEHMIGUNG_ART_REJECTED = [GENEHMIGUNG_ART_NOK, GENEHMIGUNG_ART_NOK_ARZT];

// ============================================================================
// Offerte Art (Type) Constants
// ============================================================================

/**
 * Offerte Art for new offerte (Unverbindliche Offerte)
 */
export const OFFERTE_ART_UNV = 'OfferteArtUnv';

/**
 * Offerte Art for Verlängerung (Renewal)
 */
export const OFFERTE_ART_VERL = 'OfferteArtVerl';

/**
 * Offerte Art for offerte with Antragsfragen (with questionnaire)
 */
export const OFFERTE_ART_VER = 'OfferteArtVer';

/**
 * Offerte Art for offerte without Antragsfragen (without questionnaire)
 */
export const OFFERTE_ART_VERO = 'OfferteArtVerO';

// ============================================================================
// Taetigkeit Constants
// ============================================================================

/**
 * Verkaufskanal (Sales Channel) gruppe constant
 */
export const CODE_GRUPPE_VERKAUFSKANAL = 'Verkaufskanal';

/**
 * Stellung im Betrieb (Position in Company) gruppe constant
 */
export const CODE_GRUPPE_STELLUNG_IM_BETRIEB = 'COT_STELLUNG_IM_BETRIEB';

/**
 * Arbeitspensum (Work Load/Employment Rate) gruppe constant
 * Updated to use correct gruppe: COT_Beschaeftigungsgrad
 */
export const CODE_GRUPPE_ARBEITSPENSUM = 'COT_Beschaeftigungsgrad';

/**
 * Anzahl Mitarbeiter ohne Inhaber (Number of Employees excluding Owner) gruppe constant
 */
export const CODE_GRUPPE_ANZAHL_MITARBEITER = 'COT_Anzahl_Mitarbeiter_Koepfe';

/**
 * Dauer des Vertrags (Contract Duration) gruppe constant
 */
export const CODE_GRUPPE_DAUER_VERTRAG = 'OfferteAblaufdatum';

/**
 * AVB (Allgemeine Versicherungsbedingungen) gruppe constant
 */
export const CODE_GRUPPE_AVB = 'COT_FUV_AVB';

/**
 * Zuweisungstyp (Assignment Type) gruppe constant for TEZU
 * Used to resolve HZ (Hauptzuweisung) and NZ (Nebenzuweisung) codes
 */
export const CODE_GRUPPE_TEZU_TYPE = 'TEZU_TYPE';

/**
 * Default contract duration: 4 years
 */
export const DEFAULT_VERTRAGSDAUER = 'Ablauf_4';

/**
 * Default sales channel for new offerte (OfferteArtUnv)
 */
export const DEFAULT_VERKAUFSKANAL_NEW = 'COD_SUAbklaerung';

/**
 * Default sales channel for Verlängerung (OfferteArtVerl)
 */
export const DEFAULT_VERKAUFSKANAL_VERL = 'COD_DirektmarketingAktionen';

/**
 * Default BB gueltbis date (far-future date indicating no end date)
 */
export const DEFAULT_BB_GUELTBIS = '3000-01-01';

/**
 * Default AVB (Allgemeine Versicherungsbedingungen) for Verlängerung
 * This is the latest AVB version
 */
export const DEFAULT_AVB_VERL = 'COD_FUV_AVB_01_2026';

/**
 * Default offerte gueltbis date (far-future date indicating no end date)
 * Used for Verlängerung offerten in varianten step
 */
export const DEFAULT_OFFERTE_GUELTBIS = '3000-01-01';

// ============================================================================
// Checkliste Constants
// ============================================================================

/**
 * Maximum age for insured person at contract start
 * When age exceeds this value, a warning icon should be displayed in the checkliste
 */
export const MAX_ALTER_VERSICHERTEN = 60;

// ============================================================================
// Varianten Constants
// ============================================================================

/**
 * Minimum jahresverdienst for family members (mitarbeitende Familienmitglieder)
 * When stellungImBetrieb is one of the family member codes, jahresverdienst must be at least this amount
 */
export const MIN_JAHRESVERDIENST_FAMILY_MEMBERS = 44460;

/**
 * Minimum jahresverdienst for business owners and other non-family members
 * When stellungImBetrieb is one of the owner codes, jahresverdienst must be at least this amount
 */
export const MIN_JAHRESVERDIENST_OWNERS = 66690;

/**
 * Stellung im Betrieb codes that represent family members (mitarbeitende Familienmitglieder)
 * These codes require a minimum jahresverdienst of 44'460 CHF
 */
export const FAMILY_MEMBER_CODES = [
    'COD_EHEGATTE', // Spouse
    'COD_SOHN_TOCHTER', // Son/Daughter
    'COD_ELTERNTEIL', // Parent
    'COD_GESCHWISTER', // Sibling
    'COD_EHEGATTE_GESCHWISTER_TEILWEISE_ARBEITNEHMER', // Spouse/Sibling partially employee
    'COD_UEBRIGE_FAMILIENMITGLIEDER' // Other family members
];

/**
 * Stellung im Betrieb codes that represent business owners and other non-family members
 * These codes require a minimum jahresverdienst of 66'690 CHF
 */
export const OWNER_CODES = [
    'COD_INHABER_BETRIEB', // Business owner
    'COD_INHABER_TEILWEISE_ARBEITNEHMER' // Business owner partially employee
    // Add more codes here as needed in the future
];

/**
 * Rabatt (Discount) mapping based on Taggeldaufschub (Daily Benefit Deferral)
 * Maps the code internal_name (e.g., COD_3_TAGE) to the corresponding discount percentage
 * Updated to use internal_name codes instead of localized labels for backend compatibility
 */
export const TAGGELD_RABATT_MAPPING: Record<string, number> = {
    COD_3_TAGE: 0, // 3rd day = 0% discount
    COD_15_TAGE: 20, // 15th day = 20% discount
    COD_30_TAGE: 40, // 30th day = 40% discount
    // Legacy support for old label-based values (can be removed after data migration)
    '3. Tag': 0,
    '15. Tag': 20,
    '30. Tag': 40
};

// ============================================================================
// Varianten Calculation Functions
// ============================================================================

/**
 * Calculate monthly salary from annual salary
 * Formula: Jahresverdienst / 12
 *
 * @param jahresverdienst - Annual salary in CHF
 * @returns Monthly salary in CHF
 */
export function calculateMonatsverdienst(jahresverdienst: number): number {
    if (!jahresverdienst || jahresverdienst <= 0) {
        return 0;
    }

    return jahresverdienst / 12;
}

/**
 * Calculate annual daily benefit (simplified formula)
 * Formula: Jahresverdienst * 0.8
 *
 * @param jahresverdienst - Annual salary in CHF
 * @returns Annual daily benefit in CHF
 *
 * @example
 * calculateTaggeldProJahr(120000) → 120000 * 0.8 = 96000.00 CHF
 */
export function calculateTaggeldProJahr(jahresverdienst: number): number {
    if (!jahresverdienst || jahresverdienst <= 0) {
        return 0;
    }

    return jahresverdienst * 0.8;
}

/**
 * Calculate monthly daily benefit
 * Formula: (Taggeld pro Jahr / 12), rounded up to nearest 5 Rappen (0.05 CHF)
 *
 * @param taggeldProJahr - Annual daily benefit in CHF
 * @returns Monthly daily benefit in CHF, rounded up to nearest 5 Rappen
 *
 * @example
 * calculateTaggeldProMonat(96013) → 8001.0833... → 8001.10 CHF
 * calculateTaggeldProMonat(36007.25) → 3000.6041... → 3000.65 CHF
 */
export function calculateTaggeldProMonat(taggeldProJahr: number): number {
    if (!taggeldProJahr || taggeldProJahr <= 0) {
        return 0;
    }

    // Calculate monthly benefit
    const monthlyBenefit = taggeldProJahr / 12;

    // Round up to nearest 5 Rappen (0.05 CHF)
    return Math.ceil(monthlyBenefit / 0.05) * 0.05;
}

/**
 * Get rabatt (discount) percentage for a given Taggeldaufschub value
 *
 * @param taggeldAb - The "Taggeld ab" value (e.g., "3. Tag", "15. Tag", "30. Tag")
 * @returns Discount percentage (0, 20, or 40), defaults to 0 if not found
 */
export function getRabattForTaggeldAb(taggeldAb: string): number {
    return TAGGELD_RABATT_MAPPING[taggeldAb] ?? 0;
}

/**
 * Calculate gross premium rate (Prämiensatz Brutto)
 * Formula: stufe * (1 + agenturkompetenz / 100)
 *
 * @param stufe - The base rate (Stufe)
 * @param agenturkompetenz - Agency competence percentage (e.g., 10 for 10%)
 * @returns Gross premium rate
 *
 * @example
 * calculatePraemiensatzBrutto(3.0, 10) → 3.0 * (1 + 10 / 100) = 3.0 * 1.1 = 3.3
 * calculatePraemiensatzBrutto(2.5, 15) → 2.5 * (1 + 15 / 100) = 2.5 * 1.15 = 2.875
 */
export function calculatePraemiensatzBrutto(stufe: number, agenturkompetenz: number): number {
    if (!stufe || stufe <= 0) {
        return 0;
    }

    // Default agenturkompetenz to 0 if not provided
    const agentCompetence = agenturkompetenz || 0;

    // Calculate: stufe * (1 + agenturkompetenz / 100)
    return stufe * (1 + agentCompetence / 100);
}

/**
 * Calculate gross annual premium (Jahresbruttopraemie)
 * Formula: (Jahresverdienst / 100) * Praemiensatz, rounded to nearest 5 Rappen
 *
 * @param jahresverdienst - Annual salary in CHF
 * @param praemiensatz - Premium rate as a number (e.g., 3.1563 for 3.1563%)
 * @returns Gross annual premium in CHF, rounded to nearest 5 Rappen
 *
 * @example
 * calculateJahresbruttopraemie(120000, 3.1563) → (120000 / 100) * 3.1563 = 3787.56 → 3787.60 CHF
 * calculateJahresbruttopraemie(100000, 2.5) → (100000 / 100) * 2.5 = 2500.00 CHF
 */
export function calculateJahresbruttopraemie(jahresverdienst: number, praemiensatz: number): number {
    if (!jahresverdienst || jahresverdienst <= 0 || !praemiensatz || praemiensatz <= 0) {
        return 0;
    }

    // Calculate gross premium
    const grossPremium = (jahresverdienst / 100) * praemiensatz;

    // Round to nearest 5 Rappen (0.05 CHF)
    return Math.round(grossPremium / 0.05) * 0.05;
}

/**
 * Calculate discount amount (Rabattbetrag) in CHF
 * Formula: (Jahresbruttopraemie / 100) * Rabatt percentage
 *
 * @param jahresbruttopraemie - Gross annual premium in CHF
 * @param rabattPercentage - Discount percentage (e.g., 20 for 20%)
 * @returns Discount amount in CHF, rounded to nearest 5 Rappen
 *
 * @example
 * calculateRabattBetrag(3787.60, 20) → (3787.60 / 100) * 20 = 757.52 → 757.50 CHF
 */
export function calculateRabattBetrag(jahresbruttopraemie: number, rabattPercentage: number): number {
    if (!jahresbruttopraemie || jahresbruttopraemie <= 0 || !rabattPercentage || rabattPercentage < 0) {
        return 0;
    }

    // Calculate discount amount
    const discountAmount = (jahresbruttopraemie / 100) * rabattPercentage;

    // Round to nearest 5 Rappen (0.05 CHF)
    return Math.round(discountAmount / 0.05) * 0.05;
}

/**
 * Calculate net annual premium (Jahrespraemie)
 * Formula: Jahresbruttopraemie - Rabattbetrag
 *
 * @param jahresbruttopraemie - Gross annual premium in CHF
 * @param rabattBetrag - Discount amount in CHF
 * @returns Net annual premium in CHF
 */
export function calculateJahrespraemie(jahresbruttopraemie: number, rabattBetrag: number): number {
    if (!jahresbruttopraemie || jahresbruttopraemie <= 0) {
        return 0;
    }

    return jahresbruttopraemie - (rabattBetrag || 0);
}

/**
 * Calculate monthly premium (Monatspraemie)
 * Formula: Jahrespraemie / 12, rounded to nearest 5 Rappen
 *
 * @param jahrespraemie - Net annual premium in CHF
 * @returns Monthly premium in CHF, rounded to nearest 5 Rappen
 *
 * @example
 * calculateMonatspraemie(3030.10) → 3030.10 / 12 = 252.508... → 252.50 CHF
 */
export function calculateMonatspraemie(jahrespraemie: number): number {
    if (!jahrespraemie || jahrespraemie <= 0) {
        return 0;
    }

    // Calculate monthly premium
    const monthlyPremium = jahrespraemie / 12;

    // Round to nearest 5 Rappen (0.05 CHF)
    return Math.round(monthlyPremium / 0.05) * 0.05;
}

/**
 * Calculate annual disability pension (Invalidenrente pro Jahr)
 * Formula: Jahresverdienst * 0.9
 *
 * @param jahresverdienst - Annual salary in CHF
 * @returns Annual disability pension in CHF
 *
 * @example
 * calculateInvalidenrenteProJahr(120000) → 120000 * 0.9 = 108000.00 CHF
 */
export function calculateInvalidenrenteProJahr(jahresverdienst: number): number {
    if (!jahresverdienst || jahresverdienst <= 0) {
        return 0;
    }

    return jahresverdienst * 0.9;
}

/**
 * Calculate monthly disability pension (Invalidenrente pro Monat)
 * Formula: Invalidenrente pro Jahr / 12
 *
 * @param invalidenrenteProJahr - Annual disability pension in CHF
 * @returns Monthly disability pension in CHF
 *
 * @example
 * calculateInvalidenrenteProMonat(86400) → 86400 / 12 = 7200.00 CHF
 */
export function calculateInvalidenrenteProMonat(invalidenrenteProJahr: number): number {
    if (!invalidenrenteProJahr || invalidenrenteProJahr <= 0) {
        return 0;
    }

    return invalidenrenteProJahr / 12;
}

// ============================================================================
// Vermittler (Vertriebspartner) Constants
// ============================================================================

/**
 * Vertriebspartner Definition IDs (itsvtriebpvpdef)
 * These values identify the type of vermittler in the anspruchsberechtigte array
 */
export const ITSVTRIEBPVPDEF_VERKAEUFER = '3001'; // Interner Vermittler - Verkäufer
export const ITSVTRIEBPVPDEF_BETEILIGTER = '3002'; // Interner Vermittler - Beteiligter
export const ITSVTRIEBPVPDEF_EXTERNER = '1001'; // Externer Vermittler

/**
 * Vertriebspartner Function codes (vpartnerfunktion)
 * These codes define the function/role of the vermittler
 */
export const VPFUNKTION_VERKAEUFER = 'COD_FUV_VPFunktion1'; // For Verkäufer
export const VPFUNKTION_BETEILIGTER = 'COD_FUV_VPFunktion2'; // For Beteiligter
export const VPFUNKTION_EXTERNER = 'COD_FUV_VPFunktion3'; // For Externer
