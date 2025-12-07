import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { PopoverModule } from 'primeng/popover';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Betrieb } from '@app/fuv/models/betrieb.model';
import { BetriebService } from '@app/fuv/services/betrieb.service';
import { BetriebStore } from '@app/fuv/stores/betrieb.store';
import { RecentSearchService } from '@app/shared/services/recent-search.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService } from '@syrius/core';
import { DataTablePanelComponent } from '@syrius/data-table';

import { BETRIEB_COLUMN_DEFS, BETRIEB_TABLE_CONFIG } from './betrieb-search.tables';
import {
    BetriebSearchFormData, getBetriebSearchFormErrors, validateBetriebSearchForm
} from './betrieb-search.validation';

@Component({
    selector: 'app-betrieb-search',
    standalone: true,
    imports: [CommonModule, FormsModule, PanelModule, InputTextModule, CheckboxModule, ToggleSwitchModule, ButtonModule, TableModule, ProgressSpinnerModule, DataTablePanelComponent, TranslateModule, CardModule, PopoverModule, TooltipModule],
    templateUrl: './betrieb-search.component.html'
})
export class BetriebSearchComponent implements OnInit {
    @Input() isDialog: boolean = false;
    @Output() betriebSelected = new EventEmitter<Betrieb>();

    private searchBetriebService = inject(BetriebService);
    private appMessageService = inject(AppMessageService);
    private translate = inject(TranslateService);
    private recentSearchService = inject(RecentSearchService);
    private router = inject(Router);
    private betriebStore = inject(BetriebStore);

    searchFormData: BetriebSearchFormData = {
        suvanr: '',
        partnernr: '',
        uidnr: '',
        name: ''
    };
    validationErrors: Map<string, string> = new Map();
    searchResults: Betrieb[] = [];
    loading: boolean = false;
    searchCriteriaCollapsed: boolean = false;
    submitted: boolean = false;
    selectedBetrieb: Betrieb | null = null;
    betriebSearchLoading: boolean = false;
    searchStarted: boolean = false;
    recentSearches: Betrieb[] = [];
    searchLocalOnly: boolean = false;
    betriebColumnDefs = BETRIEB_COLUMN_DEFS;
    betriebTableConfig = BETRIEB_TABLE_CONFIG;

    ngOnInit(): void {
        this.loadRecentSearches();
    }

    loadRecentSearches(): void {
        this.recentSearches = this.recentSearchService.getSearches('betrieb') as Betrieb[];
    }

    onRecentSearchSelect(search: Betrieb): void {
        if (search.partnernr) {
            // Directly use the stored betrieb object without fetching from API
            this.onBetriebSelect(search);
        }
    }

    clearRecentSearches(): void {
        this.recentSearchService.clearSearches('betrieb');
        this.loadRecentSearches();
    }

    /**
     * Removes a single search entry from recent searches
     * @param search The search entry to remove
     * @param event The click event to stop propagation
     */
    removeRecentSearch(search: Betrieb, event: Event): void {
        event.stopPropagation();
        this.recentSearchService.removeSearch('betrieb', search);
        this.loadRecentSearches();
    }

    onSubmit(): void {
        this.submitted = true;

        // Validate form using Zod schema
        const validationResult = validateBetriebSearchForm(this.searchFormData);
        this.validationErrors = getBetriebSearchFormErrors(validationResult);

        if (!validationResult.success) {
            this.searchStarted = false;
            return;
        }

        this.searchStarted = true;
        this.betriebSearchLoading = true;
        this.selectedBetrieb = null;
        this.searchResults = [];
        const criteria = {
            ...this.searchFormData,
            local: this.searchLocalOnly
        };
        this.searchBetriebService.searchBetrieb(criteria).subscribe({
            next: (data) => {
                this.searchResults = data;
                this.betriebSearchLoading = false;
                if (data && data.length > 0) {
                    this.searchCriteriaCollapsed = true;
                } else {
                    this.searchCriteriaCollapsed = false;
                }

                // If only one result, automatically navigate to detail page
                if (data && data.length === 1) {
                    this.onBetriebSelect(data[0]);
                }
            },
            error: (err) => {
                console.error(err.message);
                this.searchResults = [];
                this.betriebSearchLoading = false;
                this.selectedBetrieb = null;
                this.submitted = true;
                this.appMessageService.showError(err?.error?.message || err?.message || 'Unbekannter Fehler bei der Betriebssuche.');
            }
        });
    }

    resetForm(): void {
        this.searchFormData = {
            suvanr: '',
            partnernr: '',
            uidnr: '',
            name: ''
        };
        this.validationErrors.clear();
        this.searchResults = [];
        this.searchCriteriaCollapsed = false;
        this.submitted = false;
        this.betriebSearchLoading = false;
        this.selectedBetrieb = null;
        this.searchStarted = false;
    }

    hasError(fieldName: string): boolean {
        return this.submitted && this.validationErrors.has(fieldName);
    }

    getErrorMessage(fieldName: string): string {
        return this.validationErrors.get(fieldName) || '';
    }

    hasFormError(): boolean {
        return this.submitted && this.validationErrors.has('_form');
    }

    getFormErrorMessage(): string {
        return this.validationErrors.get('_form') || '';
    }

    onBetriebSelect(event: Record<string, unknown>): void {
        const betriebData = event as Betrieb;
        if (!betriebData) {
            this.selectedBetrieb = null;
            return;
        }

        if (this.isDialog) {
            this.betriebSelected.emit(betriebData);
            return;
        }

        // Save full betrieb object to recent searches for quick access
        this.recentSearchService.addSearch('betrieb', betriebData);
        this.loadRecentSearches();

        // Update store state and navigate to detail view
        this.betriebStore.setSelectedBetrieb(betriebData.partnernr!);
        this.betriebStore.setBetriebData(betriebData);
        this.router.navigate(['fuv', 'betrieb', 'detail', betriebData.partnernr]);
    }
}
