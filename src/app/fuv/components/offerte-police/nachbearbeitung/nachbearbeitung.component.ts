import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { map, Observable } from 'rxjs';

import { CommonModule } from '@angular/common';
import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    ContactPerson, NachbearbeitungData, RejectReason
} from '@app/fuv/models/nachbearbeitung.model';
import { CodesService } from '@app/fuv/services/codes.service';
import { OfferteAblehnungModalService } from '@app/fuv/services/offerte-ablehnung-modal.service';
import { OfferteService } from '@app/fuv/services/offerte.service';
import { VertriebspartnerService } from '@app/fuv/services/vertriebspartner.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, AuthService, LogFactoryService, Logger } from '@syrius/core';

import {
    ITSVTRIEBPVPDEF_BETEILIGTER, ITSVTRIEBPVPDEF_EXTERNER, ITSVTRIEBPVPDEF_VERKAEUFER,
    OFFERTE_ART_UNV, OFFERTE_ART_VER, OFFERTE_ART_VERL, OFFERTE_ART_VERO, OFFERTE_STATUS_ABSCHLUSS,
    VPFUNKTION_BETEILIGTER, VPFUNKTION_EXTERNER, VPFUNKTION_VERKAEUFER
} from '../police.constants';
import { validateNachbearbeitung } from './nachbearbeitung.validation';

@Component({
    selector: 'app-nachbearbeitung',
    standalone: true,
    imports: [CommonModule, FormsModule, PanelModule, RadioButtonModule, InputTextModule, SelectModule, AutoCompleteModule, ButtonModule, TooltipModule, TranslateModule, DialogModule],
    templateUrl: './nachbearbeitung.component.html'
})
export class NachbearbeitungComponent implements OnInit {
    @Input() viewMode: boolean = false; // Read-only mode flag

    private vertpartnerService = inject(VertriebspartnerService);
    private codesService = inject(CodesService);
    private offerteStore = inject(OfferteTypedStore);
    private offerteService = inject(OfferteService);
    private ablehnungModalService = inject(OfferteAblehnungModalService);
    private authService = inject(AuthService);
    private messageService = inject(AppMessageService);
    private translate = inject(TranslateService);
    private logFactory = inject(LogFactoryService);
    private logger: Logger;

    nachbearbeitungData: NachbearbeitungData = {
        kundengeschenkAbgegeben: false,
        geschenkbegriffArtikel: '',
        internerVermittlerVerkaeufer: null,
        internerVermittlerBeteiligter: null,
        externerVermittler: null,
        ablehnungsgrund: null
    };

    // Signal to track ablehnungsgrund selection for reactivity
    private ablehnungsgrundSelected = signal<RejectReason | null>(null);

    // Signal to track interner vermittler selection for reactivity
    private internerVermittlerSelected = signal<ContactPerson | null>(null);

    // Data loaded from service - separate arrays for each vermittler type
    verkaeuferContactPersons: ContactPerson[] = [];
    beteiligterContactPersons: ContactPerson[] = [];
    externalContactPersons: ContactPerson[] = [];
    rejectReasons: RejectReason[] = [];

    // Filtered suggestions for AutoComplete
    filteredVerkaeufer: ContactPerson[] = [];
    filteredBeteiligter: ContactPerson[] = [];
    filteredExternal: ContactPerson[] = [];

    // Validation errors
    validationErrors = signal<Record<string, string>>({});

    // Dialog visibility
    displayPolicierungDialog = false;

    // Computed: Check if VTT has rejected the offerte
    isVttRejected = computed(() => {
        const offerte = this.offerteStore.currentOfferte();
        const fragebogen = offerte?.fragebogen;
        const GENEHMIGUNG_ART_REJECTED = ['Offerte_Ablehnung', 'Offerte_RisikoAblehnung'];
        return !!(fragebogen?.genehmigung_art && GENEHMIGUNG_ART_REJECTED.includes(fragebogen.genehmigung_art));
    });

    // Computed: Get VTT rejection remark if rejected
    vttRejectionRemark = computed(() => {
        const offerte = this.offerteStore.currentOfferte();
        const fragebogen = offerte?.fragebogen;
        return fragebogen?.genehmigung_bemerkung || 'Keine Bemerkung';
    });

    // Computed flag: true if offerte is not signed (disable all fields except ablehnungsgrund)
    // Using computed signal to ensure reactivity when store changes
    fieldsDisabled = computed(() => {
        const isSigned = this.offerteStore.currentMeta()?.isSigned ?? false;
        // Fields are disabled if the offerte is NOT signed (unless in viewMode)
        return !isSigned || this.viewMode;
    });

    // Computed: Check if the "Offerte ablehnen" button should be disabled
    isAblehnungButtonDisabled = computed(() => {
        // Disable if in view mode
        if (this.viewMode) {
            return true;
        }
        // Disable if VTT already rejected
        if (this.isVttRejected()) {
            return true;
        }
        // Disable if no ablehnungsgrund selected (use signal for reactivity)
        if (!this.ablehnungsgrundSelected()) {
            return true;
        }
        return false;
    });

    // Computed: Tooltip message for disabled "Offerte ablehnen" button
    ablehnungButtonTooltip = computed(() => {
        if (this.viewMode) {
            return 'Im Ansichtsmodus nicht verfügbar';
        }
        if (this.isVttRejected()) {
            return 'Die Offerte wurde bereits von der VTT abgelehnt';
        }
        if (!this.ablehnungsgrundSelected()) {
            return 'Bitte wähle zuerst einen Ablehnungsgrund aus';
        }
        return '';
    });

    // Computed: Check if offerte is signed
    isOfferteSigned = computed(() => {
        return this.offerteStore.currentMeta()?.isSigned ?? false;
    });

    // Computed: Check if offerte is Verlängerung (only show Verkäufer field)
    isVerlaengerung = computed(() => {
        const offerte = this.offerteStore.currentOfferte();
        return offerte?.art === OFFERTE_ART_VERL;
    });

    // Computed: Check if "Offerte policieren" button should be disabled
    isPolicierenButtonDisabled = computed(() => {
        // Disable if in view mode
        if (this.viewMode) {
            return true;
        }
        // Disable if VTT rejected
        if (this.isVttRejected()) {
            return true;
        }
        // Disable if offerte is not signed
        if (!this.isOfferteSigned()) {
            return true;
        }
        // Disable if no interner vermittler verkäufer selected
        if (!this.internerVermittlerSelected()) {
            return true;
        }
        return false;
    });

    // Computed: Tooltip message for disabled "Offerte policieren" button
    policierenButtonTooltip = computed(() => {
        if (this.viewMode) {
            return 'Im Ansichtsmodus nicht verfügbar';
        }
        if (this.isVttRejected()) {
            return 'Die Offerte wurde von der VTT abgelehnt';
        }
        if (!this.isOfferteSigned()) {
            return 'Die Offerte muss zuerst unterschrieben werden';
        }
        if (!this.internerVermittlerSelected()) {
            return this.translate.instant('fuv.police.nachbearbeitung.validation.vermittlerRequired');
        }
        return '';
    });

    // Computed: Check if validation error should be shown for vermittler
    showVermittlerValidationError = computed(() => {
        const errors = this.validationErrors();
        return errors['internerVermittlerVerkaeufer'] !== undefined;
    });

    constructor() {
        this.logger = this.logFactory.createLogger('NachbearbeitungComponent');
    }

    ngOnInit() {
        // Get current offerte to retrieve stichdatum for API calls
        const currentOfferte = this.offerteStore.currentOfferte();

        if (!currentOfferte) {
            this.logger.warn('No offerte available - cannot load vertriebspartner');
            // Still load reject reasons as they don't depend on offerte
            this.loadRejectReasons();
            return;
        }

        this.loadVerkaeuferContactPersons(currentOfferte);
        this.loadBeteiligterContactPersons(currentOfferte);
        this.loadExternalContactPersons(currentOfferte);
        this.loadRejectReasons();

        // Load existing anspruchsberechtigte from store if available
        this.loadExistingAnspruchsberechtigte(currentOfferte);

        // After loading existing data, sync back to store to ensure anspruchsberechtigte is up-to-date
        // This is important for cases where the offerte was loaded from backend and needs to be re-synced
        setTimeout(() => {
            this.onDataChange();
        }, 100);
    }

    /**
     * Load existing Anspruchsberechtigte from store and populate the form fields
     */
    private loadExistingAnspruchsberechtigte(offerte: any): void {
        if (!offerte?.anspruchsberechtigte || offerte.anspruchsberechtigte.length === 0) {
            this.logger.debug('No existing anspruchsberechtigte found in store');
            return;
        }

        this.logger.debug('Loading existing anspruchsberechtigte from store:', offerte.anspruchsberechtigte);

        // Map anspruchsberechtigte back to form fields based on itsvtriebpvpdef
        offerte.anspruchsberechtigte.forEach((anspr: any) => {
            const vp = anspr.vertriebspartner;
            if (!vp) return;

            const contactPerson: ContactPerson = {
                id: vp.id.toString(),
                boid: vp.boid,
                name: vp.vp_vorname ? `${vp.vp_vorname} ${vp.vp_name}`.trim() : vp.vp_name,
                partnernr: vp.vp_partnernr,
                suvanr: vp.vp_suvanr,
                plz: vp.vp_plz,
                ort: vp.vp_ort,
                vpartnerfunktion: anspr.vpartnerfunktion,
                searchstring: vp.searchstring
            };

            // Assign to correct field based on itsvtriebpvpdef
            if (vp.itsvtriebpvpdef === ITSVTRIEBPVPDEF_VERKAEUFER) {
                this.nachbearbeitungData.internerVermittlerVerkaeufer = contactPerson;
                this.internerVermittlerSelected.set(contactPerson);
                this.logger.debug('Loaded Verkäufer:', contactPerson.name);
            } else if (vp.itsvtriebpvpdef === ITSVTRIEBPVPDEF_BETEILIGTER) {
                this.nachbearbeitungData.internerVermittlerBeteiligter = contactPerson;
                this.logger.debug('Loaded Beteiligter:', contactPerson.name);
            } else if (vp.itsvtriebpvpdef === ITSVTRIEBPVPDEF_EXTERNER) {
                this.nachbearbeitungData.externerVermittler = contactPerson;
                this.logger.debug('Loaded Externer Vermittler:', contactPerson.name);
            }
        });
    }

    /**
     * Load Verkäufer contact persons (Interner Vermittler Verkäufer)
     * Filters by itsvtriebpvpdef = '3001'
     */
    private loadVerkaeuferContactPersons(offerte: any): void {
        // Get gueltab date from offerte, fallback to today if not available
        let stichdatum: string;
        if (offerte.gueltab) {
            const gueltabDate = offerte.gueltab instanceof Date ? offerte.gueltab : new Date(offerte.gueltab);
            stichdatum = gueltabDate.toISOString().split('T')[0];
        } else {
            stichdatum = new Date().toISOString().split('T')[0];
        }

        this.logger.debug('Loading Verkäufer contact persons with stichdatum:', stichdatum, 'and itsvtriebpvpdef: 3001');

        this.vertpartnerService
            .searchVertriebspartner({
                stichdatum: stichdatum
            })
            .pipe(
                map((vertriebspartner) => {
                    // Client-side filter by itsvtriebpvpdef = '3001'
                    const filtered = vertriebspartner.filter((vp) => vp.itsvtriebpvpdef === '3001');
                    this.logger.debug('Filtered Verkäufer records (itsvtriebpvpdef=3001):', filtered.length, 'of', vertriebspartner.length);

                    return filtered.map((vp) => {
                        const name = vp.vp_vorname ? `${vp.vp_vorname} ${vp.vp_name}`.trim() : vp.vp_name;
                        return {
                            id: vp.id.toString(),
                            boid: vp.boid,
                            name: name,
                            partnernr: vp.vp_partnernr,
                            suvanr: vp.vp_suvanr,
                            plz: vp.vp_plz,
                            ort: vp.vp_ort,
                            vpartnerfunktion: '',
                            searchstring: vp.searchstring
                        };
                    });
                })
            )
            .subscribe({
                next: (persons) => {
                    this.verkaeuferContactPersons = persons;
                    this.logger.debug('Loaded Verkäufer contact persons:', persons);
                },
                error: (error) => {
                    this.logger.error('Error loading Verkäufer contact persons:', error);
                }
            });
    }

    /**
     * Load Beteiligter contact persons (Interner Vermittler Beteiligter)
     * Filters by itsvtriebpvpdef = '3002'
     */
    private loadBeteiligterContactPersons(offerte: any): void {
        // Get gueltab date from offerte, fallback to today if not available
        let stichdatum: string;
        if (offerte.gueltab) {
            const gueltabDate = offerte.gueltab instanceof Date ? offerte.gueltab : new Date(offerte.gueltab);
            stichdatum = gueltabDate.toISOString().split('T')[0];
        } else {
            stichdatum = new Date().toISOString().split('T')[0];
        }

        this.logger.debug('Loading Beteiligter contact persons with stichdatum:', stichdatum, 'and itsvtriebpvpdef: 3002');

        this.vertpartnerService
            .searchVertriebspartner({
                stichdatum: stichdatum
            })
            .pipe(
                map((vertriebspartner) => {
                    // Client-side filter by itsvtriebpvpdef = '3002'
                    const filtered = vertriebspartner.filter((vp) => vp.itsvtriebpvpdef === '3002');
                    this.logger.debug('Filtered Beteiligter records (itsvtriebpvpdef=3002):', filtered.length, 'of', vertriebspartner.length);

                    return filtered.map((vp) => {
                        const name = vp.vp_vorname ? `${vp.vp_vorname} ${vp.vp_name}`.trim() : vp.vp_name;
                        return {
                            id: vp.id.toString(),
                            boid: vp.boid,
                            name: name,
                            partnernr: vp.vp_partnernr,
                            suvanr: vp.vp_suvanr,
                            plz: vp.vp_plz,
                            ort: vp.vp_ort,
                            vpartnerfunktion: '',
                            searchstring: vp.searchstring
                        };
                    });
                })
            )
            .subscribe({
                next: (persons) => {
                    this.beteiligterContactPersons = persons;
                    this.logger.debug('Loaded Beteiligter contact persons:', persons);
                },
                error: (error) => {
                    this.logger.error('Error loading Beteiligter contact persons:', error);
                }
            });
    }

    /**
     * Load external contact persons (Externer Vermittler)
     * Filters by itsvtriebpvpdef = '1001'
     */
    private loadExternalContactPersons(offerte: any): void {
        // Get gueltab date from offerte, fallback to today if not available
        let stichdatum: string;
        if (offerte.gueltab) {
            const gueltabDate = offerte.gueltab instanceof Date ? offerte.gueltab : new Date(offerte.gueltab);
            stichdatum = gueltabDate.toISOString().split('T')[0];
        } else {
            stichdatum = new Date().toISOString().split('T')[0];
        }

        this.logger.debug('Loading external contact persons with stichdatum:', stichdatum, 'and itsvtriebpvpdef: 1001');

        this.vertpartnerService
            .searchVertriebspartner({
                stichdatum: stichdatum
            })
            .pipe(
                map((vertriebspartner) => {
                    // Client-side filter by itsvtriebpvpdef = '1001'
                    const filtered = vertriebspartner.filter((vp) => vp.itsvtriebpvpdef === '1001');
                    this.logger.debug('Filtered External records (itsvtriebpvpdef=1001):', filtered.length, 'of', vertriebspartner.length);

                    return filtered.map((vp) => {
                        const name = vp.vp_vorname ? `${vp.vp_vorname} ${vp.vp_name}`.trim() : vp.vp_name;
                        return {
                            id: vp.id.toString(),
                            boid: vp.boid,
                            name: name,
                            partnernr: vp.vp_partnernr,
                            suvanr: vp.vp_suvanr,
                            plz: vp.vp_plz,
                            ort: vp.vp_ort,
                            vpartnerfunktion: '',
                            searchstring: vp.searchstring
                        };
                    });
                })
            )
            .subscribe({
                next: (persons) => {
                    this.externalContactPersons = persons;
                    this.logger.debug('Loaded external contact persons:', persons);
                },
                error: (error) => {
                    this.logger.error('Error loading external contact persons:', error);
                }
            });
    }

    /**
     * Load rejection reasons (Ablehnungsgrund)
     * Fetches from codes table filtered by gruppe='KvOfferteAblehnungsgrund'
     * Shows all entries without additional filtering
     */
    private loadRejectReasons(): void {
        this.codesService
            .getCodesByGruppe('KvOfferteAblehnungsgrund')
            .pipe(
                map((codes) => {
                    // Sort by sorter field
                    const sortedCodes = codes.sort((a, b) => a.sorter - b.sorter);

                    // Map to RejectReason format with localized labels
                    return sortedCodes.map((code) => ({
                        code: code.id.toString(),
                        internal_name: code.internal_name,
                        label: this.codesService.getLocalizedLabel(code),
                        sorter: code.sorter
                    }));
                })
            )
            .subscribe({
                next: (reasons) => {
                    this.rejectReasons = reasons;
                    this.logger.debug('Loaded reject reasons from KvOfferteAblehnungsgrund:', reasons);
                },
                error: (error) => {
                    this.logger.error('Error loading reject reasons:', error);
                }
            });
    }

    onDataChange() {
        // Update signals to trigger computed properties
        this.ablehnungsgrundSelected.set(this.nachbearbeitungData.ablehnungsgrund ?? null);
        this.internerVermittlerSelected.set(this.nachbearbeitungData.internerVermittlerVerkaeufer ?? null);

        // Run validation
        this.validateForm();

        // Build anspruchsberechtigte array from vermittler selections
        const anspruchsberechtigte = this.buildAnspruchsberechtigteArray();

        // Update the store with all nachbearbeitung fields including anspruchsberechtigte
        this.offerteStore.updateOfferte(null, {
            kundengeschenk: this.nachbearbeitungData.kundengeschenkAbgegeben,
            kundengeschenkartikel: this.nachbearbeitungData.geschenkbegriffArtikel || undefined,
            anspruchsberechtigte: anspruchsberechtigte.length > 0 ? anspruchsberechtigte : undefined
        });

        this.logger.debug('Updated store with anspruchsberechtigte:', anspruchsberechtigte.length, 'items');
    }

    /**
     * Build anspruchsberechtigte array from the selected vermittler
     * Maps ContactPerson to FuvAnspruchsberechtigteVP structure
     */
    private buildAnspruchsberechtigteArray(): any[] {
        const currentOfferte = this.offerteStore.currentOfferte();
        const offerteid = currentOfferte?.id;
        const username = this.authService.getUserProfile()?.username || 'system';
        const now = new Date().toISOString().slice(0, 19);

        const anspruchsberechtigte: any[] = [];

        // Add Verkäufer (always required for policieren)
        if (this.nachbearbeitungData.internerVermittlerVerkaeufer) {
            const verkaufer = this.nachbearbeitungData.internerVermittlerVerkaeufer;

            // Find full vertriebspartner data from loaded list
            const fullVP = this.verkaeuferContactPersons.find((vp) => vp.boid === verkaufer.boid);

            anspruchsberechtigte.push({
                created: now,
                updated: now,
                updatedby: username,
                itsvpartner: verkaufer.boid,
                itskvprodanon: null,
                offerteid: offerteid,
                vpartnerfunktion: VPFUNKTION_VERKAEUFER,
                vertriebspartner: this.buildVertriebspartnerObject(fullVP || verkaufer, ITSVTRIEBPVPDEF_VERKAEUFER)
            });
        }

        // Add Beteiligter (optional, not for Verlängerung)
        if (this.nachbearbeitungData.internerVermittlerBeteiligter && !this.isVerlaengerung()) {
            const beteiligter = this.nachbearbeitungData.internerVermittlerBeteiligter;

            const fullVP = this.beteiligterContactPersons.find((vp) => vp.boid === beteiligter.boid);

            anspruchsberechtigte.push({
                created: now,
                updated: now,
                updatedby: username,
                itsvpartner: beteiligter.boid,
                itskvprodanon: null,
                offerteid: offerteid,
                vpartnerfunktion: VPFUNKTION_BETEILIGTER,
                vertriebspartner: this.buildVertriebspartnerObject(fullVP || beteiligter, ITSVTRIEBPVPDEF_BETEILIGTER)
            });
        }

        // Add Externer (optional, not for Verlängerung)
        if (this.nachbearbeitungData.externerVermittler && !this.isVerlaengerung()) {
            const externer = this.nachbearbeitungData.externerVermittler;

            const fullVP = this.externalContactPersons.find((vp) => vp.boid === externer.boid);

            anspruchsberechtigte.push({
                created: now,
                updated: now,
                updatedby: username,
                itsvpartner: externer.boid,
                itskvprodanon: null,
                offerteid: offerteid,
                vpartnerfunktion: VPFUNKTION_EXTERNER,
                vertriebspartner: this.buildVertriebspartnerObject(fullVP || externer, ITSVTRIEBPVPDEF_EXTERNER)
            });
        }

        return anspruchsberechtigte;
    }

    /**
     * Build vertriebspartner object from ContactPerson
     */
    private buildVertriebspartnerObject(contact: ContactPerson, itsvtriebpvpdef: string): any {
        const now = new Date().toISOString().slice(0, 19);
        const username = this.authService.getUserProfile()?.username || 'system';

        // Try to extract name parts
        const nameParts = contact.name.split(' ');
        const vorname = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : null;
        const name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : contact.name;

        return {
            id: parseInt(contact.id, 10) || 0,
            created: now,
            updated: now,
            updatedby: username,
            boid: contact.boid,
            gueltab: '2014-01-01', // Default validity start
            gueltbis: '3000-01-01', // Default validity end
            vertriebspartnr: contact.partnernr,
            itsvtriebppartner: contact.partnernr,
            vp_partnernr: contact.partnernr,
            vp_name: name,
            vp_vorname: vorname,
            vp_plz: contact.plz,
            vp_ort: contact.ort,
            vp_suvanr: contact.suvanr || null,
            vp_visum: null,
            itsvtriebpvpdef: itsvtriebpvpdef,
            vermittlertyp: '-62200', // Default value
            vermvertragstatus: '-43601', // Default value
            searchstring: contact.searchstring || contact.name
        };
    }

    /**
     * Validate the form using Zod schema
     */
    private validateForm(): void {
        // Skip validation in read-only mode - clear any existing errors
        if (this.viewMode) {
            this.validationErrors.set({});
            return;
        }

        const validation = validateNachbearbeitung({
            internerVermittlerVerkaeufer: this.nachbearbeitungData.internerVermittlerVerkaeufer
        });

        this.validationErrors.set(validation.errors);
    }

    /**
     * Filter Verkäufer contact persons based on search query
     * Used by AutoComplete component
     */
    filterVerkaeufer(event: any): void {
        const query = event.query.toLowerCase();
        this.filteredVerkaeufer = this.verkaeuferContactPersons.filter((person) => person.searchstring?.toLowerCase().includes(query) || false);
    }

    /**
     * Filter Beteiligter contact persons based on search query
     * Used by AutoComplete component
     */
    filterBeteiligter(event: any): void {
        const query = event.query.toLowerCase();
        this.filteredBeteiligter = this.beteiligterContactPersons.filter((person) => person.searchstring?.toLowerCase().includes(query) || false);
    }

    /**
     * Filter external contact persons based on search query
     * Used by AutoComplete component
     */
    filterExternal(event: any): void {
        const query = event.query.toLowerCase();
        this.filteredExternal = this.externalContactPersons.filter((person) => person.searchstring?.toLowerCase().includes(query) || false);
    }

    offertAblehnen() {
        // Button should be disabled if conditions aren't met, but adding safety check
        if (this.isAblehnungButtonDisabled()) {
            return;
        }

        this.logger.debug('Offerte ablehnen:', this.nachbearbeitungData);

        // Open the ablehnung modal with the selected ablehnungsgrund
        const dialogRef = this.ablehnungModalService.openAblehnungModal(this.nachbearbeitungData.ablehnungsgrund ?? null);

        // The modal service already handles the dialog result subscription
        // No additional handling needed here as the service shows success message
    }

    /**
     * Policieren - Convert offerte to police (contract)
     */
    offertePolicieren() {
        // Button should be disabled if conditions aren't met, but adding safety check
        if (this.isPolicierenButtonDisabled()) {
            return;
        }

        // Validate form one more time before proceeding
        this.validateForm();
        if (Object.keys(this.validationErrors()).length > 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Validierungsfehler',
                detail: 'Bitte korrigieren Sie die Fehler im Formular.',
                life: 3000
            });
            return;
        }

        this.logger.debug('Offerte policieren:', this.nachbearbeitungData);

        // Get current offerte
        const currentOfferte = this.offerteStore.currentOfferte();
        if (!currentOfferte || !currentOfferte.id) {
            this.logger.error('Cannot policieren: No offerte loaded or missing ID');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Offerte konnte nicht policiert werden. Offerte-ID fehlt.',
                life: 3000
            });
            return;
        }

        // Get current date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // Get preferred_username from auth service (keycloak token)
        const tokenParsed = this.authService.getParsedToken();
        const preferredUsername = tokenParsed?.preferred_username || 'unknown';

        this.logger.debug('Policieren with user:', preferredUsername, 'on date:', today);

        // Update the offerte in the store with all required fields
        this.offerteStore.updateOfferte(null, {
            status: OFFERTE_STATUS_ABSCHLUSS,
            ablehnungsgrund: undefined,
            policiert_am: today,
            policiert_durch: preferredUsername,
            unterschrieben_am: currentOfferte.unterschrieben_am,
            unterschrieben_art: currentOfferte.unterschrieben_art,
            kundengeschenk: this.nachbearbeitungData.kundengeschenkAbgegeben
        });

        // Determine which endpoint to call based on offerte art
        const offerteArt = currentOfferte.art;
        let policierenObservable: Observable<any>;

        if (offerteArt === OFFERTE_ART_VERL) {
            // Verlängerung - use policierenVerlaengerung endpoint
            this.logger.debug('Calling policierenVerlaengerung API endpoint with offerte_id:', currentOfferte.id);
            policierenObservable = this.offerteService.policierenVerlaengerung(currentOfferte.id);
        } else if (offerteArt === OFFERTE_ART_UNV || offerteArt === OFFERTE_ART_VER || offerteArt === OFFERTE_ART_VERO) {
            // Unverbindliche Offerte, Offerte mit Antragsfragen, or Offerte ohne Antragsfragen - use policierenOfferte endpoint
            this.logger.debug('Calling policierenOfferte API endpoint with offerte_id:', currentOfferte.id, 'art:', offerteArt);
            policierenObservable = this.offerteService.policierenOfferte(currentOfferte.id);
        } else {
            this.logger.error('Unknown offerte art:', offerteArt);
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Unbekannter Offertetyp. Offerte konnte nicht policiert werden.',
                life: 5000
            });
            return;
        }

        // Call the appropriate policieren endpoint
        policierenObservable.subscribe({
            next: (response) => {
                this.logger.debug('Policieren API call successful:', response);

                // Show success dialog
                this.displayPolicierungDialog = true;
            },
            error: (error) => {
                this.logger.error('Error calling policieren endpoint:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Fehler',
                    detail: 'Offerte konnte nicht policiert werden. Bitte versuchen Sie es später erneut.',
                    life: 5000
                });
            }
        });
    }

    /**
     * Close the policierung success dialog
     */
    closePolicierungDialog(): void {
        this.displayPolicierungDialog = false;
    }
}
