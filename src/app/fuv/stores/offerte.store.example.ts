/**
 * Example usage of OfferteTypedStore
 * This file demonstrates common patterns and use cases
 */

import { Component, computed, effect, inject, Signal } from '@angular/core';

import { OfferteComplete, OfferteCompleteUtils } from '../models/offerte-complete.model';
import { OfferteTypedStore } from './offerte-typed.store';

/**
 * Example Component demonstrating OfferteTypedStore usage
 */
@Component({
    selector: 'app-offerte-typed-example',
    template: `
        <div class="offerte-container">
            <!-- Header with status indicators -->
            <header>
                <h1>{{ offerteTitle() }}</h1>

                @if (hasUnsavedChanges()) {
                    <span class="badge badge-warning">Unsaved Changes</span>
                }

                @if (isLoading()) {
                    <span class="badge badge-info">Loading...</span>
                }

                @if (isSaving()) {
                    <span class="badge badge-info">Saving...</span>
                }
            </header>

            <!-- Current offerte display -->
            @if (currentOfferte(); as offerte) {
                <div class="offerte-details">
                    <div class="field">
                        <label>Offertenr:</label>
                        <span>{{ offerte.offertenr }}</span>
                    </div>

                    <div class="field">
                        <label>Status:</label>
                        <span>{{ offerte.status }}</span>
                    </div>

                    <div class="field">
                        <label>Betrieb:</label>
                        <span>{{ betriebName() }}</span>
                    </div>

                    <div class="field">
                        <label>Person:</label>
                        <span>{{ personFullName() }}</span>
                    </div>

                    <div class="field">
                        <label>Klasse:</label>
                        <span>{{ offerte.klasse }}</span>
                    </div>

                    <!-- Modified fields indicator -->
                    @if (modifiedFieldsArray().length > 0) {
                        <div class="modified-fields">
                            <strong>Modified fields:</strong>
                            <ul>
                                @for (field of modifiedFieldsArray(); track field) {
                                    <li>{{ field }}</li>
                                }
                            </ul>
                        </div>
                    }
                </div>

                <!-- Actions -->
                <div class="actions">
                    <button (click)="handleSave()" [disabled]="!canSave()">Save</button>

                    <button (click)="handleReset()" [disabled]="!isModified()">Reset</button>

                    <button (click)="handleClose()">Close</button>
                </div>
            } @else {
                <p>No offerte loaded</p>
            }

            <!-- Multiple offerten list -->
            @if (offerteKeys().length > 1) {
                <div class="offerte-list">
                    <h3>All Offerten ({{ offertenCount() }})</h3>
                    <ul>
                        @for (key of offerteKeys(); track key) {
                            <li (click)="switchOfferte(key)" [class.active]="currentKey() === key" [class.modified]="isOfferteModified(key)">
                                {{ key }}
                                @if (isOfferteModified(key)) {
                                    <span class="modified-indicator">*</span>
                                }
                            </li>
                        }
                    </ul>
                </div>
            }
        </div>
    `,
    styles: [
        `
            .badge {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                margin-left: 8px;
            }

            .badge-warning {
                background: #ffc107;
                color: #000;
            }
            .badge-info {
                background: #17a2b8;
                color: #fff;
            }

            .modified-indicator {
                color: #ffc107;
                font-weight: bold;
            }

            .offerte-list li.active {
                font-weight: bold;
                background: #e3f2fd;
            }

            .offerte-list li.modified {
                color: #ffc107;
            }
        `
    ]
})
export class OfferteTypedExampleComponent {
    // Inject the store
    readonly offerteStore = inject(OfferteTypedStore);

    // Direct signal accessors from store
    readonly currentOfferte = this.offerteStore.currentOfferte;
    readonly currentMeta = this.offerteStore.currentMeta;
    readonly isModified = this.offerteStore.isCurrentModified;
    readonly isValid = this.offerteStore.isCurrentValid;
    readonly isLoading = this.offerteStore.isCurrentLoading;
    readonly isSaving = this.offerteStore.isCurrentSaving;
    readonly offerteKeys = this.offerteStore.offerteKeys;
    readonly offertenCount = this.offerteStore.offertenCount;
    readonly currentKey = this.offerteStore.currentKey;

    // Computed signals - derived values
    readonly offerteTitle = computed(() => {
        const offerte = this.currentOfferte();
        return offerte?.offertenr || 'New Offerte';
    });

    readonly betriebName = computed(() => {
        return this.currentOfferte()?.betrieb?.name1 || '-';
    });

    readonly personFullName = computed(() => {
        const person = this.currentOfferte()?.person;
        if (!person) return '-';
        return `${person.name || ''} ${person.vorname || ''}`.trim();
    });

    readonly hasUnsavedChanges = computed(() => {
        return this.isModified() && !this.isSaving();
    });

    readonly canSave = computed(() => {
        return this.isModified() && this.isValid() && !this.isSaving();
    });

    readonly modifiedFieldsArray = computed(() => {
        const fields = this.offerteStore.getCurrentModifiedFields();
        return Array.from(fields);
    });

    constructor() {
        // Effect: Log when offerte changes
        effect(() => {
            const offerte = this.currentOfferte();
            if (offerte) {
                console.log('[Example] Current offerte changed:', offerte.offertenr);
            }
        });

        // Effect: Warn about unsaved changes
        effect(() => {
            if (this.hasUnsavedChanges()) {
                console.warn('[Example] You have unsaved changes!');
            }
        });
    }

    /**
     * Example: Load offerte from API
     */
    async loadOfferte(offertenr: string): Promise<void> {
        // Set loading state
        this.offerteStore.updateCurrentMeta({ isLoading: true });

        try {
            // Simulate API call
            const response = await this.fetchOfferteFromApi(offertenr);

            // Enrich from API and store
            const enriched = OfferteCompleteUtils.enrichFromApi(response);
            this.offerteStore.setOfferte(offertenr, enriched);

            this.offerteStore.updateCurrentMeta({
                isLoading: false,
                syncError: null
            });
        } catch (error: any) {
            this.offerteStore.updateCurrentMeta({
                isLoading: false,
                syncError: error.message
            });
            console.error('[Example] Failed to load offerte:', error);
        }
    }

    /**
     * Example: Save current offerte
     */
    async handleSave(): Promise<void> {
        const offerte = this.currentOfferte();
        if (!offerte) return;

        this.offerteStore.updateCurrentMeta({ isSaving: true });

        try {
            // Prepare for API
            const apiData = OfferteCompleteUtils.prepareForApi(offerte);

            // Save to backend
            await this.saveOfferteToApi(apiData);

            // Mark as synced (this resets isModified flag and updates original)
            this.offerteStore.markCurrentAsSynced();

            this.offerteStore.updateCurrentMeta({
                isSaving: false,
                syncError: null
            });

            console.log('[Example] Offerte saved successfully');
        } catch (error: any) {
            this.offerteStore.updateCurrentMeta({
                isSaving: false,
                syncError: error.message
            });
            console.error('[Example] Failed to save offerte:', error);
        }
    }

    /**
     * Example: Reset to original state
     */
    handleReset(): void {
        if (confirm('Discard all unsaved changes?')) {
            this.offerteStore.resetCurrentOfferte();
            console.log('[Example] Offerte reset to original state');
        }
    }

    /**
     * Example: Close offerte
     */
    handleClose(): void {
        if (this.hasUnsavedChanges()) {
            if (!confirm('You have unsaved changes. Close anyway?')) {
                return;
            }
        }

        // Navigate back or clear
        const previousUrl = this.offerteStore.previousUrl();
        if (previousUrl) {
            // this.router.navigateByUrl(previousUrl);
            console.log('[Example] Navigate to:', previousUrl);
        } else {
            this.offerteStore.deleteCurrentOfferte();
        }
    }

    /**
     * Example: Switch to different offerte
     */
    switchOfferte(key: string): void {
        if (this.hasUnsavedChanges()) {
            if (!confirm('You have unsaved changes. Switch anyway?')) {
                return;
            }
        }

        this.offerteStore.setCurrentKey(key);
    }

    /**
     * Example: Check if specific offerte is modified
     */
    isOfferteModified(key: string): boolean {
        const meta = this.offerteStore.getMeta(key);
        return meta?.isModified || false;
    }

    /**
     * Example: Update betrieb data
     */
    updateBetrieb(changes: Partial<any>): void {
        this.offerteStore.updateCurrentNestedStructure('betrieb', changes);
    }

    /**
     * Example: Update person data
     */
    updatePerson(changes: Partial<any>): void {
        this.offerteStore.updateCurrentNestedStructure('person', changes);
    }

    /**
     * Example: Update offerte fields
     */
    updateOfferteFields(changes: Partial<OfferteComplete>): void {
        this.offerteStore.updateCurrentOfferte(changes);
    }

    /**
     * Simulate API call to fetch offerte
     */
    private async fetchOfferteFromApi(offertenr: string): Promise<any> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Return mock data (would be real API call in production)
        return {
            id: 466,
            offertenr,
            art: 'OfferteArtVer',
            status: 'Offerte_Abschluss'
            // ... other fields
        };
    }

    /**
     * Simulate API call to save offerte
     */
    private async saveOfferteToApi(data: any): Promise<void> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('[Example] Saving to API:', data);
    }
}

/**
 * Example: Service usage
 */
export class OfferteTypedService {
    readonly offerteStore = inject(OfferteTypedStore);

    /**
     * Load and store offerte from API
     */
    async loadOfferte(offertenr: string): Promise<OfferteComplete | null> {
        try {
            // Check if already loaded
            if (this.offerteStore.hasOfferte(offertenr)) {
                this.offerteStore.setCurrentKey(offertenr);
                return this.offerteStore.currentOfferte();
            }

            // Fetch from API (implement your API call here)
            const response = await fetch(`/api/fuv/offerte/${offertenr}`);
            const data = await response.json();

            // Enrich and store
            const enriched = OfferteCompleteUtils.enrichFromApi(data);
            this.offerteStore.setOfferte(offertenr, enriched, true);

            return enriched;
        } catch (error) {
            console.error('Failed to load offerte:', error);
            return null;
        }
    }

    /**
     * Save current offerte to API
     */
    async saveCurrentOfferte(): Promise<boolean> {
        const offerte = this.offerteStore.currentOfferte();
        if (!offerte) return false;

        try {
            this.offerteStore.updateCurrentMeta({ isSaving: true });

            // Prepare for API
            const apiData = OfferteCompleteUtils.prepareForApi(offerte);

            // Save to backend (implement your API call here)
            const response = await fetch(`/api/fuv/offerte/${offerte.offertenr}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiData)
            });

            if (!response.ok) throw new Error('Save failed');

            // Mark as synced
            this.offerteStore.markCurrentAsSynced();
            this.offerteStore.updateCurrentMeta({
                isSaving: false,
                syncError: null
            });

            return true;
        } catch (error: any) {
            this.offerteStore.updateCurrentMeta({
                isSaving: false,
                syncError: error.message
            });
            return false;
        }
    }

    /**
     * Check for unsaved changes before navigation
     */
    canDeactivate(): boolean {
        const modifiedKeys = this.offerteStore.modifiedOfferteKeys();
        if (modifiedKeys.length > 0) {
            return confirm(`You have ${modifiedKeys.length} unsaved offerte(n). Leave anyway?`);
        }
        return true;
    }
}
