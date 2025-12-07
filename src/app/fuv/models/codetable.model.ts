/**
 * Represents a single entry in a code table (Codetabelle)
 */
export interface CodeTableEntry {
    id: number;
    internal_name: string;
    bezeichnungdt: string;
    bezeichnungfr: string;
    bezeichnungit: string;
    bezeichnungen: string;
    gruppe: string;
    sorter: number;
    aktiv: boolean;
    created: string;
    updated: string;
    updatedby: string;
    syrius: boolean;
    syrius_table: string | null;
}

/**
 * Index of code table entries by internal_name for fast lookup
 */
export interface CodeTableIndex {
    [internalName: string]: CodeTableEntry;
}

/**
 * Supported language codes for code table translations
 */
export type LanguageCode = 'de' | 'fr' | 'it' | 'en';

/**
 * Search parameters for CodeTable
 */
export interface CodeTableApiRequest {
    internal_name?: string;
    gruppe?: string;
}

/**
 * Response from CodeTable API endpoints
 */
export type CodeTableApiResponse = CodeTableEntry[];
