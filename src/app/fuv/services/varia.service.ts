import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LogFactoryService } from '@syrius/core';

/**
 * Service for various small API requests that don't fit into other specific services
 */
@Injectable({
    providedIn: 'root'
})
export class VariaService {
    private http = inject(HttpClient);
    private logger = inject(LogFactoryService).createLogger('VariaService');
    private apiUrl = '/api/offerte/fuvmerkmal';

    // Session storage keys
    private readonly STORAGE_KEY_VERS_VERDIENST = 'fuv_vers_verdienst_cache';
    private readonly STORAGE_TIMESTAMP_KEY_VERS_VERDIENST = 'fuv_vers_verdienst_cache_timestamp';
    private readonly CACHE_VALIDITY_MS = 1000 * 60 * 60 * 24; // 24 hours

    // Cache for VersVerdienst data
    private versVerdienstCache$: Observable<any> | null = null;

    /**
     * Clear cache and force reload on next request
     */
    clearCache(): void {
        this.versVerdienstCache$ = null;
        this.clearVersVerdienstSessionStorage();
    }

    /**
     * Get VersVerdienst (minimum insured income) data for validation (cached)
     * Maps to GET /api/admin/versverdienst/searchVersVerdienst?gueltab={date}
     *
     * @param gueltab Optional date string (YYYY-MM-DD), defaults to today
     * @returns Observable with VersVerdienst data
     */
    getVersVerdienst(gueltab?: string): Observable<any> {
        const dateParam = gueltab || this.formatDateForApi(new Date());

        if (!this.versVerdienstCache$) {
            // Check session storage first
            const cachedData = this.loadVersVerdienstFromSessionStorage();
            if (cachedData) {
                this.versVerdienstCache$ = of(cachedData).pipe(shareReplay(1));
                return this.versVerdienstCache$;
            }

            // Fetch from API
            const url = `/api/admin/versverdienst/searchVersVerdienst?gueltab=${dateParam}`;
            this.versVerdienstCache$ = this.http.get<any>(url).pipe(
                tap((data) => {
                    this.logger.log('VersVerdienst data fetched:', data);
                    // Save to session storage
                    this.saveVersVerdienstToSessionStorage(data);
                }),
                shareReplay(1) // Cache the result
            );
        }

        return this.versVerdienstCache$;
    }

    /**
     * Prefetch VersVerdienst data and store in session storage
     * This should be called during app initialization
     */
    prefetchVersVerdienst(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.getVersVerdienst().subscribe({
                next: () => {
                    this.logger.log('VersVerdienst data prefetched successfully');
                    resolve();
                },
                error: (error) => {
                    this.logger.error('Failed to prefetch VersVerdienst data:', error);
                    reject(error);
                }
            });
        });
    }

    /**
     * Get maximum insured income value from VersVerdienst data
     * @returns Observable with maximum income value (e.g., 406800)
     */
    getMaxVersVerdienst(): Observable<number | null> {
        return this.getVersVerdienst().pipe(
            map((data) => {
                this.logger.log('Raw VersVerdienst data:', data, 'Type:', typeof data);

                let rawValue: any;

                // Check if the response is a direct string/number (not wrapped in object/array)
                if (typeof data === 'string' || typeof data === 'number') {
                    rawValue = data;
                }
                // Assuming the response is an array and we need the first entry's maximum value
                else if (Array.isArray(data) && data.length > 0) {
                    rawValue = data[0]?.versverdienst;
                }
                // Or if it's a single object
                else if (data && typeof data === 'object') {
                    rawValue = data?.versverdienst;
                }

                // Parse as integer if it's a string
                if (typeof rawValue === 'string') {
                    const parsed = parseInt(rawValue, 10);
                    this.logger.log('Parsed versverdienst:', parsed);
                    return isNaN(parsed) ? null : parsed;
                }

                // Already a number
                if (typeof rawValue === 'number') {
                    this.logger.log('Already a number:', rawValue);
                    return rawValue;
                }

                this.logger.log('Could not parse versverdienst, returning null');
                return null;
            })
        );
    }

    /**
     * Load VersVerdienst data from session storage
     * Returns null if cache is invalid or doesn't exist
     */
    private loadVersVerdienstFromSessionStorage(): any | null {
        try {
            const cachedData = sessionStorage.getItem(this.STORAGE_KEY_VERS_VERDIENST);
            const timestamp = sessionStorage.getItem(this.STORAGE_TIMESTAMP_KEY_VERS_VERDIENST);

            if (!cachedData || !timestamp) {
                return null;
            }

            // Check if cache is still valid
            const cacheAge = Date.now() - parseInt(timestamp, 10);
            if (cacheAge > this.CACHE_VALIDITY_MS) {
                this.clearVersVerdienstSessionStorage();
                return null;
            }

            return JSON.parse(cachedData);
        } catch (error) {
            this.logger.error('Failed to load VersVerdienst from session storage:', error);
            return null;
        }
    }

    /**
     * Save VersVerdienst data to session storage
     */
    private saveVersVerdienstToSessionStorage(data: any): void {
        try {
            sessionStorage.setItem(this.STORAGE_KEY_VERS_VERDIENST, JSON.stringify(data));
            sessionStorage.setItem(this.STORAGE_TIMESTAMP_KEY_VERS_VERDIENST, Date.now().toString());
        } catch (error) {
            this.logger.error('Failed to save VersVerdienst to session storage:', error);
        }
    }

    /**
     * Clear VersVerdienst session storage cache
     */
    private clearVersVerdienstSessionStorage(): void {
        try {
            sessionStorage.removeItem(this.STORAGE_KEY_VERS_VERDIENST);
            sessionStorage.removeItem(this.STORAGE_TIMESTAMP_KEY_VERS_VERDIENST);
        } catch (error) {
            this.logger.error('Failed to clear VersVerdienst session storage:', error);
        }
    }

    /**
     * Format Date to API format (YYYY-MM-DD)
     */
    private formatDateForApi(date: Date): string {
        return date.toISOString().split('T')[0];
    }
}
