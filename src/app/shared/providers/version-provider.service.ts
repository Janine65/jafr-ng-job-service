import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { VersionDataProvider, VersionInfo } from '@syrius/core';

/**
 * KPM-specific implementation of VersionDataProvider.
 * Uses the KPM-specific /api/version endpoint to fetch backend version information.
 */
@Injectable({
    providedIn: 'root'
})
export class KpmVersionDataProviderService implements VersionDataProvider {
    private readonly API_URL = '/api/version';

    /**
     * Application version from package.json
     * TODO: Inject this from the actual package.json
     */
    private readonly appVersion: string = '1.0.0';

    constructor(private http: HttpClient) {}

    /**
     * Get the application version (typically from package.json).
     * @returns string - Application version
     */
    getAppVersion(): string {
        return this.appVersion;
    }

    /**
     * Retrieves all version information including frontend, backend, and scheduler versions.
     * This method combines the frontend version with backend and scheduler versions from KPM API.
     * @returns Observable<VersionInfo> - Complete version information
     */
    getAllVersions(): Observable<VersionInfo> {
        return this.http.get<VersionInfo>(this.API_URL).pipe(
            map((info) => ({
                ...info,
                frontendVersion: this.appVersion
            })),
            catchError((error) => {
                console.error('Error fetching KPM version information:', error);
                // On error, return just frontend version
                return of({
                    frontendVersion: this.appVersion
                });
            })
        );
    }
}
