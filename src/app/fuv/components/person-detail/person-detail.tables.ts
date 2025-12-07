import { Offerte } from '@app/fuv/models/offerte.model';
import { Vertrag } from '@app/fuv/models/vertrag.model';
import { ColumnDefinition, TableConfiguration } from '@syrius/data-table';

// Offerten Table
export const OFFERTEN_TABLE_CONFIG: TableConfiguration = {
    enableSorting: true,
    enableGlobalSearch: false,
    enablePagination: false,
    selectionMode: 'single',
    dataKey: 'offertenr',
    emptyMessage: 'common.search.noResults',
    showCaption: false
};

export const OFFERTEN_COLUMN_DEFS: ColumnDefinition<Offerte>[] = [
    { field: 'betrieb', header: 'common.partner.betrieb', sortable: true, minWidth: '180px' },
    { field: 'offertenr', header: 'common.police.offertenr', sortable: true, minWidth: '140px' },
    { field: 'updatedby', header: 'common.partner.user', sortable: true, minWidth: '100px' },
    { field: 'status', header: 'common.partner.status', type: 'custom', sortable: true, minWidth: '120px' },
    { field: 'art', header: 'common.police.artDerOfferte', type: 'custom', sortable: true, minWidth: '200px' },
    { field: 'gueltab', header: 'common.police.gueltigAb', type: 'date', sortable: true, minWidth: '120px' },
    { field: 'gueltbis', header: 'common.police.offerteGueltigBis', type: 'date', sortable: true, minWidth: '140px' },
    { field: 'ablaufdatum', header: 'common.police.dauerDesVertrages', type: 'date', sortable: true, minWidth: '140px' },
    { field: 'stellung_im_betrieb', header: 'common.partner.stellungImBetrieb', type: 'custom', sortable: true, minWidth: '140px' },
    { field: 'beschaeft_grad', header: 'common.partner.beschaeftigungsgrad', type: 'custom', sortable: true, minWidth: '150px' },
    { field: 'klasse', header: 'common.partner.klasse', sortable: true, minWidth: '100px' },
    { field: 'basisstufe', header: 'common.partner.basisstufe', sortable: true, minWidth: '100px' },
    { field: 'name', header: 'common.partner.person', sortable: true, minWidth: '180px' },
    {
        field: 'actions' as keyof Offerte & string,
        header: 'common.actions.title',
        type: 'actions',
        sortable: false,
        minWidth: '80px',
        actions: [] // Will be populated by component
    }
];

// Verträge Table
export const VERTRAEGE_TABLE_CONFIG: TableConfiguration = {
    enableSorting: true,
    enableGlobalSearch: false,
    enablePagination: false,
    selectionMode: 'single',
    dataKey: 'vertragNr',
    emptyMessage: 'common.search.noResults',
    showCaption: false
};

export const VERTRAEGE_COLUMN_DEFS: ColumnDefinition<Vertrag>[] = [
    { field: 'betrieb', header: 'common.partner.betrieb', sortable: true, minWidth: '180px' },
    { field: 'vertragNr', header: 'common.police.vertragNr', sortable: true, minWidth: '140px' },
    { field: 'gueltigAb', header: 'common.police.gueltigAb', type: 'date', sortable: true, minWidth: '120px' },
    { field: 'gueltigBis', header: 'common.police.gueltigBis', type: 'date', sortable: true, minWidth: '120px' },
    { field: 'ablaufdatum', header: 'common.police.ablaufdatum', type: 'date', sortable: true, minWidth: '120px' },
    { field: 'betriebsteil', header: 'common.partner.betriebsteil', sortable: true, minWidth: '120px' },
    { field: 'stufe', header: 'common.partner.stufe', sortable: true, minWidth: '100px' },
    { field: 'personName', header: 'common.partner.person', sortable: true, minWidth: '180px' },
    {
        field: 'actions' as keyof Vertrag & string,
        header: 'common.actions.title',
        type: 'actions',
        sortable: false,
        minWidth: '80px',
        actions: [] // Will be populated by component
    }
];
