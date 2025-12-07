import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Person, PersonApiRequest } from '@app/fuv/models/person.model';
import { PersonStore } from '@app/fuv/stores/person.store';

import { OfferteService } from './offerte.service';
import { VertragService } from './vertrag.service';

@Injectable({
    providedIn: 'root'
})
export class PersonService {
    private http = inject(HttpClient);
    private personStore = inject(PersonStore);
    private offerteService = inject(OfferteService);
    private vertragService = inject(VertragService);
    private apiUrl = `/api/offerte/fuvperson`;

    /**
     * Search for persons based on various criteria
     * Maps to GET /api/offerte/fuvperson/searchFuvPerson
     */
    searchPerson(criteria: PersonApiRequest): Observable<Person[]> {
        let params = new HttpParams();

        if (criteria.svnr) {
            params = params.set('svnr', criteria.svnr);
        }
        if (criteria.partnernr) {
            params = params.set('partnernr', criteria.partnernr);
        }
        if (criteria.name) {
            params = params.set('name', criteria.name);
        }
        if (criteria.vorname) {
            params = params.set('vorname', criteria.vorname);
        }
        if (criteria.geburtstag) {
            params = params.set('geburtstag', criteria.geburtstag);
        }
        if (criteria.boid) {
            params = params.set('boid', criteria.boid);
        }
        if (criteria.local !== undefined) {
            params = params.set('local', criteria.local.toString());
        }

        return this.http.get<Person[]>(`${this.apiUrl}/searchFuvPerson`, { params }).pipe(map((persons) => persons.map((person) => this.parsePersonDates(person))));
    }

    /**
     * Get a specific person by partnernr
     * Maps to GET /api/offerte/fuvperson/searchFuvPerson with partnernr filter
     */
    getPersonById(partnernr: string): Observable<Person> {
        const params = new HttpParams().set('partnernr', partnernr);

        return this.http.get<Person[]>(`${this.apiUrl}/searchFuvPerson`, { params }).pipe(
            map((persons) => {
                if (!persons || persons.length === 0) {
                    throw new Error(`Person with partnernr ${partnernr} not found`);
                }
                return this.parsePersonDates(persons[0]);
            })
        );
    }

    /**
     * Create a new person
     * Maps to PUT /api/offerte/fuvperson/insertFuvPerson
     */
    insertPerson(person: Person): Observable<Person> {
        const payload = this.serializePersonDates(person);
        return this.http.put<Person>(`${this.apiUrl}/insertFuvPerson`, payload).pipe(map((result) => this.parsePersonDates(result)));
    }

    /**
     * Update an existing person
     * Maps to POST /api/offerte/fuvperson/updateFuvPerson
     */
    updatePerson(person: Person): Observable<Person> {
        const payload = this.serializePersonDates(person);
        return this.http.post<Person>(`${this.apiUrl}/updateFuvPerson`, payload).pipe(map((result) => this.parsePersonDates(result)));
    }

    /**
     * Delete a person by ID
     * Maps to DELETE /api/offerte/fuvperson/deleteFuvPerson
     */
    deletePerson(id: number): Observable<void> {
        const params = new HttpParams().set('id', id.toString());

        return this.http.delete<void>(`${this.apiUrl}/deleteFuvPerson`, { params });
    }

    /**
     * Refresh person data from Syrius
     * Maps to GET /api/offerte/fuvperson/refreshFuvPerson
     */
    refreshPerson(boid: string): Observable<Person> {
        const params = new HttpParams().set('boid', boid);

        return this.http.get<Person>(`${this.apiUrl}/refreshFuvPerson`, { params }).pipe(map((person) => this.parsePersonDates(person)));
    }

    /**
     * Search for number of accidents (unfaelle) for a person
     * Maps to GET /api/offerte/fuvperson/searchAnzahlUnfaelle
     * Returns array of [label, count] pairs: [["Anzahl Unfälle", 0], ["Laufende Unfälle", 0]]
     */
    searchAnzahlUnfaelle(personBoid: string): Observable<[string, number][]> {
        const params = new HttpParams().set('person_boid', personBoid);

        return this.http.get<[string, number][]>(`${this.apiUrl}/searchAnzahlUnfaelle`, { params });
    }

    /**
     * Parse date strings from API response into Date objects
     */
    private parsePersonDates(person: Person): Person {
        return {
            ...person,
            geburtstag: person.geburtstag ? new Date(person.geburtstag) : undefined
            // sustatus is already a string from API (e.g., 'SYR_SUStatus_Unklar'), no conversion needed
        };
    }

    /**
     * Serialize Date objects into ISO string format for API requests
     */
    private serializePersonDates(person: Person): Person {
        return {
            ...person,
            geburtstag: person.geburtstag instanceof Date ? (person.geburtstag.toISOString().split('T')[0] as unknown as Date) : person.geburtstag
            // sustatus is already a string code (e.g., 'SYR_SUStatus_Unklar'), no conversion needed
        };
    }

    /**
     * Load person detail including related data (offerten, vertraege)
     * Updates PersonStore with the loaded data
     */
    loadPersonDetail(partnernr: string): void {
        // Set loading state
        this.personStore.setSelectedPerson(partnernr);
        this.personStore.setPersonLoading(true);
        this.personStore.setPersonRelationsLoading(true);

        // Load person data
        this.getPersonById(partnernr).subscribe({
            next: (person) => {
                this.personStore.setPersonData(person);

                // Load related data if person has boid
                if (person.boid) {
                    // Load offerten by person boid
                    this.offerteService.searchOfferten({ person_boid: person.boid }).subscribe({
                        next: (offerten) => {
                            this.personStore.setPersonOfferten(offerten);
                        },
                        error: (error) => {
                            console.error('Failed to load person offerten:', error);
                            this.personStore.setPersonOfferten([]);
                        }
                    });

                    // Load vertraege by person boid
                    this.vertragService.getVertraegeByPerson(person.boid).subscribe({
                        next: (vertraege) => {
                            this.personStore.setPersonVertraege(vertraege);
                        },
                        error: (error) => {
                            console.error('Failed to load person vertraege:', error);
                            this.personStore.setPersonVertraege([]);
                        }
                    });
                } else {
                    // No boid, set empty arrays
                    this.personStore.setPersonOfferten([]);
                    this.personStore.setPersonVertraege([]);
                }
            },
            error: (error) => {
                this.personStore.setPersonError(error?.message || 'Failed to load person');
            }
        });
    }
}
