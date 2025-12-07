import {
    ColumnDefinition, TableConfiguration
} from '@syrius/data-table';

import { Einladung } from './einladung.model';

// Required columns for Einladung Excel files
export const EINLADUNG_REQUIRED_COLUMNS = ['partnernr', 'bb_datum', 'partner_boid', 'btcode'];

// Example data for Einladung Excel sheet preview
export const EINLADUNG_EXAMPLE_SHEET = [
    ['partnernr', 'bb_datum', 'partner_boid', 'btcode'],
    ['12345678', '01.01.2022', '0000081341', 'A'],
    ['87654321', '02.01.2023', '0000081342', 'B'],
    ['11223344', '03.01.2024', '0000081343', 'C']
];

// Column definitions for Einladung data table
export const EINLADUNG_COLUMNS: ColumnDefinition<Record<string, unknown>>[] = [
    { field: 'partnernr', header: 'common.partner.partnernr', sortable: true, filterable: true },
    { field: 'btcode', header: 'common.partner.betriebsteil', sortable: true, filterable: true },
    { field: 'dokbestellid', header: 'vt.bb.einladung.table.dokbestellid', sortable: true, filterable: true },
    { field: 'message', header: 'vt.bb.einladung.table.message', sortable: true, filterable: true },
    { field: 'errorMessage', header: 'common.table.errorMessage', sortable: true, filterable: true }
];

// Table configuration for Einladung data table
export const EINLADUNG_TABLE_CONFIG: TableConfiguration<Einladung> = {
    selectionMode: 'multiple',
    enablePagination: true,
    pageSize: 10,
    rowsPerPageOptions: [10, 25, 50],
    loading: false,
    enableExport: true
};
