import { inject, Injectable } from '@angular/core';
import { BrowserStorageService, LogFactoryService, Logger } from '@syrius/core';

/**
 * Service to manage recent search terms for different search types.
 * Stores recent searches in localStorage with a nested structure and maintains a maximum limit.
 */
@Injectable({
    providedIn: 'root'
})
export class RecentSearchService {
    private readonly MAX_SEARCHES = 10;
    private readonly STORAGE_KEY = 'recent_searches';
    private logFactory = inject(LogFactoryService);
    private storageService = inject(BrowserStorageService);
    private logger: Logger;

    constructor() {
        this.logger = this.logFactory.createLogger('RecentSearchService');
    }

    /**
     * Gets all recent searches (nested structure)
     */
    private getAllSearches(): Record<string, unknown[]> {
        return this.storageService.getLocal<Record<string, unknown[]>>(this.STORAGE_KEY) || {};
    }

    /**
     * Adds a new search term to the recent searches of the specified type.
     * Avoids duplicates and maintains a maximum number of stored searches.
     *
     * @param type The type/category of the search (e.g., 'person', 'betrieb').
     * @param term The search term to add (can be of any type).
     */
    addSearch(type: string, term: unknown): void {
        const allSearches = this.getAllSearches();
        let searches = allSearches[type] || [];

        // Avoid adding duplicate searches
        if (!searches.find((s) => JSON.stringify(s) === JSON.stringify(term))) {
            searches.unshift(term);
            searches = searches.slice(0, this.MAX_SEARCHES);
            allSearches[type] = searches;
            this.storageService.setLocal(this.STORAGE_KEY, allSearches);
            this.logger.debug(`Added new recent search for type '${type}':`, term);
        }
    }

    /**
     * Retrieves the list of recent searches for the specified type.
     *
     * @param type The type/category of the searches to retrieve.
     * @returns An array of recent search terms.
     */
    getSearches(type: string): unknown[] {
        const allSearches = this.getAllSearches();
        const searches = allSearches[type] || [];
        this.logger.debug(`Retrieved ${searches.length} recent searches for type '${type}'.`);
        return searches;
    }

    /**
     * Removes a single search entry from the recent searches for the specified type.
     *
     * @param type The type/category of the search to remove from.
     * @param term The search term to remove.
     */
    removeSearch(type: string, term: unknown): void {
        const allSearches = this.getAllSearches();
        let searches = allSearches[type] || [];

        // Filter out the matching search entry
        searches = searches.filter((s) => JSON.stringify(s) !== JSON.stringify(term));
        allSearches[type] = searches;
        this.storageService.setLocal(this.STORAGE_KEY, allSearches);
        this.logger.debug(`Removed recent search for type '${type}':`, term);
    }

    /**
     * Clears all recent searches for the specified type.
     *
     * @param type The type/category of the searches to clear.
     */
    clearSearches(type: string): void {
        const allSearches = this.getAllSearches();
        delete allSearches[type];
        this.storageService.setLocal(this.STORAGE_KEY, allSearches);
        this.logger.debug(`Cleared recent searches for type '${type}'.`);
    }
}
