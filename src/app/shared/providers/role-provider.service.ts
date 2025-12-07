import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { InternalRole, RoleDataProvider } from '@syrius/core';

import { BerechtigungItem } from '../interfaces/roles.interface';

/**
 * KPM-specific implementation of RoleDataProvider.
 * Uses the KPM-specific /api/searchBerechtigung endpoint to fetch role mappings.
 * Handles all KPM-specific processing including parsing 'or' delimited roles.
 */
@Injectable({
    providedIn: 'root'
})
export class KpmRoleDataProviderService implements RoleDataProvider {
    private readonly API_URL = '/api/searchBerechtigung';

    constructor(private http: HttpClient) {}

    /**
     * Fetch role mappings from the KPM-specific API endpoint and process them.
     * @returns Observable<InternalRole[]> - Processed role mapping data
     */
    fetchRoleMappings(): Observable<InternalRole[]> {
        return this.http.get<BerechtigungItem[]>(this.API_URL).pipe(
            map((response) => this.processBerechtigungResponse(response)),
            catchError((error) => {
                console.error('Error fetching KPM role mappings:', error);
                return of(this.getFallbackRoles());
            })
        );
    }

    /**
     * Process the KPM API response and convert to InternalRole[].
     * Handles KPM-specific logic like parsing 'or' delimited roles.
     */
    private processBerechtigungResponse(response: BerechtigungItem[]): InternalRole[] {
        if (!response || response.length === 0) {
            console.warn('Empty or invalid response from KPM berechtigung API');
            return this.getFallbackRoles();
        }

        // Group by applikation_bereich combination for granular access control
        const roleMap = new Map<string, BerechtigungItem[]>();

        response.forEach((item) => {
            if (!item.aktiv) return; // Skip inactive items

            // Create role name from applikation and bereich
            const roleName = item.bereich ? `${item.applikation}_${item.bereich}` : item.applikation;

            if (!roleMap.has(roleName)) {
                roleMap.set(roleName, []);
            }
            roleMap.get(roleName)!.push(item);
        });

        // Convert to InternalRole[]
        const internalRoles: InternalRole[] = [];

        roleMap.forEach((items, roleName) => {
            const keycloakRoles = new Set<string>();

            items.forEach((item) => {
                // Parse roles - can be "role1 or role2 or role3"
                const roles = item.rolle
                    .split(' or ')
                    .map((r) => r.trim())
                    .filter((r) => r.length > 0);

                roles.forEach((role) => keycloakRoles.add(role));
            });

            internalRoles.push({
                name: roleName,
                displayName: this.createDisplayName(roleName),
                description: `Access to ${roleName} functionality`,
                keycloakRoles: Array.from(keycloakRoles)
            });
        });

        return internalRoles;
    }

    /**
     * Create human-readable display name from internal role name
     */
    private createDisplayName(roleName: string): string {
        return roleName
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    /**
     * Fallback roles when KPM API is unavailable
     */
    private getFallbackRoles(): InternalRole[] {
        return [
            {
                name: 'kmp_tool_berechtigung',
                displayName: 'KPM Tool Berechtigung',
                description: 'Full KPM system access',
                keycloakRoles: []
            }
        ];
    }
}
