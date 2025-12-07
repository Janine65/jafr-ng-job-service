import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Betrieb, BetriebApiRequest } from '@app/fuv/models/betrieb.model';
import { BetriebStore } from '@app/fuv/stores/betrieb.store';

import { OfferteService } from './offerte.service';
import { VertragService } from './vertrag.service';

@Injectable({
    providedIn: 'root'
})
export class BetriebService {
    private http = inject(HttpClient);
    private betriebStore = inject(BetriebStore);
    private offerteService = inject(OfferteService);
    private vertragService = inject(VertragService);
    private apiUrl = `/api/offerte/fuvbetrieb`;

    /**
     * Search for companies based on various criteria
     * Maps to GET /api/offerte/fuvbetrieb/searchFuvBetrieb
     */
    searchBetrieb(criteria: BetriebApiRequest): Observable<Betrieb[]> {
        let params = new HttpParams();

        if (criteria.partnernr) {
            params = params.set('partnernr', criteria.partnernr);
        }
        if (criteria.uidnr) {
            params = params.set('uidnr', criteria.uidnr);
        }
        if (criteria.suvanr) {
            params = params.set('suvanr', criteria.suvanr);
        }
        if (criteria.boid) {
            params = params.set('boid', criteria.boid);
        }
        if (criteria.name) {
            params = params.set('name', criteria.name);
        }
        if (criteria.local !== undefined) {
            params = params.set('local', criteria.local.toString());
        }

        return this.http.get<Betrieb[]>(`${this.apiUrl}/searchFuvBetrieb`, { params });
    }

    /**
     * Get a specific betrieb by partnernr
     * Maps to GET /api/offerte/fuvbetrieb/searchFuvBetrieb with partnernr filter
     */
    getBetriebById(partnernr: string): Observable<Betrieb> {
        const params = new HttpParams().set('partnernr', partnernr);

        return this.http.get<Betrieb[]>(`${this.apiUrl}/searchFuvBetrieb`, { params }).pipe(
            map((betriebe) => {
                if (!betriebe || betriebe.length === 0) {
                    throw new Error(`Betrieb with partnernr ${partnernr} not found`);
                }
                return betriebe[0];
            })
        );
    }

    /**
     * Create a new betrieb
     * Maps to PUT /api/offerte/fuvbetrieb/insertFuvBetrieb
     */
    insertBetrieb(betrieb: Betrieb): Observable<Betrieb> {
        return this.http.put<Betrieb>(`${this.apiUrl}/insertFuvBetrieb`, betrieb);
    }

    /**
     * Update an existing betrieb
     * Maps to POST /api/offerte/fuvbetrieb/updateFuvBetrieb
     */
    updateBetrieb(betrieb: Betrieb): Observable<Betrieb> {
        return this.http.post<Betrieb>(`${this.apiUrl}/updateFuvBetrieb`, betrieb);
    }

    /**
     * Delete a betrieb by ID
     * Maps to DELETE /api/offerte/fuvbetrieb/deleteFuvBetrieb
     */
    deleteBetrieb(id: string): Observable<void> {
        const params = new HttpParams().set('id', id.toString());

        return this.http.delete<void>(`${this.apiUrl}/deleteFuvBetrieb`, { params });
    }

    /**
     * Refresh betrieb data from Syrius
     * Maps to GET /api/offerte/fuvbetrieb/refreshFuvBetrieb
     */
    refreshBetrieb(boid: string): Observable<Betrieb> {
        const params = new HttpParams().set('boid', boid);

        return this.http.get<Betrieb>(`${this.apiUrl}/refreshFuvBetrieb`, { params });
    }

    /**
     * Load betrieb detail including related data (offerten, vertraege)
     * Updates BetriebStore with the loaded data
     */
    loadBetriebDetail(partnernr: string): void {
        // Set loading state
        this.betriebStore.setSelectedBetrieb(partnernr);
        this.betriebStore.setBetriebLoading(true);
        this.betriebStore.setBetriebRelationsLoading(true);

        // Load betrieb data
        this.getBetriebById(partnernr).subscribe({
            next: (betrieb) => {
                this.betriebStore.setBetriebData(betrieb);

                // Load related data if betrieb has boid
                if (betrieb.boid) {
                    // Load offerten by betrieb boid
                    this.offerteService.searchOfferten({ betrieb_boid: betrieb.boid }).subscribe({
                        next: (offerten) => {
                            this.betriebStore.setBetriebOfferten(offerten);
                        },
                        error: (error) => {
                            console.error('Failed to load betrieb offerten:', error);
                            this.betriebStore.setBetriebOfferten([]);
                        }
                    });

                    // Load vertraege by betrieb boid
                    this.vertragService.getVertraegeByBetrieb(betrieb.boid).subscribe({
                        next: (vertraege) => {
                            this.betriebStore.setBetriebVertraege(vertraege);
                        },
                        error: (error) => {
                            console.error('Failed to load betrieb vertraege:', error);
                            this.betriebStore.setBetriebVertraege([]);
                        }
                    });
                } else {
                    // No boid, set empty arrays
                    this.betriebStore.setBetriebOfferten([]);
                    this.betriebStore.setBetriebVertraege([]);
                }
            },
            error: (error) => {
                this.betriebStore.setBetriebError(error?.message || 'Failed to load betrieb');
            }
        });
    }
}
