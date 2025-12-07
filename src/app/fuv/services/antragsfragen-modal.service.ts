import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';

import { inject, Injectable } from '@angular/core';
import {
    AntragsfragenComponent
} from '@app/fuv/components/offerte-police/antragsfragen/antragsfragen.component';
import { AppMessageService, LogFactoryService, Logger } from '@syrius/core';

/**
 * Service to manage opening and handling antragsfragen modals from anywhere in the application.
 *
 * This service provides a centralized way to:
 * - Open antragsfragen modal from any component
 * - Handle view-only mode for read-only access
 * - Provide fullscreen capability via DynamicDialog
 */
@Injectable({
    providedIn: 'root'
})
export class AntragsfragenModalService {
    private logger: Logger;
    private dialogService = inject(DialogService);
    private messageService = inject(AppMessageService);
    private activeDialogRef?: DynamicDialogRef;

    constructor() {
        const logFactory = inject(LogFactoryService);
        this.logger = logFactory.createLogger('AntragsfragenModalService');
    }

    /**
     * Open antragsfragen modal for a specific offerte ID
     * @param offerteId The offerte ID to load antragsfragen for
     * @param viewOnly Whether to open in view-only mode (default: false)
     */
    openForOfferte(offerteId: number, viewOnly: boolean = false): DynamicDialogRef {
        this.logger.debug('Opening antragsfragen for offerte ID:', offerteId, 'viewOnly:', viewOnly);

        if (!offerteId) {
            this.logger.error('Cannot open modal: offerte ID is missing');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Offerte-ID fehlt',
                life: 3000
            });
            throw new Error('Offerte ID is required');
        }

        return this.openDialog(offerteId, viewOnly);
    }

    /**
     * Close the active antragsfragen dialog if one is open
     */
    closeDialog(): void {
        if (this.activeDialogRef) {
            this.activeDialogRef.close();
            this.activeDialogRef = undefined;
        }
    }

    /**
     * Open the PrimeNG dynamic dialog with AntragsfragenComponent
     */
    private openDialog(offerteId: number, viewOnly: boolean): DynamicDialogRef {
        // Close any existing dialog first
        this.closeDialog();

        const dialogRef = this.dialogService.open(AntragsfragenComponent, {
            header: viewOnly ? 'Antragsfragen ansehen' : 'Antragsfragen bearbeiten',
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
                viewOnly: viewOnly,
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

            // If antragsfragen were saved, show success message
            if (result?.saved) {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Erfolg',
                    detail: 'Antragsfragen erfolgreich gespeichert',
                    life: 2000
                });

                // Check if VTT dialog should be shown after save
                if (result?.showVttDialog) {
                    this.logger.debug('VTT dialog needs to be shown - reopening modal with VTT trigger');

                    // Small delay to ensure the current dialog is fully closed
                    setTimeout(() => {
                        // Reopen the modal with a flag to trigger VTT dialog
                        const newDialogRef = this.dialogService.open(AntragsfragenComponent, {
                            header: viewOnly ? 'Antragsfragen ansehen' : 'Antragsfragen bearbeiten',
                            width: '90vw',
                            height: '90vh',
                            contentStyle: { overflow: 'auto' },
                            baseZIndex: 10000,
                            maximizable: true,
                            closable: true,
                            modal: true,
                            dismissableMask: false,
                            data: {
                                offerteId: offerteId,
                                viewOnly: viewOnly,
                                mode: 'modal',
                                triggerVttDialog: true // Signal to show VTT dialog immediately
                            }
                        });

                        if (newDialogRef) {
                            this.activeDialogRef = newDialogRef;

                            // Setup close handler for the new dialog
                            newDialogRef.onClose.subscribe((newResult) => {
                                this.activeDialogRef = undefined;
                            });
                        }
                    }, 300);
                }
            }
        });

        return dialogRef;
    }
}
