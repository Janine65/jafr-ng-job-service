import { Aktenentscheid } from '@app/vt/aktenentscheid/aktenentscheid.model';
import { ColumnDefinition, TableConfiguration } from '@syrius/data-table';

// Required columns for Aktenentscheid Excel files
export const AKTENENTSCHEID_REQUIRED_COLUMNS = ['partnernr', 'btcode', 'experte'];

// Example data for Aktenentscheid Excel sheet preview
export const AKTENENTSCHEID_EXAMPLE_SHEET = [
    ['partnernr', 'btcode', 'experte'],
    ['12345678', 'A', 'sv1'],
    ['87654321', 'B', 'sv2'],
    ['11223344', 'C', 'sv3']
];

// Column definitions for Aktenentscheid data table
export const AKTENENTSCHEID_COLUMNS: ColumnDefinition<Record<string, unknown>>[] = [
    { field: 'row', header: 'common.fields.row', sortable: true, filterable: true, type: 'number', minWidth: '80px' },
    { field: 'partnernr', header: 'common.fields.partnernr', sortable: true, filterable: true, filterType: 'text', minWidth: '120px' },
    { field: 'btcode', header: 'vt.aktenentscheid.table.btcode', sortable: true, filterable: true, filterType: 'text', minWidth: '100px' },
    { field: 'experte', header: 'vt.aktenentscheid.table.experte', sortable: true, filterable: true, filterType: 'text', minWidth: '120px' },
    { field: 'bb_datum', header: 'vt.aktenentscheid.table.bb_datum', sortable: true, filterable: true, filterType: 'date', type: 'date', minWidth: '120px' },
    { field: 'aufgabe_boid', header: 'vt.aktenentscheid.table.aufgabe', sortable: true, filterable: true, filterType: 'text', minWidth: '150px' },
    { field: 'status', header: 'common.status', sortable: true, filterable: true, filterType: 'text', minWidth: '120px' },
    { field: 'error', header: 'common.fields.error', sortable: true, filterable: true, filterType: 'text', minWidth: '200px' },
    { field: 'message', header: 'common.fields.message', sortable: true, filterable: true, filterType: 'text', minWidth: '200px' }
];

// Table configuration for Aktenentscheid data table
export const AKTENENTSCHEID_TABLE_CONFIG: TableConfiguration<Aktenentscheid> = {
    dataKey: 'partnernr',
    selectionMode: 'multiple',
    enableGlobalSearch: true,
    pageSize: 10,
    enablePagination: true,
    showCaption: false,
    emptyMessage: 'common.table.noData',
    scrollHeight: '400px',
    enableExport: true
};
