import { ColumnDefinition, TableConfiguration } from '@syrius/data-table';

export const BETRIEB_TABLE_CONFIG: TableConfiguration = {
    enableSorting: true,
    enableGlobalSearch: true,
    enablePagination: true,
    pageSize: 50,
    selectionMode: 'single',
    dataKey: 'partnernr',
    emptyMessage: 'common.search.noResults'
};

export const BETRIEB_COLUMN_DEFS: ColumnDefinition[] = [
    { field: 'suvanr', header: 'common.partner.suvanr', sortable: true, minWidth: '120px' },
    { field: 'partnernr', header: 'common.partner.partnernr', sortable: true, minWidth: '120px' },
    { field: 'uidnr', header: 'common.partner.uidNr', sortable: true, minWidth: '120px' },
    { field: 'name1', header: 'common.partner.name', sortable: true, minWidth: '180px' },
    { field: 'ort', header: 'common.partner.ort', sortable: true, minWidth: '150px' }
];
