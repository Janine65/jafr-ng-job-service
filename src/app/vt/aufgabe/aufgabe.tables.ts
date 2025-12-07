import {
    ColumnDefinition, TableConfiguration
} from '@syrius/data-table';

import { Aufgabe } from './aufgabe.model';

// Required columns for Aufgabe Excel files
export const AUFGABE_REQUIRED_COLUMNS = ['partnernr'];

// Example data for Aufgabe Excel sheet preview
export const AUFGABE_EXAMPLE_SHEET = [['partnernr'], ['12345678'], ['87654321'], ['11223344']];

// Column definitions for Aufgabe data table
export const AUFGABE_COLUMNS: ColumnDefinition<Record<string, unknown>>[] = [
    { field: 'partnernr', header: 'common.partner.partnernr', sortable: true, filterable: true },
    { field: 'errors', header: 'common.status.errors', sortable: true, filterable: true },
    { field: 'status', header: 'common.status', sortable: true, filterable: true }
];

// Table configuration for Aufgabe data table
export const AUFGABE_TABLE_CONFIG: TableConfiguration<Aufgabe> = {
    selectionMode: 'multiple',
    enablePagination: true,
    pageSize: 10,
    rowsPerPageOptions: [10, 25, 50],
    loading: false,
    enableExport: true
};
