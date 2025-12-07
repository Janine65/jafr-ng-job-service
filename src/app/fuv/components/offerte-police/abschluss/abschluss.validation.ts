/**
 * Abschluss (Conclusion) Step Validation
 *
 * Validates the completion step of the offerte including checkliste,
 * antragsfragen (questionnaire), and signature/AVB confirmation
 */

import { GENEHMIGUNG_ART_APPROVED, GENEHMIGUNG_ART_REJECTED } from '../police.constants';

export interface ValidationItem {
    label: string;
    status: 'valid' | 'warning' | 'error';
    message?: string;
}

/**
 * Validate checkliste status
 * Checkliste is valid if it exists and has been saved (has an ID)
 *
 * @param checkliste - Checkliste object or array
 * @returns Validation item
 */
export function validateCheckliste(checkliste: any): ValidationItem {
    let checklisteValid = false;

    if (checkliste) {
        // Handle both array format (backend inconsistency) and single object
        if (Array.isArray(checkliste)) {
            checklisteValid = checkliste.length > 0 && !!checkliste[0]?.id;
        } else {
            checklisteValid = !!checkliste.id;
        }
    }

    return {
        label: 'fuv.police.steps.checkliste',
        status: checklisteValid ? 'valid' : 'error',
        message: checklisteValid ? 'Die Checkliste ist vollständig und gültig.' : 'Die Checkliste wurde noch nicht vollständig bearbeitet.'
    };
}

/**
 * Validate Antragsfragen (questionnaire) status
 *
 * Rules:
 * - If < 3 "ja" answers: No VTT review needed (valid)
 * - If >= 3 "ja" answers: VTT review required
 *   - If rejected by VTT: error
 *   - If approved by VTT: valid
 *   - If task created but not reviewed: warning
 *   - If no task created yet: warning
 *
 * @param fragebogen - Fragebogen object
 * @param vttTaskCreated - Whether VTT task has been created
 * @returns Validation item
 */
export function validateAntragsfragen(fragebogen: any, vttTaskCreated: boolean): ValidationItem {
    let jaCount = 0;

    if (fragebogen?.antworten) {
        // Count "ja" answers (codevalue = '-10110')
        jaCount = fragebogen.antworten.filter((antwort: any) => antwort.codevalue === '-10110').length;
    }

    // Log for debugging
    console.log('[validateAntragsfragen] Debug:', {
        jaCount,
        vttTaskCreated,
        hasFragebogen: !!fragebogen,
        hasAntworten: !!fragebogen?.antworten,
        antwortenLength: fragebogen?.antworten?.length,
        genehmigung_art: fragebogen?.genehmigung_art,
        genehmigung_art_type: typeof fragebogen?.genehmigung_art,
        REJECTION_CODES: GENEHMIGUNG_ART_REJECTED
    });

    // Check for VTT rejection first - this takes priority over everything else
    const vttRejected = fragebogen?.genehmigung_art && GENEHMIGUNG_ART_REJECTED.includes(fragebogen.genehmigung_art);

    console.log('[validateAntragsfragen] VTT Rejection Check:', {
        vttRejected,
        genehmigung_art: fragebogen?.genehmigung_art,
        includes_check: GENEHMIGUNG_ART_REJECTED.includes(fragebogen?.genehmigung_art)
    });

    if (vttRejected) {
        // VTT has rejected the questionnaire - BLOCKING ERROR
        const bemerkung = fragebogen?.genehmigung_bemerkung || 'Keine Bemerkung';
        return {
            label: 'fuv.police.steps.antragsfragen',
            status: 'error',
            message: `Ablehnung durch VTT und Suva-Arzt:\n\n${bemerkung}`
        };
    }

    // If VTT task was created OR 3+ ja answers detected, VTT review is required
    // We check vttTaskCreated flag first because it's the source of truth
    // (fragebogen.antworten might not be loaded/available in all contexts)
    if (vttTaskCreated || jaCount >= 3) {
        const vttApproved = fragebogen?.genehmigung_art && GENEHMIGUNG_ART_APPROVED.includes(fragebogen.genehmigung_art);

        if (vttApproved) {
            // VTT has approved the questionnaire
            return {
                label: 'fuv.police.steps.antragsfragen',
                status: 'valid',
                message: 'Antragsfragen wurden durch VTT geprüft.\n\nAufgabe wurde bearbeitet.'
            };
        } else if (vttTaskCreated) {
            // VTT task created but not yet approved
            return {
                label: 'fuv.police.steps.antragsfragen',
                status: 'warning',
                message: 'Antragsfragen müssen noch durch VTT geprüft werden.\n\nAufgabe wurde erstellt.'
            };
        } else {
            // No VTT task created yet
            return {
                label: 'fuv.police.steps.antragsfragen',
                status: 'warning',
                message: 'Antragsfragen müssen noch durch VTT geprüft werden.\n\nAufgabe muss erstellt werden.'
            };
        }
    } else {
        // Less than 3 ja answers - no VTT review needed
        return {
            label: 'fuv.police.steps.antragsfragen',
            status: 'valid',
            message: 'Antragsfragen sind in Ordnung (keine VTT-Prüfung erforderlich).'
        };
    }
}

/**
 * Validate all abschluss requirements
 *
 * @param checkliste - Checkliste object
 * @param fragebogen - Fragebogen object
 * @param vttTaskCreated - Whether VTT task has been created
 * @returns Array of validation items
 */
export function validateAbschlussRequirements(checkliste: any, fragebogen: any, vttTaskCreated: boolean): ValidationItem[] {
    const items: ValidationItem[] = [];

    items.push(validateCheckliste(checkliste));
    items.push(validateAntragsfragen(fragebogen, vttTaskCreated));

    return items;
}

/**
 * Check if all validations pass (no errors)
 *
 * @param validationItems - Array of validation items
 * @returns true if all items are valid, false otherwise
 */
export function allValidationsPassed(validationItems: ValidationItem[]): boolean {
    return validationItems.every((item) => item.status === 'valid');
}

/**
 * Get list of validation errors
 *
 * @param validationItems - Array of validation items
 * @returns Array of error labels
 */
export function getValidationErrors(validationItems: ValidationItem[]): string[] {
    return validationItems.filter((item) => item.status === 'error').map((item) => item.label);
}

/**
 * Validate step is ready for progression
 * User can proceed if:
 * - Digital signature is present (unterschrift not empty), OR
 * - Physical return checkbox is checked (avbBestaetigung is true)
 *
 * @param unterschrift - Digital signature data
 * @param avbBestaetigung - Physical return checkbox
 * @returns true if step is valid for progression
 */
export function validateAbschlussStep(unterschrift: string | undefined, avbBestaetigung: boolean | undefined): boolean {
    const hasDigitalSignature = !!unterschrift && unterschrift.trim() !== '';
    const hasPhysicalReturn = !!avbBestaetigung;

    return hasDigitalSignature || hasPhysicalReturn;
}
