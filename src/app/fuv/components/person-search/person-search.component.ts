import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { PopoverModule } from 'primeng/popover';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Person } from '@app/fuv/models/person.model';
import { PersonService } from '@app/fuv/services/person.service';
import { PersonStore } from '@app/fuv/stores/person.store';
import { RecentSearchService } from '@app/shared/services/recent-search.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, LogFactoryService } from '@syrius/core';
import { DataTablePanelComponent } from '@syrius/data-table';

import { PERSON_COLUMN_DEFS, PERSON_TABLE_CONFIG } from './person-search.tables';
import {
    getPersonSearchFormErrors, PersonSearchFormData, validatePersonSearchForm
} from './person-search.validation';

@Component({
    selector: 'app-person-search',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        PanelModule,
        InputTextModule,
        CheckboxModule,
        ToggleSwitchModule,
        ButtonModule,
        TableModule,
        CardModule,
        InputGroupModule,
        InputGroupAddonModule,
        DataTablePanelComponent,
        TranslateModule,
        PopoverModule,
        TooltipModule
    ],
    templateUrl: './person-search.component.html'
})
export class PersonSearchComponent implements OnInit {
    @Input() isDialog: boolean = false;
    @Output() personSelected = new EventEmitter<Person>();

    private searchPersonService = inject(PersonService);
    private router = inject(Router);
    private appMessageService = inject(AppMessageService);
    private translate = inject(TranslateService);
    private recentSearchService = inject(RecentSearchService);
    private logger = inject(LogFactoryService).createLogger('PersonSearchComponent');
    private personStore = inject(PersonStore);

    // Form data
    searchFormData: PersonSearchFormData = {
        name: '',
        vorname: '',
        geburtstag: '',
        svnr: '',
        partnernr: ''
    };

    // Validation errors
    validationErrors: Map<string, string> = new Map();

    searchResults: Person[] = [];
    personSearchLoading: boolean = false;
    searchCriteriaCollapsed: boolean = false;
    submitted: boolean = false;
    searchStarted: boolean = false;
    recentSearches: Person[] = [];
    searchLocalOnly: boolean = false;

    readonly personTableConfig = PERSON_TABLE_CONFIG;
    readonly personColumnDefs = PERSON_COLUMN_DEFS;

    ngOnInit(): void {
        this.logger.debug('Initializing PersonSearchComponent', { isDialog: this.isDialog });
        this.loadRecentSearches();
        this.logger.debug('PersonSearchComponent initialization complete');
    }

    /**
     * Loads recent person searches from local storage
     * Used to provide quick access to previously searched persons
     */
    loadRecentSearches(): void {
        this.logger.debug('Loading recent person searches');
        this.recentSearches = this.recentSearchService.getSearches('person') as Person[];
        this.logger.debug('Recent searches loaded', { count: this.recentSearches.length });
    }

    /**
     * Handles selection of a recent search entry
     * Directly uses the stored person object and navigates to detail view
     */
    onRecentSearchSelect(search: Person): void {
        this.logger.debug('Recent search selected', { search });

        if (!search.partnernr) {
            this.logger.warn('Recent search missing partnernr - cannot proceed');
            return;
        }

        // Directly use the stored person object without fetching from API
        this.logger.debug('Navigating to person detail with cached data', { partnernr: search.partnernr });
        this.onPersonSelect(search);
    }

    /**
     * Clears all recent searches from local storage
     * Resets the search interface to initial state
     */
    clearRecentSearches(): void {
        this.logger.debug('Clearing all recent searches');
        this.recentSearchService.clearSearches('person');
        this.loadRecentSearches();
        this.searchStarted = false;
        this.logger.debug('Recent searches cleared successfully');
    }

    /**
     * Removes a single search entry from recent searches
     * @param search The search entry to remove
     * @param event The click event to stop propagation
     */
    removeRecentSearch(search: Person, event: Event): void {
        event.stopPropagation();
        this.logger.debug('Removing recent search entry', { search });
        this.recentSearchService.removeSearch('person', search);
        this.loadRecentSearches();
        this.logger.debug('Recent search entry removed successfully');
    }

    /**
     * Handles form submission and person search execution
     * Validates form using Zod, performs search, and handles results/errors
     */
    onSubmit(): void {
        this.logger.debug('Person search form submitted');
        this.submitted = true;

        // Validate form using Zod schema
        const validationResult = validatePersonSearchForm(this.searchFormData);

        if (!validationResult.success) {
            this.logger.warn('Search form is invalid - not proceeding with search', {
                formErrors: validationResult.error.issues,
                formValue: this.searchFormData
            });
            this.validationErrors = getPersonSearchFormErrors(validationResult.error);
            this.searchStarted = false;
            return;
        }

        // Clear validation errors on successful validation
        this.validationErrors.clear();

        // Initialize search state
        this.searchStarted = true;
        this.personSearchLoading = true;
        this.searchResults = [];

        const criteria = {
            ...this.searchFormData,
            local: this.searchLocalOnly
        };
        this.logger.debug('Starting person search with criteria', { criteria });

        this.searchPersonService.searchPerson(criteria).subscribe({
            next: (data: Person[]) => {
                this.logger.debug('Person search completed successfully', {
                    resultCount: data?.length || 0,
                    hasResults: Array.isArray(data) && data.length > 0
                });

                this.searchResults = data;
                this.personSearchLoading = false;
                // Collapse search criteria panel if results are found
                this.searchCriteriaCollapsed = Array.isArray(data) && data.length > 0;

                // If only one result, automatically navigate to detail page
                if (data && data.length === 1) {
                    this.logger.debug('Only one person found - automatically navigating to detail page', { person: data[0] });
                    this.onPersonSelect(data[0]);
                }
            },
            error: (err) => {
                this.logger.error('Person search failed', {
                    error: err,
                    criteria,
                    errorMessage: err?.error?.message || err?.message
                });

                // Reset search state on error
                this.searchResults = [];
                this.personSearchLoading = false;
                this.searchCriteriaCollapsed = false;
                this.searchStarted = false;

                const errorMessage = err?.error?.message || err?.message || 'Unbekannter Fehler bei der Personensuche.';
                this.appMessageService.showError(errorMessage);
            }
        });
    }

    /**
     * Resets the search form and results to initial state
     * Clears all form fields, results, and loading states
     */
    resetForm(): void {
        this.logger.debug('Resetting person search form and results');

        this.searchFormData = {
            name: '',
            vorname: '',
            geburtstag: '',
            svnr: '',
            partnernr: ''
        };

        // Clear validation errors
        this.validationErrors.clear();

        // Reset all component state
        this.searchResults = [];
        this.personSearchLoading = false;
        this.searchCriteriaCollapsed = false;
        this.submitted = false;
        this.searchStarted = false;

        // Clear person detail state in store if not in dialog mode
        if (!this.isDialog) {
            this.logger.debug('Clearing person detail state from store');
            this.personStore.clearPerson();
        }

        this.logger.debug('Form reset completed');
    }

    /**
     * Check if a field has an error
     */
    hasError(fieldName: string): boolean {
        return this.submitted && this.validationErrors.has(fieldName);
    }

    /**
     * Get error message for a field
     */
    getErrorMessage(fieldName: string): string {
        return this.validationErrors.get(fieldName) || '';
    }

    /**
     * Check if form has form-level error
     */
    hasFormError(): boolean {
        return this.submitted && this.validationErrors.has('_form');
    }

    /**
     * Get form-level error message
     */
    getFormErrorMessage(): string {
        return this.validationErrors.get('_form') || '';
    }

    /**
     * Handles person selection from search results
     * In dialog mode: emits selection event
     * In regular mode: saves to recent searches and navigates to detail view
     */
    onPersonSelect(event: Record<string, unknown>): void {
        const personData = event as Person;
        this.logger.debug('Person selected from search results', { personData });

        if (!personData) {
            this.logger.warn('No person data provided for selection');
            return;
        }

        // Handle dialog mode - emit selection event for parent component
        if (this.isDialog) {
            this.logger.debug('Dialog mode: emitting person selection event');
            this.personSelected.emit(personData);
            return;
        }

        // Validate person has required data for navigation
        if (!personData.partnernr) {
            this.logger.warn('Selected person missing partnernr - cannot navigate to detail view', { personData });
            this.appMessageService.showWarning('Keine Partnernummer vorhanden, Detailansicht nicht möglich.');
            return;
        }

        // Save full person object to recent searches for quick access
        this.logger.debug('Saving person to recent searches', { personData });
        this.recentSearchService.addSearch('person', personData);
        this.loadRecentSearches();

        // Update store state and navigate to detail view
        this.logger.debug('Navigating to person detail view', { partnernr: personData.partnernr });
        this.personStore.setSelectedPerson(personData.partnernr);
        this.personStore.setPersonData(personData);
        this.router.navigate(['fuv', 'person', 'detail', personData.partnernr]);
    }
}
