import { Subscription } from 'rxjs';

import { Directive, ElementRef, HostListener, OnDestroy, OnInit, Optional } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
    selector: '[appNumberFormat]',
    standalone: true
})
export class NumberFormatDirective implements OnInit, OnDestroy {
    private el: HTMLInputElement;
    private valueChangesSubscription?: Subscription;

    constructor(
        private elementRef: ElementRef,
        @Optional() private control: NgControl
    ) {
        this.el = this.elementRef.nativeElement;
    }

    ngOnInit() {
        // Format the initial value if present
        if (this.control?.value) {
            this.formatValue(this.control.value);
        }

        // Subscribe to value changes for calculated/disabled fields
        if (this.control?.valueChanges) {
            this.valueChangesSubscription = this.control.valueChanges.subscribe((value) => {
                // Only auto-format if the field is disabled (calculated fields)
                // For enabled fields, formatting happens on blur
                if (value !== null && value !== undefined && this.el.disabled) {
                    setTimeout(() => this.formatValue(value), 0);
                }
            });
        }
    }

    ngOnDestroy() {
        this.valueChangesSubscription?.unsubscribe();
    }

    @HostListener('input', ['$event'])
    onInput(event: Event) {
        if (!this.control) return;

        const input = event.target as HTMLInputElement;
        const value = input.value;
        const cursorPosition = input.selectionStart || 0;

        // Remove all non-digit characters except minus sign at start
        const isNegative = value.startsWith('-');
        const digitsOnly = value.replace(/[^\d]/g, '');

        if (digitsOnly === '') {
            this.control.control?.setValue(0, { emitEvent: false });
            input.value = '';
            return;
        }

        // Convert to number and update model
        const numericValue = parseInt(digitsOnly, 10) * (isNegative ? -1 : 1);
        this.control.control?.setValue(numericValue, { emitEvent: false });

        // Format the display with apostrophes
        const formatted = numericValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

        // Calculate new cursor position based on apostrophes added
        const apostrophesBeforeCursor = (value.slice(0, cursorPosition).match(/'/g) || []).length;
        const apostrophesInFormatted = (formatted.slice(0, cursorPosition).match(/'/g) || []).length;
        const newCursorPosition = cursorPosition + (apostrophesInFormatted - apostrophesBeforeCursor);

        input.value = formatted;
        input.setSelectionRange(newCursorPosition, newCursorPosition);
    }

    @HostListener('blur')
    onBlur() {
        if (!this.control) return;

        // Ensure formatting is correct on blur
        const value = this.control.value;
        if (value !== null && value !== undefined && value !== '') {
            this.formatValue(value);
        }
    }

    @HostListener('focus')
    onFocus() {
        if (!this.control) return;

        // Keep formatted display even on focus for better UX
        const value = this.control.value;
        if (value !== null && value !== undefined && value !== '' && value !== 0) {
            this.formatValue(value);
        }
    }

    private formatValue(value: number | null | undefined) {
        if (value === null || value === undefined) {
            this.el.value = '';
            return;
        }

        // Format number with Swiss-style thousand separator (apostrophe)
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) {
            this.el.value = '';
            return;
        }

        // Handle decimal numbers (round to 2 decimal places for display)
        let formattedNum: string;
        if (numValue % 1 !== 0) {
            // Has decimals - format with 2 decimal places
            const parts = numValue.toFixed(2).split('.');
            const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
            formattedNum = `${integerPart}.${parts[1]}`;
        } else {
            // Integer - just add thousand separators
            formattedNum = numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        }

        this.el.value = formattedNum;
    }
}
