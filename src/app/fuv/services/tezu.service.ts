import { inject, Injectable } from '@angular/core';
import { BB } from '@app/fuv/models/bb.model';
import { Offerte } from '@app/fuv/models/offerte.model';
import { VarianteDetails } from '@app/fuv/models/varianten.model';
import { BBService } from '@app/fuv/services/bb.service';

import {
    calculateInvalidenrenteProJahr, calculateInvalidenrenteProMonat, calculateJahresbruttopraemie,
    calculateJahrespraemie, calculateMonatspraemie, calculateMonatsverdienst, calculateRabattBetrag,
    calculateTaggeldProJahr, calculateTaggeldProMonat, getRabattForTaggeldAb
} from '../components/offerte-police/police.constants';
import { toNumber } from '../components/offerte-police/varianten/varianten.utils';

@Injectable({
    providedIn: 'root'
})
export class TezuService {
    private bbService = inject(BBService);

    computeVarianteFields(variante: VarianteDetails, praemiensatzBrutto: number): VarianteDetails {
        const jahresverdienst = toNumber(variante.verdienst);
        const taggeldAb = variante.taggeld || '';

        const monatsverdienst = calculateMonatsverdienst(jahresverdienst);
        const taggeldaufschubrabatt = getRabattForTaggeldAb(taggeldAb);
        const taggeldProJahr = calculateTaggeldProJahr(jahresverdienst);
        const taggeldProMonat = calculateTaggeldProMonat(taggeldProJahr);
        const invalidenrenteProJahr = calculateInvalidenrenteProJahr(jahresverdienst);
        const invalidenrenteProMonat = calculateInvalidenrenteProMonat(invalidenrenteProJahr);
        const jahresbruttopraemie = calculateJahresbruttopraemie(jahresverdienst, praemiensatzBrutto);
        const rabattBetrag = calculateRabattBetrag(jahresbruttopraemie, toNumber(taggeldaufschubrabatt));
        const jahrespraemie = calculateJahrespraemie(jahresbruttopraemie, rabattBetrag);
        const monatspraemie = calculateMonatspraemie(jahrespraemie);

        return {
            ...variante,
            verdienst: variante.verdienst,
            monatsverdienst: monatsverdienst.toFixed(2),
            taggeldaufschubrabatt: taggeldaufschubrabatt.toString(),
            taggeldj: taggeldProJahr.toFixed(2),
            taggeldm: taggeldProMonat.toFixed(2),
            ivrentej: invalidenrenteProJahr.toFixed(2),
            ivrentem: invalidenrenteProMonat.toFixed(2),
            jahrespraemie_ohne_rabatt: jahresbruttopraemie.toFixed(2),
            rabatt: rabattBetrag.toFixed(2),
            jahrespraemie: jahrespraemie.toFixed(2),
            nettopraemie: monatspraemie.toFixed(2)
        };
    }

    mapCalculatedBB(bb: BB, resolveAgenturkompetenz: (raw: string | number | null | undefined) => { code: string; numeric: number } | undefined) {
        const technischeZuweisungen = bb.bbtezu.map((tezu) => ({
            zuweisungstyp: tezu.type,
            anteil: tezu.anteil != null ? tezu.anteil.toString() : '',
            klasse: tezu.klasse,
            bezeichnungKlasse: this.bbService.getLocalizedKlasseBezeichnung(tezu),
            unterklassenteil: tezu.ukt,
            bezeichnungUnterklassenteil: this.bbService.getLocalizedUktBezeichnung(tezu)
        }));

        const agenturkompetenz = resolveAgenturkompetenz(bb.agenturkompetenz);

        return {
            technischeZuweisungen,
            basisstufe: bb.basisstufe || 0,
            klasse: bb.bbtezu[0]?.klasse || '',
            agenturkompetenz
        };
    }

    calculateTechnischeZuweisung(offerte: Offerte | null, userId: string) {
        return this.bbService.calculateTechnischeZuweisungFromStore(offerte, userId);
    }
}
