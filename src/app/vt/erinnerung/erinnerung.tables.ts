import {
    ColumnDefinition, TableConfiguration
} from '@syrius/data-table';

import { Erinnerung } from './erinnerung.model';

// Required columns for Erinnerung Excel files
export const ERINNERUNG_REQUIRED_COLUMNS = ['partnernr', 'bb_datum', 'partner_boid', 'btcode'];

// Example data for Erinnerung Excel sheet preview
export const ERINNERUNG_EXAMPLE_SHEET = [
    ['partnernr', 'bb_datum', 'partner_boid', 'btcode'],
    ['12345678', '01.01.2022', '0000081341', 'A'],
    ['87654321', '02.01.2023', '0000081342', 'B'],
    ['11223344', '03.01.2024', '0000081343', 'C']
];

// Column definitions for Erinnerung data table
export const ERINNERUNG_COLUMNS: ColumnDefinition<Record<string, unknown>>[] = [
    { field: 'partnernr', header: 'common.partner.partnernr', sortable: true, filterable: true },
    { field: 'bb_datum', header: 'vt.bb.invite.bb_datum', sortable: true, filterable: true },
    { field: 'partner_boid', header: 'common.partner.boid', sortable: true, filterable: true },
    { field: 'btcode', header: 'common.partner.betriebsteil', sortable: true, filterable: true },
    { field: 'errors', header: 'common.status.errors', sortable: true, filterable: true },
    { field: 'status', header: 'common.status', sortable: true, filterable: true }
];

// Table configuration for Erinnerung data table
export const ERINNERUNG_TABLE_CONFIG: TableConfiguration<Erinnerung> = {
    selectionMode: 'multiple',
    enablePagination: true,
    pageSize: 10,
    rowsPerPageOptions: [10, 25, 50],
    loading: false,
    enableExport: true
};
