import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AnspruchsberechtigteVP } from '@app/fuv/models/anspruchsberechtigte.model';
import { ContactPerson, RejectReason } from '@app/fuv/models/police.nachbearbeitung.model';
import { AnspberService } from '@app/fuv/services/anspber.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { VertpartnerService } from '@app/fuv/services/vertpartner.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { OfferteDateHelper } from '@app/fuv/utils/offerte-field-helpers';
import { EnvironmentService, LogFactoryService, Logger } from '@syrius/core';

/**
 * Service for Offerte Police operations
 */
@Injectable({
    providedIn: 'root'
})
export class PoliceService {
    private http = inject(HttpClient);
    private environmentService = inject(EnvironmentService);
    private anspberService = inject(AnspberService);
    private codesService = inject(CodesService);
    private vertpartnerService = inject(VertpartnerService);
    private offerteStore = inject(OfferteTypedStore);
    private logFactory = inject(LogFactoryService);
    private logger: Logger;

    constructor() {
        this.logger = this.logFactory.createLogger('PoliceService');
    }

    /**
     * Get the base API URL for police operations
     */
    private get apiUrl(): string {
        return `${this.environmentService.apiUrl}/fuv/police`;
    }

    /**
     * Get list of internal contact persons (Vermittler) - Interner Vermittler Verkäufer
     * Fetches from FuvAnspruchsberechtigte with stichdatum (gueltab from store) and offerteid
     * @param offerteId The ID of the offerte to filter by
     */
    getInternalContactPersons(offerteId?: number): Observable<ContactPerson[]> {
        this.logger.debug('Fetching internal contact persons (Anspruchsberechtigte) for offerte:', offerteId);

        // Get gueltab date from store, fallback to today if not available
        const currentOfferte = this.offerteStore.currentOfferte();
        const stichdatum = currentOfferte?.gueltab
            ? OfferteDateHelper.toDateOnly(currentOfferte.gueltab)
            : OfferteDateHelper.today();

        this.logger.debug('Using stichdatum for Anspruchsberechtigte search:', stichdatum);

        return this.anspberService.searchAnspruchsberechtigteByStichdatum(stichdatum, offerteId).pipe(
            map((anspruchsberechtigte: AnspruchsberechtigteVP[]) => {
                return anspruchsberechtigte.map((item) => {
                    const vp = item.vertriebspartner;
                    const name = vp.vp_vorname ? `${vp.vp_vorname} ${vp.vp_name}`.trim() : vp.vp_name;

                    return {
                        id: item.id.toString(),
                        boid: item.itsvpartner,
                        name: name,
                        partnernr: vp.vp_partnernr,
                        suvanr: vp.vp_suvanr,
                        plz: vp.vp_plz,
                        ort: vp.vp_ort,
                        vpartnerfunktion: item.vpartnerfunktion
                    };
                });
            })
        );
    }

    /**
     * Get list of external contact persons (Vermittler) - Externer Vermittler
     * Fetches from FuvVertriebspartner for current date
     * Uses cached data if available, otherwise fetches from API
     * @param offerteId The ID of the offerte (optional, for future filtering)
     */
    getExternalContactPersons(offerteId?: number): Observable<ContactPerson[]> {
        this.logger.debug('Fetching external contact persons (Vertriebspartner)');

        // Check if cached data is available
        const cachedData = this.vertpartnerService.getCachedVertriebspartner();
        if (cachedData) {
            this.logger.debug('Using cached vertriebspartner data');
            return new Observable((observer) => {
                observer.next(
                    cachedData.map((vp) => {
                        const name = vp.vp_vorname ? `${vp.vp_vorname} ${vp.vp_name}`.trim() : vp.vp_name;
                        return {
                            id: vp.id.toString(),
                            boid: vp.boid,
                            name: name,
                            partnernr: vp.vp_partnernr,
                            suvanr: vp.vp_suvanr,
                            plz: vp.vp_plz,
                            ort: vp.vp_ort,
                            vpartnerfunktion: '' // Not applicable for external vertriebspartner
                        };
                    })
                );
                observer.complete();
            });
        }

        // Fetch from API if no cache available
        const today = OfferteDateHelper.today();
        return this.vertpartnerService.searchVertriebspartner({ stichdatum: today }).pipe(
            map((vertriebspartner) => {
                return vertriebspartner.map((vp) => {
                    const name = vp.vp_vorname ? `${vp.vp_vorname} ${vp.vp_name}`.trim() : vp.vp_name;
                    return {
                        id: vp.id.toString(),
                        boid: vp.boid,
                        name: name,
                        partnernr: vp.vp_partnernr,
                        suvanr: vp.vp_suvanr,
                        plz: vp.vp_plz,
                        ort: vp.vp_ort,
                        vpartnerfunktion: '' // Not applicable for external vertriebspartner
                    };
                });
            })
        );
    }

    /**
     * Get list of rejection reasons for offers (Ablehnungsgrund)
     * Fetches from codes table filtered by gruppe='GenehmigungOfferte'
     * Only returns active codes, sorted by sorter field
     */
    getRejectReasons(): Observable<RejectReason[]> {
        return this.codesService.getCodesByGruppe('GenehmigungOfferte').pipe(
            map((codes) => {
                // Filter only active codes
                const activeCodes = codes.filter((code) => code.aktiv === true);

                // Sort by sorter field
                const sortedCodes = activeCodes.sort((a, b) => a.sorter - b.sorter);

                // Map to RejectReason format with localized labels
                return sortedCodes.map((code) => ({
                    code: code.id.toString(),
                    internal_name: code.internal_name,
                    label: this.codesService.getLocalizedLabel(code),
                    sorter: code.sorter
                }));
            })
        );
    }
}
