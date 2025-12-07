import { Offerte, OfferteMetaData } from '@app/fuv/models/offerte.model';
import { Variante } from '@app/fuv/models/variante.model';
import { VarianteDetails } from '@app/fuv/models/varianten.model';

export function toNumber(value?: string | number): number {
    if (typeof value === 'number') return value;
    if (!value || value === '') return 0;

    const cleanValue = typeof value === 'string' ? value.replace(/[''\s]/g, '') : value;
    const parsed = parseFloat(cleanValue as any);
    return isNaN(parsed) ? 0 : parsed;
}

export function toString(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : value.toString();
}

export function toUiVariante(variante?: Variante): VarianteDetails {
    const monat = (variante as any)?.monatsverdienst;
    return {
        verdienst: variante?.verdienst != null ? toString(variante.verdienst) : '0',
        monatsverdienst: monat != null ? toString(monat) : '0',
        taggeld: variante?.taggeld != null ? toString(variante.taggeld) : '',
        taggeldaufschubrabatt: variante?.taggeldaufschubrabatt != null ? toString(variante.taggeldaufschubrabatt) : '0',
        taggeldj: variante?.taggeldj != null ? toString(variante.taggeldj) : '0',
        taggeldm: variante?.taggeldm != null ? toString(variante.taggeldm) : '0',
        ivrentej: variante?.ivrentej != null ? toString(variante.ivrentej) : '0',
        ivrentem: variante?.ivrentem != null ? toString(variante.ivrentem) : '0',
        jahrespraemie_ohne_rabatt: variante?.jahrespraemie_ohne_rabatt != null ? toString(variante.jahrespraemie_ohne_rabatt) : '0',
        rabatt: variante?.rabatt != null ? toString(variante.rabatt) : '0',
        jahrespraemie: variante?.jahrespraemie != null ? toString(variante.jahrespraemie) : '0',
        nettopraemie: variante?.nettopraemie != null ? toString(variante.nettopraemie) : '0'
    };
}

export function getSelectedVarianteFromStore(varianten: Variante[]): 'A' | 'B' | 'C' | null {
    const selected = varianten.find((v) => v.status === true || (v.status as unknown) === 1 || (v.status as unknown) === '1');
    if (!selected) return null;
    if (selected.variante === 1) return 'A';
    if (selected.variante === 2) return 'B';
    if (selected.variante === 3) return 'C';
    return null;
}

export function computeTezuHashFromOfferte(offerte: Offerte | null | undefined, meta?: OfferteMetaData | null): string | undefined {
    const taetigkeiten =
        meta?.tezuCalculationBasis?.taetigkeiten ||
        offerte?.bb?.bb2merkmal?.map((m: any) => ({
            taetigkeit: m.merkmal_boid,
            prozent: m.prozent?.toString() ?? '0',
            merkmal_internalname: m.merkmal_internalname ?? m.merkmal?.internalname
        }));

    if (!taetigkeiten || taetigkeiten.length === 0) {
        return undefined;
    }

    const relevantFields = {
        taetigkeiten: taetigkeiten.map((t: any) => ({
            merkmal_boid: t.taetigkeit,
            prozent: t.prozent,
            merkmal_internalname: t.merkmal_internalname
        })),
        stellenprozente: meta?.tezuCalculationBasis?.stellenprozente || offerte?.bb?.stellenprozente || '',
        anzahlMitarbeiter: meta?.tezuCalculationBasis?.anzahlMitarbeiter || offerte?.bb?.anzahlma || ''
    };

    return JSON.stringify(relevantFields);
}

export function parseBegleitbriefValue(value: unknown, defaultValue: boolean = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return value === 'yes' || value === 'true';
    }

    if (typeof value === 'number') {
        return value === 1;
    }

    return defaultValue;
}

export function resolveAgenturkompetenz(
    raw: string | number | null | undefined,
    getCode: (numeric: number) => string | undefined,
    getValue: (code: string) => number,
    defaultCode?: string
): { code: string; numeric: number } | null {
    if (raw === undefined || raw === null || raw === '') {
        if (defaultCode) {
            return { code: defaultCode, numeric: getValue(defaultCode) };
        }
        return null;
    }

    const isNumericString = typeof raw === 'string' && /^-?\d+$/.test(raw);
    const isNumber = typeof raw === 'number';

    if (!isNumber && !isNumericString) {
        const code = String(raw);
        return { code, numeric: getValue(code) };
    }

    const numericValue = isNumber ? raw : parseInt(String(raw), 10);
    const code = getCode(numericValue);

    if (code) {
        return { code, numeric: numericValue };
    }

    if (defaultCode) {
        return { code: defaultCode, numeric: getValue(defaultCode) };
    }

    return null;
}
