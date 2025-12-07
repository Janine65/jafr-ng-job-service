import { map, Observable } from 'rxjs';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { OfferteDateHelper } from '@app/fuv/utils/offerte-field-helpers';
import { formatDateToISO } from '@app/shared/utils/date-helpers';
import { generateUUID } from '@app/shared/utils/uuid.helper';
import { TranslateService } from '@ngx-translate/core';
import { LogFactoryService } from '@syrius/core';

import { BB, BBSearchParams, CalculateBBRequest, CalculateBBResponse } from '../models/bb.model';
import { Merkmal } from '../models/merkmal.model';
import { TaetigkeitData } from '../models/taetigkeit.model';

/**
 * BB Service - Handles FuvBB (Betriebsbeschreibung) operations
 * Maps to /api/offerte/fuvbb endpoints
 */
@Injectable({
    providedIn: 'root'
})
export class BBService {
    private http = inject(HttpClient);
    private translate = inject(TranslateService);
    private logger = inject(LogFactoryService).createLogger('BBService');
    private apiUrl = '/api/offerte/fuvbb';

    /**
     * Search for FuvBB entries
     * Maps to GET /api/offerte/fuvbb/searchFuvBB
     *
     * @param params Search parameters
     * @returns Observable of FuvBB array
     */
    searchFuvBB(params: BBSearchParams): Observable<BB[]> {
        let httpParams = new HttpParams();

        if (params.boid !== undefined) {
            httpParams = httpParams.set('boid', params.boid);
        }
        if (params.betrieb_boid !== undefined) {
            httpParams = httpParams.set('betrieb_boid', params.betrieb_boid);
        }
        if (params.person_boid !== undefined) {
            httpParams = httpParams.set('person_boid', params.person_boid);
        }
        if (params.vertrag_boid !== undefined) {
            httpParams = httpParams.set('vertrag_boid', params.vertrag_boid);
        }
        if (params.stichdatum !== undefined) {
            httpParams = httpParams.set('stichdatum', params.stichdatum);
        }
        if (params.gueltab !== undefined) {
            httpParams = httpParams.set('gueltab', params.gueltab);
        }
        if (params.gueltbis !== undefined) {
            httpParams = httpParams.set('gueltbis', params.gueltbis);
        }

        return this.http.get<BB[]>(`${this.apiUrl}/searchFuvBB`, { params: httpParams });
    }

    /**
     * Read a single FuvBB entry by BOID
     * Maps to GET /api/offerte/fuvbb/readFuvBB
     *
     * @param boid The BOID of the FuvBB entry
     * @returns Observable of FuvBB
     */
    readFuvBB(boid: string): Observable<BB> {
        const params = new HttpParams().set('boid', boid);
        return this.http.get<BB>(`${this.apiUrl}/readFuvBB`, { params });
    }

    /**
     * Insert a new FuvBB entry
     * Maps to PUT /api/offerte/fuvbb/insertFuvBB
     *
     * @param fuvbb The FuvBB data to insert
     * @returns Observable of created FuvBB
     */
    insertFuvBB(fuvbb: Partial<BB>): Observable<BB> {
        return this.http.put<BB>(`${this.apiUrl}/insertFuvBB`, fuvbb);
    }

    /**
     * Update an existing FuvBB entry
     * Maps to POST /api/offerte/fuvbb/updateFuvBB
     *
     * @param fuvbb The FuvBB data to update
     * @returns Observable of updated FuvBB
     */
    updateFuvBB(fuvbb: BB): Observable<BB> {
        return this.http.post<BB>(`${this.apiUrl}/updateFuvBB`, fuvbb);
    }

    /**
     * Delete a FuvBB entry
     * Maps to DELETE /api/offerte/fuvbb/deleteFuvBB
     *
     * @param boid The BOID of the FuvBB entry to delete
     * @returns Observable of void
     */
    deleteFuvBB(boid: string): Observable<void> {
        const params = new HttpParams().set('boid', boid);
        return this.http.delete<void>(`${this.apiUrl}/deleteFuvBB`, { params });
    }

    /**
     * Calculate FuvBB technical assignment
     * Maps to POST /api/offerte/fuvbb/calculateFuvBB
     *
     * @param request The calculation request
     * @returns Observable of FuvBB array
     */
    private calculateFuvBB(request: CalculateBBRequest): Observable<CalculateBBResponse> {
        return this.http.post<CalculateBBResponse>(`${this.apiUrl}/calculateFuvBB`, request);
    }

    /**
     * Get the localized class description (Klasse Bezeichnung)
     *
     * @param tezu The BBTeZu object
     * @returns Localized class description
     */
    getLocalizedKlasseBezeichnung(tezu: any): string {
        const currentLang = this.translate.currentLang || 'de';

        switch (currentLang) {
            case 'fr':
                return tezu.klasse_bezeichnungfr || tezu.klasse_bezeichnungdt;
            case 'it':
                return tezu.klasse_bezeichnungit || tezu.klasse_bezeichnungdt;
            case 'en':
            case 'de':
            default:
                return tezu.klasse_bezeichnungdt;
        }
    }

    /**
     * Get the localized subclass description (Unterklassenteil Bezeichnung)
     *
     * @param tezu The BBTeZu object
     * @returns Localized subclass description
     */
    getLocalizedUktBezeichnung(tezu: any): string {
        const currentLang = this.translate.currentLang || 'de';

        switch (currentLang) {
            case 'fr':
                return tezu.ukt_bezeichnungfr || tezu.ukt_bezeichnungdt;
            case 'it':
                return tezu.ukt_bezeichnungit || tezu.ukt_bezeichnungdt;
            case 'en':
            case 'de':
            default:
                return tezu.ukt_bezeichnungdt;
        }
    }

    /**
     * Format date from Date object to API format (YYYY-MM-DD)
     *
     * @param date Date object
     * @returns Formatted date string
     */
    formatDateForApi(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Parse API date string to Date object
     *
     * @param dateStr Date string in format YYYY-MM-DD
     * @returns Date object
     */
    parseDateFromApi(dateStr: string): Date {
        return new Date(dateStr);
    }

    /**
     * Build BB (Betriebsbeschreibung) object from Tätigkeit data
     * This creates a complete BB object ready for API submission, including bb2merkmal records
     *
     * The BB object serves as the foundation for insurance quote calculations and contains:
     * - Basic business description data (activities, employee count, etc.)
     * - Merkmal assignments (bb2merkmal) with percentage allocations
     * - Empty bbtezu array (will be populated by backend during calculation)
     *
     * @param taetigkeitData - The taetigkeit form data with enriched merkmal metadata
     * @param existingBB - Existing BB object to preserve database IDs
     * @param userId - Current user ID for audit fields (default: 'bp2')
     * @returns Complete BB object ready for API, or null if no tätigkeiten data
     */
    buildBBFromTaetigkeit(taetigkeitData: TaetigkeitData, existingBB?: BB | null, userId: string = 'bp2'): BB | null {
        // Cannot build BB without tätigkeiten
        if (!taetigkeitData.taetigkeiten || taetigkeitData.taetigkeiten.length === 0) {
            this.logger.log('No tätigkeiten to build BB from');
            return null;
        }

        const now = new Date().toISOString();
        const today = new Date().toISOString().split('T')[0];
        const BB_GUELTIG_BIS = '3000-01-01';

        // Get or generate bb_boid
        const bbBoid = existingBB?.boid || generateUUID();

        // Build BB object (using Partial to allow optional ID)
        const bb: any = {
            id: existingBB?.id, // Preserve existing ID if available
            created: existingBB?.created || now,
            updated: now,
            boid: bbBoid,
            beschreibung: null,
            taetigkeit: taetigkeitData.taetigkeitsbeschreibung || '',
            gueltab: formatDateToISO(taetigkeitData.vertragGueltigAb) || today,
            gueltbis: BB_GUELTIG_BIS,
            aufgenommenam: today,
            eingangskanal: null,
            anzahlma: taetigkeitData.anzahlMitarbeiter || '',
            // stellenprozente must be undefined if not provided (user needs to fill this)
            stellenprozente: taetigkeitData.stellenprozente ? parseFloat(taetigkeitData.stellenprozente) : undefined,
            basisstufe: null,
            agenturkompetenz: null,
            betrieb_boid: null,
            person_boid: null,
            updateby: userId,
            vksatz: null,
            uvksatz: null,
            bruttopraemiensatz: null,
            nettopraemiensatz: null,
            bb2merkmal: taetigkeitData.taetigkeiten.map((t, index) => {
                const existingMerkmal = existingBB?.bb2merkmal?.[index];

                return {
                    // Preserve existing ID; fall back to merkmal_id from selection, otherwise 0
                    id: existingMerkmal?.id ?? (t as any).merkmal_id ?? 0,
                    created: existingMerkmal?.created || now,
                    updated: now,
                    prozent: parseFloat(t.prozent.toString()),
                    bb_boid: bbBoid,
                    merkmal_boid: t.taetigkeit,
                    merkmal_statefrom: t.merkmal_statefrom ?? '',
                    merkmal_internalname: t.merkmal_internalname ?? '',
                    updatedby: userId,
                    merkmal: null
                };
            }),
            // IMPORTANT: Clear bbtezu when tätigkeit data changes to force recalculation
            // The technical assignment depends on the activities and must be recalculated
            bbtezu: []
        };

        this.logger.log('Built BB from tätigkeit:', {
            bb_boid: bbBoid,
            bb2merkmalCount: bb.bb2merkmal.length,
            bb2merkmalIds: bb.bb2merkmal.map((m: any) => m.id),
            hadPreviousBbtezu: (existingBB?.bbtezu?.length || 0) > 0,
            bbtezuCleared: true
        });

        return bb;
    }

    /**
     * Generate a UUID for new BB records
     * Delegates to shared UUID utility
     *
     * @returns UUID string
     * @deprecated Use generateUUID from '@app/shared/utils/uuid.helper' directly
     */
    generateUUID(): string {
        return generateUUID();
    }

    /**
     * Build request payload for BB calculation from Tätigkeit data
     * Extracts and formats all required fields for the calculateFuvBB API call
     *
     * @param taetigkeit - The taetigkeit form data with enriched merkmal metadata
     * @param existingBB - Existing BB object to preserve database IDs and timestamps
     * @param offerteId - The offerte ID (required for BB calculation)
     * @param userId - Current user ID for audit fields
     * @returns Complete CalculateFuvBBRequest ready for API submission
     */
    buildCalculateRequest(taetigkeit: TaetigkeitData, existingBB: BB | undefined, offerteId: number, userId: string): CalculateBBRequest {
        const now = new Date().toISOString().slice(0, 19);
        const today = new Date().toISOString().split('T')[0];
        const BB_GUELTIG_BIS = '3000-01-01';

        // Check if BB already exists (has boid)
        const isExisting = existingBB?.boid !== undefined;

        // Generate bb_boid if new, otherwise use existing
        const bbBoid = isExisting ? existingBB!.boid : generateUUID();

        const request: CalculateBBRequest = {
            // Use offerte's ID for BB (from insertOfferte response)
            id: offerteId,
            created: isExisting ? existingBB!.created : now,
            updated: now,
            boid: bbBoid,
            beschreibung: null,

            // Required fields from taetigkeit
            taetigkeit: taetigkeit.taetigkeitsbeschreibung || '',
            gueltab: taetigkeit.vertragGueltigAb ? formatDateToISO(taetigkeit.vertragGueltigAb) || today : today,
            gueltbis: BB_GUELTIG_BIS,
            aufgenommenam: today,
            eingangskanal: null,
            anzahlma: taetigkeit.anzahlMitarbeiter || '',
            // stellenprozente must be undefined if not provided (user needs to fill this)
            stellenprozente: taetigkeit.stellenprozente ? parseFloat(taetigkeit.stellenprozente) : undefined,

            // Calculated fields (preserve from existing BB if available, otherwise null)
            basisstufe: existingBB?.basisstufe ?? null,
            agenturkompetenz: existingBB?.agenturkompetenz ?? null,
            betrieb_boid: existingBB?.betrieb_boid ?? null,
            person_boid: existingBB?.person_boid ?? null,
            updateby: userId,
            vksatz: existingBB?.vksatz ?? null,
            uvksatz: existingBB?.uvksatz ?? null,
            bruttopraemiensatz: existingBB?.bruttopraemiensatz ?? null,
            nettopraemiensatz: existingBB?.nettopraemiensatz ?? null,

            // Activity mappings
            bb2merkmal: (taetigkeit.taetigkeiten || []).map((t, index) => {
                const existingMerkmal = existingBB?.bb2merkmal?.[index];
                const merkmalExists = existingMerkmal?.merkmal_boid === t.taetigkeit;
                const bb2merkmalId = existingMerkmal?.id;

                const mapped: Merkmal = {
                    id: bb2merkmalId ?? t.merkmal_id ?? 0,
                    created: merkmalExists ? existingMerkmal!.created : now,
                    updated: now,
                    prozent: parseFloat(t.prozent.toString()),
                    bb_boid: bbBoid,
                    merkmal_boid: t.taetigkeit,
                    merkmal_statefrom: t.merkmal_statefrom ?? '',
                    merkmal_internalname: t.merkmal_internalname ?? '',
                    updatedby: userId,
                    merkmal: null
                };

                return mapped;
            }),

            // Technical assignments (empty before calculation)
            bbtezu: []
        };

        return request;
    }

    /**
     * Calculate technical assignment from offerte store data
     * High-level method that orchestrates the BB calculation workflow:
     * 1. Validates taetigkeit data exists
     * 2. Builds calculation request
     * 3. Calls backend calculateFuvBB API
     * 4. Returns calculated BB object
     */
    calculateTechnischeZuweisungFromStore(offerte: any, userId: string): Observable<BB> {
        // Ensure offerte has been inserted (has ID)
        if (!offerte?.id) {
            return new Observable((observer) => {
                observer.error(new Error('Offerte konnte nicht automatisch synchronisiert werden. Bitte warte einen kurzen Moment und versuche es manuell.'));
            });
        }

        const bb = offerte.bb;
        const taetigkeit: TaetigkeitData = {
            taetigkeitsbeschreibung: bb?.taetigkeit,
            taetigkeiten: bb?.bb2merkmal?.map((m: any) => ({
                taetigkeit: m.merkmal_boid,
                prozent: m.prozent?.toString() ?? '0',
                merkmal_internalname: m.merkmal_internalname ?? m.merkmal?.internalname,
                merkmal_statefrom: m.merkmal_statefrom ?? m.merkmal?.statefrom,
                merkmal_id: m.merkmal_id ?? m.merkmal?.id
            })),
            vertragGueltigAb: OfferteDateHelper.parse(offerte.gueltab ?? bb?.gueltab) || undefined,
            vertragGueltigBis: OfferteDateHelper.parse(offerte.gueltbis ?? bb?.gueltbis) || undefined,
            verkaufskanal: offerte.kanal,
            avb: offerte.avb,
            stellungImBetrieb: offerte.stellung_im_betrieb,
            arbeitspensum: offerte.beschaeft_grad,
            selbststaendigSeit: OfferteDateHelper.parse(offerte.selbst_seit) || undefined,
            anzahlMitarbeiter: bb?.anzahlma,
            stellenprozente: bb?.stellenprozente?.toString()
        };

        // Validate taetigkeit has required fields
        if (!taetigkeit.taetigkeitsbeschreibung || !taetigkeit.taetigkeiten || taetigkeit.taetigkeiten.length === 0) {
            return new Observable((observer) => {
                observer.error(new Error('Unvollständige Tätigkeitsdaten'));
            });
        }

        // Build request
        const request = this.buildCalculateRequest(taetigkeit, bb, offerte.id, userId);

        this.logger.log('Calling calculateFuvBB with request:', request);

        // Call API and return first result
        return this.calculateFuvBB(request).pipe(
            map((result: CalculateBBResponse) => {
                if (!result || result.length === 0) {
                    throw new Error('Berechnung lieferte kein Ergebnis');
                }
                this.logger.log('BB calculation successful:', result[0]);
                return result[0];
            })
        );
    }
}
