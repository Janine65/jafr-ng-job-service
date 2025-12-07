import { Observable } from 'rxjs';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
    Vertriebspartner, VertriebspartnerSearchParams
} from '@app/fuv/models/vertriebspartner.model';

/**
 * Service for managing FUV Vertriebspartner (Sales Partners)
 */
@Injectable({
    providedIn: 'root'
})
export class VertriebspartnerService {
    private http = inject(HttpClient);
    private apiUrl = '/api/offerte/fuvvertriebspartner';

    // Cache for vertriebspartner data
    private vertriebspartnerCache: Vertriebspartner[] | null = null;
    private lastCacheTime: number | null = null;
    private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

    /**
     * Search for FUV Vertriebspartner entries
     * Maps to GET /api/offerte/fuvvertriebspartner/searchFuvVertriebspartner
     */
    searchVertriebspartner(params: VertriebspartnerSearchParams = {}): Observable<Vertriebspartner[]> {
        let httpParams = new HttpParams();

        if (params.stichdatum !== undefined) {
            httpParams = httpParams.set('stichdatum', params.stichdatum);
        }
        if (params.vertriebspartnr !== undefined) {
            httpParams = httpParams.set('vertriebspartnr', params.vertriebspartnr);
        }
        if (params.vp_partnernr !== undefined) {
            httpParams = httpParams.set('vp_partnernr', params.vp_partnernr);
        }
        if (params.vp_name !== undefined) {
            httpParams = httpParams.set('vp_name', params.vp_name);
        }
        if (params.vp_suvanr !== undefined) {
            httpParams = httpParams.set('vp_suvanr', params.vp_suvanr);
        }
        if (params.itsvtriebpvpdef !== undefined) {
            httpParams = httpParams.set('itsvtriebpvpdef', params.itsvtriebpvpdef);
        }

        return this.http.get<Vertriebspartner[]>(`${this.apiUrl}/searchFuvVertriebspartner`, { params: httpParams });
    }

    /**
     * Read a single FuvVertriebspartner by query parameters
     * Maps to GET /api/offerte/fuvvertriebspartner/readFuvVertriebspartner
     */
    readVertriebspartner(params: VertriebspartnerSearchParams): Observable<Vertriebspartner> {
        let httpParams = new HttpParams();

        if (params.vertriebspartnr !== undefined) {
            httpParams = httpParams.set('vertriebspartnr', params.vertriebspartnr);
        }
        if (params.vp_partnernr !== undefined) {
            httpParams = httpParams.set('vp_partnernr', params.vp_partnernr);
        }

        return this.http.get<Vertriebspartner>(`${this.apiUrl}/readFuvVertriebspartner`, { params: httpParams });
    }

    /**
     * Insert a new FuvVertriebspartner
     * Maps to PUT /api/offerte/fuvvertriebspartner/insertFuvVertriebspartner
     */
    insertVertriebspartner(data: Partial<Vertriebspartner>): Observable<Vertriebspartner> {
        return this.http.put<Vertriebspartner>(`${this.apiUrl}/insertFuvVertriebspartner`, data);
    }

    /**
     * Update an existing FuvVertriebspartner
     * Maps to POST /api/offerte/fuvvertriebspartner/updateFuvVertriebspartner
     */
    updateVertriebspartner(data: Partial<Vertriebspartner>): Observable<Vertriebspartner> {
        return this.http.post<Vertriebspartner>(`${this.apiUrl}/updateFuvVertriebspartner`, data);
    }

    /**
     * Delete a FuvVertriebspartner
     * Maps to DELETE /api/offerte/fuvvertriebspartner/deleteFuvVertriebspartner
     */
    deleteVertriebspartner(params: VertriebspartnerSearchParams): Observable<void> {
        let httpParams = new HttpParams();

        if (params.vertriebspartnr !== undefined) {
            httpParams = httpParams.set('vertriebspartnr', params.vertriebspartnr);
        }

        return this.http.delete<void>(`${this.apiUrl}/deleteFuvVertriebspartner`, { params: httpParams });
    }

    /**
     * Load FuvVertriebspartner data
     * Maps to GET /api/offerte/fuvvertriebspartner/loadFuvVertriebspartner
     */
    loadVertriebspartner(): Observable<Vertriebspartner[]> {
        return this.http.get<Vertriebspartner[]>(`${this.apiUrl}/loadFuvVertriebspartner`);
    }

    /**
     * Prefetch vertriebspartner data for current date
     * This should be called during app initialization
     */
    async prefetchVertriebspartner(): Promise<void> {
        // Check if cache is still valid
        if (this.vertriebspartnerCache && this.lastCacheTime) {
            const cacheAge = Date.now() - this.lastCacheTime;
            if (cacheAge < this.CACHE_DURATION_MS) {
                return; // Cache is still fresh
            }
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        return new Promise((resolve, reject) => {
            this.searchVertriebspartner({ stichdatum: today }).subscribe({
                next: (data) => {
                    this.vertriebspartnerCache = data;
                    this.lastCacheTime = Date.now();
                    resolve();
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * Get cached vertriebspartner data
     * Returns null if cache is not available or expired
     */
    getCachedVertriebspartner(): Vertriebspartner[] | null {
        if (!this.vertriebspartnerCache || !this.lastCacheTime) {
            return null;
        }

        const cacheAge = Date.now() - this.lastCacheTime;
        if (cacheAge >= this.CACHE_DURATION_MS) {
            return null; // Cache expired
        }

        return this.vertriebspartnerCache;
    }

    /**
     * Clear the cache
     */
    clearCache(): void {
        this.vertriebspartnerCache = null;
        this.lastCacheTime = null;
    }

    /**
     * Refresh the cache with latest data
     */
    async refreshCache(): Promise<void> {
        this.clearCache();
        await this.prefetchVertriebspartner();
    }
}
