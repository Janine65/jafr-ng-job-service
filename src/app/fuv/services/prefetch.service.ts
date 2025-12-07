import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AnspberService } from '@app/fuv/services/anspber.service';
import { ChecklisteService } from '@app/fuv/services/checkliste.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { FragenService } from '@app/fuv/services/fragen.service';
import { KpmService } from '@app/fuv/services/kpm.service';
import { MerkmalService } from '@app/fuv/services/merkmal.service';
import { VariaService } from '@app/fuv/services/varia.service';
import { VertriebspartnerService } from '@app/fuv/services/vertriebspartner.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { AppMessageService, LogFactoryService, Logger } from '@syrius/core';

/**
 * Status of a prefetch resource
 */
export enum ResourceStatus {
    PENDING = 'pending',
    LOADING = 'loading',
    LOADED = 'loaded',
    ERROR = 'error'
}

/**
 * Interface for a prefetch resource registration
 */
export interface PrefetchResource {
    /** Unique identifier for the resource */
    key: string;
    /** Display name shown in progress toasts */
    displayName: string;
    /** Optional description */
    description?: string;
    /** Loading function that returns a Promise */
    loadFn: () => Promise<void>;
    /** Priority order (lower numbers load first) */
    priority?: number;
    /** Current status */
    status: ResourceStatus;
    /** Error message if status is ERROR */
    error?: string;
}

/**
 * Service to manage FUV Offerte-Police specific prefetching tasks.
 *
 * This service provides a registry-based prefetch system where:
 * - Services can register resources with metadata (name, description, loading function)
 * - Progress tracking is automatic based on registered resources
 * - Components can query resource loading status
 * - Supports dynamic resource registration and priority ordering
 */
@Injectable({
    providedIn: 'root'
})
export class PrefetchService {
    private logger: Logger;
    private anspberService = inject(AnspberService);
    private codesService = inject(CodesService);
    private merkmalService = inject(MerkmalService);
    private variaService = inject(VariaService);
    private fragenService = inject(FragenService);
    private vertriebspartnerService = inject(VertriebspartnerService);
    private checklisteService = inject(ChecklisteService);
    private kpmService = inject(KpmService);
    private offerteStore = inject(OfferteTypedStore);
    private messageService = inject(AppMessageService);

    // Resource registry - stores all registered prefetch resources
    private resourceRegistry = new Map<string, PrefetchResource>();

    // Prefetch status signals
    private _isInitialized = signal(false);
    private _isPrefetching = signal(false);
    private _prefetchProgress = signal<{
        total: number;
        completed: number;
        current: string | null;
    }>({
        total: 0, // Dynamic based on registered resources
        completed: 0,
        current: null
    });
    private _prefetchErrors = signal<string[]>([]);

    // Checkliste prefetch tracking
    private _checklistePrefetchStatus = signal<{
        attempted: boolean;
        success: boolean;
        error: string | null;
    }>({
        attempted: false,
        success: false,
        error: null
    });
    private lastPrefetchedOfferteId: number | null = null;

    // Public readonly signals
    readonly isInitialized = this._isInitialized.asReadonly();
    readonly isPrefetching = this._isPrefetching.asReadonly();
    readonly prefetchProgress = this._prefetchProgress.asReadonly();
    readonly prefetchErrors = this._prefetchErrors.asReadonly();
    readonly checklistePrefetchStatus = this._checklistePrefetchStatus.asReadonly();

    // Computed: prefetch completion percentage
    readonly prefetchPercentage = computed(() => {
        const progress = this._prefetchProgress();
        return progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
    });

    // Computed: check if all prefetch completed successfully
    readonly isPrefetchComplete = computed(() => {
        return this._isInitialized() && !this._isPrefetching() && this._prefetchErrors().length === 0;
    });

    constructor() {
        const logFactory = inject(LogFactoryService);
        this.logger = logFactory.createLogger('PrefetchService');

        // Register all core FUV resources
        this.registerCoreResources();

        // Smart effect: Prefetch checkliste as soon as offerteId is available
        // Note: searchFuvCheckliste only requires offerteId, not person/betrieb
        effect(() => {
            const offerte = this.offerteStore.currentOfferte();
            const offerteId = offerte?.id;

            // Prefetch as soon as we have an offerte ID
            if (offerteId) {
                // Check if checkliste is already in store
                const hasChecklisteInStore = !!(offerte?.checkliste && ((Array.isArray(offerte.checkliste) && offerte.checkliste.length > 0 && offerte.checkliste[0]?.id) || (!Array.isArray(offerte.checkliste) && (offerte.checkliste as any)?.id)));

                // Prefetch if:
                // 1. We haven't prefetched this offerte yet, OR
                // 2. The checkliste is missing from store (page reload case)
                if (this.lastPrefetchedOfferteId !== offerteId || !hasChecklisteInStore) {
                    if (!hasChecklisteInStore) {
                        this.logger.debug('Checkliste missing from store - refetching for offerte:', offerteId);
                    } else {
                        this.logger.debug('Offerte ID available - prefetching checkliste for offerte:', offerteId);
                    }
                    this.prefetchCheckliste(offerteId);
                } else {
                    this.logger.debug('Checkliste already prefetched and available in store for offerte:', offerteId);
                }
            }
        });

        // Smart effect: Prefetch aufgabe details when aufgabe_boid is available
        effect(() => {
            const offerte = this.offerteStore.currentOfferte();
            const meta = this.offerteStore.currentMeta();
            const aufgabe_boid = offerte?.fragebogen?.aufgabe_boid || meta?.aufgabe_boid;

            if (aufgabe_boid && !meta?.aufgabeDetails) {
                this.logger.debug('Aufgabe BOID available - prefetching aufgabe details:', aufgabe_boid);
                this.prefetchAufgabeDetails(aufgabe_boid);
            }
        });
    }

    /**
     * Register a new prefetch resource
     *
     * @param resource The resource configuration to register
     * @example
     * prefetchService.registerResource({
     *   key: 'my-data',
     *   displayName: 'Meine Daten',
     *   description: 'Lädt meine spezifischen Daten',
     *   loadFn: () => this.myService.loadData(),
     *   priority: 10
     * });
     */
    registerResource(resource: Omit<PrefetchResource, 'status'>): void {
        const fullResource: PrefetchResource = {
            ...resource,
            status: ResourceStatus.PENDING,
            priority: resource.priority ?? 999 // Default low priority
        };

        this.resourceRegistry.set(resource.key, fullResource);
        this.logger.debug(`Registered prefetch resource: ${resource.key} (${resource.displayName})`);

        // Update total count
        this._prefetchProgress.update((p) => ({
            ...p,
            total: this.resourceRegistry.size
        }));
    }

    /**
     * Check if a specific resource has been loaded
     *
     * @param key The resource key to check
     * @returns true if the resource is loaded, false otherwise
     * @example
     * if (prefetchService.isResourceLoaded('codes')) {
     *   // Codes are ready to use
     * }
     */
    isResourceLoaded(key: string): boolean {
        const resource = this.resourceRegistry.get(key);
        return resource?.status === ResourceStatus.LOADED;
    }

    /**
     * Get the current status of a resource
     *
     * @param key The resource key to query
     * @returns The resource status or null if not found
     */
    getResourceStatus(key: string): ResourceStatus | null {
        return this.resourceRegistry.get(key)?.status ?? null;
    }

    /**
     * Get full resource information
     *
     * @param key The resource key
     * @returns The resource object or undefined if not found
     */
    getResource(key: string): PrefetchResource | undefined {
        return this.resourceRegistry.get(key);
    }

    /**
     * Get all registered resources
     *
     * @returns Array of all registered resources
     */
    getAllResources(): PrefetchResource[] {
        return Array.from(this.resourceRegistry.values());
    }

    /**
     * Register all core FUV resources
     * This is called automatically in the constructor
     */
    private registerCoreResources(): void {
        this.logger.debug('Registering core FUV resources...');

        this.registerResource({
            key: 'codes',
            displayName: 'Code-Tabellen',
            description: 'Systemcode-Tabellen und Referenzdaten',
            loadFn: () => this.prefetchCodeTable(),
            priority: 1 // Load first
        });

        this.registerResource({
            key: 'merkmale',
            displayName: 'Merkmale',
            description: 'Merkmal-Definitionen',
            loadFn: () => this.prefetchMerkmalData(),
            priority: 2
        });

        this.registerResource({
            key: 'versverdienst',
            displayName: 'VersVerdienst',
            description: 'Versicherungsverdienst-Daten',
            loadFn: () => this.prefetchVersVerdienst(),
            priority: 3
        });

        this.registerResource({
            key: 'fragen',
            displayName: 'FUV Fragen',
            description: 'Fragebogen und Antragsfragen',
            loadFn: () => this.prefetchFragen(),
            priority: 4
        });

        this.registerResource({
            key: 'vertriebspartner',
            displayName: 'Vertriebspartner',
            description: 'Vertriebspartner-Daten',
            loadFn: () => this.prefetchVertriebspartner(),
            priority: 5
        });
    }

    /**
     * Initialize all FUV prefetch tasks
     * This should be called when the user has FUV permissions and navigates to/uses FUV features
     * Automatically loads all registered resources in priority order
     */
    async initializePrefetch(): Promise<void> {
        if (this._isInitialized()) {
            this.logger.debug('FUV prefetch already initialized, skipping...');
            return;
        }

        this._isPrefetching.set(true);
        this._prefetchErrors.set([]);

        // Get all registered resources sorted by priority
        const resources = Array.from(this.resourceRegistry.values()).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

        this.logger.debug(`Loading ${resources.length} registered resources...`);

        // Show initial loading toast
        this.messageService.add({
            severity: 'info',
            summary: 'FUV-Daten',
            detail: `Lade ${resources.length} Datensätze...`,
            life: 3000
        });

        // Execute all prefetch tasks sequentially to track progress
        for (const resource of resources) {
            // Update resource status
            resource.status = ResourceStatus.LOADING;
            this._prefetchProgress.update((p) => ({ ...p, current: resource.displayName }));

            try {
                await resource.loadFn();

                // Update resource status to loaded
                resource.status = ResourceStatus.LOADED;
                this._prefetchProgress.update((p) => ({ ...p, completed: p.completed + 1 }));
                this.logger.debug(`${resource.displayName} loaded successfully`);
            } catch (error) {
                // Update resource status to error
                resource.status = ResourceStatus.ERROR;
                resource.error = error instanceof Error ? error.message : String(error);

                this.logger.error(`${resource.displayName} failed:`, error);
                this._prefetchErrors.update((errors) => [...errors, `${resource.displayName}: ${error}`]);

                // Continue with other tasks even if one fails
                this._prefetchProgress.update((p) => ({ ...p, completed: p.completed + 1 }));
            }
        }

        // Finalize
        this._prefetchProgress.update((p) => ({ ...p, current: null }));
        this._isPrefetching.set(false);
        this._isInitialized.set(true);

        const errorCount = this._prefetchErrors().length;
        if (errorCount === 0) {
            this.logger.debug('FUV prefetch initialization completed successfully');

            // Show success toast
            this.messageService.add({
                severity: 'success',
                summary: 'FUV-Daten',
                detail: 'Alle Daten erfolgreich geladen',
                life: 3000
            });
        } else {
            this.logger.warn(`⚠FUV prefetch completed with ${errorCount} error(s)`);

            // Show warning toast
            this.messageService.add({
                severity: 'warn',
                summary: 'Teilweise geladen',
                detail: `${errorCount} Fehler beim Laden der FUV-Daten`,
                life: 4000
            });
        }
    }

    /**
     * Prefetch code table data
     */
    private async prefetchCodeTable(): Promise<void> {
        try {
            await this.codesService.prefetchCodes();
        } catch (error) {
            this.logger.error('Failed to prefetch code table:', error);
            throw error;
        }
    }

    /**
     * Prefetch merkmal data
     */
    private async prefetchMerkmalData(): Promise<void> {
        try {
            await this.merkmalService.prefetchMerkmale();
        } catch (error) {
            this.logger.error('Failed to prefetch merkmal data:', error);
            throw error;
        }
    }

    /**
     * Prefetch VersVerdienst data
     */
    private async prefetchVersVerdienst(): Promise<void> {
        try {
            await this.variaService.prefetchVersVerdienst();
        } catch (error) {
            this.logger.error('Failed to prefetch VersVerdienst data:', error);
            throw error;
        }
    }

    /**
     * Prefetch FUV Fragen
     */
    private async prefetchFragen(): Promise<void> {
        try {
            // FragenService.prefetchFragen() returns void, but we wrap it for consistency
            this.fragenService.prefetchFragen();
        } catch (error) {
            this.logger.error('Failed to prefetch FUV Fragen:', error);
            throw error;
        }
    }

    /**
     * Prefetch Vertriebspartner data
     */
    private async prefetchVertriebspartner(): Promise<void> {
        try {
            await this.vertriebspartnerService.prefetchVertriebspartner();
        } catch (error) {
            this.logger.error('Failed to prefetch Vertriebspartner:', error);
            throw error;
        }
    }

    /**
     * Prefetch checkliste for a specific offerte
     * This is called automatically when person and betrieb are available
     */
    private prefetchCheckliste(offerteId: number): void {
        // Reset status
        this._checklistePrefetchStatus.set({
            attempted: true,
            success: false,
            error: null
        });

        this.checklisteService.searchFuvCheckliste(offerteId).subscribe({
            next: (checklisten) => {
                if (checklisten && checklisten.length > 0) {
                    const checkliste = checklisten[0]; // Take most recent

                    // Mark as prefetched before updating store to prevent effect re-triggering
                    this.lastPrefetchedOfferteId = offerteId;

                    // Update store with prefetched checkliste
                    this.offerteStore.updateOfferte(null, { checkliste });

                    // Update status
                    this._checklistePrefetchStatus.set({
                        attempted: true,
                        success: true,
                        error: null
                    });

                    // Show success notification in German
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Geladen',
                        detail: 'Checkliste erfolgreich geladen',
                        life: 2000
                    });
                } else {
                    this.logger.debug('No existing checkliste found for offerte:', offerteId);
                    // This is not an error - just no existing checkliste
                    this._checklistePrefetchStatus.set({
                        attempted: true,
                        success: true, // Still considered success
                        error: null
                    });
                    this.lastPrefetchedOfferteId = offerteId;
                }
            },
            error: (error) => {
                this.logger.error('Error prefetching checkliste:', error);
                this._checklistePrefetchStatus.set({
                    attempted: true,
                    success: false,
                    error: error.message || 'Unbekannter Fehler'
                });

                // Show subtle error notification
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Hinweis',
                    detail: 'Checkliste konnte nicht geladen werden',
                    life: 3000
                });
            }
        });
    }

    /**
     * Prefetch aufgabe details for a VTT task
     * This is called automatically when aufgabe_boid is available in fragebogen
     */
    private prefetchAufgabeDetails(aufgabe_boid: string): void {
        this.kpmService.getAufgabeDetails(aufgabe_boid).subscribe({
            next: (details) => {
                // Update store with prefetched aufgabe details
                this.offerteStore.updateMeta(null, { aufgabeDetails: details });

                // Show subtle success notification
                this.messageService.add({
                    severity: 'success',
                    summary: 'Geladen',
                    detail: 'VTT Aufgabendetails geladen',
                    life: 2000
                });
            },
            error: (error) => {
                this.logger.error('Error prefetching aufgabe details:', error);

                // Show subtle error notification
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Hinweis',
                    detail: 'VTT Aufgabendetails konnten nicht geladen werden',
                    life: 3000
                });
            }
        });
    }

    /**
     * Clear all cached data and reset state
     * Useful for logout or data refresh scenarios
     */
    clearCache(): void {
        this.logger.debug('Clearing FUV prefetch cache...');
        this.codesService.clearCache();
        this.merkmalService.clearCache();
        this.variaService.clearCache();
        this.fragenService.clearCache();
        this.vertriebspartnerService.clearCache();

        // Reset all resource statuses
        for (const resource of this.resourceRegistry.values()) {
            resource.status = ResourceStatus.PENDING;
            resource.error = undefined;
        }

        // Reset state
        this._isInitialized.set(false);
        this._isPrefetching.set(false);
        this._prefetchProgress.set({
            total: this.resourceRegistry.size,
            completed: 0,
            current: null
        });
        this._prefetchErrors.set([]);
        this._checklistePrefetchStatus.set({
            attempted: false,
            success: false,
            error: null
        });
        this.lastPrefetchedOfferteId = null;
    }

    /**
     * Reinitialize prefetch (clear and reload)
     */
    async reinitialize(): Promise<void> {
        this.logger.debug('Reinitializing FUV prefetch...');
        this.clearCache();
        await this.initializePrefetch();
    }
}
