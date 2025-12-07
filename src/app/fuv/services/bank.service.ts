import { Observable } from 'rxjs';

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LogFactoryService } from '@syrius/core';

import { Bank } from '../models/bank.model';
import { extractBankClearingNumber, formatIban, isValidSwissIban } from './bank.validation';

@Injectable({
    providedIn: 'root'
})
export class BankService {
    private http = inject(HttpClient);
    private logger = inject(LogFactoryService).createLogger('BankService');
    private apiUrl = '/api/admin/bank';

    /**
     * Extract clearing number from Swiss IBAN
     * Swiss IBAN format: CH** **** **** **** **** *
     * Characters 5-9 (0-indexed 4-8) contain the bank clearing number (BankClear Code / BC-Nummer)
     *
     * Example: CH13 0077 8180 2388 9200
     * - CH: Country code
     * - 13: Check digits
     * - 00778: Clearing number (position 4-8, 5 digits)
     * - 180238892: Account number
     * - 00: Check digit for account
     *
     * @param iban Swiss IBAN (with or without spaces)
     * @returns Clearing number without leading zeros, or null if invalid
     */
    extractClearingNumber(iban: string): string | null {
        const clearingNumber = extractBankClearingNumber(iban);

        if (!clearingNumber) {
            this.logger.warn('[BankService] Invalid Swiss IBAN format:', iban);
            return null;
        }

        // Remove leading zeros
        const clearingNumberWithoutLeadingZeros = clearingNumber.replace(/^0+/, '');

        this.logger.log('Extracted clearing number:', {
            iban,
            clearingNumber,
            withoutLeadingZeros: clearingNumberWithoutLeadingZeros
        });

        return clearingNumberWithoutLeadingZeros || '0'; // Return '0' if all zeros
    }

    /**
     * Search for bank by clearing number
     * Maps to GET /api/admin/bank/searchBank?clearingnr=XXX
     *
     * @param clearingNumber Bank clearing number (without leading zeros)
     * @returns Observable of bank entries matching the clearing number
     */
    searchBank(clearingNumber: string): Observable<Bank[]> {
        const params = new HttpParams().set('clearingnr', clearingNumber);
        return this.http.get<Bank[]>(`${this.apiUrl}/searchBank`, { params });
    }

    /**
     * Search for bank by IBAN
     * Extracts clearing number from IBAN and searches for matching bank
     *
     * @param iban Swiss IBAN (with or without spaces)
     * @returns Observable of bank entries, or empty array if IBAN is invalid
     */
    searchBankByIban(iban: string): Observable<Bank[]> {
        const clearingNumber = this.extractClearingNumber(iban);

        if (!clearingNumber) {
            this.logger.error('[BankService] Cannot search bank: Invalid IBAN format');
            // Return empty array instead of throwing error
            return new Observable((observer) => {
                observer.next([]);
                observer.complete();
            });
        }

        return this.searchBank(clearingNumber);
    }

    /**
     * Format IBAN with spaces for display (Swiss format)
     * CH13 0077 8180 2388 9200
     *
     * @param iban IBAN string (with or without spaces)
     * @returns Formatted IBAN with spaces, or original if invalid
     */
    formatIban(iban: string): string {
        return formatIban(iban);
    }

    /**
     * Validate Swiss IBAN format
     * @param iban IBAN string (with or without spaces)
     * @returns true if valid Swiss IBAN, false otherwise
     */
    isValidSwissIban(iban: string): boolean {
        return isValidSwissIban(iban);
    }
}
