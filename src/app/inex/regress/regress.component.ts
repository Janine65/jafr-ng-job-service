import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { PopoverModule } from 'primeng/popover';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import {
    FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators
} from '@angular/forms';
import { Regress } from '@app/inex/regress/regress.model';
import { RegressService } from '@app/inex/regress/regress.service';
import { ExcelService } from '@app/shared/services/excel.service';
import { ExternalService } from '@app/shared/services/external.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, LogFactoryService } from '@syrius/core';
import { ActionButton, ActionsPanelComponent, DataTablePanelComponent } from '@syrius/data-table';

import {
    REGRESS_COLUMN_DEFS, REGRESS_TABLE_ACTION_BUTTONS, REGRESS_TABLE_CONFIG
} from './regress.tables';
import { getSchadenNrError, schadenNrPattern } from './regress.validation';

@Component({
    selector: 'app-inex-regress',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        PanelModule,
        InputTextModule,
        ButtonModule,
        TableModule,
        CardModule,
        InputGroupModule,
        InputGroupAddonModule,
        TranslateModule,
        PopoverModule,
        ToolbarModule,
        TooltipModule,
        DataTablePanelComponent,
        ActionsPanelComponent
    ],
    templateUrl: './regress.component.html'
})
export class RegressComponent implements OnInit {
    @Input() isDialog: boolean = false;
    @Output() personSelected = new EventEmitter<Regress>();
    @ViewChild(DataTablePanelComponent) dataTablePanel?: DataTablePanelComponent<Regress>;

    private fb = inject(FormBuilder);
    private regressService = inject(RegressService);
    private appMessageService = inject(AppMessageService);
    private translate = inject(TranslateService);
    private externalService = inject(ExternalService);
    private excelService = inject(ExcelService);
    private logger = inject(LogFactoryService).createLogger('RegressComponent');

    searchForm!: FormGroup;
    searchResults: Regress[] = [];
    selectedRegress: Regress | null = null;
    selectedRows: Regress[] = [];
    regressSearchLoading: boolean = false;
    searchCriteriaCollapsed: boolean = false;
    submitted: boolean = false;
    searchStarted: boolean = false;

    regressTableConfig = REGRESS_TABLE_CONFIG;
    readonly regressColumnDefs = REGRESS_COLUMN_DEFS;
    filteredResults: Regress[] = [];
    actionButtons: ActionButton[] = [];
    exportMenuItems: MenuItem[] = [];

    ngOnInit(): void {
        this.logger.debug('Initializing RegressComponent', { isDialog: this.isDialog });

        // Initialize search form with schadenNr field
        // SchadenNr format: XX.XXXXX.XX.X (10 digits with dots as separators)
        this.searchForm = this.fb.group({
            schadenNr: ['', [Validators.required, Validators.pattern(schadenNrPattern)]]
        });

        // Configure table
        this.regressTableConfig = {
            ...REGRESS_TABLE_CONFIG,
            enableActionsPanel: false,
            actionButtons: []
        };

        // Initialize action buttons for the SEPARATE actions panel
        this.actionButtons = [
            {
                label: REGRESS_TABLE_ACTION_BUTTONS[0].label,
                icon: REGRESS_TABLE_ACTION_BUTTONS[0].icon,
                severity: REGRESS_TABLE_ACTION_BUTTONS[0].severity,
                tooltip: REGRESS_TABLE_ACTION_BUTTONS[0].tooltip,
                disabled: true, // Will be updated when selection changes
                command: () => {
                    this.logger.debug('SYRIUS button clicked', {
                        selectedRowsCount: this.selectedRows.length,
                        selectedRows: this.selectedRows
                    });
                    if (this.selectedRows.length === 1) {
                        this.openInSyrius(this.selectedRows[0]);
                    }
                }
            },
            {
                label: REGRESS_TABLE_ACTION_BUTTONS[1].label,
                icon: REGRESS_TABLE_ACTION_BUTTONS[1].icon,
                severity: REGRESS_TABLE_ACTION_BUTTONS[1].severity,
                tooltip: REGRESS_TABLE_ACTION_BUTTONS[1].tooltip,
                command: () => this.resetFiltersAndSort()
            }
        ];

        // Initialize export menu items for the SEPARATE actions panel
        this.updateExportMenuItems();

        this.logger.debug('RegressComponent initialization complete');
    }

    /**
     * Formats schadenNr input: XX.XXXXX.XX.X
     * User sees the formatted value with dots as they type
     */
    onSchadenNrInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = input.value.replace(/\D/g, '').substring(0, 10); // Only digits, max 10

        // Format: XX.XXXXX.XX.X
        const formatted = value.replace(/(\d{2})(\d{1,5})?(\d{1,2})?(\d{1})?/, (_, p1, p2, p3, p4) => {
            let result = p1;
            if (p2) result += '.' + p2;
            if (p3) result += '.' + p3;
            if (p4) result += '.' + p4;
            return result;
        });

        input.value = formatted;
        // Store formatted value (with dots) for API
        this.searchForm.get('schadenNr')?.setValue(formatted, { emitEvent: false });
    }

    /**
     * Handles paste event for schadenNr
     * Allows pasting numbers with or without dots
     * User sees the formatted value with dots
     */
    onSchadenNrPaste(event: ClipboardEvent): void {
        event.preventDefault();
        const pastedText = event.clipboardData?.getData('text') || '';
        this.logger.debug('Pasting schadenNr', { pastedText });

        // Remove all non-digits from pasted text
        const digitsOnly = pastedText.replace(/\D/g, '').substring(0, 10);

        // Format: XX.XXXXX.XX.X
        const formatted = digitsOnly.replace(/(\d{2})(\d{1,5})?(\d{1,2})?(\d{1})?/, (_, p1, p2, p3, p4) => {
            let result = p1;
            if (p2) result += '.' + p2;
            if (p3) result += '.' + p3;
            if (p4) result += '.' + p4;
            return result;
        });

        // Update both input display and form control with formatted value
        const input = event.target as HTMLInputElement;
        input.value = formatted;
        this.searchForm.get('schadenNr')?.setValue(formatted, { emitEvent: false });
        this.searchForm.get('schadenNr')?.markAsTouched();
    }

    /**
     * Returns appropriate validation error message for form fields
     * Handles schadenNr format and required field validation
     */
    getValidationErrorMessage(field?: string): string {
        if (field === 'schadenNr') {
            const control = this.searchForm.get('schadenNr');
            const schadenNr = control?.value;

            // Use validation function from validation file
            const error = getSchadenNrError(schadenNr);
            if (error && (control?.hasError('required') || control?.hasError('pattern'))) {
                return error;
            }
        }

        return this.translate.instant('common.validation.invalidInput');
    }

    /**
     * Checks if a form field has validation errors and should display error styling
     * Only shows errors after form submission attempt
     */
    isFieldInvalid(field: string): boolean {
        const control = this.searchForm.get(field);
        if (!control || !this.submitted) {
            return false;
        }

        return control.invalid && (control.dirty || control.touched);
    }

    onSubmit(): void {
        this.submitted = true;

        if (this.searchForm.invalid) {
            this.searchStarted = false;
            return;
        }

        this.searchStarted = true;
        this.regressSearchLoading = true;
        this.searchResults = [];

        const criteria = this.searchForm.value;

        this.regressService.searchRegress(criteria).subscribe({
            next: (data: Regress[]) => {
                this.logger.debug('Regress search completed successfully', {
                    resultCount: data?.length || 0,
                    hasResults: Array.isArray(data) && data.length > 0,
                    criteria
                });

                this.searchResults = data;
                this.regressSearchLoading = false;
                // Update button states based on data availability
                this.updateActionButtonStates();
                // Collapse search criteria panel if results are found
                this.searchCriteriaCollapsed = Array.isArray(data) && data.length > 0;
            },
            error: (err: unknown) => {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                this.logger.error('Regress search failed', {
                    error: err,
                    criteria,
                    errorMessage
                });

                // Reset search state on error
                this.searchResults = [];
                this.regressSearchLoading = false;
                // Update button states - all disabled when no data
                this.updateActionButtonStates();
                this.searchCriteriaCollapsed = false;
                this.searchStarted = false;

                this.appMessageService.showError(errorMessage || 'Unbekannter Fehler bei der Schadens-Suche.');
            }
        });
    }

    /**
     * Resets the search form and results to initial state
     * Clears schadenNr field, results, and loading states
     */
    resetForm(): void {
        this.logger.debug('Resetting regress search form and results');

        this.searchForm.reset({
            schadenNr: ''
        });

        // Reset all component state
        this.searchResults = [];
        this.regressSearchLoading = false;
        this.searchCriteriaCollapsed = false;
        this.submitted = false;
        this.searchStarted = false;

        // Clear selection
        this.selectedRows = [];
        this.selectedRegress = null;

        // Update button states - all disabled when no data
        this.updateActionButtonStates();

        this.logger.debug('Form reset completed');
    }

    /**
     * Handles selection changes from the data-table two-way binding
     * This is the primary event that updates when selection changes
     */
    onSelectionChange(selection: Regress[] | Regress | null): void {
        this.logger.debug('Selection changed from data-table', {
            selection,
            isArray: Array.isArray(selection),
            length: Array.isArray(selection) ? selection.length : selection ? 1 : 0
        });

        // Ensure selectedRows is properly synced
        if (selection === null) {
            this.selectedRows = [];
        } else if (Array.isArray(selection)) {
            this.selectedRows = selection;
        } else {
            this.selectedRows = [selection];
        }

        // Update button states immediately since we have the latest selection
        this.updateSelectionState();
    }

    /**
     * Updates the selection state and button states based on current selectedRows
     * This is called after selection changes to ensure proper state management
     */
    updateSelectionState(): void {
        this.logger.debug('Updating selection state', {
            selectedRowsCount: this.selectedRows.length,
            selectedRows: this.selectedRows
        });

        // Set selectedRegress only if exactly one row is selected
        if (this.selectedRows.length === 1) {
            this.selectedRegress = this.selectedRows[0];

            // Handle dialog mode - emit selection event for parent component
            if (this.isDialog) {
                this.logger.debug('Dialog mode: emitting regress selection event');
                this.personSelected.emit(this.selectedRegress);
                return;
            }
        } else {
            // Clear selectedRegress if multiple or no rows selected
            this.selectedRegress = null;
        }

        this.logger.debug('Selection updated', {
            selectedRowsCount: this.selectedRows.length,
            selectedRows: this.selectedRows
        });

        // Update action button states based on new selection
        this.updateActionButtonStates();
    }

    /**
     * Updates the disabled state of action buttons based on selection
     * SYRIUS button is only enabled when exactly one row is selected
     */
    updateActionButtonStates(): void {
        const hasData = this.searchResults.length > 0;

        // Update action buttons by creating a new array to trigger change detection
        this.actionButtons = this.actionButtons.map((btn) => {
            // Disable all buttons if no data is available
            if (!hasData) {
                return { ...btn, disabled: true };
            }

            // Special handling for SYRIUS button - requires exactly one selection
            if (btn.label === 'inex.regress.openSelectionInSyrius') {
                return {
                    ...btn,
                    disabled: this.selectedRows.length !== 1 || !this.selectedRows[0]?.partnernr
                };
            }

            // All other buttons remain enabled when data is available
            return btn;
        });

        // Also update export menu items to reflect current selection state
        this.updateExportMenuItems();

        this.logger.debug('Action button states updated', {
            hasData,
            selectedRowsCount: this.selectedRows.length
        });
    }

    /**
     * Updates export menu items with current translations
     * Called on init and when translations change
     */
    updateExportMenuItems(): void {
        this.exportMenuItems = [
            {
                label: this.translate.instant('common.actions.exportAll'),
                icon: 'pi pi-download',
                command: () => this.onExportData(this.searchResults)
            },
            {
                label: this.translate.instant('common.actions.exportSelection'),
                icon: 'pi pi-check-square',
                command: () => this.onExportData(this.selectedRows),
                disabled: this.selectedRows.length === 0
            },
            {
                label: this.translate.instant('common.actions.exportFiltered'),
                icon: 'pi pi-filter',
                command: () => {
                    const dataToExport = this.filteredResults.length > 0 ? this.filteredResults : this.searchResults;
                    this.onExportData(dataToExport);
                }
            }
        ];
    }

    /**
     * Handles filtered data updates from the data table
     * Tracks filtered results for export filtered functionality
     */
    onFilteredDataChange(filteredData: Regress[]): void {
        this.filteredResults = filteredData;
        this.logger.debug('Filtered data updated', { count: filteredData.length });
    }

    /**
     * Opens the selected regress entry in SYRIUS
     * Only enabled when exactly one row is selected
     * @param regress - Optional regress to open, defaults to this.selectedRegress
     */
    openInSyrius(regress?: Regress): void {
        const regressToOpen = regress || this.selectedRegress;

        if (!regressToOpen) {
            this.logger.warn('Cannot open in SYRIUS: no regress selected');
            return;
        }

        if (!regressToOpen.partnernr) {
            this.logger.warn('Cannot open in SYRIUS: partnernr is missing', { selectedRegress: regressToOpen });
            this.appMessageService.showWarning(this.translate.instant('inex.regress.errors.missingIdentifiers'));
            return;
        }

        this.logger.debug('Opening regress in SYRIUS', { partnernr: regressToOpen.partnernr });
        this.externalService.openSyrius(regressToOpen.partnernr);
    }

    /**
     * Resets all filters and sorting on the data table
     * Clears global search, column filters, and sort order
     */
    resetFiltersAndSort(): void {
        this.logger.debug('Resetting all filters and sorting on data table');

        // Use the new reset method from DataTablePanelComponent
        if (this.dataTablePanel) {
            this.dataTablePanel.reset();
            this.logger.debug('Filters and sorting reset completed');
        } else {
            this.logger.warn('Could not reset filters: data table not available');
        }
    }

    /**
     * Handles export data event from data table
     * Converts the data to Excel format and triggers download
     */
    onExportData(data: Regress[]): void {
        this.logger.debug('Exporting regress data', { rowCount: data.length });

        if (!data || data.length === 0) {
            this.appMessageService.showWarning(this.translate.instant('common.error.emptyFile'));
            return;
        }

        // Convert data to exportable format
        const exportData = data.map((item) => ({
            Vorfall: item.gvorfall || '',
            'Rechnungs-Nr.': item.rechnungsnr || '',
            'Betrag (CHF)': item.urbetrag || '',
            'Partner-Nr.': item.partnernr || '',
            Name: item.name || '',
            'Zahler-Nr.': item.zahlernr || '',
            Erstelldatum: item.erstelldatum || '',
            'Zahlungs-ID': item.paymentid || '',
            'Meldungs-ID': item.meldungsid || '',
            Zahlungsdatum: item.zahlungsdatum || ''
        }));

        // Generate filename with timestamp
        const fileName = `regress_export`;

        this.logger.debug('Triggering Excel download', { fileName, rowCount: exportData.length });
        this.excelService.exportAsExcelFile(exportData, fileName);
    }
}
