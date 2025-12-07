import { ColumnDefinition, ExportDefinition, TableConfiguration } from '@syrius/data-table';

import { Regress } from './regress.model';

/**
 * Action button definitions for the separate actions panel
 * Static configuration without dynamic command functions - functions are assigned in the component
 */
export const REGRESS_TABLE_ACTION_BUTTONS = [
    {
        label: 'inex.regress.openSelectionInSyrius',
        icon: 'pi pi-external-link',
        severity: 'secondary' as const,
        tooltip: 'common.services.syrius',
        disabled: true,
        requiresSingleSelection: true
        // commands will be defined in the component
    },
    {
        label: 'common.actions.resetFilter',
        icon: 'pi pi-filter-slash',
        severity: 'secondary' as const,
        tooltip: 'common.actions.resetFilter'
        // commands will be defined in the component
    }
] as const;

/**
 * Export menu definitions for regress data
 * Simple options: Export All, Export Selected, Export Filtered
 */
export const REGRESS_EXPORT_DEFINITIONS: ExportDefinition<Regress>[] = [
    {
        label: 'common.actions.exportAll',
        icon: 'pi pi-download',
        tooltip: 'common.actions.exportAll',
        fileName: 'regress_all'
    },
    {
        label: 'common.actions.exportSelection',
        icon: 'pi pi-check-square',
        tooltip: 'common.actions.exportSelection',
        fileName: 'regress_selected'
    },
    {
        label: 'common.actions.exportFiltered',
        icon: 'pi pi-filter',
        tooltip: 'common.actions.exportFiltered',
        fileName: 'regress_filtered'
    }
];

// Regress Table Configuration
export const REGRESS_TABLE_CONFIG: TableConfiguration<Regress> = {
    enableSorting: true,
    enableGlobalSearch: true,
    enableColumnFiltering: true,
    enablePagination: true,
    pageSize: 50,
    rowsPerPageOptions: [10, 25, 50],
    selectionMode: 'multiple',
    dataKey: 'boid',
    emptyMessage: 'common.search.noResults',
    enableExport: true,
    exportDefinitions: REGRESS_EXPORT_DEFINITIONS,
    enableActionsPanel: true,
    showActionsPanelExport: true,
    actionButtons: []
};

// Column definitions matching API response fields from /api/ielisten/getopzahlungenregress
export const REGRESS_COLUMN_DEFS: ColumnDefinition<Regress>[] = [
    { field: 'gvorfall', header: 'inex.regress.vorfall', sortable: true, filterable: true, filterType: 'text', minWidth: '200px' },
    { field: 'rechnungsnr', header: 'inex.regress.rechnungsnummer', sortable: true, filterable: true, filterType: 'text', minWidth: '150px' },
    { field: 'urbetrag', header: 'inex.regress.rechnungsbetrag', type: 'number', sortable: true, filterable: true, filterType: 'numeric', minWidth: '150px' },
    { field: 'partnernr', header: 'inex.regress.partnernummer', sortable: true, filterable: true, filterType: 'text', minWidth: '150px' },
    { field: 'name', header: 'inex.regress.name', sortable: true, filterable: true, filterType: 'text', minWidth: '200px' },
    { field: 'zahlernr', header: 'inex.regress.zahlernr', sortable: true, filterable: true, filterType: 'text', minWidth: '180px' },
    { field: 'erstelldatum', header: 'inex.regress.erstelldatum', type: 'date', sortable: true, filterable: true, filterType: 'date', minWidth: '120px' },
    { field: 'paymentid', header: 'inex.regress.transaktionsnriso', sortable: true, filterable: true, filterType: 'text', minWidth: '180px' },
    { field: 'meldungsid', header: 'inex.regress.meldungsidiso', sortable: true, filterable: true, filterType: 'text', minWidth: '180px' },
    { field: 'zahlungsdatum', header: 'inex.regress.zahlungsdatum', type: 'date', sortable: true, filterable: true, filterType: 'date', minWidth: '140px' }
];
