/**
 * Centralized role configuration
 * This file contains all role-related constants and route-to-role mappings
 */

/**
 * System role constants
 */
export const ROLE_CONSTANTS = {
    /** Administrator role - grants access to all features and system configuration */
    ADMIN: 'kpm_tool_berechtigung',
    /** System role - grants access to system features */
    SYSTEM: 'kpm_tool'
} as const;

/**
 * Route-to-role mappings
 * Maps route paths to the roles that have access to them
 * Format: key = route path, value = array of role names (using internal role format)
 */
export const ROUTE_ROLE_MAPPINGS: Record<string, string[]> = {
    // Dashboard - accessible to all
    '/dashboard': [],

    // FUV routes - using granular role names
    '/fuv': ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt', 'fuv_offerte_antragsfragen'],
    '/fuv/search/partner': ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt'],
    '/fuv/search/betrieb': ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt'],
    '/fuv/search/offerte': ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt'],

    // VT routes
    '/vt': ['aktenentscheid', 'aktenentscheid_bbakt'],
    '/vt/aktenentscheid': ['aktenentscheid'],
    '/vt/betriebsbeschreibung': ['aktenentscheid_bbakt'],
    '/vt/betriebsbeschreibung/einladung': ['aktenentscheid_bbakt'],
    '/vt/betriebsbeschreibung/erinnerung': ['aktenentscheid_bbakt'],
    '/vt/betriebsbeschreibung/mahnung': ['aktenentscheid_bbakt'],
    '/vt/betriebsbeschreibung/aufgabe': ['aktenentscheid_bbakt'],

    // INEX routes - using granular role names
    '/inex': ['medirueck_leistungsabrechnung', 'ie_auswertung_regress'],
    '/inex/medirueck': ['medirueck_leistungsabrechnung'],
    '/inex/regress': ['ie_auswertung_regress'],

    // System routes
    '/system': [ROLE_CONSTANTS.SYSTEM, ROLE_CONSTANTS.ADMIN],
    '/system/scheduler': [ROLE_CONSTANTS.SYSTEM, ROLE_CONSTANTS.ADMIN],
    '/system/berechtigungen': [ROLE_CONSTANTS.ADMIN],
    '/system/codetabellen': [ROLE_CONSTANTS.SYSTEM, ROLE_CONSTANTS.ADMIN],
    '/system/steuertabellen': [ROLE_CONSTANTS.SYSTEM, ROLE_CONSTANTS.ADMIN]
} as const;

/**
 * Helper type for role constants
 */
export type RoleConstant = (typeof ROLE_CONSTANTS)[keyof typeof ROLE_CONSTANTS];
