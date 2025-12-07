import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LogFactoryService } from '@syrius/core';

import { MerkmalApiRequest, MerkmalApiResponse, MerkmalIndex } from '../models/merkmal.model';

@Injectable({
    providedIn: 'root'
})
export class MerkmalService {
    private http = inject(HttpClient);
    private translate = inject(TranslateService);
    private logger = inject(LogFactoryService).createLogger('MerkmalService');
    private apiUrl = '/api/offerte/fuvmerkmal';

    // Session storage key for merkmal cache
    private readonly STORAGE_KEY = 'fuv_merkmal_cache';
    private readonly STORAGE_TIMESTAMP_KEY = 'fuv_merkmal_cache_timestamp';
    private readonly CACHE_VALIDITY_MS = 1000 * 60 * 60 * 24; // 24 hours

    // Cache for merkmale to avoid repeated API calls
    private merkmalCache$: Observable<MerkmalApiResponse[]> | null = null;
    private merkmalIndexCache: MerkmalIndex | null = null;

    /**
     * Search for FUV Merkmal entries
     * Maps to GET /api/offerte/fuvmerkmal/searchFuvMerkmal
     */
    searchMerkmale(params: MerkmalApiRequest): Observable<MerkmalApiResponse[]> {
        let httpParams = new HttpParams();

        if (params.boid !== undefined) {
            httpParams = httpParams.set('boid', params.boid);
        }
        if (params.kurzbez !== undefined) {
            httpParams = httpParams.set('kurzbez', params.kurzbez);
        }
        if (params.bezeichnung !== undefined) {
            httpParams = httpParams.set('bezeichnung', params.bezeichnung);
        }
        if (params.stichdatum !== undefined) {
            httpParams = httpParams.set('stichdatum', params.stichdatum);
        }

        return this.http.get<MerkmalApiResponse[]>(`${this.apiUrl}/searchFuvMerkmal`, { params: httpParams });
    }

    /**
     * Get all merkmale (cached)
     * Loads all merkmale for the current date and caches them
     * Also stores in session storage for persistence across page reloads
     */
    getAllMerkmale(stichdatum?: string): Observable<MerkmalApiResponse[]> {
        if (!this.merkmalCache$) {
            // Check session storage first
            const cachedData = this.loadFromSessionStorage();
            if (cachedData) {
                this.merkmalCache$ = of(cachedData).pipe(shareReplay(1));
                return this.merkmalCache$;
            }

            // Use provided stichdatum or current date
            const dateStr = stichdatum || this.getCurrentDateString();

            // Empty params except stichdatum to get all merkmale
            const params: MerkmalApiRequest = {
                boid: '',
                kurzbez: '',
                bezeichnung: '',
                stichdatum: dateStr
            };

            this.merkmalCache$ = this.searchMerkmale(params).pipe(
                tap((merkmale) => {
                    // Save to session storage
                    this.saveToSessionStorage(merkmale);
                }),
                shareReplay(1) // Cache the result
            );
        }

        return this.merkmalCache$;
    }

    /**
     * Get merkmal index (boid -> FuvMerkmal mapping)
     * Builds an index for fast lookups by boid
     */
    getMerkmalIndex(stichdatum?: string): Observable<MerkmalIndex> {
        return this.getAllMerkmale(stichdatum).pipe(
            map((merkmale) => {
                if (!this.merkmalIndexCache) {
                    this.merkmalIndexCache = merkmale.reduce((index, merkmal) => {
                        index[merkmal.boid] = merkmal;
                        return index;
                    }, {} as MerkmalIndex);
                }
                return this.merkmalIndexCache;
            })
        );
    }

    /**
     * Get merkmal index by kurzbez (kurzbez -> FuvMerkmal mapping)
     * Builds an index for fast lookups by kurzbez
     */
    getMerkmalIndexByKurzbez(stichdatum?: string): Observable<MerkmalIndex> {
        return this.getAllMerkmale(stichdatum).pipe(
            map((merkmale) => {
                return merkmale.reduce((index, merkmal) => {
                    index[merkmal.kurzbez] = merkmal;
                    return index;
                }, {} as MerkmalIndex);
            })
        );
    }

    /**
     * Resolve a merkmal BOID to its localized bezeichnung
     * @param boid The BOID to resolve
     * @returns The localized bezeichnung or the boid if not found
     */
    resolveMerkmal(boid: string): Observable<string> {
        return this.getMerkmalIndex().pipe(
            map((index) => {
                const merkmal = index[boid];
                return merkmal ? this.getLocalizedBezeichnung(merkmal) : boid;
            })
        );
    }

    /**
     * Resolve multiple merkmal BOIDs to their localized bezeichnung
     * @param boids Array of BOIDs to resolve
     * @returns Map of boid -> localized bezeichnung
     */
    resolveMerkmale(boids: string[]): Observable<Record<string, string>> {
        return this.getMerkmalIndex().pipe(
            map((index) => {
                const result: Record<string, string> = {};
                boids.forEach((boid) => {
                    const merkmal = index[boid];
                    result[boid] = merkmal ? this.getLocalizedBezeichnung(merkmal) : boid;
                });
                return result;
            })
        );
    }

    /**
     * Get active merkmale for a specific date
     * @param stichdatum The reference date (format: YYYY-MM-DD)
     * @returns Array of active merkmale
     */
    getActiveMerkmale(stichdatum?: string): Observable<MerkmalApiResponse[]> {
        return this.getAllMerkmale(stichdatum).pipe(map((merkmale) => merkmale.filter((merkmal) => merkmal.aktiv === true)));
    }

    /**
     * Get the localized bezeichnung based on current language
     * @param merkmal The merkmal object
     * @returns The localized bezeichnung
     */
    getLocalizedBezeichnung(merkmal: MerkmalApiResponse): string {
        const currentLang = this.translate.currentLang || 'de';

        switch (currentLang) {
            case 'fr':
                return merkmal.bezeichnungfr || merkmal.bezeichnungdt;
            case 'it':
                return merkmal.bezeichnungit || merkmal.bezeichnungdt;
            case 'en':
            case 'de':
            default:
                return merkmal.bezeichnungdt;
        }
    }

    /**
     * Clear the cache to force reload on next request
     */
    clearCache(): void {
        this.merkmalCache$ = null;
        this.merkmalIndexCache = null;
        this.clearSessionStorage();
    }

    /**
     * Save merkmal entries to session storage
     */
    private saveToSessionStorage(merkmale: MerkmalApiResponse[]): void {
        try {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(merkmale));
            sessionStorage.setItem(this.STORAGE_TIMESTAMP_KEY, Date.now().toString());
        } catch (error) {
            this.logger.error('Failed to save merkmale to session storage:', error);
        }
    }

    /**
     * Load merkmal entries from session storage
     * Returns null if cache is invalid or doesn't exist
     */
    private loadFromSessionStorage(): MerkmalApiResponse[] | null {
        try {
            const cachedData = sessionStorage.getItem(this.STORAGE_KEY);
            const timestamp = sessionStorage.getItem(this.STORAGE_TIMESTAMP_KEY);

            if (!cachedData || !timestamp) {
                return null;
            }

            // Check if cache is still valid
            const cacheAge = Date.now() - parseInt(timestamp, 10);
            if (cacheAge > this.CACHE_VALIDITY_MS) {
                this.clearSessionStorage();
                return null;
            }

            return JSON.parse(cachedData) as MerkmalApiResponse[];
        } catch (error) {
            this.logger.error('Failed to load merkmale from session storage:', error);
            return null;
        }
    }

    /**
     * Clear session storage cache
     */
    private clearSessionStorage(): void {
        try {
            sessionStorage.removeItem(this.STORAGE_KEY);
            sessionStorage.removeItem(this.STORAGE_TIMESTAMP_KEY);
        } catch (error) {
            this.logger.error('Failed to clear merkmal session storage:', error);
        }
    }

    /**
     * Get current date as string in YYYY-MM-DD format
     */
    private getCurrentDateString(): string {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    /**
     * Prefetch all merkmale and store in session storage
     * This should be called during app initialization
     */
    prefetchMerkmale(stichdatum?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.getAllMerkmale(stichdatum).subscribe({
                next: () => {
                    this.logger.log('Merkmale prefetched successfully');
                    resolve();
                },
                error: (error) => {
                    this.logger.error('Failed to prefetch merkmale:', error);
                    reject(error);
                }
            });
        });
    }
}
