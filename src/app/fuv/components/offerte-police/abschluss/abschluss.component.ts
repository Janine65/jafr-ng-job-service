import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { PanelModule } from 'primeng/panel';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import {
    AfterViewInit, Component, computed, ElementRef, EventEmitter, inject, Input, Output, signal,
    ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AbschlussData, ValidationItem } from '@app/fuv/models/abschluss.model';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, LogFactoryService, Logger } from '@syrius/core';

import {
    GENEHMIGUNG_ART_APPROVED, GENEHMIGUNG_ART_REJECTED, OFFERTE_STATUS_SIGNED_ELECTRONICALLY,
    OFFERTE_STATUS_SIGNED_PHYSICALLY
} from '../police.constants';
import {
    allValidationsPassed as checkAllValidationsPassed, getValidationErrors,
    validateAbschlussRequirements, validateAbschlussStep
} from './abschluss.validation';

@Component({
    selector: 'app-abschluss',
    standalone: true,
    imports: [CommonModule, FormsModule, PanelModule, CheckboxModule, ButtonModule, TooltipModule, TranslateModule],
    templateUrl: './abschluss.component.html'
})
export class AbschlussComponent implements AfterViewInit {
    @Input() viewMode: boolean = false; // Read-only mode flag
    @Output() printOffertantragRequested = new EventEmitter<void>();

    private _signatureCanvas?: ElementRef<HTMLCanvasElement>;

    /**
     * ViewChild with setter to automatically initialize canvas when it becomes available
     * This is important because the canvas can be hidden/shown via *ngIf
     */
    @ViewChild('signatureCanvas')
    set signatureCanvas(element: ElementRef<HTMLCanvasElement> | undefined) {
        const previousElement = this._signatureCanvas;
        this._signatureCanvas = element;

        // Only initialize if this is a new element (not just a change detection cycle on the same element)
        if (element?.nativeElement && element !== previousElement) {
            // Canvas just became available - initialize it
            this.logger.debug('[AbschlussComponent] Canvas element became available, initializing...');
            // Use setTimeout to ensure DOM is fully ready
            setTimeout(() => {
                if (this._signatureCanvas?.nativeElement) {
                    this.initializeCanvas();
                    if (this.needsSignatureRestore && this.abschlussData.unterschrift) {
                        this.restoreSignatureToCanvas(this.abschlussData.unterschrift);
                        this.needsSignatureRestore = false;
                    }
                }
            }, 0);
        }
    }

    get signatureCanvas(): ElementRef<HTMLCanvasElement> | undefined {
        return this._signatureCanvas;
    }

    private logFactory = inject(LogFactoryService);
    private offerteStore = inject(OfferteTypedStore);
    private messageService = inject(AppMessageService);
    private translate = inject(TranslateService);
    private logger: Logger;

    // Banner state for signature persistence notification
    showSignatureBanner = signal<boolean>(false);
    signatureWasInvalidated = signal<boolean>(false);

    // Banner state for validation errors
    showValidationErrorBanner = signal<boolean>(false);
    validationErrorMessage = signal<string>('');

    // Track if user is currently drawing a signature (for instant checkbox disabling)
    private hasUnconfirmedSignature = signal<boolean>(false);

    // Track if we're in an active drawing session (canvas should stay visible)
    // This is true when user has drawn something in the current session
    // False when loading a confirmed signature from a previous session
    private isActiveDrawingSession = signal<boolean>(false);
    // Track if we need to restore signature once canvas is available
    private needsSignatureRestore: boolean = false;
    // Computed property to check if VTT has rejected the offerte
    isVttRejected = computed(() => {
        const fragebogen = this.offerteStore.currentOfferte()?.fragebogen;
        return fragebogen?.genehmigung_art && GENEHMIGUNG_ART_REJECTED.includes(fragebogen.genehmigung_art);
    });
    private context!: CanvasRenderingContext2D;
    private isDrawing = false;
    private lastX = 0;
    private lastY = 0;
    private deleteButtonBounds = { x: 0, y: 0, size: 0 };

    abschlussData: AbschlussData = {
        unterschrift: '',
        avbBestaetigung: false
    };

    constructor() {
        this.logger = this.logFactory.createLogger('AbschlussComponent');

        // Watch for signature invalidation when offerte data changes
        const checkSignatureInvalidation = () => {
            const meta = this.offerteStore.currentMeta();
            const wasSignedBefore = meta?.signedAt;
            const isSignedNow = meta?.isSigned;

            // If there was a signature before but it's no longer valid, show invalidation message
            if (wasSignedBefore && !isSignedNow && !this.signatureWasInvalidated()) {
                this.logger.warn('[AbschlussComponent] Signature was invalidated due to offerte changes');
                this.signatureWasInvalidated.set(true);
                this.showSignatureBanner.set(true);
            }
        };

        // Run check when component initializes and when offerte changes
        checkSignatureInvalidation();
    }

    // Vollständigkeitsprüfung collapsed state
    vollstaendigkeitCollapsed = false;

    // Computed: Check if all validations pass (no errors)
    allValidationsPassed = computed(() => {
        // Skip validation in read-only mode - always return true
        if (this.viewMode) {
            return true;
        }
        const items = this.validationItems();
        const passed = checkAllValidationsPassed(items);

        // Auto-dismiss validation error banner when all validations pass
        if (passed && this.showValidationErrorBanner()) {
            this.showValidationErrorBanner.set(false);
        }

        return passed;
    });

    // Computed: Get list of validation errors
    validationErrors = computed(() => {
        // Skip validation in read-only mode - always return empty array
        if (this.viewMode) {
            return [];
        }
        const items = this.validationItems();
        return getValidationErrors(items);
    });

    // Computed validation items based on offerte store state
    validationItems = computed<ValidationItem[]>(() => {
        const offerte = this.offerteStore.currentOfferte();

        return validateAbschlussRequirements(offerte?.checkliste, offerte?.fragebogen, this.offerteStore.currentMeta()?.vttTaskCreated === true);
    });

    ngAfterViewInit() {
        // Load existing signature and abschluss data from store first
        this.loadAbschlussDataFromStore();

        this.logger.debug('[AbschlussComponent] ngAfterViewInit - abschlussData:', {
            hasUnterschrift: !!this.abschlussData.unterschrift,
            unterschriftLength: this.abschlussData.unterschrift?.length,
            avbBestaetigung: this.abschlussData.avbBestaetigung,
            isActiveDrawingSession: this.isActiveDrawingSession()
        });

        // Only initialize canvas if it's available (won't be available if physical signature exists)
        if (this.signatureCanvas?.nativeElement) {
            this.initializeCanvas();

            // Restore signature if there's one in abschlussData
            if (this.abschlussData.unterschrift) {
                this.logger.debug('[AbschlussComponent] Restoring signature to canvas...');
                this.restoreSignatureToCanvas(this.abschlussData.unterschrift);
            } else {
                this.logger.debug('[AbschlussComponent] No signature data to restore');
            }
        } else {
            this.logger.debug('[AbschlussComponent] Canvas not available (probably physical signature mode)');
        }
    }

    /**
     * Load abschluss data (including signature) from store
     * Canvas restoration is handled separately in ngAfterViewInit
     */
    private loadAbschlussDataFromStore(): void {
        const offerte = this.offerteStore.currentOfferte();
        const meta = this.offerteStore.currentMeta();
        const metaAbschluss = meta?.abschluss;

        this.logger.debug('[AbschlussComponent] Loading abschluss data from store:', {
            abschluss: metaAbschluss,
            unterschrieben_art: offerte?.unterschrieben_art,
            unterschrieben_am: offerte?.unterschrieben_am
        });

        // Load signature based on unterschrieben_art
        if (offerte?.unterschrieben_art === 'physisch') {
            // Physical signature - set checkbox
            this.abschlussData.avbBestaetigung = true;
            this.abschlussData.unterschrift = ''; // Clear any canvas signature
            this.hasUnconfirmedSignature.set(false); // Clear unconfirmed flag
            this.isActiveDrawingSession.set(false); // Not in an active drawing session
            this.logger.log('[AbschlussComponent] 🔵 Loaded PHYSICAL signature - set avbBestaetigung to TRUE');
            this.logger.debug('[AbschlussComponent] Loaded physical signature from store');
        } else if (offerte?.unterschrieben_art === 'elektronisch') {
            // Digital signature confirmed
            this.abschlussData.avbBestaetigung = false; // Uncheck checkbox
            this.hasUnconfirmedSignature.set(false); // Clear unconfirmed flag (signature is confirmed)
            this.logger.log('[AbschlussComponent] 🟢 Loaded ELECTRONIC signature');

            this.logger.debug('[AbschlussComponent] Loading elektronisch signature:', {
                hasAbschlussObject: !!metaAbschluss,
                hasUnterschrift: !!metaAbschluss?.unterschrift,
                unterschriftLength: metaAbschluss?.unterschrift?.length
            });

            // Check if we have the canvas data - if yes, we're still in the same session
            if (metaAbschluss?.unterschrift) {
                this.abschlussData.unterschrift = metaAbschluss.unterschrift;
                // We have canvas data - keep showing canvas (same session)
                this.isActiveDrawingSession.set(true);
                this.needsSignatureRestore = true;
                this.logger.debug('[AbschlussComponent] Loaded digital signature with canvas data (same session)', {
                    dataLength: metaAbschluss.unterschrift.length
                });
            } else {
                // No canvas data - this is from backend/previous session, show confirmation box
                this.isActiveDrawingSession.set(false);
            }
        } else if (metaAbschluss) {
            // Load from abschluss object if unterschrieben_art not set
            this.logger.log('[AbschlussComponent] 🟡 Loading LEGACY data (no unterschrieben_art)', {
                avbBestaetigung: metaAbschluss.avbBestaetigung,
                hasUnterschrift: !!metaAbschluss.unterschrift
            });
            if (metaAbschluss.avbBestaetigung !== undefined) {
                this.abschlussData.avbBestaetigung = metaAbschluss.avbBestaetigung;
            }

            if (metaAbschluss.unterschrift) {
                this.abschlussData.unterschrift = metaAbschluss.unterschrift;
                this.hasUnconfirmedSignature.set(true);
                this.isActiveDrawingSession.set(true);
            } else {
                this.hasUnconfirmedSignature.set(false);
                this.isActiveDrawingSession.set(false);
            }
            this.logger.debug('Loaded abschluss data from store');
        } else {
            // No signature data at all
            this.logger.log('No signature data found in store');
            this.hasUnconfirmedSignature.set(false);
            this.isActiveDrawingSession.set(false);
        }

        // After loading all data from store, ensure isSigned flag is up-to-date
        // This ensures that when navigating between steps, the isSigned flag reflects the actual state
        this.updateSignedState();
        this.logger.debug('[AbschlussComponent] Called updateSignedState() after loading from store');
    }

    /**
     * Restore a signature image to the canvas from base64 data
     */
    private restoreSignatureToCanvas(signatureData: string): void {
        if (!signatureData || !signatureData.startsWith('data:image')) {
            this.logger.error('[AbschlussComponent] Invalid signature data format:', signatureData?.substring(0, 50));
            return;
        }

        const canvas = this.signatureCanvas?.nativeElement;
        if (!canvas) {
            this.logger.error('[AbschlussComponent] Canvas not available for signature restoration');
            return;
        }

        const img = new Image();

        img.onload = () => {
            try {
                // Clear canvas first
                this.context.clearRect(0, 0, canvas.width, canvas.height);

                // Draw the signature image
                this.context.drawImage(img, 0, 0);

                // Redraw the delete button on top
                this.drawDeleteButton();

                this.logger.debug('Signature successfully restored to canvas');
            } catch (error) {
                this.logger.error('Error drawing signature to canvas:', error);
            }
        };

        img.onerror = (error) => {
            this.logger.error('Failed to load signature image:', error);
            this.logger.error('Image data:', signatureData.substring(0, 100));
        };

        try {
            img.src = signatureData;
        } catch (error) {
            this.logger.error('Error setting image src:', error);
        }
    }

    drawDeleteButton() {
        if (!this.signatureCanvas?.nativeElement) return;

        const canvas = this.signatureCanvas.nativeElement;
        const buttonSize = 40;
        const margin = 10;
        const x = canvas.width - buttonSize - margin;
        const y = canvas.height - buttonSize - margin;

        // Save current context state
        this.context.save();

        // Draw red circle
        this.context.fillStyle = '#ef4444';
        this.context.beginPath();
        this.context.arc(x + buttonSize / 2, y + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2);
        this.context.fill();

        // Draw trash icon (simplified)
        this.context.strokeStyle = '#ffffff';
        this.context.fillStyle = '#ffffff';
        this.context.lineWidth = 2;

        const centerX = x + buttonSize / 2;
        const centerY = y + buttonSize / 2;

        // Trash can body
        this.context.beginPath();
        this.context.rect(centerX - 8, centerY - 4, 16, 14);
        this.context.stroke();

        // Trash can lid
        this.context.beginPath();
        this.context.moveTo(centerX - 10, centerY - 4);
        this.context.lineTo(centerX + 10, centerY - 4);
        this.context.stroke();

        // Trash can handle
        this.context.beginPath();
        this.context.moveTo(centerX - 3, centerY - 4);
        this.context.lineTo(centerX - 3, centerY - 8);
        this.context.lineTo(centerX + 3, centerY - 8);
        this.context.lineTo(centerX + 3, centerY - 4);
        this.context.stroke();

        // Restore context state for drawing
        this.context.restore();

        // Store button position for click detection
        this.deleteButtonBounds = { x, y, size: buttonSize };
    }

    startDrawing(event: MouseEvent | TouchEvent) {
        const coords = this.getCoordinates(event);

        // Check if click is on delete button
        if (this.isClickOnDeleteButton(coords.x, coords.y)) {
            this.clearSignature();
            return;
        }

        this.isDrawing = true;
        this.lastX = coords.x;
        this.lastY = coords.y;
    }

    private isClickOnDeleteButton(x: number, y: number): boolean {
        const btn = this.deleteButtonBounds;
        const centerX = btn.x + btn.size / 2;
        const centerY = btn.y + btn.size / 2;
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        return distance <= btn.size / 2;
    }

    draw(event: MouseEvent | TouchEvent) {
        if (!this.isDrawing) return;

        event.preventDefault();
        const coords = this.getCoordinates(event);

        // Reset context drawing styles before each stroke
        this.context.strokeStyle = '#000000';
        this.context.lineWidth = 2;
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';

        this.context.beginPath();
        this.context.moveTo(this.lastX, this.lastY);
        this.context.lineTo(coords.x, coords.y);
        this.context.stroke();

        this.lastX = coords.x;
        this.lastY = coords.y;

        // Set flags immediately to disable checkbox (instant feedback)
        if (!this.hasUnconfirmedSignature()) {
            this.hasUnconfirmedSignature.set(true);
        }
        if (!this.isActiveDrawingSession()) {
            this.isActiveDrawingSession.set(true);
        }

        // Note: We don't save signature or update store during drawing
        // This will be done in stopDrawing() to avoid excessive updates
    }

    stopDrawing() {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        // Check if all validations pass before allowing signature
        if (!this.allValidationsPassed()) {
            // Clear the signature
            this.clearSignature();

            // Show error banner
            const errors = this.validationErrors();
            this.validationErrorMessage.set(this.translate.instant('fuv.police.messages.signatureValidationFailed'));
            this.showValidationErrorBanner.set(true);

            this.logger.warn('Signature prevented due to validation errors:', errors);
            return;
        }

        // Save signature as base64 now that drawing is complete
        if (this.signatureCanvas?.nativeElement) {
            this.abschlussData.unterschrift = this.signatureCanvas.nativeElement.toDataURL();
            this.logger.debug('[AbschlussComponent] Signature saved after drawing stopped');

            // Persist signature snapshot to meta immediately for session restore
            this.offerteStore.updateMeta(null, {
                abschluss: { ...this.abschlussData },
                isSignedProvisionally: true
            });
        }

        // Update isSigned flag in store (only once per drawing session)
        this.updateSignedState();
    }

    onMouseMove(event: MouseEvent) {
        if (!this.signatureCanvas?.nativeElement) return;

        const coords = this.getCoordinates(event);
        const canvas = this.signatureCanvas.nativeElement;

        if (this.isClickOnDeleteButton(coords.x, coords.y)) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'crosshair';
        }

        if (this.isDrawing) {
            this.draw(event);
        }
    }

    clearSignature() {
        if (!this.signatureCanvas?.nativeElement) return;

        const canvas = this.signatureCanvas.nativeElement;
        this.context.clearRect(0, 0, canvas.width, canvas.height);
        this.abschlussData.unterschrift = '';

        // Clear both flags
        this.hasUnconfirmedSignature.set(false);
        this.isActiveDrawingSession.set(false);

        // Redraw the delete button
        this.drawDeleteButton();

        // Update isSigned flag in store when signature is cleared
        this.updateSignedState();
    }
    private getCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } {
        if (!this.signatureCanvas?.nativeElement) {
            return { x: 0, y: 0 };
        }

        const canvas = this.signatureCanvas.nativeElement;
        const rect = canvas.getBoundingClientRect();

        if (event instanceof MouseEvent) {
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
        } else {
            const touch = event.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }
    }

    printOffertantrag() {
        this.logger.debug('Printing Offertantrag from Abschluss component...');

        // Get the current offerte to validate
        const offerte = this.offerteStore.currentOfferte();
        if (!offerte) {
            this.logger.error('Cannot print Offertantrag - no offerte in store');
            return;
        }

        // Emit event to parent component to handle the actual printing
        // The parent (PoliceComponent) has the full print logic with task dialog
        this.printOffertantragRequested.emit();
    }

    onDataChange() {
        // Check if user is trying to sign with validation errors
        if (this.abschlussData.avbBestaetigung && !this.allValidationsPassed()) {
            // Prevent signing - uncheck the checkbox
            this.abschlussData.avbBestaetigung = false;

            // Show error banner
            const errors = this.validationErrors();
            this.validationErrorMessage.set(this.translate.instant('fuv.police.messages.signatureValidationFailed'));
            this.showValidationErrorBanner.set(true);

            this.logger.warn('Signing prevented due to validation errors:', errors);
            return;
        }

        // Emit data changes if needed in the future
        this.logger.debug('Abschluss data changed:', this.abschlussData);

        // Update isSigned flag when AVB confirmation changes
        this.updateSignedState();
    }

    /**
     * Update the isSigned flag in the store based on current signature/confirmation state
     * Only updates store - backend persistence happens on step navigation or manual save
     */
    private updateSignedState(): void {
        // Do not modify signature state in read-only mode
        if (this.viewMode || this.offerteStore.currentMeta()?.isReadOnly) {
            this.logger.debug('[AbschlussComponent] Read-only mode - skipping updateSignedState');
            return;
        }

        const hasDigitalSignature = !!(this.abschlussData.unterschrift && this.abschlussData.unterschrift.trim().length > 0);
        const hasPhysicalReturn = this.abschlussData.avbBestaetigung;
        const isSigned = hasDigitalSignature || hasPhysicalReturn;

        this.logger.log('[AbschlussComponent] updateSignedState() - Calculating isSigned:', {
            hasDigitalSignature,
            hasPhysicalReturn,
            isSigned,
            unterschriftLength: this.abschlussData.unterschrift?.length,
            avbBestaetigung: this.abschlussData.avbBestaetigung
        });

        // Include timestamp and signature type when signing
        const signedAt = isSigned ? new Date().toISOString() : undefined;
        const unterschrieben_am = isSigned ? new Date().toISOString().split('T')[0] : undefined; // ISO date: YYYY-MM-DD
        const unterschrieben_art = hasDigitalSignature ? 'elektronisch' : hasPhysicalReturn ? 'physisch' : undefined;

        // Persist signature info to metadata only (keep backend clean until policieren)
        const status = hasDigitalSignature
            ? OFFERTE_STATUS_SIGNED_ELECTRONICALLY
            : hasPhysicalReturn
              ? OFFERTE_STATUS_SIGNED_PHYSICALLY
              : undefined;

        this.offerteStore.updateMeta(null, {
            isSigned,
            isSignedProvisionally: isSigned,
            signedAt,
            abschluss: {
                ...this.abschlussData,
                unterschrieben_am,
                unterschrieben_art,
                status
            }
        });

        this.logger.log('[AbschlussComponent] ✅ Updated store with isSigned flag:', {
            isSigned,
            unterschrieben_art,
            unterschrieben_am,
            signedAt,
            status
        });

        this.logger.debug('[AbschlussComponent] Updated isSigned flag and abschluss data in store:', {
            isSigned,
            unterschrieben_art,
            hasUnterschriftData: !!this.abschlussData.unterschrift,
            unterschriftLength: this.abschlussData.unterschrift?.length,
            hasDigitalSignature,
            hasPhysicalReturn,
            signedAt,
            status,
            unterschrieben_am
        });

        // Don't show banner when signing - only when invalidated
        // Reset invalidation flag if we're signing again
        if (isSigned && this.signatureWasInvalidated()) {
            this.signatureWasInvalidated.set(false);
            this.showSignatureBanner.set(false);
        }
    }

    /**
     * Dismiss the signature banner
     */
    dismissSignatureBanner(): void {
        this.showSignatureBanner.set(false);
    }

    /**
     * Dismiss the validation error banner
     */
    dismissValidationErrorBanner(): void {
        this.showValidationErrorBanner.set(false);
    }

    /**
     * Computed: Check if physical signature (checkbox) is selected
     * Based on store unterschrieben_art to ensure reactivity
     */
    hasPhysicalSignature = computed(() => {
        const metaSig = this.offerteStore.currentMeta()?.abschluss?.unterschrieben_art;
        const offerte = this.offerteStore.currentOfferte();
        return metaSig ? metaSig === 'physisch' : offerte?.unterschrieben_art === 'physisch';
    });

    /**
     * Computed: Check if digital signature is confirmed (saved to store)
     * Only based on store unterschrieben_art - not on local drawing state
     */
    hasDigitalSignature = computed(() => {
        const metaSig = this.offerteStore.currentMeta()?.abschluss?.unterschrieben_art;
        const offerte = this.offerteStore.currentOfferte();
        return metaSig ? metaSig === 'elektronisch' : offerte?.unterschrieben_art === 'elektronisch';
    });

    /**
     * Computed: Check if user is currently drawing/has drawn a signature (not yet confirmed)
     * This is used to disable the checkbox while drawing
     */
    isDrawingSignature = computed(() => {
        return this.hasUnconfirmedSignature();
    });

    /**
     * Computed: Check if we should show the confirmation box (not the canvas)
     * Only show confirmation when signature is confirmed in store AND we're not in an active drawing session
     * This happens when loading a previously saved signature where we don't persist the canvas image
     */
    shouldShowDigitalConfirmation = computed(() => {
        const metaSig = this.offerteStore.currentMeta()?.abschluss?.unterschrieben_art;
        const offreteSig = this.offerteStore.currentOfferte()?.unterschrieben_art;
        const hasConfirmedSignature = metaSig ? metaSig === 'elektronisch' : offreteSig === 'elektronisch';

        // Show confirmation box only if signature is confirmed AND we're NOT in an active drawing session
        // During the same session (after drawing but before navigating away), we keep showing the canvas
        // After reloading the offerte, we show the confirmation box instead
        return hasConfirmedSignature && !this.isActiveDrawingSession();
    });

    /**
     * Computed: Get the signature timestamp from store
     */
    signatureTimestamp = computed(() => {
        const meta = this.offerteStore.currentMeta();
        return meta?.signedAt || null;
    });

    /**
     * Discard physical signature (uncheck the checkbox)
     */
    discardPhysicalSignature(): void {
        this.logger.debug('[AbschlussComponent] Discarding physical signature');
        this.abschlussData.avbBestaetigung = false;
        this.onDataChange();

        // Note: Canvas will be recreated by *ngIf and ViewChild setter will initialize it automatically
        // No need for manual initialization here
    }

    /**
     * Revoke/discard digital signature (clear the canvas)
     */
    revokeDigitalSignature(): void {
        this.logger.debug('[AbschlussComponent] Revoking digital signature');

        // Clear the signature data
        this.abschlussData.unterschrift = '';

        // Clear both flags
        this.hasUnconfirmedSignature.set(false);
        this.isActiveDrawingSession.set(false);

        // Update the store to remove the signature
        this.updateSignedState();

        // Note: Canvas will be recreated by *ngIf and ViewChild setter will initialize it automatically
        // No need for manual initialization here
    } /**
     * Initialize or reinitialize the canvas
     */
    private initializeCanvas(): void {
        if (!this.signatureCanvas?.nativeElement) {
            return;
        }

        // Don't reinitialize if we're actively drawing - this would clear the canvas
        if (this.isDrawing) {
            this.logger.debug('[AbschlussComponent] Skipping canvas initialization - currently drawing');
            return;
        }

        const canvas = this.signatureCanvas.nativeElement;

        // Check if canvas is already initialized with correct size
        // Only reinitialize if size changed or context doesn't exist
        const needsResize = !this.context || canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight;

        if (!needsResize) {
            this.logger.debug('[AbschlussComponent] Canvas already initialized, skipping');
            return;
        }

        this.context = canvas.getContext('2d')!;

        // Set canvas size (this automatically clears the canvas!)
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Set drawing styles
        this.context.strokeStyle = '#000000';
        this.context.lineWidth = 2;
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';

        // Draw the delete button
        this.drawDeleteButton();

        this.logger.debug('[AbschlussComponent] Canvas initialized/reinitialized');
    }

    /**
     * Get formatted signature date (YYYY.MM.DD format)
     */
    getFormattedSignatureDate(): string | null {
        const metaDate = this.offerteStore.currentMeta()?.abschluss?.unterschrieben_am;
        const offerte = this.offerteStore.currentOfferte();
        const unterschriebenAm = metaDate || offerte?.unterschrieben_am;

        return unterschriebenAm ? unterschriebenAm.replace(/-/g, '.') : null;
    }

    /**
     * Check if step is valid and ready to proceed:
     * - Must have digital signature OR physical return confirmation
     */
    isStepValid(): boolean {
        // Skip validation in read-only mode - always return true
        if (this.viewMode) {
            return true;
        }

        const isValid = validateAbschlussStep(this.abschlussData.unterschrift, this.abschlussData.avbBestaetigung);

        this.logger.debug('[AbschlussComponent] Step validation:', {
            hasDigitalSignature: !!this.abschlussData.unterschrift,
            hasPhysicalReturn: !!this.abschlussData.avbBestaetigung,
            isValid
        });

        return isValid;
    }
}
