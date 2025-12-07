import {
    ColumnDefinition, TableConfiguration
} from '@syrius/data-table';

import { Mahnung } from './mahnung.model';

// Required columns for Mahnung Excel files
export const MAHNUNG_REQUIRED_COLUMNS = ['partnernr', 'bb_datum', 'partner_boid', 'btcode'];

// Example data for Mahnung Excel sheet preview
export const MAHNUNG_EXAMPLE_SHEET = [
    ['partnernr', 'bb_datum', 'partner_boid', 'btcode'],
    ['12345678', '01.01.2022', '0000081341', 'A'],
    ['87654321', '02.01.2023', '0000081342', 'B'],
    ['11223344', '03.01.2024', '0000081343', 'C']
];

// Column definitions for Mahnung data table
export const MAHNUNG_COLUMNS: ColumnDefinition<Record<string, unknown>>[] = [
    { field: 'partnernr', header: 'common.partner.partnernr', sortable: true, filterable: true },
    { field: 'bb_datum', header: 'vt.bb.invite.bb_datum', sortable: true, filterable: true },
    { field: 'partner_boid', header: 'common.partner.boid', sortable: true, filterable: true },
    { field: 'btcode', header: 'common.partner.betriebsteil', sortable: true, filterable: true },
    { field: 'errors', header: 'common.status.errors', sortable: true, filterable: true },
    { field: 'status', header: 'common.status', sortable: true, filterable: true }
];

// Table configuration for Mahnung data table
export const MAHNUNG_TABLE_CONFIG: TableConfiguration<Mahnung> = {
    selectionMode: 'multiple',
    enablePagination: true,
    pageSize: 10,
    rowsPerPageOptions: [10, 25, 50],
    loading: false,
    enableExport: true
};
