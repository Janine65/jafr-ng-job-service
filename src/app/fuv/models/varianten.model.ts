// Technische Zuweisung
export interface TechnischeZuweisung {
    zuweisungstyp?: string;
    anteil?: string;
    klasse?: string;
    bezeichnungKlasse?: string;
    unterklassenteil?: string;
    bezeichnungUnterklassenteil?: string;
}

// Varianten UI/DTO structure used by the component
export interface VariantenData {
    technischeZuweisungen?: TechnischeZuweisung[];

    // Grundlagen für die Prämienberechnung
    agenturkompetenz?: string;
    klasse?: string;
    basisstufe?: string;
    stufe?: string;
    praemiensatz?: string;

    // Variants A, B, C
    selectedVariante?: 'A' | 'B' | 'C';
    varianteA?: VarianteDetails;
    varianteB?: VarianteDetails;
    varianteC?: VarianteDetails;

    // Prämienzahlung
    praemienzahlung?: 'jaehrlich' | 'halbjaehrlich' | 'vierteljaehrlich' | 'monatlich';

    // Zahlungsadresse
    name_bank?: string;
    plz_bank?: string;
    ort_bank?: string;
    iban?: string;
    kontoinhaber?: string;

    // Begleitschreiben
    begleitbrief?: boolean;
}

// Variante
export interface VarianteDetails {
    verdienst?: string;
    monatsverdienst?: string;
    taggeld?: string;
    taggeldaufschubrabatt?: string;
    taggeldj?: string;
    taggeldm?: string;
    ivrentej?: string;
    ivrentem?: string;
    jahrespraemie_ohne_rabatt?: string;
    rabatt?: string;
    jahrespraemie?: string;
    nettopraemie?: string;
}
