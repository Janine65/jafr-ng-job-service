import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';

import { inject, Injectable } from '@angular/core';
import {
    OfferteAblehnungModalComponent
} from '@app/fuv/components/offerte-police/nachbearbeitung/offerte-ablehnung-modal.component';
import { RejectReason } from '@app/fuv/models/nachbearbeitung.model';
import { AppMessageService, LogFactoryService, Logger } from '@syrius/core';

/**
 * Service to manage opening the offerte ablehnung (rejection) modal.
 *
 * This service provides a centralized way to:
 * - Open the rejection modal from the nachbearbeitung step
 * - Pass the selected ablehnungsgrund to the modal
 * - Handle task creation for rejected offers
 */
@Injectable({
    providedIn: 'root'
})
export class OfferteAblehnungModalService {
    private logger: Logger;
    private dialogService = inject(DialogService);
    private messageService = inject(AppMessageService);
    private activeDialogRef?: DynamicDialogRef;

    constructor() {
        const logFactory = inject(LogFactoryService);
        this.logger = logFactory.createLogger('OfferteAblehnungModalService');
    }

    /**
     * Open the offerte ablehnung modal
     * @param ablehnungsgrund The selected rejection reason
     * @returns DynamicDialogRef for handling the dialog result
     */
    openAblehnungModal(ablehnungsgrund: RejectReason | null): DynamicDialogRef {
        // Close any existing dialog first
        this.closeDialog();

        const dialogRef = this.dialogService.open(OfferteAblehnungModalComponent, {
            header: 'Neue Aufgabe erstellen',
            width: '70vw',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: false,
            closable: true,
            modal: true,
            dismissableMask: false, // Prevent accidental closes by clicking outside
            data: {
                ablehnungsgrund: ablehnungsgrund
            }
        });

        if (!dialogRef) {
            throw new Error('Failed to open ablehnung dialog');
        }

        this.activeDialogRef = dialogRef;

        // Handle dialog close
        dialogRef.onClose.subscribe((result) => {
            this.activeDialogRef = undefined;

            // If task was created, result will contain saved: true
            if (result?.saved) {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Erfolg',
                    detail: 'Offerte wurde abgelehnt und Aufgabe erstellt',
                    life: 3000
                });
            }
        });

        return dialogRef;
    }

    /**
     * Close the active dialog if one is open
     */
    closeDialog(): void {
        if (this.activeDialogRef) {
            this.activeDialogRef.close();
            this.activeDialogRef = undefined;
        }
    }
}
