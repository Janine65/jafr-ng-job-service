import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Regress } from '@app/inex/regress/regress.model';
import { LogFactoryService } from '@syrius/core';

/**
 * Service for managing regress-related operations
 * Handles searching and retrieving damage/regress payment data from the backend
 */
@Injectable({
    providedIn: 'root'
})
export class RegressService {
    private http = inject(HttpClient);
    private logger = inject(LogFactoryService).createLogger('RegressService');

    /**
     * Searches for regress data based on schadenNr (damage number)
     * Uses the /api/ielisten/getopzahlungenregress endpoint
     *
     * @param criteria - Search criteria containing schadenNr
     * @returns Observable of Regress array
     */
    searchRegress(criteria: { schadenNr?: string }): Observable<Regress[]> {
        this.logger.debug('Searching for regress data', { criteria });

        const url = `/api/ielisten/getopzahlungenregress`;

        // Build query parameters
        let params = new HttpParams();
        if (criteria.schadenNr) {
            params = params.set('schadennr', criteria.schadenNr);
        }

        return this.http.get<Regress[]>(url, { params }).pipe(
            map((results) => {
                this.logger.debug('Regress search results received', { count: results.length });
                return results;
            })
        );
    }

    /**
     * Retrieves a specific regress entry by BOID (Business Object ID)
     * @param boid - The unique business object identifier for the regress entry
     * @returns Observable of single Regress object
     */
    getRegressById(boid: string): Observable<Regress> {
        this.logger.debug('Fetching regress details by BOID', { boid });

        const url = `/api/ielisten/getopzahlungenregress`;
        const params = new HttpParams().set('boid', boid);

        return this.http.get<Regress[]>(url, { params }).pipe(
            map((results) => {
                if (results && results.length > 0) {
                    this.logger.debug('Regress entry found', { boid });
                    return results[0];
                }
                throw new Error(`No regress entry found with BOID: ${boid}`);
            })
        );
    }

    /**
     * Retrieves regress data by schaden nummer
     * @param schadenNr - The schaden nummer to search for (format: XX.XXXXX.XX.X)
     * @returns Observable of Regress array
     */
    getRegressBySchadenNr(schadenNr: string): Observable<Regress[]> {
        this.logger.debug('Fetching regress data by schadenNr', { schadenNr });

        const url = `/api/ielisten/getopzahlungenregress`;
        const params = new HttpParams().set('schadennr', schadenNr);

        return this.http.get<Regress[]>(url, { params }).pipe(
            map((results) => {
                this.logger.debug('Regress data retrieved', { schadenNr, count: results.length });
                return results;
            })
        );
    }
}
