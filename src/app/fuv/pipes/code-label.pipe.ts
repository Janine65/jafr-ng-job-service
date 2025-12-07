import { Observable, of } from 'rxjs';

import { Pipe, PipeTransform } from '@angular/core';

import { CodesService } from '../services/codes.service';

/**
 * Pipe to resolve code table internal_name to localized label
 *
 * Usage in template:
 * {{ person.art_der_offerte | codeLabel | async }}
 *
 * This pipe uses the CodesService to resolve code internal_names
 * to their localized labels based on the current language.
 */
@Pipe({
    name: 'codeLabel',
    standalone: true
})
export class CodeLabelPipe implements PipeTransform {
    constructor(private codesService: CodesService) {}

    /**
     * Transform a code internal_name to its localized label
     * @param internalName The internal_name from the code table
     * @returns Observable<string> The localized label or '-' if not found
     */
    transform(internalName: string | undefined | null): Observable<string> {
        if (!internalName) {
            return of('-');
        }
        return this.codesService.resolveCode(internalName);
    }
}
