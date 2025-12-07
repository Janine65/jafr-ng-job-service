import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';

import { inject, Injectable } from '@angular/core';
import {
    ChecklisteComponent
} from '@app/fuv/components/offerte-police/checkliste/checkliste.component';
import { Checkliste } from '@app/fuv/models/checkliste.model';
import { Offerte } from '@app/fuv/models/offerte.model';
import { Vertrag } from '@app/fuv/models/vertrag.model';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { PersonStore } from '@app/fuv/stores/person.store';
import { AppMessageService, LogFactoryService, Logger } from '@syrius/core';

import { ChecklisteService } from './checkliste.service';
import { PersonService } from './person.service';

/**
 * Service to manage opening and handling checkliste modals from anywhere in the application.
 *
 * This service provides a centralized way to:
 * - Open checkliste modal from any component (betrieb-detail, person-detail, offerte-police)
 * - Load existing checkliste or initialize new one
 * - Handle checkliste creation/update
 * - Update the offerte store when checkliste is saved
 *
 * Usage examples:
 * - From offerte table: checklisteModalService.openForOfferte(offerte)
 * - From vertrag table: checklisteModalService.openForVertrag(vertrag)
 * - From offerte-police wizard: checklisteModalService.openForOfferteId(offerteId)
 */
@Injectable({
    providedIn: 'root'
})
export class ChecklisteModalService {
    private logger: Logger;
    private dialogService = inject(DialogService);
    private checklisteService = inject(ChecklisteService);
    private personService = inject(PersonService);
    private offerteStore = inject(OfferteTypedStore);
    private personStore = inject(PersonStore);
    private messageService = inject(AppMessageService);
    private activeDialogRef?: DynamicDialogRef;

    constructor() {
        const logFactory = inject(LogFactoryService);
        this.logger = logFactory.createLogger('ChecklisteModalService');
    }

    /**
     * Open checkliste modal for a specific offerte ID
     * This will load the offerte data if not already in store
     */
    openForOfferteId(offerteId: number): DynamicDialogRef {
        // Load existing checkliste if available
        this.loadAndPrepareCheckliste(offerteId);

        return this.openDialog(offerteId);
    }

    /**
     * Open checkliste modal from an offerte object
     * This is useful when called from data tables that already have offerte data
     */
    openForOfferte(offerte: Offerte): DynamicDialogRef {
        if (!offerte?.id) {
            this.logger.error('[ChecklisteModalService] Cannot open modal: offerte has no ID');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Offerte-ID fehlt',
                life: 3000
            });
            throw new Error('Offerte ID is required');
        }

        // Update store with offerte data if not already there
        const currentOfferte = this.offerteStore.currentOfferte();
        if (currentOfferte?.id !== offerte.id) {
            const offertenr = offerte.offertenr || 'new';
            this.offerteStore.setOfferte(offertenr, offerte);
        }

        // Load existing checkliste
        this.loadAndPrepareCheckliste(offerte.id);

        return this.openDialog(offerte.id);
    }

    /**
     * Open checkliste modal from a vertrag object
     * For verträge, we need to fetch the associated offerte first
     */
    openForVertrag(vertrag: Vertrag): DynamicDialogRef {
        if (!vertrag?.vertragNr) {
            this.logger.error('[ChecklisteModalService] Cannot open modal: vertrag has no vertragNr');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Vertrags-Nummer fehlt',
                life: 3000
            });
            throw new Error('Vertrag number is required');
        }

        // For now, we'll need the offerte ID from the vertrag
        // If vertrag doesn't have offerte_id, we might need to fetch it
        // This depends on your data structure
        const offerteId = (vertrag as any).offerte_id;

        if (!offerteId) {
            this.logger.error('[ChecklisteModalService] Vertrag has no associated offerte_id');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Vertrag hat keine zugeordnete Offerte',
                life: 3000
            });
            throw new Error('Vertrag must have associated offerte_id');
        }

        // Load existing checkliste
        this.loadAndPrepareCheckliste(offerteId);

        return this.openDialog(offerteId);
    }

    /**
     * Close the active checkliste dialog if one is open
     */
    closeDialog(): void {
        if (this.activeDialogRef) {
            this.activeDialogRef.close();
            this.activeDialogRef = undefined;
        }
    }

    /**
     * Load existing checkliste for the given offerte ID and prepare store
     */
    private loadAndPrepareCheckliste(offerteId: number): void {
        this.logger.debug('[ChecklisteModalService] Loading checkliste for offerte:', offerteId);

        // First check if checkliste is already in store
        const currentOfferte = this.offerteStore.currentOfferte();
        const existingCheckliste = currentOfferte?.checkliste;

        // Check if we have a valid checkliste in store
        const hasValidCheckliste = existingCheckliste && ((Array.isArray(existingCheckliste) && existingCheckliste.length > 0 && existingCheckliste[0]?.id) || (!Array.isArray(existingCheckliste) && (existingCheckliste as any)?.id));

        if (hasValidCheckliste) {
            this.logger.debug('[ChecklisteModalService] Checkliste already available in store, skipping fetch');
            return;
        }

        this.logger.debug('[ChecklisteModalService] Checkliste not in store, fetching from backend');

        this.checklisteService.searchFuvCheckliste(offerteId).subscribe({
            next: (checklisten: Checkliste[]) => {
                if (checklisten && checklisten.length > 0) {
                    const checkliste = checklisten[0]; // Take most recent
                    this.logger.debug('[ChecklisteModalService] Existing checkliste found:', checkliste);

                    // Update store with loaded checkliste
                    this.offerteStore.updateOfferte(null, { checkliste });

                    this.messageService.add({
                        severity: 'info',
                        summary: 'Geladen',
                        detail: 'Vorhandene Checkliste geladen',
                        life: 2000
                    });
                } else {
                    this.logger.debug('[ChecklisteModalService] No existing checkliste, will create new one');
                }
            },
            error: (error: any) => {
                this.logger.error('[ChecklisteModalService] Error loading checkliste:', error);
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Hinweis',
                    detail: 'Checkliste konnte nicht geladen werden',
                    life: 3000
                });
            }
        });
    }

    /**
     * Open the PrimeNG dynamic dialog with ChecklisteComponent
     */
    private openDialog(offerteId: number): DynamicDialogRef {
        // Close any existing dialog first
        this.closeDialog();

        const dialogRef = this.dialogService.open(ChecklisteComponent, {
            header: 'Checkliste erfassen',
            width: '90vw',
            height: '90vh',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: true, // Show fullscreen button
            closable: true, // Show X close button
            modal: true,
            dismissableMask: false, // Prevent accidental closes by clicking outside
            data: {
                offerteId: offerteId,
                mode: 'modal' // Signal to component that it's in modal mode
            }
        });

        if (!dialogRef) {
            throw new Error('Failed to open dialog');
        }

        this.activeDialogRef = dialogRef;

        // Handle dialog close
        dialogRef.onClose.subscribe((result) => {
            this.activeDialogRef = undefined;

            // If checkliste was saved, result will contain the saved checkliste
            if (result?.saved) {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Erfolg',
                    detail: 'Checkliste erfolgreich gespeichert',
                    life: 2000
                });
            }
        });

        return dialogRef;
    }
}
