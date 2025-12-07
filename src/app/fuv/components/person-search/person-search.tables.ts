import { ColumnDefinition, TableConfiguration } from '@syrius/data-table';

// Person Table
export const PERSON_TABLE_CONFIG: TableConfiguration = {
    enableSorting: true,
    enableGlobalSearch: true,
    enablePagination: true,
    pageSize: 50,
    rowsPerPageOptions: [10, 25, 50],
    selectionMode: 'single',
    dataKey: 'partnernr',
    emptyMessage: 'common.search.noResults'
};

export const PERSON_COLUMN_DEFS: ColumnDefinition[] = [
    { field: 'name', header: 'common.partner.name', sortable: true, filterable: true, filterType: 'text', minWidth: '150px' },
    { field: 'vorname', header: 'common.partner.vorname', sortable: true, filterable: true, filterType: 'text', minWidth: '150px' },
    { field: 'strasse', header: 'common.partner.strasse', sortable: true, filterable: true, filterType: 'text', minWidth: '200px' },
    { field: 'hausnr', header: 'common.partner.hausnr', sortable: true, filterable: true, filterType: 'text', minWidth: '200px' },
    { field: 'plz', header: 'common.partner.plz', sortable: true, filterable: true, filterType: 'text', minWidth: '80px' },
    { field: 'ort', header: 'common.partner.ort', sortable: true, filterable: true, filterType: 'text', minWidth: '150px' },
    { field: 'svnr', header: 'common.partner.svnr', sortable: true, filterable: true, filterType: 'text', minWidth: '120px' },
    { field: 'geburtstag', header: 'common.partner.geburtstag', type: 'date', sortable: true, filterable: true, filterType: 'date', minWidth: '120px' }
];
