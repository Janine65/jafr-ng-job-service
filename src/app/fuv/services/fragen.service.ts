import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Antwort, Frage, Fragebogen } from '@app/fuv/models/fragen.model';
import { LogFactoryService, Logger } from '@syrius/core';

/**
 * Service for FUV Fragen (Application Questions) API endpoints
 */
@Injectable({
    providedIn: 'root'
})
export class FragenService {
    private http = inject(HttpClient);
    private logFactory = inject(LogFactoryService);
    private logger: Logger = this.logFactory.createLogger('FragenService');

    private apiUrlFrage = '/api/offerte/fuvfrage';
    private apiUrlFragebogen = '/api/offerte/fuvfragebogen';

    // Session storage keys for caching
    private readonly STORAGE_KEY_FRAGEN = 'fuv_fragen_cache';
    private readonly STORAGE_TIMESTAMP_KEY_FRAGEN = 'fuv_fragen_cache_timestamp';
    private readonly CACHE_VALIDITY_MS = 1000 * 60 * 60 * 24; // 24 hours

    // Cache for Fragen to avoid repeated API calls
    private fragenCache$: Observable<Frage[]> | null = null;

    /**
     * Search FUV Fragen by Stichdatum (reference date)
     * Maps to GET /api/offerte/fuvfrage/searchFuvFrage
     *
     * @param stichdatum Reference date (format: YYYY-MM-DD), defaults to today
     * @returns Observable with array of FuvFrage
     */
    searchFuvFrage(stichdatum?: string): Observable<Frage[]> {
        // Use today's date if not provided
        if (!stichdatum) {
            const today = new Date();
            stichdatum = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        }

        // Check if we have cached data for this date
        if (this.fragenCache$) {
            const cachedData = this.loadFromSessionStorage();
            if (cachedData && cachedData.stichdatum === stichdatum) {
                this.logger.debug('Using cached fragen data for date:', stichdatum);
                return this.fragenCache$;
            }
        }

        // Fetch from API
        const params = new HttpParams().set('stichdatum', stichdatum);

        this.fragenCache$ = this.http.get<Frage[]>(`${this.apiUrlFrage}/searchFuvFrage`, { params }).pipe(
            tap((fragen) => {
                this.logger.debug('Fetched fragen from API:', fragen.length, 'questions');
                // Save to session storage with stichdatum
                this.saveToSessionStorage(fragen, stichdatum);
            }),
            shareReplay(1) // Cache the result
        );

        return this.fragenCache$;
    }

    /**
     * Read a specific FUV Frage by ID
     * Maps to GET /api/offerte/fuvfrage/readFuvFrage
     *
     * @param id Frage ID
     * @returns Observable with FuvFrage
     */
    readFuvFrage(id: number): Observable<Frage> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.get<Frage>(`${this.apiUrlFrage}/readFuvFrage`, { params });
    }

    /**
     * Insert a new FUV Frage
     * Maps to PUT /api/offerte/fuvfrage/insertFuvFrage
     *
     * @param frage Frage data to insert
     * @returns Observable with API response
     */
    insertFuvFrage(frage: Partial<Frage>): Observable<any> {
        // Clear cache after insert
        this.clearCache();
        return this.http.put<any>(`${this.apiUrlFrage}/insertFuvFrage`, frage);
    }

    /**
     * Update an existing FUV Frage
     * Maps to POST /api/offerte/fuvfrage/updateFuvFrage
     *
     * @param frage Frage data to update
     * @returns Observable with API response
     */
    updateFuvFrage(frage: Partial<Frage>): Observable<any> {
        // Clear cache after update
        this.clearCache();
        return this.http.post<any>(`${this.apiUrlFrage}/updateFuvFrage`, frage);
    }

    /**
     * Delete a FUV Frage by ID
     * Maps to DELETE /api/offerte/fuvfrage/deleteFuvFrage
     *
     * @param id Frage ID to delete
     * @returns Observable with API response
     */
    deleteFuvFrage(id: number): Observable<any> {
        // Clear cache after delete
        this.clearCache();
        const params = new HttpParams().set('id', id.toString());
        return this.http.delete<any>(`${this.apiUrlFrage}/deleteFuvFrage`, { params });
    }

    /**
     * Load FUV Fragen with additional processing
     * Maps to GET /api/offerte/fuvfrage/loadFuvFragen
     *
     * @returns Observable with array of FuvFrage
     */
    loadFuvFragen(): Observable<Frage[]> {
        return this.http.get<Frage[]>(`${this.apiUrlFrage}/loadFuvFragen`);
    }

    // ==================== FRAGEBOGEN (QUESTIONNAIRE/ANSWERS) ENDPOINTS ====================

    /**
     * Search FUV Fragebogen by person_boid
     * Maps to GET /api/offerte/fuvfragebogen/searchFuvFragebogen
     *
     * @param person_boid Person BOID from the offerte store
     * @param lokal Whether to search locally (default: false)
     * @returns Observable with array of FuvFragebogen
     */
    searchFuvFragebogen(person_boid: string, lokal: boolean = false): Observable<Fragebogen[]> {
        const params = new HttpParams().set('person_boid', person_boid).set('lokal', lokal.toString());

        return this.http.get<Fragebogen[]>(`${this.apiUrlFragebogen}/searchFuvFragebogen`, { params }).pipe(
            tap((fragebogen) => {
                this.logger.debug('Fetched fragebogen for person:', person_boid, 'Count:', fragebogen.length);
                if (fragebogen.length > 0) {
                    this.logger.debug('Total answers:', fragebogen[0].antworten?.length || 0);
                }
            })
        );
    }

    /**
     * Read a specific FUV Fragebogen by ID
     * Maps to GET /api/offerte/fuvfragebogen/readFuvFragebogen
     *
     * @param id Fragebogen ID
     * @returns Observable with FuvFragebogen
     */
    readFuvFragebogen(id: number): Observable<Fragebogen> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.get<Fragebogen>(`${this.apiUrlFragebogen}/readFuvFragebogen`, { params });
    }

    /**
     * Insert a new FUV Fragebogen
     * Maps to PUT /api/offerte/fuvfragebogen/insertFuvFragebogen
     *
     * @param fragebogen Fragebogen data to insert
     * @returns Observable with API response
     */
    insertFuvFragebogen(fragebogen: Partial<Fragebogen>): Observable<any> {
        return this.http.put<any>(`${this.apiUrlFragebogen}/insertFuvFragebogen`, fragebogen);
    }

    /**
     * Update an existing FUV Fragebogen
     * Maps to POST /api/offerte/fuvfragebogen/updateFuvFragebogen
     *
     * @param fragebogen Fragebogen data to update
     * @returns Observable with API response
     */
    updateFuvFragebogen(fragebogen: Partial<Fragebogen>): Observable<any> {
        return this.http.post<any>(`${this.apiUrlFragebogen}/updateFuvFragebogen`, fragebogen);
    }

    /**
     * Delete a FUV Fragebogen by ID
     * Maps to DELETE /api/offerte/fuvfragebogen/deleteFuvFragebogen
     *
     * @param id Fragebogen ID to delete
     * @returns Observable with API response
     */
    deleteFuvFragebogen(id: number): Observable<any> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.delete<any>(`${this.apiUrlFragebogen}/deleteFuvFragebogen`, { params });
    }

    // ==================== HELPER METHODS ====================

    /**
     * Map answers from Fragebogen to questions by frage_boid
     * Creates a map of frage_boid -> FuvAntwort for easy lookup
     *
     * @param fragebogen Fragebogen containing answers
     * @returns Map of frage_boid to FuvAntwort
     */
    mapAnswersToQuestions(fragebogen: Fragebogen): Map<string, Antwort> {
        const answerMap = new Map<string, Antwort>();

        if (fragebogen && fragebogen.antworten) {
            fragebogen.antworten.forEach((antwort) => {
                answerMap.set(antwort.frage_boid, antwort);
            });
        }

        return answerMap;
    }

    /**
     * Get answer value for a specific question (by frage_boid)
     * Returns the codevalue or textvalue depending on the question type
     *
     * @param fragebogen Fragebogen containing answers
     * @param frage_boid Question BOID to lookup
     * @returns Answer value (string) or null if not found
     */
    getAnswerForQuestion(fragebogen: Fragebogen | null, frage_boid: string): string | null {
        if (!fragebogen || !fragebogen.antworten) {
            return null;
        }

        const antwort = fragebogen.antworten.find((a) => a.frage_boid === frage_boid);
        return antwort ? antwort.codevalue || antwort.textvalue : null;
    }

    /**
     * Check if a question has been answered
     *
     * @param fragebogen Fragebogen containing answers
     * @param frage_boid Question BOID to check
     * @returns true if question has an answer (codevalue or textvalue)
     */
    hasAnswer(fragebogen: Fragebogen | null, frage_boid: string): boolean {
        const answer = this.getAnswerForQuestion(fragebogen, frage_boid);
        return answer !== null && answer !== '';
    }

    /**
     * Group questions by titel_boid (question groups like Frage 1, Frage 2, etc.)
     * Returns a map of titel_boid to array of questions, sorted by sort field
     *
     * @param fragen Array of all questions
     * @returns Map of titel_boid to sorted questions in that group
     */
    groupQuestionsByTitle(fragen: Frage[]): Map<string, Frage[]> {
        const grouped = new Map<string, Frage[]>();

        fragen.forEach((frage) => {
            if (!grouped.has(frage.titel_boid)) {
                grouped.set(frage.titel_boid, []);
            }
            grouped.get(frage.titel_boid)!.push(frage);
        });

        // Sort questions within each group by sort field
        grouped.forEach((questions) => {
            questions.sort((a, b) => a.sort.localeCompare(b.sort));
        });

        return grouped;
    }

    /**
     * Get main question from a group (first CodeTyp with mandatory=true)
     *
     * @param questions Array of questions in a group
     * @returns Main question or first question if no mandatory CodeTyp found
     */
    getMainQuestion(questions: Frage[]): Frage | null {
        // Find first mandatory CodeTyp question
        const main = questions.find((q) => q.variabletyp === 'CodeTyp' && q.mandatory);
        return main || questions[0] || null;
    }

    /**
     * Get follow-up questions (Text type or non-mandatory CodeTyp)
     *
     * @param questions Array of questions in a group
     * @returns Array of follow-up questions
     */
    getFollowUpQuestions(questions: Frage[]): Frage[] {
        // First mandatory CodeTyp is the main question, everything else is follow-up
        const mainIndex = questions.findIndex((q) => q.variabletyp === 'CodeTyp' && q.mandatory);
        if (mainIndex === -1) return [];

        return questions.slice(mainIndex + 1);
    }

    /**
     * Prefetch fragen data for today's date
     * Should be called on app initialization
     */
    prefetchFragen(): void {
        this.logger.debug('Prefetching fragen data...');
        this.searchFuvFrage().subscribe({
            next: (fragen) => {},
            error: (error) => {
                this.logger.error('Prefetch failed:', error);
            }
        });
    }

    /**
     * Clear the in-memory and session storage cache
     */
    clearCache(): void {
        this.fragenCache$ = null;
        sessionStorage.removeItem(this.STORAGE_KEY_FRAGEN);
        sessionStorage.removeItem(this.STORAGE_TIMESTAMP_KEY_FRAGEN);
        this.logger.debug('Cache cleared');
    }

    /**
     * Load fragen data from session storage if valid
     */
    private loadFromSessionStorage(): { fragen: Frage[]; stichdatum: string } | null {
        try {
            const cached = sessionStorage.getItem(this.STORAGE_KEY_FRAGEN);
            const timestamp = sessionStorage.getItem(this.STORAGE_TIMESTAMP_KEY_FRAGEN);

            if (!cached || !timestamp) {
                return null;
            }

            const cacheAge = Date.now() - parseInt(timestamp, 10);
            if (cacheAge > this.CACHE_VALIDITY_MS) {
                this.logger.debug('Cache expired, will fetch fresh data');
                return null;
            }

            const data = JSON.parse(cached);
            this.logger.debug('Loaded fragen from session storage:', data.fragen.length, 'questions');
            return data;
        } catch (error) {
            this.logger.error('Error loading from session storage:', error);
            return null;
        }
    }

    /**
     * Save fragen data to session storage with timestamp
     */
    private saveToSessionStorage(fragen: Frage[], stichdatum: string): void {
        try {
            const data = { fragen, stichdatum };
            sessionStorage.setItem(this.STORAGE_KEY_FRAGEN, JSON.stringify(data));
            sessionStorage.setItem(this.STORAGE_TIMESTAMP_KEY_FRAGEN, Date.now().toString());
            this.logger.debug('Saved fragen to session storage:', fragen.length, 'questions');
        } catch (error) {
            this.logger.error('Error saving to session storage:', error);
        }
    }
}
