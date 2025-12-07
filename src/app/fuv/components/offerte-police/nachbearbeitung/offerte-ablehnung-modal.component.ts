import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RejectReason } from '@app/fuv/models/nachbearbeitung.model';
import { KpmService } from '@app/fuv/services/kpm.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { TranslateModule } from '@ngx-translate/core';
import { AppMessageService, LogFactoryService, Logger } from '@syrius/core';

import {
    DEFAULT_AUFGABE_AUSFUEHRENDER, OFFERTE_STATUS_REJECTED, WFD_FUV_OFFERTE_ABGELEHNT_NACHFASSEN
} from '../police.constants';
import { isOfferteAblehnungFormValid } from './offerte-ablehnung-modal.validation';

interface AufgabeData {
    aufgabeart: string;
    titel: string;
    faelligAm: Date;
    zugewiesenAn: string;
    beschreibung: string;
    automatischeBeschreibung: string;
}

@Component({
    selector: 'app-offerte-ablehnung-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, SelectModule, TextareaModule, DatePickerModule, TranslateModule],
    template: `
        <div class="space-y-4">
            <!-- Aufgabeart -->
            <div class="grid grid-cols-[200px_1fr] gap-4 items-center">
                <label class="text-sm font-medium">Aufgabeart</label>
                <p-select [options]="aufgabeartOptions" [(ngModel)]="aufgabeData.aufgabeart" optionLabel="label" optionValue="value" placeholder="Wählen Sie eine Aufgabeart" [disabled]="true" class="w-full"></p-select>
            </div>

            <!-- Titel der Aufgabe -->
            <div class="grid grid-cols-[200px_1fr] gap-4 items-center">
                <label class="text-sm font-medium">Titel der Aufgabe</label>
                <input pInputText type="text" [(ngModel)]="aufgabeData.titel" class="w-full" />
            </div>

            <!-- Fällig am -->
            <div class="grid grid-cols-[200px_1fr] gap-4 items-center">
                <label class="text-sm font-medium">Fällig am</label>
                <p-datepicker [(ngModel)]="aufgabeData.faelligAm" dateFormat="dd.mm.yy" class="w-full"></p-datepicker>
            </div>

            <!-- Zugewiesen an -->
            <div class="grid grid-cols-[200px_1fr] gap-4 items-center">
                <label class="text-sm font-medium">Zugewiesen an</label>
                <input pInputText type="text" [(ngModel)]="aufgabeData.zugewiesenAn" [disabled]="true" class="w-full" />
            </div>

            <!-- Beschreibung -->
            <div class="grid grid-cols-[200px_1fr] gap-4 items-start">
                <label class="text-sm font-medium pt-2">Beschreibung</label>
                <textarea pTextarea [(ngModel)]="aufgabeData.beschreibung" rows="4" class="w-full"></textarea>
            </div>

            <!-- Automatische Beschreibung (read-only) -->
            <div class="grid grid-cols-[200px_1fr] gap-4 items-start">
                <label class="text-sm font-medium pt-2">Automatische Beschreibung</label>
                <textarea pTextarea [(ngModel)]="aufgabeData.automatischeBeschreibung" rows="3" [disabled]="true" class="w-full bg-gray-50"></textarea>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end gap-2 pt-4 border-t">
                <button pButton type="button" label="Abbrechen" icon="pi pi-times" class="p-button-text" (click)="onCancel()"></button>
                <button pButton type="button" label="Aufgabe erstellen" icon="pi pi-check" class="p-button-primary" (click)="onSave()" [disabled]="!isValid()"></button>
            </div>
        </div>
    `
})
export class OfferteAblehnungModalComponent implements OnInit {
    private dialogConfig = inject(DynamicDialogConfig);
    private dialogRef = inject(DynamicDialogRef);
    private offerteStore = inject(OfferteTypedStore);
    private kpmService = inject(KpmService);
    private messageService = inject(AppMessageService);
    private logFactory = inject(LogFactoryService);
    private logger: Logger;

    aufgabeData: AufgabeData = {
        aufgabeart: '',
        titel: '',
        faelligAm: new Date(),
        zugewiesenAn: '',
        beschreibung: '',
        automatischeBeschreibung: ''
    };

    aufgabeartOptions = [{ label: 'FUV Offerte abgelehnt - nachfassen', value: WFD_FUV_OFFERTE_ABGELEHNT_NACHFASSEN }];

    private ablehnungsgrund: RejectReason | null = null;

    constructor() {
        this.logger = this.logFactory.createLogger('OfferteAblehnungModalComponent');
    }

    ngOnInit(): void {
        this.logger.debug('[OfferteAblehnungModalComponent] Initializing modal');

        // Get data passed from the parent
        const data = this.dialogConfig.data;
        this.ablehnungsgrund = data?.ablehnungsgrund;

        // Set default values using constants
        this.aufgabeData.aufgabeart = WFD_FUV_OFFERTE_ABGELEHNT_NACHFASSEN;
        this.aufgabeData.titel = 'FUV Offerte abgelehnt - nachfassen';
        this.aufgabeData.zugewiesenAn = DEFAULT_AUFGABE_AUSFUEHRENDER;

        // Set default due date: 3 weeks (21 days) from now, adjusted if it falls on a weekend
        this.aufgabeData.faelligAm = this.calculateDueDate();

        // Get current offerte
        const offerte = this.offerteStore.currentOfferte();
        if (offerte) {
            // Build automatic description
            this.aufgabeData.automatischeBeschreibung = this.buildAutomaticDescription(offerte);
        }

        this.logger.debug('[OfferteAblehnungModalComponent] Initialized with ablehnungsgrund:', this.ablehnungsgrund);
    }

    /**
     * Calculate due date: 3 weeks (21 days) from now
     * If the date falls on a weekend (Saturday or Sunday), move it to the previous Friday
     */
    private calculateDueDate(): Date {
        const dueDate = new Date();
        // Add 3 weeks (21 days)
        dueDate.setDate(dueDate.getDate() + 21);

        // Get day of week (0 = Sunday, 6 = Saturday)
        const dayOfWeek = dueDate.getDay();

        if (dayOfWeek === 0) {
            // Sunday: move back 2 days to Friday
            dueDate.setDate(dueDate.getDate() - 2);
        } else if (dayOfWeek === 6) {
            // Saturday: move back 1 day to Friday
            dueDate.setDate(dueDate.getDate() - 1);
        }

        return dueDate;
    }

    /**
     * Build automatic description based on offerte and rejection reason
     */
    private buildAutomaticDescription(offerte: any): string {
        const offerteNr = offerte.offertenr || 'N/A';
        const ablehnungsgrundText = this.ablehnungsgrund?.label || 'sonstiges';

        return `Die Offerte wurde abgelehnt.\nOfferteNr: ${offerteNr}\nAblehnungsgrund: ${ablehnungsgrundText}`;
    }

    /**
     * Check if form is valid
     */
    isValid(): boolean {
        return isOfferteAblehnungFormValid(this.aufgabeData.aufgabeart, this.aufgabeData.titel, this.aufgabeData.faelligAm);
    }

    /**
     * Cancel and close the modal
     */
    onCancel(): void {
        this.logger.debug('[OfferteAblehnungModalComponent] Cancel clicked');
        this.dialogRef.close({ saved: false });
    }

    /**
     * Save the task and reject the offerte
     */
    onSave(): void {
        this.logger.debug('[OfferteAblehnungModalComponent] Save clicked');

        if (!this.isValid()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validierung',
                detail: 'Bitte füllen Sie alle Pflichtfelder aus',
                life: 3000
            });
            return;
        }

        const offerte = this.offerteStore.currentOfferte();
        if (!offerte?.id) {
            this.logger.error('[OfferteAblehnungModalComponent] No offerte ID available');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Offerte-ID fehlt',
                life: 3000
            });
            return;
        }

        // Update the offerte store with the ablehnungsgrund code and status
        // This will save the code (e.g., 'COD_04_AblehnungFUV_keinInteresse') to the offerte
        if (this.ablehnungsgrund?.code) {
            this.logger.debug('[OfferteAblehnungModalComponent] Saving ablehnungsgrund and status to store:', this.ablehnungsgrund.code);
            this.offerteStore.updateOfferte(null, {
                ablehnungsgrund: this.ablehnungsgrund.code,
                status: OFFERTE_STATUS_REJECTED // Set status to rejected
            });
        }

        // TODO: Implement the actual rejection logic
        // This should:
        // 1. Create the task via KPM service
        // 2. Persist changes to backend

        this.logger.debug('[OfferteAblehnungModalComponent] Creating task with data:', this.aufgabeData);

        // For now, just close with success
        this.messageService.add({
            severity: 'success',
            summary: 'Erfolg',
            detail: 'Aufgabe erfolgreich erstellt',
            life: 3000
        });

        this.dialogRef.close({
            saved: true,
            aufgabeData: this.aufgabeData
        });
    }
}
