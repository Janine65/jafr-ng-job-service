import { map, Observable } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { BerechtigungItem } from '../interfaces/roles.interface';

/**
 * CRUD Permission interface
 */
export interface CrudPermissions {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}

/**
 * Module-specific permissions
 */
export interface ModulePermissions {
    module: string;
    bereich: string | null;
    crud: CrudPermissions;
}

/**
 * Service to handle CRUD permissions from BerechtigungItem data
 * Maps funktion field (CRUD string) to granular permission checks
 */
@Injectable({
    providedIn: 'root'
})
export class PermissionService {
    private readonly API_URL = '/api/searchBerechtigung';
    private http = inject(HttpClient);
    private berechtigungen: BerechtigungItem[] = [];
    private permissionsCache: Map<string, CrudPermissions> = new Map();

    /**
     * Load permissions from backend
     */
    loadPermissions(): Observable<BerechtigungItem[]> {
        console.log('[PermissionService] Loading permissions from API...');
        return this.http.get<BerechtigungItem[]>(this.API_URL).pipe(
            map((response) => {
                console.log('[PermissionService] API response received:', response);
                this.berechtigungen = response.filter((item) => item.aktiv);
                console.log('[PermissionService] Active berechtigungen:', this.berechtigungen);
                this.buildPermissionsCache();
                return this.berechtigungen;
            })
        );
    }

    /**
     * Build cache of permissions for fast lookup
     */
    private buildPermissionsCache(): void {
        this.permissionsCache.clear();
        console.log('[PermissionService] Building permissions cache from', this.berechtigungen.length, 'items...');

        this.berechtigungen.forEach((item) => {
            const key = this.getCacheKey(item.applikation, item.bereich);
            const existing = this.permissionsCache.get(key);

            // Parse CRUD string and merge with existing permissions
            const newPerms = this.parseCrudString(item.funktion);

            console.log(`[PermissionService] Processing: ${key} with funktion="${item.funktion}"`, newPerms);

            if (existing) {
                // Merge permissions (union - if any role has permission, grant it)
                const merged = {
                    canCreate: existing.canCreate || newPerms.canCreate,
                    canRead: existing.canRead || newPerms.canRead,
                    canUpdate: existing.canUpdate || newPerms.canUpdate,
                    canDelete: existing.canDelete || newPerms.canDelete
                };
                console.log(`[PermissionService] Merging ${key}: existing`, existing, '+ new', newPerms, '= merged', merged);
                this.permissionsCache.set(key, merged);
            } else {
                console.log(`[PermissionService] First entry for ${key}:`, newPerms);
                this.permissionsCache.set(key, newPerms);
            }
        });

        console.log('[PermissionService] Permissions cache built:', Array.from(this.permissionsCache.entries()));
    }

    /**
     * Parse CRUD string to permission object
     * @param funktion - String containing any combination of C, R, U, D (e.g., "CRUD", "CRU", "R", "UD")
     */
    private parseCrudString(funktion: string): CrudPermissions {
        const upperFunktion = (funktion || '').toUpperCase();

        return {
            canCreate: upperFunktion.includes('C'),
            canRead: upperFunktion.includes('R'),
            canUpdate: upperFunktion.includes('U'),
            canDelete: upperFunktion.includes('D')
        };
    }

    /**
     * Get cache key for module/bereich combination
     */
    private getCacheKey(applikation: string, bereich: string | null): string {
        return bereich ? `${applikation}:${bereich}` : applikation;
    }

    /**
     * Get permissions for a specific module and optional bereich
     * @param applikation - Application name (e.g., 'KPM')
     * @param bereich - Optional bereich/area (e.g., 'Offerte', 'Vertrag')
     */
    getPermissions(applikation: string, bereich?: string | null): CrudPermissions {
        const key = this.getCacheKey(applikation, bereich || null);
        const permissions = this.permissionsCache.get(key);

        if (permissions) {
            return permissions;
        }

        // Fallback: try without bereich if specific not found
        if (bereich) {
            const fallbackKey = this.getCacheKey(applikation, null);
            const fallbackPermissions = this.permissionsCache.get(fallbackKey);
            if (fallbackPermissions) {
                return fallbackPermissions;
            }
        }

        // No permissions found - deny all by default
        console.warn(`[PermissionService] No permissions found for ${key}, denying all`);
        return {
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false
        };
    }

    /**
     * Check if user can create in specified module/bereich
     */
    canCreate(applikation: string, bereich?: string | null): boolean {
        return this.getPermissions(applikation, bereich).canCreate;
    }

    /**
     * Check if user can read/view in specified module/bereich
     */
    canRead(applikation: string, bereich?: string | null): boolean {
        return this.getPermissions(applikation, bereich).canRead;
    }

    /**
     * Check if user can update/edit in specified module/bereich
     */
    canUpdate(applikation: string, bereich?: string | null): boolean {
        return this.getPermissions(applikation, bereich).canUpdate;
    }

    /**
     * Check if user can delete in specified module/bereich
     */
    canDelete(applikation: string, bereich?: string | null): boolean {
        return this.getPermissions(applikation, bereich).canDelete;
    }

    /**
     * Get all module permissions (for debugging/admin views)
     */
    getAllPermissions(): ModulePermissions[] {
        const permissions: ModulePermissions[] = [];

        this.permissionsCache.forEach((crud, key) => {
            const [module, bereich] = key.split(':');
            permissions.push({
                module,
                bereich: bereich || null,
                crud
            });
        });

        return permissions;
    }

    /**
     * Check if user has any permissions at all
     */
    hasAnyPermission(): boolean {
        return this.permissionsCache.size > 0;
    }

    /**
     * Clear the cache (useful for logout or permission refresh)
     */
    clearCache(): void {
        this.permissionsCache.clear();
        this.berechtigungen = [];
    }
}
