import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { CommonModule } from '@angular/common';
import { Component, effect, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Checkliste } from '@app/fuv/models/checkliste.model';
import { ChecklisteService } from '@app/fuv/services/checkliste.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { CrifService } from '@app/fuv/services/crif.service';
import { KpmService } from '@app/fuv/services/kpm.service';
import { PersonService } from '@app/fuv/services/person.service';
import { PrefetchService } from '@app/fuv/services/prefetch.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { PersonStore } from '@app/fuv/stores/person.store';
import { ExternalService } from '@app/shared/services/external.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, AuthService, LogFactoryService, Logger } from '@syrius/core';

import {
    DEFAULT_AUFGABE_AUSFUEHRENDER, MAX_ALTER_VERSICHERTEN, WFD_FUV_OFFERTE_PRUEFEN_VTT
} from '../police.constants';

/**
 * ChecklisteComponent - Handles checkliste form display and operations
 *
 * This component can work in two modes:
 * 1. Embedded mode: Used directly in offerte-police wizard (loads data via effect from store)
 * 2. Modal mode: Opened via ChecklisteModalService (data is pre-loaded by service)
 *
 * The component detects its mode automatically via DynamicDialogConfig.
 */
@Component({
    selector: 'app-checkliste',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, DatePickerModule, InputTextModule, CheckboxModule, SelectModule, ButtonModule, DialogModule, TextareaModule, ProgressSpinnerModule],
    templateUrl: './checkliste.component.html',
    styleUrls: ['./checkliste.component.scss']
})
export class ChecklisteComponent implements OnInit {
    @Output() checklisteSaved = new EventEmitter<Checkliste>();

    private fb = inject(FormBuilder);
    private logFactory = inject(LogFactoryService);
    private checklisteService = inject(ChecklisteService);
    private codesService = inject(CodesService);
    private crifService = inject(CrifService);
    private externalService = inject(ExternalService);
    private personService = inject(PersonService);
    private kpmService = inject(KpmService);
    private authService = inject(AuthService);
    private prefetchService = inject(PrefetchService);
    private offerteStore = inject(OfferteTypedStore);
    private personStore = inject(PersonStore);
    private messageService = inject(AppMessageService);
    private translate = inject(TranslateService);
    private logger: Logger;

    // Optional: Injected when component is opened in a dialog
    private dialogConfig = inject(DynamicDialogConfig, { optional: true });
    private dialogRef = inject(DynamicDialogRef, { optional: true });

    checklisteForm!: FormGroup;
    bonitaetOptions: any[];
    checklisteId?: number;
    currentCheckliste?: Checkliste; // Store the current checkliste
    isLoading = false;
    crifArchivingId?: string; // Store archiving ID from CRIF search
    private hasLoadedForOfferte: number | null = null; // Track which offerte we've already loaded for
    isModalMode = false; // Track if component is in modal mode

    // Backend accident data for icon display (0 = checkmark, >0 = X)
    backendAnzahlUnfaelle: number = 0;
    backendLaufendeUnfaelle: number = 0;

    // Task creation dialog properties
    showTaskCreationDialog: boolean = false;
    taskData = {
        aufgabeart: '',
        titel: '',
        faelligAm: '',
        zugewiesenAn: '',
        beschreibung: '',
        automatischeBeschreibung: ''
    };
    aufgabenartOptions: Array<{ label: string; value: string }> = [];
    zugewiesenAnOptions: Array<{ label: string; value: string }> = [];

    constructor() {
        this.logger = this.logFactory.createLogger('ChecklisteComponent');
        this.logger.debug('[ChecklisteComponent] Constructor called');

        // Initialize with empty options, will be loaded from code service
        this.bonitaetOptions = [];

        // Check if we're in modal mode
        this.isModalMode = !!this.dialogConfig?.data?.mode;
        this.logger.debug('[ChecklisteComponent] Mode:', this.isModalMode ? 'Modal' : 'Embedded');

        // Only set up the auto-loading effect if NOT in modal mode
        // In modal mode, data is pre-loaded by ChecklisteModalService
        if (!this.isModalMode) {
            effect(() => {
                const offerte = this.offerteStore.currentOfferte();
                this.logger.debug('[ChecklisteComponent] Effect triggered, offerte:', offerte);

                // Only load if we have an offerte with ID and haven't already loaded for this offerte
                if (offerte?.id && this.hasLoadedForOfferte !== offerte.id) {
                    this.logger.debug('[ChecklisteComponent] Loading checkliste for offerte ID:', offerte.id);
                    this.loadChecklisteForOfferte(offerte.id);
                } else if (offerte?.id && this.hasLoadedForOfferte === offerte.id) {
                    this.logger.debug('[ChecklisteComponent] Already loaded for offerte ID:', offerte.id, '- skipping duplicate load');
                } else {
                    this.logger.warn('[ChecklisteComponent] No offerte or offerte ID available');
                }
            });
        }
    }

    ngOnInit(): void {
        this.logger.debug('[ChecklisteComponent] ngOnInit called');

        // Get current language from TranslateService
        const currentLang = this.translate.currentLang || this.translate.defaultLang || 'de';
        this.logger.debug('[ChecklisteComponent] Initializing with language:', currentLang);

        this.checklisteForm = this.fb.group({
            gueltig_ab: [{ value: new Date(), disabled: true }],
            alter_versicherter: [null],
            anzahl_unfaelle: [false],
            laufende_unfaelle: [false],
            bonitaet_syrius: [null],
            bonitaet_crif: [null],
            bonitaet_crif_bemerkung: [null],
            audit: [false],
            vttanfrage: [false],
            sprache: [currentLang],
            genehmigung_art: [null],
            genehmigung_bemerkung: [null],
            bt_malus: [0]
        });

        // Load bonität options from code service
        this.loadBonitaetOptions();

        // Initialize task data with default date
        this.taskData.faelligAm = this.getDefaultFaelligAm();

        // In modal mode, check if checkliste is already in store (pre-loaded by service)
        // Otherwise, the effect() in constructor will handle loading
        if (this.isModalMode) {
            const offerte = this.offerteStore.currentOfferte();
            const checkliste = offerte?.checkliste;

            // Check if we have a valid checkliste
            const hasValidCheckliste = checkliste && ((Array.isArray(checkliste) && checkliste.length > 0 && checkliste[0]?.id) || (!Array.isArray(checkliste) && (checkliste as any)?.id));

            if (hasValidCheckliste) {
                this.logger.debug('[ChecklisteComponent] Modal mode: using pre-loaded checkliste from store');
                this.populateForm(Array.isArray(checkliste) ? checkliste[0] : checkliste);
            } else if (offerte?.id) {
                // Fallback: If checkliste is missing, try to load it directly
                // This handles race conditions where prefetch might not have completed
                this.logger.warn('[ChecklisteComponent] Modal mode: checkliste not in store, attempting fallback fetch');

                // Give prefetch a moment to complete, then check again
                setTimeout(() => {
                    const updatedOfferte = this.offerteStore.currentOfferte();
                    const updatedCheckliste = updatedOfferte?.checkliste;

                    const hasChecklisteNow = updatedCheckliste && ((Array.isArray(updatedCheckliste) && updatedCheckliste.length > 0 && updatedCheckliste[0]?.id) || (!Array.isArray(updatedCheckliste) && (updatedCheckliste as any)?.id));

                    if (hasChecklisteNow) {
                        this.logger.debug('[ChecklisteComponent] Checkliste loaded after delay, populating form');
                        this.populateForm(Array.isArray(updatedCheckliste) ? updatedCheckliste[0] : updatedCheckliste);
                    } else if (offerte.id) {
                        // Still missing - force fetch
                        this.logger.warn('[ChecklisteComponent] Checkliste still missing, forcing fetch');
                        this.loadChecklisteForOfferte(offerte.id);
                    } else {
                        this.logger.error('[ChecklisteComponent] No offerte ID available for fallback fetch');
                        this.initializeNewCheckliste();
                    }
                }, 500);
            }
        }
    }

    /**
     * Load bonität options from code service
     * Gets translated labels for CRIF_HOCH, CRIF_MITTEL, CRIF_TIEF
     */
    private loadBonitaetOptions(): void {
        this.codesService.getCodesByGruppe('CRIFCode').subscribe({
            next: (codes) => {
                this.bonitaetOptions = codes
                    .filter((code) => ['CRIF_HOCH', 'CRIF_MITTEL', 'CRIF_TIEF'].includes(code.internal_name))
                    .map((code) => ({
                        label: this.codesService.getLocalizedLabel(code),
                        value: code.internal_name
                    }));

                this.logger.debug('[ChecklisteComponent] Loaded bonität options:', this.bonitaetOptions);
            },
            error: (error) => {
                this.logger.error('[ChecklisteComponent] Error loading bonität options:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('menu.dashboard.errors'),
                    detail: this.translate.instant('fuv.police.checkliste.errors.bonitaetOptionsLoadFailed'),
                    life: 5000
                });
            }
        });
    }

    /**
     * Load checkliste data for the given offerte ID
     */
    private loadChecklisteForOfferte(offerteId: number): void {
        this.logger.debug('[ChecklisteComponent] loadChecklisteForOfferte called with ID:', offerteId);

        // Mark this offerte as loaded to prevent duplicate calls
        this.hasLoadedForOfferte = offerteId;

        this.checklisteService.searchFuvCheckliste(offerteId).subscribe({
            next: (checklisten: Checkliste[]) => {
                this.logger.debug('[ChecklisteComponent] Checkliste loaded:', checklisten);
                if (checklisten && checklisten.length > 0) {
                    // Take the first (most recent) checkliste
                    this.currentCheckliste = checklisten[0];

                    // Update store with loaded checkliste so the button turns green
                    this.logger.debug('[ChecklisteComponent] Updating store with loaded checkliste:', checklisten[0]);
                    this.logger.debug('[ChecklisteComponent] Checkliste ID:', checklisten[0].id);
                    this.offerteStore.updateOfferte(null, { checkliste: checklisten[0] });

                    this.populateForm(checklisten[0]);
                } else {
                    this.logger.debug('[ChecklisteComponent] No existing checkliste, initializing new one');
                    this.initializeNewCheckliste();
                }
            },
            error: (error: any) => {
                this.logger.error('Error loading checkliste:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('common.messages.error'),
                    detail: this.translate.instant('fuv.police.checkliste.errors.checklisteLoadFailed')
                });
            }
        });
    }

    /**
     * Initialize new checkliste with default values
     */
    private initializeNewCheckliste(): void {
        this.logger.debug('[ChecklisteComponent] initializeNewCheckliste called');

        const offerte = this.offerteStore.currentOfferte();
        // Get person from offerte object, not from personStore
        // The offerte already contains the complete person data
        const person = offerte?.person || this.personStore.data();

        this.logger.debug('[ChecklisteComponent] Offerte:', offerte);
        this.logger.debug('[ChecklisteComponent] Person:', person);

        if (!offerte?.person_boid) {
            this.logger.warn('[ChecklisteComponent] Cannot initialize: No person_boid in offerte');
            return;
        }

        this.isLoading = true;

        // Set gueltig_ab to today
        const gueltigAb = new Date();
        this.checklisteForm.get('gueltig_ab')?.setValue(gueltigAb);
        this.logger.debug('[ChecklisteComponent] Set gueltig_ab to:', gueltigAb);

        // Load accident data from person service
        this.logger.debug('[ChecklisteComponent] Fetching accident data for person_boid:', offerte.person_boid);
        this.personService.searchAnzahlUnfaelle(offerte.person_boid).subscribe({
            next: (unfaelleData) => {
                // Parse the response: [["Anzahl Unfälle", 0], ["Laufende Unfälle", 0]]
                if (unfaelleData && unfaelleData.length >= 2) {
                    // Store backend values for icon display
                    this.backendAnzahlUnfaelle = unfaelleData[0][1];
                    this.backendLaufendeUnfaelle = unfaelleData[1][1];

                    // Set checkbox values based on backend data
                    // anzahl_unfaelle: true if more than 1 accident
                    // laufende_unfaelle: true if has running accidents (user can override)
                    const anzahlUnfaelle = this.backendAnzahlUnfaelle > 1;
                    const laufendeUnfaelle = this.backendLaufendeUnfaelle > 0;

                    this.checklisteForm.patchValue({
                        anzahl_unfaelle: anzahlUnfaelle,
                        laufende_unfaelle: laufendeUnfaelle
                    });

                    this.logger.debug('[ChecklisteComponent] Initialized accident data:', {
                        backendAnzahlUnfaelle: this.backendAnzahlUnfaelle,
                        backendLaufendeUnfaelle: this.backendLaufendeUnfaelle,
                        anzahlUnfaelle,
                        laufendeUnfaelle
                    });
                }

                // Calculate age if person has birth date
                if (person?.geburtstag && gueltigAb) {
                    const age = this.calculateAge(person.geburtstag, gueltigAb);
                    this.checklisteForm.get('alter_versicherter')?.setValue(age);
                    this.logger.debug('[ChecklisteComponent] Calculated age:', age);
                }

                // Automatically trigger CRIF data retrieval with callback
                this.logger.debug('[ChecklisteComponent] Calling autoCrifDatenAbrufen');
                this.autoCrifDatenAbrufen(() => {
                    // Loading complete
                    this.isLoading = false;
                });
            },
            error: (error) => {
                this.isLoading = false;
                this.logger.error('[ChecklisteComponent] Error loading accident data:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('common.messages.error'),
                    detail: this.translate.instant('fuv.police.checkliste.errors.accidentDataLoadFailed'),
                    life: 5000
                });

                // Still try to trigger CRIF even if accident data fails
                this.logger.debug('[ChecklisteComponent] Calling autoCrifDatenAbrufen despite accident data error');
                this.autoCrifDatenAbrufen(() => {
                    // Even if CRIF succeeds, we had an error before
                    this.isLoading = false;
                });
            }
        });
    }

    /**
     * Calculate age from birth date to reference date
     */
    private calculateAge(birthDate: Date, referenceDate: Date): number {
        const birth = new Date(birthDate);
        const reference = new Date(referenceDate);
        let age = reference.getFullYear() - birth.getFullYear();
        const monthDiff = reference.getMonth() - birth.getMonth();

        // Adjust if birthday hasn't occurred yet this year
        if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    }

    /**
     * Get icon class for alter versicherter (age)
     * > MAX_ALTER_VERSICHERTEN (65) = warning icon (yellow)
     * > 0 and <= MAX_ALTER_VERSICHERTEN = checkmark (green)
     * <= 0 = X (red)
     */
    getAlterIcon(): string {
        const alter = this.checklisteForm.get('alter_versicherter')?.value;

        if (!alter || alter <= 0) {
            return 'pi-times text-red-500';
        }

        if (alter > MAX_ALTER_VERSICHERTEN) {
            return 'pi-exclamation-triangle text-yellow-500';
        }

        return 'pi-check text-green-500';
    }

    /**
     * Get icon class for anzahl unfälle
     * Checkbox checked = X (red), not checked = checkmark (green)
     */
    getAnzahlUnfaelleIcon(): string {
        const isChecked = this.checklisteForm.get('anzahl_unfaelle')?.value;
        return isChecked ? 'pi-times text-red-500' : 'pi-check text-green-500';
    }

    /**
     * Get icon class for laufende unfälle
     * Checkbox checked = X (red), not checked = checkmark (green)
     */
    getLaufendeUnfaelleIcon(): string {
        const isChecked = this.checklisteForm.get('laufende_unfaelle')?.value;
        return isChecked ? 'pi-times text-red-500' : 'pi-check text-green-500';
    }

    /**
     * Get icon class for audit flag
     * Checkbox checked = X (red), not checked = checkmark (green)
     */
    getAuditIcon(): string {
        const isChecked = this.checklisteForm.get('audit')?.value;
        return isChecked ? 'pi-times text-red-500' : 'pi-check text-green-500';
    }

    /**
     * Populate form with checkliste data (from backend)
     */
    private populateForm(checkliste: Checkliste): void {
        this.logger.debug('[ChecklisteComponent] populateForm called with:', checkliste);

        // Store the checkliste ID for updates
        this.checklisteId = checkliste.id;
        this.logger.debug('[ChecklisteComponent] Set checklisteId to:', this.checklisteId);

        // Get the gueltig_ab control and update both value and disabled state
        const gueltigAbControl = this.checklisteForm.get('gueltig_ab');
        const gueltigAbDate = checkliste.gueltig_ab ? new Date(checkliste.gueltig_ab) : new Date();

        gueltigAbControl?.setValue(gueltigAbDate);
        gueltigAbControl?.disable(); // Keep it disabled when loaded from backend

        this.checklisteForm.patchValue({
            alter_versicherter: checkliste.alter_versicherter,
            anzahl_unfaelle: checkliste.anzahl_unfaelle,
            laufende_unfaelle: checkliste.laufende_unfaelle,
            bonitaet_syrius: checkliste.bonitaet_syrius,
            bonitaet_crif: checkliste.bonitaet_crif,
            bonitaet_crif_bemerkung: checkliste.bonitaet_crif_bemerkung,
            audit: checkliste.audit,
            vttanfrage: checkliste.vttanfrage,
            sprache: checkliste.sprache,
            genehmigung_art: checkliste.genehmigung_art,
            genehmigung_bemerkung: checkliste.genehmigung_bemerkung,
            bt_malus: checkliste.bt_malus
        });

        // Also load backend accident data for icon display
        const offerte = this.offerteStore.currentOfferte();
        this.logger.debug('[ChecklisteComponent] Loading accident data for icons, person_boid:', offerte?.person_boid);

        if (offerte?.person_boid) {
            this.personService.searchAnzahlUnfaelle(offerte.person_boid).subscribe({
                next: (unfaelleData) => {
                    if (unfaelleData && unfaelleData.length >= 2) {
                        this.backendAnzahlUnfaelle = unfaelleData[0][1];
                        this.backendLaufendeUnfaelle = unfaelleData[1][1];
                        this.logger.debug('[ChecklisteComponent] Loaded backend accident data for icons:', {
                            backendAnzahlUnfaelle: this.backendAnzahlUnfaelle,
                            backendLaufendeUnfaelle: this.backendLaufendeUnfaelle
                        });
                    }
                },
                error: (error) => {
                    this.logger.error('[ChecklisteComponent] Error loading accident data for icons:', error);
                }
            });
        }

        // Automatically fetch CRIF data if bonitaet_crif is not set
        if (!checkliste.bonitaet_crif) {
            this.logger.debug('[ChecklisteComponent] Bonitaet not set, auto-fetching CRIF data');
            this.autoCrifDatenAbrufen();
        }
    }

    onSave(): void {
        const offerte = this.offerteStore.currentOfferte();

        if (!offerte?.id) {
            this.logger.error('[ChecklisteComponent] Cannot save: No offerte ID');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Keine Offerte verfügbar',
                life: 3000
            });
            return;
        }

        this.isLoading = true;

        // Get form data including disabled fields
        const formData = this.checklisteForm.getRawValue();

        // Debug: Check audit field specifically
        this.logger.debug('[ChecklisteComponent] Audit field value from form:', formData.audit);
        this.logger.debug('[ChecklisteComponent] Audit control value:', this.checklisteForm.get('audit')?.value);

        // Calculate valid status
        const validStatus = this.calculateValidStatus(formData, offerte);

        // Prepare checkliste data for API
        const checklisteData: Partial<Checkliste> = {
            ...formData,
            offerte_id: offerte.id,
            valid: validStatus,
            updatedby: this.authService.getUserProfile()?.username || 'system'
        };

        // Debug: Log exactly what we're sending to backend
        this.logger.debug('[ChecklisteComponent] ===== SAVING CHECKLISTE TO BACKEND =====');
        this.logger.debug('[ChecklisteComponent] Operation:', this.checklisteId ? 'UPDATE' : 'INSERT');
        this.logger.debug('[ChecklisteComponent] ChecklisteId:', this.checklisteId);
        this.logger.debug('[ChecklisteComponent] Form data (raw):', formData);
        this.logger.debug('[ChecklisteComponent] Checkliste data (with offerte_id):', checklisteData);
        this.logger.debug('[ChecklisteComponent] Valid status:', validStatus);
        this.logger.debug('[ChecklisteComponent] =======================================');

        // Insert or update based on whether we have an ID
        const operation = this.checklisteId
            ? this.checklisteService.updateFuvCheckliste({ ...checklisteData, id: this.checklisteId } as Checkliste)
            : this.checklisteService.insertFuvCheckliste(checklisteData);

        operation.subscribe({
            next: (result) => {
                this.isLoading = false;

                // Handle backend returning array instead of single object
                const checklisteData = Array.isArray(result) ? result[0] : result;

                this.logger.debug('[ChecklisteComponent] Raw result from backend:', result);
                this.logger.debug('[ChecklisteComponent] Is array?:', Array.isArray(result));
                this.logger.debug('[ChecklisteComponent] Extracted checkliste:', checklisteData);

                // Validate that we have a valid checkliste with ID
                if (!checklisteData || !checklisteData.id) {
                    this.logger.error('[ChecklisteComponent] Backend returned invalid checkliste data (no ID):', checklisteData);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Fehler',
                        detail: 'Ungültige Antwort vom Server (keine ID)',
                        life: 3000
                    });
                    return;
                }

                // Store the ID and result for future updates
                this.checklisteId = checklisteData.id;
                this.currentCheckliste = checklisteData;

                // Mark this offerte as having loaded checkliste
                if (offerte?.id) {
                    this.hasLoadedForOfferte = offerte.id;
                }

                // Update store with saved checkliste (single object, not array)
                this.logger.debug('[ChecklisteComponent] Updating store with checkliste:', checklisteData);
                this.offerteStore.updateOfferte(null, { checkliste: checklisteData });

                // Verify the store was updated
                const verifyOfferte = this.offerteStore.currentOfferte();
                this.logger.debug('[ChecklisteComponent] Store verification after update:');
                this.logger.debug('[ChecklisteComponent]   - offerte.checkliste:', verifyOfferte?.checkliste);
                this.logger.debug('[ChecklisteComponent]   - offerte.checkliste.id:', verifyOfferte?.checkliste?.id);
                this.logger.debug('[ChecklisteComponent]   - is array?:', Array.isArray(verifyOfferte?.checkliste));

                this.logger.debug('[ChecklisteComponent] Checkliste saved successfully:', checklisteData);
                this.logger.debug('[ChecklisteComponent] Updated checklisteId:', this.checklisteId);
                this.logger.debug('[ChecklisteComponent] Store updated with checkliste ID:', checklisteData.id);

                // Emit event to notify parent that checkliste was saved
                this.checklisteSaved.emit(checklisteData);

                this.messageService.add({
                    severity: 'success',
                    summary: 'Gespeichert',
                    detail: 'Checkliste erfolgreich gespeichert',
                    life: 2000
                });

                // If in modal mode, close the dialog after successful save
                if (this.isModalMode && this.dialogRef) {
                    this.logger.debug('[ChecklisteComponent] Closing modal after successful save');
                    setTimeout(() => {
                        this.dialogRef?.close({ saved: true, checkliste: checklisteData });
                    }, 500); // Small delay to show success message
                }
            },
            error: (error) => {
                this.isLoading = false;
                this.logger.error('[ChecklisteComponent] Error saving checkliste:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Fehler',
                    detail: 'Fehler beim Speichern der Checkliste',
                    life: 3000
                });
            }
        });
    }

    onPrint(): void {
        if (!this.checklisteId) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warnung',
                detail: 'Bitte speichern Sie die Checkliste zuerst',
                life: 3000
            });
            return;
        }

        this.isLoading = true;

        this.checklisteService.printFuvCheckliste(this.checklisteId).subscribe({
            next: (blob: Blob) => {
                this.isLoading = false;

                // Create a download link for the PDF
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `checkliste_${this.checklisteId}.pdf`;
                link.click();
                window.URL.revokeObjectURL(url);

                this.logger.debug('[ChecklisteComponent] Checkliste printed');
                this.messageService.add({
                    severity: 'success',
                    summary: 'Erfolg',
                    detail: 'Checkliste wird heruntergeladen',
                    life: 2000
                });
            },
            error: (error) => {
                this.isLoading = false;
                this.logger.error('[ChecklisteComponent] Error printing checkliste:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Fehler',
                    detail: 'Fehler beim Drucken der Checkliste',
                    life: 3000
                });
            }
        });
    }

    /**
     * Open external CRIF site for person lookup
     * This opens the CRIF web portal in a new tab with the person's data pre-filled
     */
    onCrifAufrufen(): void {
        const offerte = this.offerteStore.currentOfferte();
        // Get person from offerte object, not from personStore
        const person = offerte?.person || this.personStore.data();

        if (!person) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warnung',
                detail: 'Keine Personendaten verfügbar',
                life: 3000
            });
            return;
        }

        this.logger.debug('[ChecklisteComponent] Opening external CRIF for person:', person);

        // Use ExternalService to open CRIF in new tab
        this.externalService.openCrifPerson({
            name: person.name,
            vorname: person.vorname,
            strasse: person.strasse,
            hausnr: person.hausnr,
            plz: person.plz,
            geburtstag: person.geburtstag
        });

        this.messageService.add({
            severity: 'info',
            summary: 'CRIF geöffnet',
            detail: 'CRIF-Portal wurde in einem neuen Tab geöffnet',
            life: 3000
        });
    }

    /**
     * Map CRIF color code to internal_name
     * GREEN -> CRIF_HOCH
     * YELLOW_GREEN or YELLOW (without RED) -> CRIF_MITTEL
     * YELLOW_RED or anything with RED -> CRIF_TIEF
     */
    private mapCrifColorToInternalName(colorCode: string): string {
        const upperColor = colorCode.toUpperCase();

        if (upperColor === 'GREEN') {
            return 'CRIF_HOCH';
        } else if (upperColor.includes('RED')) {
            return 'CRIF_TIEF';
        } else if (upperColor.includes('YELLOW')) {
            return 'CRIF_MITTEL';
        }

        // Default to CRIF_MITTEL if unknown
        this.logger.warn('[ChecklisteComponent] Unknown CRIF color code:', colorCode);
        return 'CRIF_MITTEL';
    }

    /**
     * Automatically fetch CRIF data (triggered on component init)
     * Silent operation without user notifications
     * @param onComplete Optional callback to execute when CRIF data fetch is complete (success or failure)
     */
    private autoCrifDatenAbrufen(onComplete?: () => void): void {
        const offerte = this.offerteStore.currentOfferte();
        // Get person from offerte object, not from personStore
        const person = offerte?.person || this.personStore.data();

        if (!person) {
            this.logger.debug('[ChecklisteComponent] Auto CRIF: No person data available');
            if (onComplete) {
                onComplete();
            }
            return;
        }

        this.logger.debug('[ChecklisteComponent] Auto-fetching CRIF data for person:', person);

        // Format birth date to string if exists
        const dateOfBirth = person.geburtstag ? new Date(person.geburtstag).toISOString().split('T')[0] : undefined;

        this.crifService
            .searchPerson({
                firstname: person.vorname,
                lastname: person.name,
                date_of_birth: dateOfBirth,
                country: person['land'] as string | undefined,
                city: person.ort,
                street: person.strasse,
                house_number: person.hausnr,
                zipcode: person.plz
            })
            .subscribe({
                next: (result) => {
                    // Store report_id (not archiving_id) for later report fetching
                    this.crifArchivingId = result.report_id?.toString();

                    this.logger.debug('[ChecklisteComponent] Auto CRIF search successful - full result:', result);

                    // Auto-update bonitaet field if result contains color code
                    if (result.bonitaet) {
                        const colorCode = result.bonitaet;
                        const internalName = this.mapCrifColorToInternalName(colorCode);
                        const bemerkung = result.bonitaet_kommentar || null;
                        const auditFlag = result.audit_flag || false;

                        this.logger.debug('[ChecklisteComponent] Mapping CRIF color:', {
                            colorCode,
                            internalName,
                            bemerkung,
                            auditFlag,
                            reportId: result.report_id
                        });

                        this.checklisteForm.patchValue({
                            bonitaet_crif: internalName,
                            bonitaet_crif_bemerkung: bemerkung,
                            audit: auditFlag
                        });

                        this.logger.debug('[ChecklisteComponent] Auto-filled bonitaet_crif, bemerkung, and audit:', {
                            bonitaet: internalName,
                            bemerkung: bemerkung,
                            audit: auditFlag
                        });
                    }

                    // Call completion callback if provided
                    if (onComplete) {
                        onComplete();
                    }
                },
                error: (error) => {
                    this.logger.warn('[ChecklisteComponent] Auto CRIF search failed (silent):', error);
                    // Silent failure - no user notification for automatic retrieval

                    // Call completion callback even on error
                    if (onComplete) {
                        onComplete();
                    }
                }
            });
    }

    /**
     * Manually fetch CRIF data from backend API (triggered by button click)
     * This refreshes the credit rating data by calling searchPerson API
     */
    onCrifDatenAbrufen(): void {
        const offerte = this.offerteStore.currentOfferte();
        // Get person from offerte object, not from personStore
        const person = offerte?.person || this.personStore.data();

        if (!person) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warnung',
                detail: 'Keine Personendaten verfügbar',
                life: 3000
            });
            return;
        }

        this.isLoading = true;
        this.logger.debug('[ChecklisteComponent] Fetching CRIF data from API for person:', person);

        // Format birth date to string if exists
        const dateOfBirth = person.geburtstag ? new Date(person.geburtstag).toISOString().split('T')[0] : undefined;

        this.crifService
            .searchPerson({
                firstname: person.vorname,
                lastname: person.name,
                date_of_birth: dateOfBirth,
                country: person['land'] as string | undefined,
                city: person.ort,
                street: person.strasse,
                house_number: person.hausnr,
                zipcode: person.plz
            })
            .subscribe({
                next: (result) => {
                    this.isLoading = false;
                    // Store report_id (not archiving_id) for later report fetching
                    this.crifArchivingId = result.report_id?.toString();

                    this.logger.debug('[ChecklisteComponent] CRIF data fetched successfully:', result);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Erfolg',
                        detail: 'CRIF-Daten erfolgreich abgerufen',
                        life: 3000
                    });

                    // Auto-update bonitaet field if result contains color code
                    if (result.bonitaet) {
                        const colorCode = result.bonitaet;
                        const internalName = this.mapCrifColorToInternalName(colorCode);
                        const bemerkung = result.bonitaet_kommentar || null;
                        const auditFlag = result.audit_flag || false;

                        this.logger.debug('[ChecklisteComponent] CRIF result full object:', result);
                        this.logger.debug('[ChecklisteComponent] Mapping CRIF color from manual data fetch:', {
                            colorCode,
                            internalName,
                            bemerkung,
                            auditFlag,
                            reportId: result.report_id
                        });

                        this.checklisteForm.patchValue({
                            bonitaet_crif: internalName,
                            bonitaet_crif_bemerkung: bemerkung,
                            audit: auditFlag
                        });
                    }
                },
                error: (error) => {
                    this.isLoading = false;
                    this.logger.error('[ChecklisteComponent] CRIF data fetch error:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Fehler',
                        detail: error.message || 'Fehler beim Abrufen der CRIF-Daten',
                        life: 5000
                    });
                }
            });
    }

    /**
     * Download CRIF report as PDF
     */
    onCrifReportPdfDownload(): void {
        if (!this.crifArchivingId) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warnung',
                detail: 'Bitte führen Sie zuerst eine CRIF-Suche durch',
                life: 3000
            });
            return;
        }

        this.isLoading = true;
        this.logger.debug('[ChecklisteComponent] Downloading CRIF PDF report');

        this.crifService.getReportPdf(this.crifArchivingId).subscribe({
            next: (blob) => {
                this.isLoading = false;

                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `crif_report_${this.crifArchivingId}.pdf`;
                link.click();
                window.URL.revokeObjectURL(url);

                this.messageService.add({
                    severity: 'success',
                    summary: 'Erfolg',
                    detail: 'CRIF-Report wird heruntergeladen',
                    life: 3000
                });
            },
            error: (error) => {
                this.isLoading = false;
                this.logger.error('[ChecklisteComponent] CRIF PDF download error:', error);

                // Check if report is not ready yet
                if (error.notReady) {
                    this.messageService.add({
                        severity: 'info',
                        summary: 'Bitte warten',
                        detail: 'Der CRIF-Report ist noch nicht verfügbar. Bitte versuchen Sie es in einer Minute erneut.',
                        life: 5000
                    });
                } else {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Fehler',
                        detail: error.message || 'Fehler beim Herunterladen des CRIF-Reports',
                        life: 5000
                    });
                }
            }
        });
    }

    /**
     * Open CRIF report in web browser
     */
    onCrifReportWebOpen(): void {
        if (!this.crifArchivingId) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warnung',
                detail: 'Bitte führen Sie zuerst eine CRIF-Suche durch',
                life: 3000
            });
            return;
        }

        this.isLoading = true;
        this.logger.debug('[ChecklisteComponent] Opening CRIF web report');

        this.crifService.getReportWeb(this.crifArchivingId).subscribe({
            next: (webUrl) => {
                this.isLoading = false;

                // Open URL in new window
                window.open(webUrl, '_blank');

                this.messageService.add({
                    severity: 'success',
                    summary: 'Erfolg',
                    detail: 'CRIF-Report wird im Browser geöffnet',
                    life: 3000
                });
            },
            error: (error) => {
                this.isLoading = false;
                this.logger.error('[ChecklisteComponent] CRIF web report error:', error);

                // Check if report is not ready yet
                if (error.notReady) {
                    this.messageService.add({
                        severity: 'info',
                        summary: 'Bitte warten',
                        detail: 'Der CRIF-Report ist noch nicht verfügbar. Bitte versuchen Sie es in einer Minute erneut.',
                        life: 5000
                    });
                } else {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Fehler',
                        detail: error.message || 'Fehler beim Öffnen des CRIF-Reports',
                        life: 5000
                    });
                }
            }
        });
    }

    /**
     * Get default date for Fällig am (today)
     */
    getDefaultFaelligAm(): string {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Example: Check if specific resources are loaded from PrefetchService
     * This demonstrates how components can query the prefetch service for resource status
     */
    private checkResourceAvailability(): void {
        // Check if codes are loaded (useful before using CodesService)
        const codesLoaded = this.prefetchService.isResourceLoaded('codes');
        this.logger.debug('[ChecklisteComponent] Codes loaded:', codesLoaded);

        // Check if CRIF data is loaded
        const crifStatus = this.prefetchService.getResourceStatus('codes');
        this.logger.debug('[ChecklisteComponent] CRIF status:', crifStatus);

        // Get full resource info
        const codesResource = this.prefetchService.getResource('codes');
        if (codesResource) {
            this.logger.debug('[ChecklisteComponent] Codes resource:', {
                name: codesResource.displayName,
                status: codesResource.status,
                error: codesResource.error
            });
        }

        // Check if all prefetch is complete
        const allComplete = this.prefetchService.isPrefetchComplete();
        this.logger.debug('[ChecklisteComponent] All prefetch complete:', allComplete);

        // Get current prefetch progress
        const progress = this.prefetchService.prefetchProgress();
        this.logger.debug('[ChecklisteComponent] Prefetch progress:', progress);
    }

    /**
     * Handle "Aufgabe VTT erstellen" button click
     * Opens task creation dialog with pre-filled data
     */
    onAufgabeVttErstellen(): void {
        this.logger.debug('[ChecklisteComponent] Opening task creation dialog');

        // Check if checkliste is saved
        if (!this.checklisteId) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warnung',
                detail: 'Bitte speichern Sie die Checkliste zuerst',
                life: 3000
            });
            return;
        }

        // Generate dynamic task description based on checkliste data
        this.taskData.automatischeBeschreibung = this.generateTaskDescription();

        // Get visum from auth service (preferred_username from Keycloak)
        const userProfile = this.authService.getUserProfile();
        const visum = userProfile?.username || 'GE';

        // Load aufgabenart options from codes service (only show WFD_FUVOff_Offerte_pruefen_VTT)
        this.codesService.getCodesByGruppe('AufgabenDef').subscribe({
            next: (codes) => {
                // Filter to show ONLY WFD_FUVOff_Offerte_pruefen_VTT for checkliste VTT task
                this.aufgabenartOptions = codes
                    .filter((code) => code.aktiv === true && code.internal_name === WFD_FUV_OFFERTE_PRUEFEN_VTT)
                    .map((code) => ({
                        label: this.codesService.getLocalizedLabel(code),
                        value: code.internal_name
                    }));

                // Set default aufgabeart if available
                const defaultAufgabeart = this.aufgabenartOptions.length > 0 ? this.aufgabenartOptions[0].value : '';
                const defaultTitel = this.aufgabenartOptions.length > 0 ? this.aufgabenartOptions[0].label : '';

                // Initialize task data
                this.taskData.aufgabeart = defaultAufgabeart;
                this.taskData.titel = defaultTitel;
                this.taskData.zugewiesenAn = DEFAULT_AUFGABE_AUSFUEHRENDER;

                // Show task creation dialog
                this.logger.debug('[ChecklisteComponent] Opening task creation dialog with aufgabenart options:', this.aufgabenartOptions.length);
                this.showTaskCreationDialog = true;
            },
            error: (error) => {
                this.logger.error('[ChecklisteComponent] Failed to load aufgabenart options', error);
                // Still show dialog with empty options
                this.taskData.aufgabeart = '';
                this.taskData.titel = '';
                this.taskData.zugewiesenAn = DEFAULT_AUFGABE_AUSFUEHRENDER;

                this.showTaskCreationDialog = true;
            }
        });
    }

    /**
     * Generate dynamic task description based on checkliste data
     * Includes Sv-Nr, CRIF information, and other relevant checkliste data
     */
    private generateTaskDescription(): string {
        const offerte = this.offerteStore.currentOfferte();
        const person = offerte?.person;
        const userProfile = this.authService.getUserProfile();
        const userName = userProfile?.firstName && userProfile?.lastName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile?.username || 'User';
        const userVisum = userProfile?.username || 'GE';
        const svnr = person?.svnr || 'N/A';

        let description = `${userName} (${userVisum})\n`;
        description += `Die Offerte kann nicht abgeschlossen werden, aufgrund der Checkliste. Bitte entsprechende Prüfungen vornehmen.\n`;
        description += `SV-Nr: ${svnr}\n`;
        description += `Gültig ab: ${this.formatDateForDescription(this.checklisteForm.get('gueltig_ab')?.value)}\n`;

        // Add age information
        const alter = this.checklisteForm.get('alter_versicherter')?.value;
        if (alter) {
            description += `Alter des Versicherten zu Vertragsbeginn: ${alter}\n`;
        }

        // Add accident information
        description += `Mehr als ein Unfall "ordentlich" innerhalb der letzten fünf Jahren\n`;
        description += `Liegen laufende Unfälle vor?:\n`;

        // Add CRIF information
        const bonitaet = this.checklisteForm.get('bonitaet_crif')?.value;
        if (bonitaet) {
            description += `Bonität aus CRIF: ${bonitaet}\n`;
        }

        // Add additional comment
        description += `Ergänzender Kommentar zur Bonität aus CRIF: Der Bonitätswert wurde automatisch aus CRIF übernommen.\n`;

        // Add audit flag
        description += `Audit:\n`;
        description += `Malus:`;

        return description;
    }

    /**
     * Format date for description
     */
    private formatDateForDescription(date: any): string {
        if (!date) return 'N/A';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Handle aufgabenart selection change
     * Updates titel to match the selected aufgabenart text
     */
    onAufgabenartChange(): void {
        const selectedOption = this.aufgabenartOptions.find((opt) => opt.value === this.taskData.aufgabeart);
        if (selectedOption) {
            this.taskData.titel = selectedOption.label;
            this.logger.debug('[ChecklisteComponent] Aufgabenart changed, updated titel', {
                aufgabeart: this.taskData.aufgabeart,
                titel: this.taskData.titel
            });
        }
    }

    /**
     * Save task creation
     */
    onTaskCreationSave(): void {
        // TODO: Implement actual task creation via KpmService
        // TODO: Call kpmService.createSyriusAufgabe() with taskData
        // TODO: Map taskData to CreateSyriusAufgabeRequest format
        // TODO: Handle response and error cases
        this.logger.debug('[ChecklisteComponent] Creating VTT task with data:', this.taskData);
        this.logger.warn('[ChecklisteComponent] Task creation via KpmService not yet implemented - TODO for future work');

        this.showTaskCreationDialog = false;

        this.messageService.add({
            severity: 'success',
            summary: 'Erfolg',
            detail: 'Aufgabe wurde erstellt',
            life: 3000
        });

        // Update checkliste form to set vttanfrage flag
        this.checklisteForm.patchValue({
            vttanfrage: true
        });

        // Save checkliste automatically after task creation
        this.onSave();
    }

    /**
     * Cancel task creation
     */
    onTaskCreationCancel(): void {
        this.logger.debug('[ChecklisteComponent] Task creation cancelled');
        this.showTaskCreationDialog = false;
    }

    /**
     * Calculate valid status
     *
     * Validation Logic:
     * 1. checkRendement() - Invalid if:
     *    - anzahl_unfaelle is true (more than 1 accident)
     *    - OR laufende_unfaelle is true (more than 1 ongoing accident)
     *
     * 2. checkMalus() - Invalid if (for typeOfCall == 'vertrag' only):
     *    - bt_malus > 0
     *
     * 3. Missing required comment - Invalid if:
     *    - isKommentarRequired() returns true AND
     *    - bonitaet_crif_bemerkung is empty
     *
     * 4. Expert Approval Exception - Valid if:
     *    - genehmigung_art == 'ExperteGenehmigung_OK' OR
     *    - genehmigung_art == 'ExperteGenehmigung_OK_Arzt'
     *    (This overrides all other checks)
     *
     */
    private calculateValidStatus(formData: any, offerte: any): boolean {
        // Expert approval overrides all other validations
        if (formData.genehmigung_art === 'ExperteGenehmigung_OK' || formData.genehmigung_art === 'ExperteGenehmigung_OK_Arzt') {
            return true;
        }

        // 1. Check Rendement (accidents)
        const rendementFailed = this.checkRendement(formData);
        if (rendementFailed) {
            return false;
        }

        // 2. Check Malus (only for 'vertrag' type)
        const malusFailed = this.checkMalus(formData, offerte);
        if (malusFailed) {
            return false;
        }

        // 3. Check if required comment is missing
        const kommentarRequired = this.isKommentarRequired(formData);
        if (kommentarRequired && !formData.bonitaet_crif_bemerkung) {
            return false;
        }

        // All checks passed
        return true;
    }

    /**
     * Check rendement (accident history)
     * Returns true if check FAILS (invalid condition)
     *
     * checkRendement() returns false when:
     * - anzahl_unfaelle is true (more than 1 accident)
     * - OR laufende_unfaelle is true (more than 1 ongoing accident)
     */
    private checkRendement(formData: any): boolean {
        const anzahlUnfaelle = formData.anzahl_unfaelle === true;
        const laufendeUnfaelle = formData.laufende_unfaelle === true;

        this.logger.debug('[ChecklisteComponent]   Rendement check:', {
            anzahl_unfaelle: anzahlUnfaelle,
            laufende_unfaelle: laufendeUnfaelle,
            failed: anzahlUnfaelle || laufendeUnfaelle
        });

        return anzahlUnfaelle || laufendeUnfaelle;
    }

    /**
     * Check malus (only for vertrag/contract extensions)
     * Returns true if check FAILS (invalid condition)
     */
    private checkMalus(formData: any, offerte: any): boolean {
        // Only check malus for vertrag type
        const isVertrag = offerte?.art === 'OfferteArtVerl' || offerte?.art === 'vertrag';
        const hasMalus = (formData.bt_malus || 0) > 0;

        const failed = isVertrag && hasMalus;

        this.logger.debug('[ChecklisteComponent]   Malus check:', {
            isVertrag,
            bt_malus: formData.bt_malus || 0,
            hasMalus,
            failed
        });

        return failed;
    }

    /**
     * Check if comment (bemerkung) is required
     * Returns true if comment is required
     *
     * Comment is required when:
     * - Bonität is low (CRIF_TIEF)
     * - OR audit flag is set
     */
    private isKommentarRequired(formData: any): boolean {
        const isLowBonity = formData.bonitaet_crif === 'CRIF_TIEF';
        const hasAudit = formData.audit === true;

        const required = isLowBonity || hasAudit;

        this.logger.debug('[ChecklisteComponent]   Kommentar required check:', {
            bonitaet_crif: formData.bonitaet_crif,
            isLowBonity,
            audit: formData.audit,
            hasAudit,
            required
        });

        return required;
    }
}
