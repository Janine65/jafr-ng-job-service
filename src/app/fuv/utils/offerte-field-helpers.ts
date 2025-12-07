/**
 * Field Helpers for Offerte Model
 *
 * This module provides type-safe helpers to ensure correct format and type for all offerte fields.
 * - Date helpers: Accept Date objects and convert to required string formats
 * - Code helpers: Validate codes against cached code tables and transform back/forth
 */

import { firstValueFrom } from 'rxjs';

import { inject, Injectable } from '@angular/core';

import { CodeTableEntry } from '../models/codetable.model';
import { CodesService } from '../services/codes.service';

/**
 * Date format types used in Offerte model
 */
export enum DateFormat {
    /** YYYY-MM-DD format (e.g., "2025-11-21") */
    DATE_ONLY = 'DATE_ONLY',
    /** YYYY-MM-DDTHH:mm:ss format (e.g., "2025-11-21T11:06:38") */
    DATETIME_NO_TZ = 'DATETIME_NO_TZ',
    /** YYYY-MM-DDTHH:mm:ss.sssZ format (e.g., "2025-11-21T11:06:38.000Z") */
    DATETIME_ISO = 'DATETIME_ISO'
}

/**
 * Code gruppe constants for offerte fields
 */
export const OfferteCodeGruppen = {
    ART: 'OfferteArt',
    STATUS: 'OfferteStatus',
    AVB: 'COT_FUV_AVB',
    STELLUNG_IM_BETRIEB: 'COT_STELLUNG_IM_BETRIEB',
    BESCHAEFT_GRAD: 'COT_Beschaeftigungsgrad',
    VERKAUFSKANAL: 'Verkaufskanal'
} as const;

/**
 * Praemienzahlung enum (not from code table, fixed values)
 */
export enum Praemienzahlung {
    JAEHRLICH = 'jaehrlich',
    HALBJAEHRLICH = 'halbjaehrlich',
    VIERTELJAEHRLICH = 'vierteljaehrlich',
    MONATLICH = 'monatlich'
}

/**
 * Unterschrieben art enum (not from code table, fixed values)
 */
export enum UnterschriebenArt {
    PHYSISCH = 'physisch',
    ELEKTRONISCH = 'elektronisch'
}

/**
 * Begleitbrief values
 */
export enum Begleitbrief {
    YES = 'yes',
    NO = 'no'
}

/**
 * Date Helper Class
 * Handles all date conversions and formatting for offerte fields
 */
export class OfferteDateHelper {
    /**
     * Format date to YYYY-MM-DD format
     * Used for: gueltab, gueltbis, ablaufdatum, selbst_seit, gedruckt_am, policiert_am, unterschrieben_am
     */
    static toDateOnly(date: Date | string | null | undefined): string | null {
        if (!date) return null;

        if (typeof date === 'string') {
            // If already in correct format, return as-is
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return date;
            }
            // Try to parse and reformat
            date = new Date(date);
        }

        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return null;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    /**
     * Format date to YYYY-MM-DDTHH:mm:ss format (no timezone)
     * Used for: created, updated, statusab
     */
    static toDateTimeNoTz(date: Date | string | null | undefined): string | null {
        if (!date) return null;

        if (typeof date === 'string') {
            // If already in correct format, return as-is
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date)) {
                return date;
            }
            // Try to parse
            date = new Date(date);
        }

        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return null;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    /**
     * Format date to ISO 8601 format with timezone
     * Used for: metadata timestamps
     */
    static toDateTimeISO(date: Date | string | null | undefined): string | null {
        if (!date) return null;

        if (typeof date === 'string') {
            // If already in correct format, return as-is
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date)) {
                return date;
            }
            // Try to parse
            date = new Date(date);
        }

        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return null;
        }

        return date.toISOString();
    }

    /**
     * Parse any date string/object to Date object
     */
    static parse(date: string | Date | null | undefined): Date | null {
        if (!date) return null;

        if (date instanceof Date) {
            return isNaN(date.getTime()) ? null : date;
        }

        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * Get current timestamp in YYYY-MM-DDTHH:mm:ss format
     * Useful for created, updated, statusab fields
     */
    static now(): string {
        return this.toDateTimeNoTz(new Date())!;
    }

    /**
     * Get current date in YYYY-MM-DD format
     */
    static today(): string {
        return this.toDateOnly(new Date())!;
    }

    /**
     * Validate date string format
     */
    static isValidDateFormat(dateStr: string, format: DateFormat): boolean {
        if (!dateStr) return false;

        switch (format) {
            case DateFormat.DATE_ONLY:
                return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
            case DateFormat.DATETIME_NO_TZ:
                return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateStr);
            case DateFormat.DATETIME_ISO:
                return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dateStr);
            default:
                return false;
        }
    }
}

/**
 * Code Helper Service
 * Handles validation and transformation of code table values
 * Injectable to access CodesService
 */
@Injectable({
    providedIn: 'root'
})
export class OfferteCodeHelper {
    private codesService = inject(CodesService);

    // Cache for code validation (gruppe -> Set of valid internal_names)
    private codeValidationCache = new Map<string, Set<string>>();

    /**
     * Validate that a code exists in the specified gruppe
     * Returns the code if valid, null if invalid
     */
    async validateCode(code: string | null | undefined, gruppe: string): Promise<string | null> {
        if (!code) return null;

        // Check cache first
        if (!this.codeValidationCache.has(gruppe)) {
            await this.loadCodesForGruppe(gruppe);
        }

        const validCodes = this.codeValidationCache.get(gruppe);
        if (!validCodes) return null;

        return validCodes.has(code) ? code : null;
    }

    /**
     * Validate multiple codes at once
     */
    async validateCodes(codes: Array<{ code: string | null | undefined; gruppe: string }>): Promise<Array<string | null>> {
        // Preload all required gruppes
        const gruppeSet = new Set(codes.map((c) => c.gruppe));
        const uniqueGruppes = Array.from(gruppeSet);
        await Promise.all(uniqueGruppes.map((gruppe) => this.loadCodesForGruppe(gruppe)));

        // Validate each code
        return codes.map(({ code, gruppe }) => {
            if (!code) return null;
            const validCodes = this.codeValidationCache.get(gruppe);
            return validCodes?.has(code) ? code : null;
        });
    }

    /**
     * Get code entry for a code value
     */
    async getCodeEntry(code: string, gruppe: string): Promise<CodeTableEntry | null> {
        try {
            const codes = await firstValueFrom(this.codesService.getCodesByGruppe(gruppe));
            return codes.find((c) => c.internal_name === code) || null;
        } catch (error) {
            console.error(`Failed to get code entry for ${code} in gruppe ${gruppe}:`, error);
            return null;
        }
    }

    /**
     * Get localized label for a code
     */
    async getCodeLabel(code: string, gruppe: string): Promise<string> {
        const entry = await this.getCodeEntry(code, gruppe);
        if (!entry) return code;
        return this.codesService.getLocalizedLabel(entry);
    }

    /**
     * Get all valid codes for a gruppe as dropdown options
     * Returns {label, value} array suitable for PrimeNG dropdowns
     */
    async getCodeOptions(gruppe: string, activeOnly = true): Promise<Array<{ label: string; value: string }>> {
        try {
            let codes = await firstValueFrom(this.codesService.getCodesByGruppe(gruppe));

            if (activeOnly) {
                codes = codes.filter((c) => c.aktiv === true);
            }

            return codes.map((code) => ({
                label: this.codesService.getLocalizedLabel(code),
                value: code.internal_name
            }));
        } catch (error) {
            console.error(`Failed to get code options for gruppe ${gruppe}:`, error);
            return [];
        }
    }

    /**
     * Get all valid codes for a gruppe using signal-based approach
     * Useful for reactive components
     */
    getCodeOptionsSignal(gruppe: string, activeOnly = true) {
        return this.codesService.getCodeOptionsSignal(gruppe, activeOnly);
    }

    /**
     * Load and cache codes for a gruppe
     */
    private async loadCodesForGruppe(gruppe: string): Promise<void> {
        if (this.codeValidationCache.has(gruppe)) {
            return; // Already loaded
        }

        try {
            const codes = await firstValueFrom(this.codesService.getCodesByGruppe(gruppe));
            const validCodes = new Set(codes.map((c) => c.internal_name));
            this.codeValidationCache.set(gruppe, validCodes);
        } catch (error) {
            console.error(`Failed to load codes for gruppe ${gruppe}:`, error);
            this.codeValidationCache.set(gruppe, new Set());
        }
    }

    /**
     * Clear the validation cache (useful after code table updates)
     */
    clearCache(): void {
        this.codeValidationCache.clear();
    }

    /**
     * Validate Offerte art field
     */
    async validateArt(art: string | null | undefined): Promise<string | null> {
        return this.validateCode(art, OfferteCodeGruppen.ART);
    }

    /**
     * Validate Offerte status field
     */
    async validateStatus(status: string | null | undefined): Promise<string | null> {
        return this.validateCode(status, OfferteCodeGruppen.STATUS);
    }

    /**
     * Validate AVB field
     */
    async validateAvb(avb: string | null | undefined): Promise<string | null> {
        return this.validateCode(avb, OfferteCodeGruppen.AVB);
    }

    /**
     * Validate stellung_im_betrieb field
     */
    async validateStellungImBetrieb(stellung: string | null | undefined): Promise<string | null> {
        return this.validateCode(stellung, OfferteCodeGruppen.STELLUNG_IM_BETRIEB);
    }

    /**
     * Validate beschaeft_grad field
     */
    async validateBeschaeftGrad(grad: string | null | undefined): Promise<string | null> {
        return this.validateCode(grad, OfferteCodeGruppen.BESCHAEFT_GRAD);
    }

    /**
     * Validate kanal field
     */
    async validateKanal(kanal: string | null | undefined): Promise<string | null> {
        return this.validateCode(kanal, OfferteCodeGruppen.VERKAUFSKANAL);
    }

    /**
     * Validate praemienzahlung field (enum, not from code table)
     */
    validatePraemienzahlung(praemienzahlung: string | null | undefined): string | null {
        if (!praemienzahlung) return null;
        const valid = Object.values(Praemienzahlung).includes(praemienzahlung as Praemienzahlung);
        return valid ? praemienzahlung : null;
    }

    /**
     * Validate unterschrieben_art field (enum, not from code table)
     */
    validateUnterschriebenArt(art: string | null | undefined): string | null {
        if (!art) return null;
        const valid = Object.values(UnterschriebenArt).includes(art as UnterschriebenArt);
        return valid ? art : null;
    }

    /**
     * Validate begleitbrief field
     */
    validateBegleitbrief(begleitbrief: string | boolean | null | undefined): string | null {
        if (begleitbrief === null || begleitbrief === undefined) return null;

        if (typeof begleitbrief === 'boolean') {
            return begleitbrief ? Begleitbrief.YES : Begleitbrief.NO;
        }

        const valid = Object.values(Begleitbrief).includes(begleitbrief as Begleitbrief);
        return valid ? begleitbrief : null;
    }

    /**
     * Convert begleitbrief string to boolean
     */
    begleitbriefToBoolean(begleitbrief: string | null | undefined): boolean {
        return begleitbrief === Begleitbrief.YES;
    }
}

/**
 * Combined field validator for Offerte
 * Validates all fields at once and returns validation errors
 */
@Injectable({
    providedIn: 'root'
})
export class OfferteFieldValidator {
    private codeHelper = inject(OfferteCodeHelper);

    /**
     * Validate all code fields in an offerte
     * Returns map of field -> error message (only for invalid fields)
     */
    async validateAllCodeFields(offerte: {
        art?: string | null;
        status?: string | null;
        avb?: string | null;
        stellung_im_betrieb?: string | null;
        beschaeft_grad?: string | null;
        kanal?: string | null;
        praemienzahlung?: string | null;
        unterschrieben_art?: string | null;
    }): Promise<Record<string, string>> {
        const errors: Record<string, string> = {};

        // Validate code table fields
        const codeValidations = [
            { field: 'art', value: offerte.art, gruppe: OfferteCodeGruppen.ART },
            { field: 'status', value: offerte.status, gruppe: OfferteCodeGruppen.STATUS },
            { field: 'avb', value: offerte.avb, gruppe: OfferteCodeGruppen.AVB },
            { field: 'stellung_im_betrieb', value: offerte.stellung_im_betrieb, gruppe: OfferteCodeGruppen.STELLUNG_IM_BETRIEB },
            { field: 'beschaeft_grad', value: offerte.beschaeft_grad, gruppe: OfferteCodeGruppen.BESCHAEFT_GRAD },
            { field: 'kanal', value: offerte.kanal, gruppe: OfferteCodeGruppen.VERKAUFSKANAL }
        ];

        for (const validation of codeValidations) {
            if (validation.value) {
                const isValid = await this.codeHelper.validateCode(validation.value, validation.gruppe);
                if (!isValid) {
                    errors[validation.field] = `Invalid code: ${validation.value} not found in gruppe ${validation.gruppe}`;
                }
            }
        }

        // Validate enum fields
        if (offerte.praemienzahlung) {
            const isValid = this.codeHelper.validatePraemienzahlung(offerte.praemienzahlung);
            if (!isValid) {
                errors['praemienzahlung'] = `Invalid value: must be one of ${Object.values(Praemienzahlung).join(', ')}`;
            }
        }

        if (offerte.unterschrieben_art) {
            const isValid = this.codeHelper.validateUnterschriebenArt(offerte.unterschrieben_art);
            if (!isValid) {
                errors['unterschrieben_art'] = `Invalid value: must be one of ${Object.values(UnterschriebenArt).join(', ')}`;
            }
        }

        return errors;
    }

    /**
     * Validate all date fields in an offerte
     * Returns map of field -> error message (only for invalid fields)
     */
    validateAllDateFields(offerte: {
        created?: string | null;
        updated?: string | null;
        gueltab?: string | null;
        gueltbis?: string | null;
        ablaufdatum?: string | null;
        selbst_seit?: string | null;
        statusab?: string | null;
        gedruckt_am?: string | null;
        policiert_am?: string | null;
        unterschrieben_am?: string | null;
    }): Record<string, string> {
        const errors: Record<string, string> = {};

        // Validate DATETIME_NO_TZ fields
        const datetimeFields = ['created', 'updated', 'statusab'] as const;
        for (const field of datetimeFields) {
            const value = offerte[field];
            if (value && !OfferteDateHelper.isValidDateFormat(value, DateFormat.DATETIME_NO_TZ)) {
                errors[field] = `Invalid datetime format: must be YYYY-MM-DDTHH:mm:ss`;
            }
        }

        // Validate DATE_ONLY fields
        const dateFields = ['gueltab', 'gueltbis', 'ablaufdatum', 'selbst_seit', 'gedruckt_am', 'policiert_am', 'unterschrieben_am'] as const;
        for (const field of dateFields) {
            const value = offerte[field];
            if (value && !OfferteDateHelper.isValidDateFormat(value, DateFormat.DATE_ONLY)) {
                errors[field] = `Invalid date format: must be YYYY-MM-DD`;
            }
        }

        return errors;
    }
}
