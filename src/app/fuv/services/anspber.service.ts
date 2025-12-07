import { Observable } from 'rxjs';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
    Anspruchsberechtigte, AnspruchsberechtigteApiRequest, AnspruchsberechtigteVP
} from '@app/fuv/models/anspruchsberechtigte.model';

/**
 * Service for managing FUV Anspruchsberechtigte (Beneficiaries)
 */
@Injectable({
    providedIn: 'root'
})
export class AnspberService {
    private http = inject(HttpClient);
    private apiUrl = '/api/offerte/fuvanspruchsberechtigte';

    /**
     * Search for FUV Anspruchsberechtigte entries
     * Maps to GET /api/offerte/fuvanspruchsberechtigte/searchFuvAnspruchsberechtigte
     */
    searchAnspruchsberechtigte(params: AnspruchsberechtigteApiRequest): Observable<Anspruchsberechtigte[]> {
        let httpParams = new HttpParams();

        if (params.boid !== undefined) {
            httpParams = httpParams.set('boid', params.boid);
        }
        if (params.person_boid !== undefined) {
            httpParams = httpParams.set('person_boid', params.person_boid);
        }
        if (params.offerte_boid !== undefined) {
            httpParams = httpParams.set('offerte_boid', params.offerte_boid);
        }
        if (params.nachname !== undefined) {
            httpParams = httpParams.set('nachname', params.nachname);
        }
        if (params.vorname !== undefined) {
            httpParams = httpParams.set('vorname', params.vorname);
        }
        if (params.stichdatum !== undefined) {
            httpParams = httpParams.set('stichdatum', params.stichdatum);
        }

        return this.http.get<Anspruchsberechtigte[]>(`${this.apiUrl}/searchFuvAnspruchsberechtigte`, { params: httpParams });
    }

    /**
     * Search for FUV Anspruchsberechtigte with Vertriebspartner by offerteid
     * Maps to GET /api/offerte/fuvanspruchsberechtigte/searchFuvAnspruchsberechtigte
     * @param offerteid The offerte ID
     */
    searchAnspruchsberechtigteByOfferte(offerteid: number): Observable<AnspruchsberechtigteVP[]> {
        const params = new HttpParams().set('offerteid', offerteid.toString());
        return this.http.get<AnspruchsberechtigteVP[]>(`${this.apiUrl}/searchFuvAnspruchsberechtigte`, { params });
    }

    /**
     * Search for FUV Anspruchsberechtigte with Vertriebspartner by stichdatum and optionally offerteid
     * Maps to GET /api/offerte/fuvanspruchsberechtigte/searchFuvAnspruchsberechtigte
     * @param stichdatum The reference date (format: YYYY-MM-DD)
     * @param offerteid Optional offerte ID to filter by
     */
    searchAnspruchsberechtigteByStichdatum(stichdatum: string, offerteid?: number): Observable<AnspruchsberechtigteVP[]> {
        let params = new HttpParams().set('stichdatum', stichdatum);
        if (offerteid !== undefined) {
            params = params.set('offerteid', offerteid.toString());
        }
        return this.http.get<AnspruchsberechtigteVP[]>(`${this.apiUrl}/searchFuvAnspruchsberechtigte`, { params });
    }

    /**
     * Read a single FuvAnspruchsberechtigte by BOID
     * Maps to GET /api/offerte/fuvanspruchsberechtigte/readFuvAnspruchsberechtigte
     */
    readAnspruchsberechtigte(boid: string): Observable<Anspruchsberechtigte> {
        const params = new HttpParams().set('boid', boid);
        return this.http.get<Anspruchsberechtigte>(`${this.apiUrl}/readFuvAnspruchsberechtigte`, { params });
    }

    /**
     * Insert a new FuvAnspruchsberechtigte
     * Maps to PUT /api/offerte/fuvanspruchsberechtigte/insertFuvAnspruchsberechtigte
     */
    insertAnspruchsberechtigte(data: Partial<Anspruchsberechtigte>): Observable<Anspruchsberechtigte> {
        return this.http.put<Anspruchsberechtigte>(`${this.apiUrl}/insertFuvAnspruchsberechtigte`, data);
    }

    /**
     * Update an existing FuvAnspruchsberechtigte
     * Maps to POST /api/offerte/fuvanspruchsberechtigte/updateFuvAnspruchsberechtigte
     */
    updateAnspruchsberechtigte(data: Partial<Anspruchsberechtigte>): Observable<Anspruchsberechtigte> {
        return this.http.post<Anspruchsberechtigte>(`${this.apiUrl}/updateFuvAnspruchsberechtigte`, data);
    }

    /**
     * Delete a FuvAnspruchsberechtigte by BOID
     * Maps to DELETE /api/offerte/fuvanspruchsberechtigte/deleteFuvAnspruchsberechtigte
     */
    deleteAnspruchsberechtigte(boid: string): Observable<void> {
        const params = new HttpParams().set('boid', boid);
        return this.http.delete<void>(`${this.apiUrl}/deleteFuvAnspruchsberechtigte`, { params });
    }

    /**
     * Save FuvAnspruchsberechtigte for an offerte
     * Maps to POST /api/offerte/fuvanspruchsberechtigte/saveFuvAnspruchsberechtigte
     *
     * @param offerteid The offerte ID to save beneficiaries for (as query parameter)
     * @returns Observable of the save result
     */
    saveFuvAnspruchsberechtigte(offerteid: number): Observable<any> {
        const params = new HttpParams().set('offerteid', offerteid.toString());
        return this.http.post<any>(`${this.apiUrl}/saveFuvAnspruchsberechtigte`, [], { params });
    }
}
