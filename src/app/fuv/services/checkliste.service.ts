import { Observable } from 'rxjs';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
    Checkliste, ChecklisteApiRequest, ChecklisteApiResponse
} from '../models/checkliste.model';

/**
 * Service for FUV Checkliste operations
 * Handles API communication for checkliste management
 */
@Injectable({
    providedIn: 'root'
})
export class ChecklisteService {
    private http = inject(HttpClient);
    private apiUrl = '/api/offerte/fuvcheckliste';

    /**
     * Search for checkliste entries by offerte ID
     * Maps to GET /api/offerte/fuvcheckliste/searchFuvCheckliste
     *
     * @param offerteId - The offerte ID to search for
     * @returns Observable of checkliste array
     */
    searchFuvCheckliste(offerteId: number): Observable<ChecklisteApiResponse> {
        const params = new HttpParams().set('offerte_id', offerteId.toString());
        return this.http.get<ChecklisteApiResponse>(`${this.apiUrl}/searchFuvCheckliste`, { params });
    }

    /**
     * Search for checkliste entries by vertrag BOID
     * Maps to GET /api/offerte/fuvcheckliste/searchFuvCheckliste
     *
     * @param vertragBoid - The vertrag BOID to search for
     * @returns Observable of checkliste array
     */
    searchFuvChecklisteByVertrag(vertragBoid: string): Observable<ChecklisteApiResponse> {
        const params = new HttpParams().set('vertrag_boid', vertragBoid);
        return this.http.get<ChecklisteApiResponse>(`${this.apiUrl}/searchFuvCheckliste`, { params });
    }

    /**
     * Read a specific checkliste by ID
     * Maps to GET /api/offerte/fuvcheckliste/readFuvCheckliste
     *
     * @param id - The checkliste ID
     * @returns Observable of checkliste
     */
    readFuvCheckliste(id: number): Observable<Checkliste> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.get<Checkliste>(`${this.apiUrl}/readFuvCheckliste`, { params });
    }

    /**
     * Insert a new checkliste
     * Maps to PUT /api/offerte/fuvcheckliste/insertFuvCheckliste
     *
     * @param checkliste - The checkliste data to insert
     * @returns Observable of created checkliste
     */
    insertFuvCheckliste(checkliste: Partial<Checkliste>): Observable<Checkliste> {
        return this.http.put<Checkliste>(`${this.apiUrl}/insertFuvCheckliste`, checkliste);
    }

    /**
     * Update an existing checkliste
     * Maps to POST /api/offerte/fuvcheckliste/updateFuvCheckliste
     *
     * @param checkliste - The checkliste data to update
     * @returns Observable of updated checkliste
     */
    updateFuvCheckliste(checkliste: Checkliste): Observable<Checkliste> {
        return this.http.post<Checkliste>(`${this.apiUrl}/updateFuvCheckliste`, checkliste);
    }

    /**
     * Delete a checkliste
     * Maps to DELETE /api/offerte/fuvcheckliste/deleteFuvCheckliste
     *
     * @param id - The checkliste ID to delete
     * @returns Observable of void
     */
    deleteFuvCheckliste(id: number): Observable<void> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.delete<void>(`${this.apiUrl}/deleteFuvCheckliste`, { params });
    }

    /**
     * Print checkliste
     * Maps to GET /api/offerte/fuvcheckliste/printFuvCheckliste
     *
     * @param id - The checkliste ID to print
     * @returns Observable of print result (likely PDF or similar)
     */
    printFuvCheckliste(id: number): Observable<Blob> {
        const params = new HttpParams().set('id', id.toString());
        return this.http.get(`${this.apiUrl}/printFuvCheckliste`, {
            params,
            responseType: 'blob'
        });
    }
}
