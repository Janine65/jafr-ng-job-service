import { map, Observable } from 'rxjs';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Vertrag, VertragApiRequest, VertragUtils } from '@app/fuv/models/vertrag.model';

/**
 * Service for managing FuvVertrag data via API endpoints
 * API Base: /offerte/fuvvertrag
 */
@Injectable({
    providedIn: 'root'
})
export class VertragService {
    private http = inject(HttpClient);
    private apiUrl = `/api/offerte/fuvvertrag`;

    /**
     * Search for verträge based on criteria
     * Endpoint: GET /offerte/fuvvertrag/searchFuvVertrag
     * @param criteria Search criteria (all optional)
     * @returns Observable of Vertrag array
     */
    searchVertraege(criteria: VertragApiRequest = {}): Observable<Vertrag[]> {
        let params = new HttpParams();
        Object.keys(criteria).forEach((key) => {
            const value = criteria[key as keyof VertragApiRequest];
            if (value !== undefined && value !== null && value !== '') {
                params = params.set(key, value.toString());
            }
        });

        return this.http.get<any>(`${this.apiUrl}/searchFuvVertrag`, { params }).pipe(
            map((response) => {
                // API returns array directly, not wrapped in { result: [...] }
                const results = Array.isArray(response) ? response : response?.result || [];
                return (results as Vertrag[]).map((vertrag) => VertragUtils.enrichFromApi(vertrag));
            })
        );
    }

    /**
     * Get all verträge, optionally filtered by partnernr
     * @param partnernr Optional partner number filter (used as person_boid)
     * @returns Observable of Vertrag array
     */
    getVertraege(partnernr?: string): Observable<Vertrag[]> {
        const criteria: VertragApiRequest = {};
        if (partnernr) {
            // Vertrag API uses person_boid (not person_partnernr like Offerte API)
            criteria.person_boid = partnernr;
        }
        return this.searchVertraege(criteria);
    }

    /**
     * Read a specific vertrag by ID
     * Endpoint: GET /offerte/fuvvertrag/readFuvVertrag
     * @param id Vertrag ID
     * @returns Observable of Vertrag
     */
    getVertragById(id: number): Observable<Vertrag> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.get<any>(`${this.apiUrl}/readFuvVertrag`, { params }).pipe(
            map((response) => {
                // API may return object directly or wrapped in { result: {...} }
                const result = response?.result || response;
                return result ? VertragUtils.enrichFromApi(result as Vertrag) : ({} as Vertrag);
            })
        );
    }

    /**
     * Search for verträge by BOID
     * @param boid Vertrag BOID
     * @returns Observable of Vertrag array
     */
    getVertragByBoid(boid: string): Observable<Vertrag[]> {
        return this.searchVertraege({ boid });
    }

    /**
     * Search for verträge by Vertragsnummer
     * @param vertragsnr Vertragsnummer
     * @returns Observable of Vertrag array
     */
    getVertragByVertragsnr(vertragsnr: string): Observable<Vertrag[]> {
        return this.searchVertraege({ vertragsnr });
    }

    /**
     * Search for verträge by Betrieb BOID
     * @param betriebBoid Betrieb BOID
     * @returns Observable of Vertrag array
     */
    getVertraegeByBetrieb(betriebBoid: string): Observable<Vertrag[]> {
        return this.searchVertraege({ betrieb_boid: betriebBoid });
    }

    /**
     * Search for verträge by Person BOID
     * @param personBoid Person BOID
     * @returns Observable of Vertrag array
     */
    getVertraegeByPerson(personBoid: string): Observable<Vertrag[]> {
        return this.searchVertraege({ person_boid: personBoid });
    }

    /**
     * Insert a new vertrag
     * Endpoint: PUT /offerte/fuvvertrag/insertFuvVertrag
     * @param vertrag Vertrag data to insert
     * @returns Observable of API response
     */
    insertVertrag(vertrag: Partial<Vertrag>): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/insertFuvVertrag`, vertrag);
    }

    /**
     * Update an existing vertrag
     * Endpoint: POST /offerte/fuvvertrag/updateFuvVertrag
     * @param vertrag Vertrag data to update
     * @returns Observable of API response
     */
    updateVertrag(vertrag: Partial<Vertrag>): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/updateFuvVertrag`, vertrag);
    }

    /**
     * Delete a vertrag by ID
     * Endpoint: DELETE /offerte/fuvvertrag/deleteFuvVertrag
     * @param id Vertrag ID
     * @returns Observable of API response
     */
    deleteVertrag(id: number): Observable<any> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.delete<any>(`${this.apiUrl}/deleteFuvVertrag`, { params });
    }

    /**
     * Refresh vertrag data from Syrius
     * Endpoint: GET /offerte/fuvvertrag/refreshFuvVertrag
     * @param boid Vertrag BOID
     * @returns Observable of API response
     */
    refreshVertrag(boid: string): Observable<any> {
        const params = new HttpParams().set('boid', boid);
        return this.http.get<any>(`${this.apiUrl}/refreshFuvVertrag`, { params });
    }

    /**
     * Save a vertrag (insert if new, update if existing)
     * @param vertrag Vertrag data to save
     * @returns Observable of API response
     */
    saveVertrag(vertrag: Partial<Vertrag>): Observable<any> {
        if (vertrag.id) {
            return this.updateVertrag(vertrag);
        } else {
            return this.insertVertrag(vertrag);
        }
    }
}
