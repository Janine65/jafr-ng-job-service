import {
    ColumnDefinition, TableConfiguration
} from '@syrius/data-table';

import { Medikamentenrueckforderung } from './medirueck.model';

// Required columns for Medikamentenrückforderung Excel files
export const MEDIRUECK_REQUIRED_COLUMNS = ['falldossier', 'rechnungstyp', 'behandlungsbeginn', 'behandlungsende', 'rueckzahler', 'rechnungsbetrag', 'kommentar'];

// Example data for Medikamentenrückforderung Excel sheet preview
export const MEDIRUECK_EXAMPLE_SHEET = [
    ['falldossier', 'rechnungstyp', 'behandlungsbeginn', 'behandlungsende', 'rueckzahler', 'rechnungsbetrag', 'kommentar'],
    ['12.34567.89.0', 'Rückzahlung Heilungskosten', '01.01.2024', '15.01.2024', '123-45678.9', '1500.00', 'Rückzahlung für Behandlung A'],
    ['23.45678.90.1', 'Rückzahlung Heilungskosten', '10.02.2024', '20.02.2024', '234-56789.0', '3200.50', 'Rabatt für Behandlung B'],
    ['34.56789.01.2', 'Rückzahlung Heilungskosten', '05.03.2024', '10.03.2024', '345-67890.1', '850.75', 'Rückzahlung für Behandlung C']
];

// Column definitions for Medikamentenrückforderung data table
// Use Record<string, unknown> for compatibility with data-table component
export const MEDIRUECK_COLUMNS: ColumnDefinition<Record<string, unknown>>[] = [
    { field: 'falldossier', header: 'inex.medirueck.table.falldossier', sortable: true, filterable: true },
    { field: 'rechnungstyp', header: 'inex.medirueck.table.rechnungstyp', sortable: true, filterable: true },
    { field: 'behandlungsbeginn', header: 'inex.medirueck.table.behandlungsbeginn', sortable: true, filterable: true },
    { field: 'behandlungsende', header: 'inex.medirueck.table.behandlungsende', sortable: true, filterable: true },
    { field: 'rueckzahler', header: 'inex.medirueck.table.rueckzahler', sortable: true, filterable: true },
    { field: 'rechnungsbetrag', header: 'inex.medirueck.table.rechnungsbetrag', sortable: true, filterable: true },
    { field: 'kommentar', header: 'inex.medirueck.table.kommentar', sortable: true, filterable: true },
    { field: 'message', header: 'inex.medirueck.table.message', sortable: true, filterable: true },
    { field: 'errorMessage', header: 'common.table.errorMessage', sortable: true, filterable: true }
];

export const MEDIRUECK_TABLE_CONFIG: TableConfiguration<Medikamentenrueckforderung> = {
    dataKey: 'falldossier',
    selectionMode: 'multiple',
    enableGlobalSearch: true,
    pageSize: 10,
    enablePagination: true,
    showCaption: false,
    emptyMessage: 'common.table.noData',
    scrollHeight: '400px',
    enableExport: true
};
