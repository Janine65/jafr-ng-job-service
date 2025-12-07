/**
 * Validation Translation Helper
 * 
 * This helper provides translation support for Zod validation messages.
 * Since Zod schemas are created at module load time (before Angular's DI is available),
 * we use a function-based approach that gets the translation service at runtime.
 */

import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Get a translated validation message
 * This should be called from within a component or service where DI is available
 */
export function getValidationMessage(key: string, params?: Record<string, any>): string {
  try {
    const translate = inject(TranslateService);
    return translate.instant(key, params);
  } catch {
    // Fallback if translation service is not available
    return key;
  }
}

/**
 * Common validation message keys
 */
export const ValidationMessages = {
  required: (field: string) => `${field} ist erforderlich`,
  invalid: (field: string) => `${field} ist nicht valide`,
  mustBeNumber: (field: string) => `${field} muss eine Zahl sein`,
  minValue: (field: string, min: number) => `${field} muss mindestens ${min} sein`,
  maxValue: (field: string, max: number) => `${field} darf höchstens ${max} sein`,
  notNegative: (field: string) => `${field} darf nicht negativ sein`,
  notInPast: (field: string) => `${field} darf nicht in der Vergangenheit liegen`,
  mustBeAfter: (field1: string, field2: string) => `${field1} muss nach ${field2} liegen`,
} as const;

/**
 * Create translated validation messages for Taetigkeit
 * These return the translation keys that will be resolved by the component
 */
export const TaetigkeitValidationMessages = {
  taetigkeitsbeschreibungInvalid: 'fuv.police.taetigkeit.validation.taetigkeitsbeschreibungInvalid',
  stellungImBetriebRequired: 'fuv.police.taetigkeit.validation.stellungImBetriebRequired',
  arbeitspensumRequired: 'fuv.police.taetigkeit.validation.arbeitspensumRequired',
  selbststaendigSeitRequired: 'fuv.police.taetigkeit.validation.selbststaendigSeitRequired',
  anzahlMitarbeiterRequired: 'fuv.police.taetigkeit.validation.anzahlMitarbeiterRequired',
  stellenprozenteRequired: 'fuv.police.taetigkeit.validation.stellenprozenteRequired',
  stellenprozenteMustBeNumber: 'fuv.police.taetigkeit.validation.stellenprozenteMustBeNumber',
  stellenprozenteNotNegative: 'fuv.police.taetigkeit.validation.stellenprozenteNotNegative',
  stellenprozenteMaxValue: 'fuv.police.taetigkeit.validation.stellenprozenteMaxValue',
  vertragGueltigAbRequired: 'fuv.police.taetigkeit.validation.vertragGueltigAbRequired',
  vertragGueltigAbNotInPast: 'fuv.police.taetigkeit.validation.vertragGueltigAbNotInPast',
  vertragGueltigBisRequired: 'fuv.police.taetigkeit.validation.vertragGueltigBisRequired',
  vertragGueltigBisMustBeAfter: 'fuv.police.taetigkeit.validation.vertragGueltigBisMustBeAfter',
  vertragMustCoverYears: 'fuv.police.taetigkeit.validation.vertragMustCoverYears',
  taetigkeitenSumMust100: 'fuv.police.taetigkeit.validation.taetigkeitenSumMust100',
  prozentMustBeNumber: 'fuv.police.taetigkeit.validation.prozentMustBeNumber',
  prozentMinValue: 'fuv.police.taetigkeit.validation.prozentMinValue',
  prozentMaxValue: 'fuv.police.taetigkeit.validation.prozentMaxValue',
} as const;
