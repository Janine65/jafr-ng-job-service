import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';

import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import {
    CodeTableApiRequest, CodeTableApiResponse, CodeTableEntry, CodeTableIndex, LanguageCode
} from '../models/codetable.model';

@Injectable({
    providedIn: 'root'
})
export class CodesService {
    private http = inject(HttpClient);
    private translate = inject(TranslateService);
    private apiUrl = '/api/admin/codetabelle';

    // Session storage key for code table cache
    private readonly STORAGE_KEY = 'fuv_codetable_cache';
    private readonly STORAGE_TIMESTAMP_KEY = 'fuv_codetable_cache_timestamp';
    private readonly CACHE_VALIDITY_MS = 1000 * 60 * 60 * 24; // 24 hours

    // Cache for code tables to avoid repeated API calls
    private codeTableCache$?: Observable<CodeTableEntry[]>;
    private codeTableIndexCache?: CodeTableIndex;

    // Signal-based caching for modern reactive patterns
    // Pre-convert the main Observable to a signal to avoid toSignal() in reactive contexts
    private allCodesSignal = toSignal(this.getAllCodes(), { initialValue: [] });

    /**
     * Search for code table entries
     * Maps to GET /api/admin/codetabelle/searchCodetabelle
     */
    searchCodeTable(criteria: CodeTableApiRequest): Observable<CodeTableApiResponse> {
        let params = new HttpParams();

        if (criteria.internal_name !== undefined) {
            params = params.set('internal_name', criteria.internal_name);
        }
        if (criteria.gruppe !== undefined) {
            params = params.set('gruppe', criteria.gruppe);
        }

        return this.http.get<CodeTableApiResponse>(`${this.apiUrl}/searchCodetabelle`, { params });
    }

    /**
     * Get all code table entries (cached)
     * This loads all codes once and caches them for subsequent calls
     * Also stores in session storage for persistence across page reloads
     */
    getAllCodes(): Observable<CodeTableApiResponse> {
        if (!this.codeTableCache$) {
            // Check session storage first
            const cachedData = this.loadFromSessionStorage();
            if (cachedData) {
                this.codeTableCache$ = of(cachedData).pipe(shareReplay(1));
                return this.codeTableCache$;
            }

            // Empty params to get all codes
            const params = new HttpParams().set('internal_name', '').set('gruppe', '');

            this.codeTableCache$ = this.http.get<CodeTableApiResponse>(`${this.apiUrl}/searchCodetabelle`, { params }).pipe(
                tap((entries) => {
                    // Save to session storage
                    this.saveToSessionStorage(entries);
                }),
                shareReplay(1) // Cache the result
            );
        }

        return this.codeTableCache$;
    }

    /**
     * Get code table index (internal_name -> CodeTableEntry mapping)
     * Builds an index for fast lookups by internal_name
     */
    getCodeTableIndex(): Observable<CodeTableIndex> {
        return this.getAllCodes().pipe(
            map((entries) => {
                if (!this.codeTableIndexCache) {
                    this.codeTableIndexCache = entries.reduce((index, entry) => {
                        index[entry.internal_name] = entry;
                        return index;
                    }, {} as CodeTableIndex);
                }
                return this.codeTableIndexCache;
            })
        );
    }

    /**
     * Resolve a code internal_name to its localized label
     * @param internalName The internal_name to resolve
     * @param lang Optional language code (defaults to current language)
     * @returns The localized label or the internal_name if not found
     */
    resolveCode(internalName: string, lang?: LanguageCode): Observable<string> {
        return this.getCodeTableIndex().pipe(
            map((index) => {
                const entry = index[internalName];
                if (!entry) {
                    return internalName; // Return internal_name if not found
                }

                return this.getLocalizedLabel(entry, lang);
            })
        );
    }

    /**
     * Resolve multiple code internal_names to their localized labels
     * @param internalNames Array of internal_names to resolve
     * @param lang Optional language code (defaults to current language)
     * @returns Map of internal_name -> localized label
     */
    resolveCodes(internalNames: string[], lang?: LanguageCode): Observable<Record<string, string>> {
        return this.getCodeTableIndex().pipe(
            map((index) => {
                const result: Record<string, string> = {};
                internalNames.forEach((internalName) => {
                    const entry = index[internalName];
                    result[internalName] = entry ? this.getLocalizedLabel(entry, lang) : internalName;
                });
                return result;
            })
        );
    }

    /**
     * Get all codes for a specific gruppe (category)
     * @param gruppe The gruppe to filter by
     * @returns Array of code table entries for the specified gruppe
     */
    getCodesByGruppe(gruppe: string): Observable<CodeTableApiResponse> {
        return this.getAllCodes().pipe(map((entries) => entries.filter((entry) => entry.gruppe === gruppe)));
    }

    /**
     * Get localized label for a code table entry
     * @param entry The code table entry
     * @param lang Optional language code (defaults to current language)
     * @returns The localized label based on the language
     */
    getLocalizedLabel(entry: CodeTableEntry, lang?: LanguageCode): string {
        const currentLang = lang || (this.translate.currentLang as LanguageCode) || this.translate.defaultLang || 'de';

        switch (currentLang) {
            case 'de':
                return entry.bezeichnungdt || entry.internal_name;
            case 'fr':
                return entry.bezeichnungfr || entry.bezeichnungdt || entry.internal_name;
            case 'it':
                return entry.bezeichnungit || entry.bezeichnungdt || entry.internal_name;
            case 'en':
                return entry.bezeichnungen || entry.bezeichnungdt || entry.internal_name;
            default:
                return entry.bezeichnungdt || entry.internal_name;
        }
    }

    /**
     * Insert a new code table entry
     * Maps to PUT /api/admin/codetabelle/insertCodetabelle
     */
    insertCode(entry: Partial<CodeTableEntry>): Observable<CodeTableEntry> {
        this.clearCache();
        return this.http.put<CodeTableEntry>(`${this.apiUrl}/insertCodetabelle`, entry);
    }

    /**
     * Update an existing code table entry
     * Maps to POST /api/admin/codetabelle/updateCodetabelle
     */
    updateCode(entry: CodeTableEntry): Observable<CodeTableEntry> {
        this.clearCache();
        return this.http.post<CodeTableEntry>(`${this.apiUrl}/updateCodetabelle`, entry);
    }

    /**
     * Delete a code table entry
     * Maps to DELETE /api/admin/codetabelle/deleteCodetabelle
     */
    deleteCode(id: number): Observable<void> {
        this.clearCache();
        const params = new HttpParams().set('id', id.toString());
        return this.http.delete<void>(`${this.apiUrl}/deleteCodetabelle`, { params });
    }

    /**
     * Import code table entries
     * Maps to PUT /api/admin/codetabelle/importCodetabelle
     */
    importCodes(entries: CodeTableApiResponse): Observable<void> {
        this.clearCache();
        return this.http.put<void>(`${this.apiUrl}/importCodetabelle`, entries);
    }

    /**
     * Refresh Syrius codes
     * Maps to PUT /api/admin/codetabelle/refreshSyriusCodes
     */
    refreshSyriusCodes(): Observable<void> {
        this.clearCache();
        return this.http.put<void>(`${this.apiUrl}/refreshSyriusCodes`, {});
    }

    /**
     * Load Syrius codes
     * Maps to PUT /api/admin/codetabelle/loadSyriusCodes
     */
    loadSyriusCodes(): Observable<void> {
        this.clearCache();
        return this.http.put<void>(`${this.apiUrl}/loadSyriusCodes`, {});
    }

    /**
     * Clear the cache to force reload on next request
     */
    clearCache(): void {
        this.codeTableCache$ = undefined;
        this.codeTableIndexCache = undefined;
        this.clearSessionStorage();
    }

    // ========== SIGNAL-BASED METHODS (Angular 20+) ==========

    /**
     * Get code entries by gruppe as a computed signal
     * No lazy caching needed - computed() handles memoization automatically
     * @param gruppe - The group code to filter by
     * @returns Computed signal containing filtered code entries
     */
    getCodesByGruppeSignal(gruppe: string): Signal<CodeTableEntry[]> {
        return computed(() => {
            const allCodes = this.allCodesSignal();
            return allCodes.filter((code) => code.gruppe === gruppe);
        });
    }

    /**
     * Get active code entries by gruppe as a computed signal
     * Filters for entries where aktiv === true
     * @param gruppe - The group code to filter by
     * @returns Computed signal containing filtered active code entries
     */
    getActiveCodesByGruppeSignal(gruppe: string): Signal<CodeTableEntry[]> {
        return computed(() => {
            const allCodes = this.allCodesSignal();
            return allCodes.filter((code) => code.gruppe === gruppe && code.aktiv === true);
        });
    }

    /**
     * Get code entries as a Map for O(1) lookups
     * Key is internal_name, value is the CodeTableEntry
     * @param gruppe - The group code to filter by
     * @returns Computed signal containing a Map of code entries
     */
    getCodeMapSignal(gruppe: string): Signal<Map<string, CodeTableEntry>> {
        return computed(() => {
            const allCodes = this.allCodesSignal();
            const filteredCodes = allCodes.filter((code) => code.gruppe === gruppe);
            return new Map(filteredCodes.map((code) => [code.internal_name, code]));
        });
    }

    /**
     * Get code entries formatted as dropdown options
     * Returns {label, value} objects suitable for PrimeNG dropdowns
     * @param gruppe - The group code to filter by
     * @param activeOnly - If true, only returns entries where aktiv === true
     * @returns Computed signal containing dropdown options
     */
    getCodeOptionsSignal(gruppe: string, activeOnly = false): Signal<Array<{ label: string; value: string }>> {
        return computed(() => {
            const allCodes = this.allCodesSignal();
            const filteredCodes = allCodes.filter((code) => {
                if (code.gruppe !== gruppe) return false;
                if (activeOnly && code.aktiv !== true) return false;
                return true;
            });

            return filteredCodes.map((code) => ({
                label: this.getLocalizedLabel(code),
                value: code.internal_name
            }));
        });
    }

    // ========== END SIGNAL-BASED METHODS ==========

    /**
     * Save code table entries to session storage
     */
    private saveToSessionStorage(entries: CodeTableEntry[]): void {
        try {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
            sessionStorage.setItem(this.STORAGE_TIMESTAMP_KEY, Date.now().toString());
        } catch (error) {
            console.error('Failed to save code table to session storage:', error);
        }
    }

    /**
     * Load code table entries from session storage
     * Returns null if cache is invalid or doesn't exist
     */
    private loadFromSessionStorage(): CodeTableEntry[] | null {
        try {
            const cachedData = sessionStorage.getItem(this.STORAGE_KEY);
            const timestamp = sessionStorage.getItem(this.STORAGE_TIMESTAMP_KEY);

            if (!cachedData || !timestamp) {
                return null;
            }

            // Check if cache is still valid
            const cacheAge = Date.now() - parseInt(timestamp, 10);
            if (cacheAge > this.CACHE_VALIDITY_MS) {
                this.clearSessionStorage();
                return null;
            }

            return JSON.parse(cachedData) as CodeTableEntry[];
        } catch (error) {
            console.error('Failed to load code table from session storage:', error);
            return null;
        }
    }

    /**
     * Clear session storage cache
     */
    private clearSessionStorage(): void {
        try {
            sessionStorage.removeItem(this.STORAGE_KEY);
            sessionStorage.removeItem(this.STORAGE_TIMESTAMP_KEY);
        } catch (error) {
            console.error('Failed to clear code table session storage:', error);
        }
    }

    /**
     * Prefetch all codes and store in session storage
     * This should be called during app initialization
     */
    prefetchCodes(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.getAllCodes().subscribe({
                next: () => {
                    resolve();
                },
                error: (error) => {
                    console.error('Failed to prefetch codes:', error);
                    reject(error);
                }
            });
        });
    }
}
