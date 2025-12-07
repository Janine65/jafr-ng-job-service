import { Offerte } from '@app/fuv/models/offerte.model';
import { ColumnDefinition, TableConfiguration } from '@syrius/data-table';

export const OFFERTE_COLUMN_DEFS: ColumnDefinition<Offerte>[] = [
    { field: 'offertenr', header: 'fuv.searchOfferte.table.offertenr', sortable: true, minWidth: '120px' },
    { field: 'status', header: 'fuv.searchOfferte.table.status', type: 'custom', sortable: true, minWidth: '100px' },
    { field: 'art', header: 'fuv.searchOfferte.table.artDerOfferte', type: 'custom', sortable: true, minWidth: '120px' },
    { field: 'name', header: 'fuv.searchOfferte.table.person', sortable: true, minWidth: '180px' },
    { field: 'betrieb', header: 'fuv.searchOfferte.table.betrieb', sortable: true, minWidth: '180px' },
    { field: 'gueltab', header: 'fuv.searchOfferte.table.gueltigAb', sortable: true, type: 'date', minWidth: '120px' },
    { field: 'gueltbis', header: 'fuv.searchOfferte.table.gueltigBis', sortable: true, type: 'date', minWidth: '120px' },
    { field: 'stellung_im_betrieb', header: 'fuv.searchOfferte.table.stellungImBetrieb', type: 'custom', sortable: true, minWidth: '150px' },
    { field: 'beschaeft_grad', header: 'fuv.searchOfferte.table.beschaeftigungsgrad', type: 'custom', sortable: true, minWidth: '130px' },
    { field: 'klasse', header: 'fuv.searchOfferte.table.klasse', sortable: true, minWidth: '100px' },
    { field: 'basisstufe', header: 'fuv.searchOfferte.table.basisstufe', sortable: true, minWidth: '100px' },
    { field: 'updatedby', header: 'fuv.searchOfferte.table.user', sortable: true, minWidth: '120px' },
    {
        field: 'actions' as keyof Offerte & string,
        header: 'common.actions.title',
        type: 'actions',
        sortable: false,
        minWidth: '80px',
        actions: [] // Will be populated by component
    }
];

export const OFFERTE_TABLE_CONFIG: TableConfiguration = {
    enableSorting: true,
    enableGlobalSearch: true,
    enablePagination: true,
    pageSize: 50,
    rowsPerPageOptions: [10, 25, 50],
    selectionMode: 'single',
    dataKey: 'offertenr',
    emptyMessage: 'fuv.searchOfferte.table.noResults'
};
