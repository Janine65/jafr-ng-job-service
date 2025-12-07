import { Variante } from '@app/fuv/models/variante.model';
import { VarianteDetails, VariantenData } from '@app/fuv/models/varianten.model';

import { toNumber } from './varianten.utils';

export function mapVariantsToApi(variantenData: VariantenData, existing: Variante[] = [], username?: string, mindestVerdienst: number = 0, vksatz?: number | null): Variante[] {
    const calcVerwaltungskosten = (nettoPraemie: number, rabattBetrag: number, vks?: number | null) => {
        const basis = Math.max(nettoPraemie - rabattBetrag / 12, 0); // rabatt is yearly, nettopraemie is monthly
        const vksValue = vks ?? 0;
        const raw = (basis * vksValue) / 100;
        return Math.round(raw * 20) / 20; // round to 0.05
    };

    const mapVariant = (letter: 'A' | 'B' | 'C', data?: VarianteDetails): Variante | undefined => {
        if (!data) return undefined;
        const varianteNumber = letter === 'A' ? 1 : letter === 'B' ? 2 : 3;
        const verdienstNum = toNumber(data.verdienst);
        const taggeld = data.taggeld?.toString().trim() || undefined;

        const existingVariant = existing.find((v) => v.variante === varianteNumber);
        const nettopraemieRaw = toNumber(data.nettopraemie);
        const rabattRaw = toNumber(data.rabatt);
        const jahrespraemieRaw = toNumber(data.jahrespraemie);
        const jahresbruttoRaw = toNumber(data.jahrespraemie_ohne_rabatt);
        const jahrespraemieOhneMinimalRaw = toNumber((data as any).jahrespraemie_ohne_minimal ?? data.jahrespraemie);

        const nettopraemie = nettopraemieRaw || existingVariant?.nettopraemie || 0;
        const rabattBetrag = rabattRaw || existingVariant?.rabatt || 0;
        const jahrespraemie = jahrespraemieRaw || existingVariant?.jahrespraemie || 0;
        const jahresbruttopraemie = jahresbruttoRaw || existingVariant?.jahrespraemie_ohne_rabatt || 0;
        const jahrespraemieOhneMinimal = jahrespraemieOhneMinimalRaw || existingVariant?.jahrespraemie_ohne_minimal || 0;
        const verwaltungskostenpraemie = calcVerwaltungskosten(nettopraemie, rabattBetrag, vksatz);

        return {
            id: existingVariant?.id,
            variante: varianteNumber,
            verdienst: verdienstNum || 0,
            mind_verdienst: mindestVerdienst || 0,
            taggeld: taggeld || null,
            taggeldaufschubrabatt: toNumber(data.taggeldaufschubrabatt) || 0,
            taggeldj: toNumber(data.taggeldj) || 0,
            taggeldm: toNumber(data.taggeldm) || 0,
            ivrentej: toNumber(data.ivrentej) || 0,
            ivrentem: toNumber(data.ivrentem) || 0,
            jahrespraemie_ohne_rabatt: jahresbruttopraemie,
            jahrespraemie_ohne_minimal: jahrespraemieOhneMinimal || jahrespraemie,
            verwaltungskostenpraemie,
            rabatt: rabattBetrag,
            jahrespraemie,
            nettopraemie,
            status: variantenData.selectedVariante === letter,
            updatedby: username
        };
    };

    const a = mapVariant('A', (variantenData as any).varianteA);
    const b = mapVariant('B', (variantenData as any).varianteB);
    const c = mapVariant('C', (variantenData as any).varianteC);

    return [a, b, c].filter((v): v is Variante => !!v);
}
