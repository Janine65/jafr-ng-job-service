import { forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, Injector } from '@angular/core';
import {
    DEFAULT_AVB_VERL, DEFAULT_BB_GUELTBIS, DEFAULT_OFFERTE_GUELTBIS, DEFAULT_VERKAUFSKANAL_VERL,
    DEFAULT_VERTRAGSDAUER, OFFERTE_ART_VERL
} from '@app/fuv/components/offerte-police/police.constants';
import { Offerte, OfferteSearchCriteria, OfferteUtils } from '@app/fuv/models/offerte.model';
import { Vertrag } from '@app/fuv/models/vertrag.model';
import { VertragService } from '@app/fuv/services/vertrag.service';
import { AppMessageService, LogFactoryService } from '@syrius/core';

import { BBService } from './bb.service';
import { BetriebService } from './betrieb.service';
import { ChecklisteService } from './checkliste.service';
import { PersonService } from './person.service';

/**
 * Service for managing FuvOfferte data via API endpoints
 * API Base: /offerte/fuvofferte
 */
@Injectable({
    providedIn: 'root'
})
export class OfferteService {
    private http = inject(HttpClient);
    private vertragService = inject(VertragService);
    private bbService = inject(BBService);
    private checklisteService = inject(ChecklisteService);
    private injector = inject(Injector); // Use Injector for lazy loading to avoid circular dependency
    private messageService = inject(AppMessageService);
    private logger = inject(LogFactoryService).createLogger('OfferteService');
    private apiUrl = `/api/offerte/fuvofferte`;

    constructor() {}

    /**
     * Search for offerten based on criteria
     * Endpoint: GET /offerte/fuvofferte/searchFuvOfferte
     * @param criteria Search criteria (all optional)
     * @returns Observable of Offerte array
     */
    searchOfferten(criteria: OfferteSearchCriteria = {}): Observable<Offerte[]> {
        let params = new HttpParams();
        Object.keys(criteria).forEach((key) => {
            const value = criteria[key as keyof OfferteSearchCriteria];
            if (value !== undefined && value !== null && value !== '') {
                params = params.set(key, value.toString());
            }
        });

        return this.http.get<any>(`${this.apiUrl}/searchFuvOfferte`, { params }).pipe(
            map((response) => {
                // API returns array directly, not wrapped in { result: [...] }
                const results = Array.isArray(response) ? response : response?.result || [];
                return results.map((item: any) => OfferteUtils.enrichFromApi(item));
            })
        );
    }

    /**
     * Get all offerten, optionally filtered by partnernr
     * @param partnernr Optional partner number filter
     * @returns Observable of Offerte array
     */
    getOfferten(partnernr?: string): Observable<Offerte[]> {
        const criteria: OfferteSearchCriteria = {};
        if (partnernr) {
            criteria.person_partnernr = partnernr;
        }
        return this.searchOfferten(criteria);
    }

    /**
     * Search offerten with flexible criteria
     * @param criteria Search criteria
     * @returns Observable of Offerte array
     */
    searchOfferte(criteria: OfferteSearchCriteria): Observable<Offerte[]> {
        return this.searchOfferten(criteria);
    }

    /**
     * Read a specific offerte by ID
     * Endpoint: GET /offerte/fuvofferte/readFuvOfferte
     * @param id Offerte ID
     * @returns Observable of Offerte
     */
    getOfferteById(id: string): Observable<Offerte | undefined> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.get<any>(`${this.apiUrl}/readFuvOfferte`, { params }).pipe(
            map((response) => {
                // API may return object directly or wrapped in { result: {...} }
                const result = response?.result || response;
                return result ? OfferteUtils.enrichFromApi(result) : undefined;
            })
        );
    }

    /**
     * Load complete offerte data with all related entities
     * Endpoint: GET /offerte/fuvofferte/readFuvOfferte
     * @param id Offerte id
     * @returns Observable of complete Offerte with all related data
     */
    loadFuvOfferte(id: string): Observable<Offerte | undefined> {
        const params = new HttpParams().set('id', id);
        return this.http.get<any>(`${this.apiUrl}/readFuvOfferte`, { params }).pipe(
            map((response) => {
                // API may return object directly or wrapped in { result: {...} }
                return response ? OfferteUtils.enrichFromApi(response) : undefined;
            })
        );
    }

    /**
     * Insert a new offerte
     * Endpoint: PUT /offerte/fuvofferte/insertFuvOfferte
     * @param offerte Offerte data to insert
     * @param offerteMain Optional query parameter
     * @returns Observable of API response
     */
    insertOfferte(offerte: Partial<Offerte>, offerteMain?: any): Observable<any> {
        let params = new HttpParams();
        if (offerteMain !== undefined) {
            params = params.set('offerteMain', JSON.stringify(offerteMain));
        }

        const apiData = OfferteUtils.prepareForApi(offerte);
        return this.http.put<any>(`${this.apiUrl}/insertFuvOfferte`, apiData, { params }).pipe(
            tap((response) => {
                // Show success toast when offerte is created
                const createdOfferte = Array.isArray(response) ? response[0] : response;
                if (createdOfferte && createdOfferte.offertenr) {
                    this.messageService.showSuccess(`Offerte ${createdOfferte.offertenr} wurde erfolgreich angelegt`, { life: 4000 });
                }
            })
        );
    }

    /**
     * Update an existing offerte
     * Endpoint: POST /offerte/fuvofferte/updateFuvOfferte
     * @param offerte Offerte data to update
     * @param offerteMain Optional query parameter
     * @returns Observable of API response
     */
    updateOfferte(offerte: Partial<Offerte>, offerteMain?: any): Observable<any> {
        let params = new HttpParams();
        if (offerteMain !== undefined) {
            params = params.set('offerteMain', JSON.stringify(offerteMain));
        }

        const apiData = OfferteUtils.prepareForApi(offerte);
        return this.http.post<any>(`${this.apiUrl}/updateFuvOfferte`, apiData, { params });
    }

    /**
     * Delete an offerte by ID
     * Endpoint: DELETE /offerte/fuvofferte/deleteFuvOfferte
     * @param id Offerte ID
     * @returns Observable of API response
     */
    deleteOfferte(id: string): Observable<any> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.delete<any>(`${this.apiUrl}/deleteFuvOfferte`, { params });
    }

    /**
     * Save an offerte (insert if new, update if existing)
     * @param offerte Offerte data to save
     * @returns Observable of API response
     */
    saveOfferte(offerte: Partial<Offerte>): Observable<any> {
        if (offerte.id) {
            return this.updateOfferte(offerte);
        } else {
            return this.insertOfferte(offerte);
        }
    }

    /**
     * Creates and persists a Vertragsverlängerung offerte from a vertrag.
     * This is the complete flow:
     * 1. Maps vertrag to offerte data (including BB and Checkliste)
     * 2. Refreshes person and betrieb data from backend
     * 3. Inserts the offerte with complete data
     *
     * @param vertrag The vertrag to create a Verlängerung from
     * @returns Observable of the created offerte
     */
    mapVertragToOfferte(vertrag: Vertrag): Observable<Partial<Offerte>> {
        // LEGACY APP FLOW: The gueltab comes from checklist.gueltig_ab which is always Jan 1 of next year
        // This is the standard renewal date for all Verlängerungen
        const nextYear = new Date().getFullYear() + 1;
        const gueltab = `${nextYear}-01-01`;

        // LEGACY APP FLOW: ablaufdatum is gueltab + 4 years, ending Dec 31
        // Example: gueltab = 2026-01-01 → ablaufdatum = 2029-12-31 (4 years duration)
        const ablaufdatumDate = new Date(gueltab);
        ablaufdatumDate.setFullYear(ablaufdatumDate.getFullYear() + 4); // Add 4 years
        ablaufdatumDate.setMonth(11); // December (0-indexed)
        ablaufdatumDate.setDate(31); // Last day of month
        const ablaufdatum = ablaufdatumDate.toISOString().split('T')[0]; // YYYY-MM-DD format

        this.logger.debug('Verlängerung dates (matching legacy app flow)', {
            gueltab,
            ablaufdatum,
            contractDuration: '4 years',
            vertragEndDate: vertrag.gueltbis
        });

        // LEGACY APP FLOW: BB search uses the offerte.gueltab as stichdatum
        // This is the checklist's gueltig_ab date (Jan 1 of next year)
        const bbSearchStichdatum = gueltab;

        // Load additional data: FuvBB and FuvCheckliste by vertrag_boid
        const bbObservable = vertrag.boid ? this.bbService.searchFuvBB({ vertrag_boid: vertrag.boid, stichdatum: bbSearchStichdatum }) : of([]);

        const checklisteObservable = vertrag.boid ? this.checklisteService.searchFuvChecklisteByVertrag(vertrag.boid).pipe(map((checklisten) => (checklisten && checklisten.length > 0 ? checklisten : []))) : of([]);

        // Combine all requests
        return forkJoin({
            bb: bbObservable,
            checkliste: checklisteObservable
        }).pipe(
            map(({ bb, checkliste }) => {
                this.logger.debug('Loaded additional data for vertrag', {
                    vertragsnr: vertrag.vertragsnr,
                    bbCount: bb.length,
                    checklisteCount: checkliste.length,
                    gueltab,
                    ablaufdatum,
                    bbSearchStichdatum
                });

                // Map vertrag data to offerte structure
                const offerteData: Partial<Offerte> = {
                    // Reference BOIDs
                    person_boid: vertrag.person_boid,
                    betrieb_boid: vertrag.betrieb_boid,
                    vertrag_boid: vertrag.boid,

                    // Nested objects
                    person: vertrag.person,
                    betrieb: vertrag.betrieb,

                    // Payment information from vertrag
                    iban: vertrag.iban,
                    kontoinhaber: vertrag.kontoinhaber,
                    praemienzahlung: this.mapZahlungsartToCode(vertrag.zahlungsart), // Map text/code to standardized code

                    // Additional fields from first produkt
                    avb: DEFAULT_AVB_VERL, // Use latest AVB for Verlängerung
                    stellung_im_betrieb: vertrag.produkt?.[0]?.stellung_im_betrieb,
                    beschaeft_grad: vertrag.produkt?.[0]?.beschaeft_grad,
                    klasse: vertrag.produkt?.[0]?.klasse,
                    basisstufe: vertrag.produkt?.[0]?.stufe ?? undefined,

                    // Set as Verlängerung
                    art: OFFERTE_ART_VERL,
                    status: 'Offerte_Neu', // Correct initial status
                    gueltab: gueltab, // LEGACY APP: Jan 1 of next year (from checklist.gueltig_ab)
                    gueltbis: DEFAULT_OFFERTE_GUELTBIS, // Far-future date for varianten step
                    ablaufdatum: ablaufdatum, // LEGACY APP: gueltab + 3 years, Dec 31
                    kanal: DEFAULT_VERKAUFSKANAL_VERL // Default for Verlängerung: COD_DirektmarketingAktionen
                };

                // Process BB data if available (take first result - template with id=0)
                if (bb && bb.length > 0) {
                    const loadedBB = bb[0];
                    this.logger.debug(loadedBB);

                    this.logger.debug('Processing BB template from searchFuvBB', {
                        bb: loadedBB,
                        hasId: !!loadedBB.id,
                        hasBoid: !!loadedBB.boid,
                        hasTaetigkeit: !!loadedBB.taetigkeit,
                        hasAnzahlma: !!loadedBB.anzahlma,
                        hasStellenprozente: !!loadedBB.stellenprozente,
                        bb2merkmalCount: loadedBB.bb2merkmal?.length || 0
                    });

                    // Generate a new BOID for the BB (template has boid=null)
                    const newBBBoid = this.bbService.generateUUID();

                    // Build complete BB object for offerte
                    const bbForOfferte = {
                        ...loadedBB,
                        id: 0, // Template ID
                        boid: newBBBoid, // New BOID for this offerte
                        gueltab: gueltab, // LEGACY APP: Same as offerte.gueltab (Jan 1 of next year)
                        gueltbis: DEFAULT_BB_GUELTBIS, // Standard far-future date (3000-01-01)
                        aufgenommenam: new Date().toISOString().split('T')[0], // Today
                        betrieb_boid: vertrag.betrieb_boid ?? null, // LEGACY APP: Link to betrieb
                        person_boid: vertrag.person_boid ?? null, // LEGACY APP: Link to person
                        agenturkompetenz: 'SYR_Code_ZERO', // LEGACY APP: Default value
                        // Generate beschreibung from betrieb and person
                        beschreibung: vertrag.person ? `AFC ${vertrag.person.name || ''} ${vertrag.person.vorname || ''}`.trim() : loadedBB.beschreibung,
                        // Ensure bb2merkmal has the new bb_boid
                        bb2merkmal: (loadedBB.bb2merkmal || []).map((merkmal: any) => ({
                            ...merkmal,
                            bb_boid: newBBBoid
                        }))
                    };

                    offerteData.bb = bbForOfferte;
                    offerteData.bb_boid = newBBBoid;

                    this.logger.debug('Created BB for offerte', {
                        bb_boid: newBBBoid,
                        bb2merkmalCount: bbForOfferte.bb2merkmal?.length || 0
                    });

                } else {
                    // BB not found - tätigkeiten fields will remain empty
                    this.logger.warn('No BB template found for vertrag - tätigkeiten fields will be empty', {
                        vertrag_boid: vertrag.boid,
                        bbSearchStichdatum: bbSearchStichdatum
                    });
                }

                // Process Checkliste if available (take most recent)
                if (checkliste && checkliste.length > 0) {
                    const loadedCheckliste = checkliste[0];

                    // Build checkliste object for offerte (no ID yet, will be set by backend)
                    const checklisteForOfferte = {
                        ...loadedCheckliste,
                        id: undefined, // Will be assigned by backend
                        gueltig_ab: gueltab, // LEGACY APP: Jan 1 of next year (matches offerte.gueltab)
                        vertrag_boid: vertrag.boid, // Link to original vertrag
                        offerte_id: undefined // Will be set after offerte insert
                    };

                    offerteData.checkliste = checklisteForOfferte;
                    this.logger.debug('Added Checkliste to offerte data', { checkliste: checklisteForOfferte });
                }

                return offerteData;
            })
        );
    }

    /**
     * Create and persist a Vertragsverlängerung offerte from an existing vertrag
     * This method performs the complete flow:
     * 1. Maps vertrag to offerte structure (loads BB and Checkliste templates)
     * 2. Refreshes FuvPerson and FuvBetrieb from Syrius
     * 3. Inserts the offerte in backend WITH the complete BB and Checkliste data
     * @param vertrag The complete vertrag object to create offerte from
     * @returns Observable with the created Offerte
     */
    createAndPersistVerlaengerung(vertrag: Vertrag): Observable<Offerte> {
        return this.mapVertragToOfferte(vertrag).pipe(
            switchMap((offerteData) => {
                this.logger.debug('Offerte data mapped, now refreshing person and betrieb', offerteData);

                // Step 1: Refresh person and betrieb from Syrius
                if (!offerteData.person_boid || !offerteData.betrieb_boid) {
                    throw new Error('Cannot create offerte - missing person_boid or betrieb_boid');
                }

                // Lazy load PersonService and BetriebService to avoid circular dependency
                const personService = this.injector.get(PersonService);
                const betriebService = this.injector.get(BetriebService);

                return forkJoin({
                    person: personService.refreshPerson(offerteData.person_boid),
                    betrieb: betriebService.refreshBetrieb(offerteData.betrieb_boid),
                    offerteData: of(offerteData), // Pass through the offerte data
                    vertrag: of(vertrag) // Pass through the original vertrag for produkt access
                });
            }),
            switchMap(({ person, betrieb, offerteData, vertrag }) => {
                this.logger.debug('Person and Betrieb refreshed, now inserting offerte with complete data');

                // Get single person and betrieb objects (not arrays)
                // Handle malformed nested structures like {0: {actual object}}
                let personObject = Array.isArray(person) ? person[0] : person;
                if (personObject && typeof personObject === 'object' && '0' in personObject) {
                    personObject = (personObject as any)['0'];
                    this.logger.warn('Person had malformed nested structure, unwrapped it');
                }

                let betriebObject = Array.isArray(betrieb) ? betrieb[0] : betrieb;
                if (betriebObject && typeof betriebObject === 'object' && '0' in betriebObject) {
                    betriebObject = (betriebObject as any)['0'];
                    this.logger.warn('Betrieb had malformed nested structure, unwrapped it');
                }

                // Build complete offerte object with BB and Checkliste
                const offerteToInsert: Partial<Offerte> = {
                    // Core offerte fields
                    art: OFFERTE_ART_VERL,
                    status: 'Offerte_Neu',
                    gueltab: offerteData.gueltab,
                    gueltbis: undefined,
                    ablaufdatum: offerteData.ablaufdatum,
                    avb: offerteData.avb,

                    // Reference BOIDs
                    person_boid: offerteData.person_boid,
                    betrieb_boid: offerteData.betrieb_boid,
                    vertrag_boid: offerteData.vertrag_boid,
                    bb_boid: offerteData.bb_boid,

                    // Nested objects (refreshed from Syrius)
                    person: personObject as any,
                    betrieb: betriebObject as any,

                    // BB and Checkliste objects (from templates)
                    bb: offerteData.bb,
                    checkliste: offerteData.checkliste,

                    // Fields from vertrag/produkt
                    stellung_im_betrieb: offerteData.stellung_im_betrieb,
                    beschaeft_grad: offerteData.beschaeft_grad,
                    klasse: offerteData.klasse,
                    basisstufe: offerteData.basisstufe,
                    kanal: offerteData.kanal,

                    // Payment information
                    iban: offerteData.iban,
                    kontoinhaber: offerteData.kontoinhaber,
                    praemienzahlung: offerteData.praemienzahlung,

                    // Taetigkeit data with defaults
                    // Initialize variante array
                    // Variante A (1) is built from the vertrag's produkt data and set as active (status: true)
                    // Varianten B (2) and C (3) are initialized as empty/inactive
                    variante: [
                        {
                            id: 0,
                            status: true, // Variante A is active by default for Verlängerung
                            verdienst: vertrag.produkt?.[0]?.verdienst || 0, // Extract jahresverdienst from produkt
                            taggeld: vertrag.produkt?.[0]?.taggeld || undefined, // Extract taggeld ab from produkt
                            variante: 1
                        },
                        {
                            id: 0,
                            status: false,
                            verdienst: 0,
                            variante: 2
                        },
                        {
                            id: 0,
                            status: false,
                            verdienst: 0,
                            variante: 3
                        }
                    ]
                };

                this.logger.debug('Inserting offerte with complete structure', {
                    hasBB: !!offerteToInsert.bb,
                    hasCheckliste: !!offerteToInsert.checkliste,
                    bb_boid: offerteToInsert.bb_boid,
                    varianteCount: offerteToInsert.variante?.length,
                    varianteA: {
                        status: offerteToInsert.variante?.[0]?.status,
                        verdienst: offerteToInsert.variante?.[0]?.verdienst,
                        taggeld: offerteToInsert.variante?.[0]?.taggeld
                    },
                    praemienzahlung: offerteToInsert.praemienzahlung,
                    zahlungsartOriginal: vertrag.zahlungsart
                });

                return this.insertOfferte(offerteToInsert).pipe(
                    map((insertedOfferte) => {
                        this.logger.debug('Offerte inserted successfully (raw from API)', insertedOfferte);

                        // Get the offerte object (may be wrapped in array)
                        const offerteData = Array.isArray(insertedOfferte) ? insertedOfferte[0] : insertedOfferte;

                        // Enrich the offerte with UI fields (including rebuilding taetigkeit from BB)
                        const enrichedOfferte = OfferteUtils.enrichFromApi(offerteData);

                        return enrichedOfferte;
                    })
                );
            })
        );
    }

    /**
     * Policieren - Mark offerte as finalized (convert to police/contract)
     * Endpoint: PUT /offerte/fuvpolicierung/policierenOfferte
     * @param offerteId The ID of the offerte to policieren
     * @returns Observable of API response
     */
    policierenOfferte(offerteId: number): Observable<any> {
        const params = new HttpParams().set('offerte_id', offerteId.toString());
        return this.http.put<any>(`/api/offerte/fuvpolicierung/policierenOfferte`, null, { params });
    }

    /**
     * Policieren Verlängerung - Mark renewal offerte as finalized
     * Endpoint: PUT /offerte/fuvpolicierung/policierenVerlaengerung
     * @param offerteId The ID of the offerte to policieren
     * @returns Observable of API response
     */
    policierenVerlaengerung(offerteId: number): Observable<any> {
        const params = new HttpParams().set('offerte_id', offerteId.toString());
        return this.http.put<any>(`/api/offerte/fuvpolicierung/policierenVerlaengerung`, null, { params });
    }

    /**
     * HACK: Map zahlungsart string or code to standardized code
     * Handles both direct codes (COD_MONAT, COD_QUARTAL, etc.) and text formats
     * Text formats can be:
     * - "3 monatlich" / "3 monthly" → COD_MONAT
     * - "2 vierteljährlich" / "2 quarterly" → COD_QUARTAL
     * - "1 halbjährlich" / "1 semi-annually" → COD_HALBJAHR
     * - "0 jährlich" / "0 annually" → COD_JAHR
     * Supports German umlauts (ä, ö, ü) and their ae/oe/ue equivalents
     *
     * @param zahlungsart Input string (code or text)
     * @returns Standardized code or undefined if no match
     */
    private mapZahlungsartToCode(zahlungsart: string | undefined): string | undefined {
        if (!zahlungsart) return undefined;

        const normalized = zahlungsart.trim().toUpperCase();

        // Check if already a code
        if (normalized.startsWith('COD_')) {
            return zahlungsart; // Return original casing
        }

        // Map text to codes using regex
        // Match pattern: optional number + optional whitespace + payment period text
        // Support umlauts (ä/ae, ö/oe, ü/ue) and case-insensitive

        // Monthly: monatlich, monthly, monat
        if (/^[0-9\s]*(MONAT|MONTHLY)/i.test(normalized)) {
            return 'COD_MONAT';
        }

        // Quarterly: vierteljährlich, vierteljährlich, quarterly, quartal
        if (/^[0-9\s]*(VIERTELJ[AÄ]HRL?|QUARTERLY|QUARTAL)/i.test(normalized)) {
            return 'COD_QUARTAL';
        }

        // Semi-annually: halbjährlich, halbjährlich, semi-annually, halbjahr
        if (/^[0-9\s]*(HALBJ[AÄ]HRL?|SEMI[\s-]?ANN|HALBJAHR)/i.test(normalized)) {
            return 'COD_HALBJAHR';
        }

        // Annually: jährlich, jaehrlich, annually, jahr
        if (/^[0-9\s]*(J[AÄ]HRL?|ANN|JAHR)/i.test(normalized)) {
            return 'COD_JAHR';
        }

        this.logger.warn(`Could not map zahlungsart to code: ${zahlungsart}`);
        return undefined;
    }

    /**
     * Ensure a date value is an ISO string (YYYY-MM-DD)
     * Accepts string | Date | undefined and returns string | undefined
     */
    private ensureISOString(date: string | Date | undefined): string | undefined {
        if (!date) return undefined;
        if (typeof date === 'string') return date.split('T')[0]; // Already string, ensure no time part
        return date.toISOString().split('T')[0]; // Convert Date to ISO string
    }
}
