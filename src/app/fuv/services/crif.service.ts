import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
    CrifSearchApiResponse, CrifSearchBetriebApiRequest, CrifSearchPersonApiRequest
} from '@app/fuv/models/crif.model';

/**
 * Service for interacting with CRIF (credit information) API endpoints
 */
@Injectable({
    providedIn: 'root'
})
export class CrifService {
    private http = inject(HttpClient);
    private apiUrl = '/api/crif';

    /**
     * Search for person credit information in CRIF
     * Maps to GET /api/crif/searchPerson
     *
     * @param params - Search parameters (firstname, lastname, date_of_birth, address fields)
     * @returns Observable with search results including archiving_id
     */
    searchPerson(params: CrifSearchPersonApiRequest): Observable<CrifSearchApiResponse> {
        let httpParams = new HttpParams();

        if (params.firstname) {
            httpParams = httpParams.set('firstname', params.firstname);
        }
        if (params.lastname) {
            httpParams = httpParams.set('lastname', params.lastname);
        }
        if (params.date_of_birth) {
            httpParams = httpParams.set('date_of_birth', params.date_of_birth);
        }
        if (params.country) {
            httpParams = httpParams.set('country', params.country);
        }
        if (params.city) {
            httpParams = httpParams.set('city', params.city);
        }
        if (params.house_number) {
            httpParams = httpParams.set('house_number', params.house_number);
        }
        if (params.street) {
            httpParams = httpParams.set('street', params.street);
        }
        if (params.zipcode) {
            httpParams = httpParams.set('zipcode', params.zipcode);
        }

        return this.http.get<CrifSearchApiResponse>(`${this.apiUrl}/searchPerson`, { params: httpParams }).pipe(catchError(this.handleError));
    }

    /**
     * Search for company credit information in CRIF
     * Maps to GET /api/crif/searchCompany
     *
     * @param params - Search parameters (company, date_of_birth, address fields)
     * @returns Observable with search results including archiving_id
     */
    searchCompany(params: CrifSearchBetriebApiRequest): Observable<CrifSearchApiResponse> {
        let httpParams = new HttpParams();

        if (params.company) {
            httpParams = httpParams.set('company', params.company);
        }
        if (params.date_of_birth) {
            httpParams = httpParams.set('date_of_birth', params.date_of_birth);
        }
        if (params.country) {
            httpParams = httpParams.set('country', params.country);
        }
        if (params.city) {
            httpParams = httpParams.set('city', params.city);
        }
        if (params.house_number) {
            httpParams = httpParams.set('house_number', params.house_number);
        }
        if (params.street) {
            httpParams = httpParams.set('street', params.street);
        }
        if (params.zipcode) {
            httpParams = httpParams.set('zipcode', params.zipcode);
        }

        return this.http.get<CrifSearchApiResponse>(`${this.apiUrl}/searchCompany`, { params: httpParams }).pipe(catchError(this.handleError));
    }

    /**
     * Get CRIF report as web URL
     * Maps to GET /api/crif/getReportWeb
     *
     * Returns the WEB-URL of the CRIF portal if available (can take up to 1 minute)
     *
     * @param archivingId - The archiving ID from search results
     * @returns Observable with web URL string
     */
    getReportWeb(archivingId: string): Observable<string> {
        const params = new HttpParams().set('archiving_id', archivingId);

        return this.http.get(`${this.apiUrl}/getReportWeb`, { params, responseType: 'text' }).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status !== 200) {
                    // Return specific error for non-200 responses
                    return throwError(() => ({
                        ...error,
                        message: 'Der CRIF-Report ist noch nicht verfügbar. Bitte versuchen Sie es in einer Minute erneut.',
                        notReady: true
                    }));
                }
                return this.handleError(error);
            })
        );
    }

    /**
     * Get CRIF report as PDF blob
     * Maps to GET /api/crif/getReportPDF
     *
     * Returns a PDF blob if available on CRIF (can take up to 1 minute)
     *
     * @param archivingId - The archiving ID from search results
     * @returns Observable with PDF Blob
     */
    getReportPdf(archivingId: string): Observable<Blob> {
        const params = new HttpParams().set('archiving_id', archivingId);

        return this.http.get(`${this.apiUrl}/getReportPDF`, { params, responseType: 'blob' }).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status !== 200) {
                    // Return specific error for non-200 responses
                    return throwError(() => ({
                        ...error,
                        message: 'Der CRIF-Report ist noch nicht verfügbar. Bitte versuchen Sie es in einer Minute erneut.',
                        notReady: true
                    }));
                }
                return this.handleError(error);
            })
        );
    }

    /**
     * Handle HTTP errors
     */
    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Ein unbekannter Fehler ist aufgetreten';

        if (error.error instanceof ErrorEvent) {
            // Client-side error
            errorMessage = `Fehler: ${error.error.message}`;
        } else {
            // Server-side error
            errorMessage = `Server-Fehler ${error.status}: ${error.message}`;
        }

        return throwError(() => ({
            ...error,
            message: errorMessage
        }));
    }
}
