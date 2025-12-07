import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { PopoverModule } from 'primeng/popover';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
    AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors,
    ValidatorFn
} from '@angular/forms';
import { Router } from '@angular/router';
import { Offerte, OfferteSearchCriteria } from '@app/fuv/models/offerte.model';
import { Vertrag } from '@app/fuv/models/vertrag.model';
import { ChecklisteModalService } from '@app/fuv/services/checkliste-modal.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { OfferteService } from '@app/fuv/services/offerte.service';
import { VertragService } from '@app/fuv/services/vertrag.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { PermissionService } from '@app/shared/services/permission.service';
import { RecentSearchService } from '@app/shared/services/recent-search.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, LogFactoryService } from '@syrius/core';
import { ColumnDefinition, DataTablePanelComponent } from '@syrius/data-table';

import {
    OFFERTE_STATUS_ABSCHLUSS, OFFERTE_STATUS_REJECTED
} from '../offerte-police/police.constants';
import { OFFERTE_COLUMN_DEFS, OFFERTE_TABLE_CONFIG } from './offerte-search.tables';

@Component({
    selector: 'app-offerte-search',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, PanelModule, InputTextModule, ButtonModule, TableModule, ProgressSpinnerModule, TranslateModule, CardModule, DataTablePanelComponent, PopoverModule, TooltipModule],
    templateUrl: './offerte-search.component.html'
})
export class OfferteSearchComponent implements OnInit {
    private fb = inject(FormBuilder);
    private offerteService = inject(OfferteService);
    private vertragService = inject(VertragService);
    private translate = inject(TranslateService);
    private recentSearchService = inject(RecentSearchService);
    private router = inject(Router);
    private appMessageService = inject(AppMessageService);
    private codesService = inject(CodesService);
    private permissionService = inject(PermissionService);
    private checklisteModalService = inject(ChecklisteModalService);
    private logger = inject(LogFactoryService).createLogger('OfferteSearchComponent');
    private offerteStore = inject(OfferteTypedStore);

    searchForm!: FormGroup;
    searchResults: any[] = [];
    loading: boolean = false;
    searchCriteriaCollapsed: boolean = false;
    submitted: boolean = false;
    searchStarted: boolean = false;
    recentSearches: any[] = [];

    // Track vertrag_boids that already have Vertragsverlängerung offerten (for menu disable logic)
    private vertragBoidsWithVerlaengerungMap = new Map<string, boolean>();

    tableConfig = OFFERTE_TABLE_CONFIG;
    columnDefs: ColumnDefinition<any>[];

    constructor() {
        // Initialize column definitions with actions
        this.columnDefs = this.initializeOffertenColumns();
    }

    ngOnInit(): void {
        this.searchForm = this.fb.group(
            {
                offertenr: [''],
                betrieb_partnernr: [''],
                person_partnernr: ['']
            },
            { validators: [this.atLeastOneFieldValidator()] }
        );
        this.loadRecentSearches();

        // Load permissions
        this.permissionService.loadPermissions().subscribe({
            next: () => {
                // Reinitialize column definitions now that permissions are loaded
                this.columnDefs = this.initializeOffertenColumns();
            },
            error: (error) => {
                this.logger.error('Failed to load permissions', error);
            }
        });
    }

    /**
     * Initialize offerten column definitions with action menu and reactive code resolvers
     */
    private initializeOffertenColumns(): ColumnDefinition<any>[] {
        const columns = [...OFFERTE_COLUMN_DEFS];

        // Add async transform for code table fields using reactive approach
        const statusColumn = columns.find((col) => col.field === 'status');
        if (statusColumn) {
            statusColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.status || '');
            statusColumn.async = true;
        }

        const artColumn = columns.find((col) => col.field === 'art');
        if (artColumn) {
            artColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.art || '');
            artColumn.async = true;
        }

        const stellungColumn = columns.find((col) => col.field === 'stellung_im_betrieb');
        if (stellungColumn) {
            stellungColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.stellung_im_betrieb || '');
            stellungColumn.async = true;
        }

        const beschaeftGradColumn = columns.find((col) => col.field === 'beschaeft_grad');
        if (beschaeftGradColumn) {
            beschaeftGradColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.beschaeft_grad || '');
            beschaeftGradColumn.async = true;
        }

        const betriebColumn = columns.find((col) => col.field === 'betrieb');
        if (betriebColumn) {
            betriebColumn.transform = (rowData: Offerte) => this.getBetriebDisplayName(rowData);
        }

        // Add action menu
        const actionsColumn = columns.find((col) => col.type === 'actions');

        if (actionsColumn) {
            const permissions = this.permissionService.getPermissions('fuv_offerte', 'offerte');
            this.logger.log('[OfferteSearch] Permissions loaded:', permissions);
            const actions: any[] = [];

            // View action - requires Read permission
            if (permissions.canRead) {
                actions.push({
                    label: 'common.actions.view',
                    icon: 'pi pi-eye',
                    command: (offerte: Offerte) => {
                        this.logger.log('[OfferteSearch] View offerte clicked:', offerte.offertenr);
                        this.viewOfferte(offerte);
                    }
                });
            }

            // Edit action - requires Update permission and offerte must not be rejected or concluded
            if (permissions.canUpdate) {
                actions.push({
                    label: 'common.actions.edit',
                    icon: 'pi pi-pencil',
                    command: (offerte: Offerte) => {
                        this.logger.log('[OfferteSearch] Edit offerte clicked:', offerte.offertenr);
                        this.editOfferte(offerte);
                    },
                    // Disable edit for rejected or concluded offerten
                    disabled: (offerte: Offerte) => offerte.status === OFFERTE_STATUS_REJECTED || offerte.status === OFFERTE_STATUS_ABSCHLUSS
                });
            }

            // Checkliste erfassen action - requires Create permission and offerte must not be rejected or concluded
            if (permissions.canCreate) {
                actions.push({
                    label: 'Checkliste erfassen',
                    icon: 'pi pi-list',
                    command: (offerte: Offerte) => {
                        this.logger.log('[OfferteSearch] Checkliste erfassen clicked:', offerte.offertenr);
                        this.openChecklisteModal(offerte);
                    },
                    // Disable checkliste for rejected or concluded offerten
                    disabled: (offerte: Offerte) => offerte.status === OFFERTE_STATUS_REJECTED || offerte.status === OFFERTE_STATUS_ABSCHLUSS
                });
            }

            // Vertragsverlängerung erfassen - requires Create permission and offerte must have a vertrag_boid
            if (permissions.canCreate) {
                actions.push({
                    label: 'Vertragsverlängerung erfassen',
                    icon: 'pi pi-file',
                    command: (offerte: Offerte) => {
                        this.logger.log('[OfferteSearch] Vertragsverlängerung erfassen clicked:', offerte.offertenr);
                        this.createVerlaengerungFromOfferte(offerte);
                    },
                    // Only visible if offerte has a vertrag_boid
                    visible: (offerte: Offerte) => !!offerte.vertrag_boid,
                    // Disable if there's already another offerte for this vertrag_boid (checked via API cache)
                    disabled: (offerte: Offerte) => {
                        if (!offerte.vertrag_boid) {
                            return true; // No vertrag_boid, disable
                        }
                        // Check cache - if vertrag_boid already has a Verlängerung, disable
                        return this.vertragBoidsWithVerlaengerungMap.get(offerte.vertrag_boid) === true;
                    }
                });
            }

            this.logger.log('[OfferteSearch] Actions configured:', actions.length, 'actions');
            actionsColumn.actions = actions;
        }

        return columns;
    }

    private getBetriebDisplayName(rowData: Offerte): string {
        const combined = this.combineNameParts(rowData.betrieb?.name1, rowData.betrieb?.name2);
        if (combined) {
            return combined;
        }

        return rowData.betrieb?.nl_name1?.trim() || '';
    }

    private combineNameParts(name1?: string | null, name2?: string | null): string {
        const parts = [name1, name2].map((part) => part?.trim()).filter((part): part is string => !!part);
        return parts.join(' ');
    }

    /**
     * Navigate to offerte detail view (read-only)
     * Since offerte-detail component doesn't exist, navigate to offerte-police instead
     */
    private viewOfferte(offerte: Offerte): void {
        this.openOfferte(offerte, true);
    }

    /**
     * Navigate to offerte edit/police view
     */
    private editOfferte(offerte: Offerte): void {
        this.openOfferte(offerte, false);
    }

    /**
     * Open checkliste modal for an offerte
     */
    private openChecklisteModal(offerte: Offerte): void {
        this.logger.log('[OfferteSearch] Opening checkliste modal for offerte', offerte.offertenr);
        this.checklisteModalService.openForOfferte(offerte);
    }

    /**
     * Create a Vertragsverlängerung from an existing offerte that has a vertrag_boid
     * Loads the vertrag and creates a new offerte from it
     */
    private createVerlaengerungFromOfferte(offerte: Offerte): void {
        if (!offerte.vertrag_boid) {
            this.appMessageService.showError('Keine Vertragsnummer gefunden');
            return;
        }

        this.logger.log('[OfferteSearch] Creating Vertragsverlängerung from offerte', {
            offertenr: offerte.offertenr,
            vertrag_boid: offerte.vertrag_boid
        });

        // Load the vertrag by BOID to get complete data
        this.vertragService.getVertragByBoid(offerte.vertrag_boid).subscribe({
            next: (vertraege) => {
                if (!vertraege || vertraege.length === 0) {
                    this.appMessageService.showError('Vertrag nicht gefunden');
                    return;
                }

                const vertrag = vertraege[0];
                if (!vertrag.vertragsnr) {
                    this.appMessageService.showError('Vertragsnummer fehlt');
                    return;
                }

                // Create and persist complete Verlängerung offerte
                // This will: map data, load BB/Checkliste, refresh person/betrieb, insert and update offerte
                this.offerteService.createAndPersistVerlaengerung(vertrag).subscribe({
                    next: (createdOfferte) => {
                        this.logger.log('[OfferteSearch] Verlängerung offerte created and persisted', createdOfferte);

                        // Navigate to police component with the created offerte number (offertenr)
                        // Pass the complete offerte data in state to avoid re-fetching from backend
                        this.router.navigate(['fuv', 'offerte', 'police', createdOfferte.offertenr], {
                            state: {
                                previousUrl: this.router.url,
                                fromVertrag: true,
                                offerteData: createdOfferte // Pass complete offerte data including taetigkeit
                            }
                        });
                    },
                    error: (error) => {
                        this.logger.error('[OfferteSearch] Failed to map offerte from vertrag', error);
                        this.appMessageService.showError('Fehler beim Erstellen der Verlängerung');
                    }
                });
            },
            error: (error) => {
                this.logger.error('[OfferteSearch] Failed to load vertrag', error);
                this.appMessageService.showError('Fehler beim Laden des Vertrags');
            }
        });
    }

    /**
     * Check search results for existing Vertragsverlängerung offerten using API
     * Updates vertragBoidsWithVerlaengerungMap cache for use in menu disabled logic
     */
    private checkOffertenForVerlaengerung(offerten: Offerte[]): void {
        // Extract all unique vertrag_boids from search results
        const vertragBoids = new Set<string>();
        offerten.forEach((offerte) => {
            if (offerte.vertrag_boid) {
                vertragBoids.add(offerte.vertrag_boid);
            }
        });

        // For each vertrag_boid, check if there's more than one offerte with that vertrag_boid
        vertragBoids.forEach((boid) => {
            // Only check if not already in cache
            if (!this.vertragBoidsWithVerlaengerungMap.has(boid)) {
                this.offerteService.searchOfferten({ vertrag_boid: boid }).subscribe({
                    next: (offerten) => {
                        // If we find more than 1 offerte with this vertrag_boid, there's already a Verlängerung
                        this.vertragBoidsWithVerlaengerungMap.set(boid, offerten.length > 1);
                        this.logger.debug('[OfferteSearch] Checked vertrag_boid for Verlängerung', {
                            boid,
                            hasVerlaengerung: offerten.length > 1,
                            offertenCount: offerten.length
                        });
                    },
                    error: (error) => {
                        this.logger.error('[OfferteSearch] Error checking for Vertragsverlängerung', { boid, error });
                        // On error, assume false (allow action)
                        this.vertragBoidsWithVerlaengerungMap.set(boid, false);
                    }
                });
            }
        });
    }

    /**
     * Loads recent offerte searches from local storage
     */
    loadRecentSearches(): void {
        this.recentSearches = this.recentSearchService.getSearches('offerte') as Offerte[];
    }

    /**
     * Handles selection of a recent search entry
     * Directly uses the stored offerte object and navigates to detail view
     */
    onRecentSearchSelect(search: Offerte): void {
        if (!search.offertenr) {
            return;
        }
        // Directly use the stored offerte object without fetching from API
        this.onOfferteSelect(search);
    }

    /**
     * Clears all recent searches from local storage
     */
    clearRecentSearches(): void {
        this.recentSearchService.clearSearches('offerte');
        this.loadRecentSearches();
    }

    /**
     * Removes a single search entry from recent searches
     * @param search The search entry to remove
     * @param event The click event to stop propagation
     */
    removeRecentSearch(search: Offerte, event: Event): void {
        event.stopPropagation();
        this.recentSearchService.removeSearch('offerte', search);
        this.loadRecentSearches();
    }

    /**
     * Custom validator: at least one of the search fields must be filled.
     */
    atLeastOneFieldValidator(): ValidatorFn {
        return (group: AbstractControl): ValidationErrors | null => {
            const offertenr = group.get('offertenr')?.value?.trim();
            const betriebPartnernr = group.get('betrieb_partnernr')?.value?.trim();
            const personPartnernr = group.get('person_partnernr')?.value?.trim();
            if (offertenr || betriebPartnernr || personPartnernr) {
                return null;
            }
            return { atLeastOneFieldRequired: true };
        };
    }

    /**
     * Gets validation error message for the form
     */
    getValidationErrorMessage(): string {
        if (this.searchForm.errors?.['atLeastOneFieldRequired']) {
            return this.translate.instant('fuv.searchOfferte.validation.atLeastOneFieldRequired');
        }
        return '';
    }

    /**
     * Checks if a field should show validation error
     */
    isFieldInvalid(field: string): boolean {
        const control = this.searchForm.get(field);
        if (!control) return false;
        if (!this.submitted) return false;
        if (this.searchForm.errors?.['atLeastOneFieldRequired'] && !control.value?.trim()) {
            return field === 'offertenr' || field === 'betrieb_partnernr' || field === 'person_partnernr';
        }
        return false;
    }

    /**
     * Handles form submission and offerte search execution
     */
    onSubmit(): void {
        this.submitted = true;

        if (this.searchForm.invalid) {
            this.searchStarted = false;
            return;
        }

        this.loading = true;
        this.searchStarted = true;
        this.searchCriteriaCollapsed = true;
        this.searchResults = [];

        const formValue = this.searchForm.value;
        const criteria: OfferteSearchCriteria = {
            offertenr: formValue.offertenr || undefined,
            betrieb_partnernr: formValue.betrieb_partnernr || undefined,
            person_partnernr: formValue.person_partnernr || undefined
        };

        this.offerteService.searchOfferten(criteria).subscribe({
            next: (data: Offerte[]) => {
                this.searchResults = data;
                this.loading = false;
                this.searchCriteriaCollapsed = Array.isArray(data) && data.length > 0;

                // Check for existing Vertragsverlängerung offerten
                if (data && data.length > 0) {
                    this.checkOffertenForVerlaengerung(data);
                }

                // Do not automatically navigate - show the result in the table instead
                // (offerte-detail component does not exist anymore)
            },
            error: (err: any) => {
                this.logger.error('Error fetching offerte data:', err);
                this.searchResults = [];
                this.loading = false;
                this.searchCriteriaCollapsed = false;
                this.searchStarted = false;

                const errorMessage = err?.error?.message || err?.message || 'Unbekannter Fehler bei der Offerten-Suche.';
                this.appMessageService.showError(errorMessage);
            }
        });
    }

    /**
     * Handles offerte selection from search results
     * Saves to recent searches and navigates to offerte-police view
     * Respects permissions: opens in write mode if canUpdate, otherwise read-only mode
     */
    onOfferteSelect(offerte: Offerte): void {
        const offerteData = offerte;
        if (!offerteData) {
            return;
        }

        // Validate offerte has required data for navigation
        if (!offerteData.offertenr) {
            this.appMessageService.showWarning('Keine Offertennummer vorhanden, Detailansicht nicht möglich.');
            return;
        }

        // Save full offerte object to recent searches for quick access
        this.recentSearchService.addSearch('offerte', offerteData);
        this.loadRecentSearches();

        // Check permissions to determine navigation mode
        const permissions = this.permissionService.getPermissions('fuv_offerte', 'offerte');
        const isRejectedOrConcluded = offerteData.status === OFFERTE_STATUS_REJECTED || offerteData.status === OFFERTE_STATUS_ABSCHLUSS;

        // Determine if we should open in write mode or read-only mode
        // Write mode: user has update permission AND offerte is not rejected or concluded
        // Read-only mode: user only has read permission OR offerte is rejected/concluded
        const shouldOpenInWriteMode = permissions.canUpdate && !isRejectedOrConcluded;

        this.logger.log('[OfferteSearch] Row clicked - navigating with permissions:', {
            canRead: permissions.canRead,
            canUpdate: permissions.canUpdate,
            isRejectedOrConcluded,
            shouldOpenInWriteMode
        });
        this.openOfferte(offerteData, !shouldOpenInWriteMode);
    }

    private openOfferte(offerte: Offerte, viewMode: boolean): void {
        if (!offerte?.offertenr) {
            return;
        }

        this.prepareOfferteNavigation(offerte, viewMode);
        this.router.navigate(['/fuv/offerte/police', offerte.offertenr], {
            state: {
                previousUrl: this.router.url,
                viewMode,
                offerteData: offerte
            }
        });
    }

    private prepareOfferteNavigation(offerte: Offerte, viewMode: boolean): void {
        const offertenr = offerte.offertenr;
        if (!offertenr) {
            return;
        }

        this.offerteStore.setOfferte(offertenr, offerte);
        this.offerteStore.setKey(offertenr);
        this.offerteStore.setReadOnly(offertenr, viewMode);
        this.offerteStore.setPreviousUrl(this.router.url);
    }

    /**
     * Resets the search form and results to initial state
     */
    resetForm(): void {
        this.searchForm.reset({
            offertenr: '',
            betrieb_partnernr: '',
            person_partnernr: ''
        });
        this.searchResults = [];
        this.searchCriteriaCollapsed = false;
        this.submitted = false;
        this.searchStarted = false;
        this.loading = false;
    }
}
