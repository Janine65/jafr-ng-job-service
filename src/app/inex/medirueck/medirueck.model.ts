/**
 * Interface for Medikamentenrueckforderung Excel data
 * Represents the structure of data parsed from uploaded Excel files
 */
export interface Medikamentenrueckforderung {
    falldossier: string;
    rechnungstyp: string;
    behandlungsbeginn: string;
    behandlungsende: string;
    rueckzahler: string;
    rechnungsbetrag: string;
    [key: string]: unknown;
}

import { JobEntry } from '@syrius/job-service';

/**
 * File upload response from /uploadfile endpoint
 */
export interface UploadFileResponse {
    filename: string;
    size: number;
    uploadedAt?: string;
}

/**
 * Entry from backend API representing a row in the Medikamentenrückforderung database table.
 * This unified model is used for:
 * - Individual Excel row entries (row >= 1, contains data)
 * - Metadata entries (row = 0, all data fields are null)
 *
 * Status values:
 * - 'neu': Entry just uploaded, not yet processed
 * - 'verarbeitet': Entry has been processed (may have succeeded or failed)
 *   - If 'message' field is non-empty, processing failed with an error
 *   - If 'message' field is empty/null, processing succeeded
 *
 * Returned by:
 * - PUT /medirueckforderung/medirueck/uploadMediRueckforderung (all entries including metadata)
 * - GET /medirueckforderung/medirueck/searchMediRueckExcelfile (metadata entry only, row=0)
 * - GET /medirueckforderung/medirueck/searchMediRueckforderung (all entries for a file)
 */
export interface MediRueckEntry extends JobEntry {
    falldossier: string | null;
    rueckzahler: string | null;
    behandlungsbeginn: string | null;
    behandlungsende: string | null;
    rechnungsbetrag: string | null;
    rechnungstyp: string | null;
    kommentar: string | null;
    rueckzahlungid: string | null;
}
