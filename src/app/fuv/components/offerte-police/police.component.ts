import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { StepsModule } from 'primeng/steps';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin, map } from 'rxjs';

import { CommonModule, Location } from '@angular/common';
import {
    AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal,
    ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Offerte } from '@app/fuv/models/offerte.model';
import { BetriebService } from '@app/fuv/services/betrieb.service';
import { ChecklisteModalService } from '@app/fuv/services/checkliste-modal.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { OfferteService } from '@app/fuv/services/offerte.service';
import { PersonService } from '@app/fuv/services/person.service';
import { PrefetchService } from '@app/fuv/services/prefetch.service';
import { PrintService } from '@app/fuv/services/print.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { OfferteDateHelper } from '@app/fuv/utils/offerte-field-helpers';
import { calculateContractEndDate } from '@app/shared/utils/date-helpers';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, AuthService, LogFactoryService, Logger } from '@syrius/core';

import { AbschlussComponent } from './abschluss/abschluss.component';
import { AntragsfragenComponent } from './antragsfragen/antragsfragen.component';
// Import step components
import { FuvBetriebComponent } from './fuv-betrieb/fuv-betrieb.component';
import { NachbearbeitungComponent } from './nachbearbeitung/nachbearbeitung.component';
import {
    DEFAULT_AUFGABE_AUSFUEHRENDER, GENEHMIGUNG_ART_REJECTED, OFFERTE_ART_UNV, OFFERTE_ART_VERL,
    OFFERTE_STATUS_ABSCHLUSS, OFFERTE_STATUS_BEARBEITUNG, OFFERTE_STATUS_NEU,
    OFFERTE_STATUS_REJECTED, WFD_FUV_OFFERTE_NACHFASSEN
} from './police.constants';
import { TaetigkeitComponent } from './taetigkeit/taetigkeit.component';
import { VariantenComponent } from './varianten/varianten.component';
import { VersichertePersonComponent } from './versicherte-person/versicherte-person.component';

@Component({
    selector: 'app-offerte-police',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        StepsModule,
        ButtonModule,
        DialogModule,
        TooltipModule,
        InputTextModule,
        SelectModule,
        TextareaModule,
        ProgressSpinnerModule,
        VersichertePersonComponent,
        FuvBetriebComponent,
        TaetigkeitComponent,
        VariantenComponent,
        AntragsfragenComponent,
        AbschlussComponent,
        NachbearbeitungComponent,
        TranslateModule
    ],
    templateUrl: './police.component.html'
})
export class PoliceComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(TaetigkeitComponent) taetigkeitComponent?: TaetigkeitComponent;
    @ViewChild(VariantenComponent) variantenComponent?: VariantenComponent;
    @ViewChild(AntragsfragenComponent) antragsfragenComponent?: AntragsfragenComponent;
    @ViewChild(AbschlussComponent) abschlussComponent?: AbschlussComponent;
    @ViewChild('scrollTarget', { read: ElementRef }) scrollTargetRef?: ElementRef;

    private translate = inject(TranslateService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private location = inject(Location);
    private logFactory = inject(LogFactoryService);
    readonly offerteStore = inject(OfferteTypedStore);
    private offerteService = inject(OfferteService);
    private betriebService = inject(BetriebService);
    private personService = inject(PersonService);
    private printService = inject(PrintService);
    private codesService = inject(CodesService);
    private checklisteModalService = inject(ChecklisteModalService);
    private prefetchService = inject(PrefetchService);
    private authService = inject(AuthService);
    private messageService = inject(AppMessageService);
    private logger: Logger;
    private lastCreationTrigger: string | null = null;

    items: MenuItem[] = [];
    activeIndex: number = 0;
    completedSteps: Set<number> = new Set();
    displayDuplicateDialog: boolean = false;
    duplicateOffertenr: string = '';

    // Task creation dialog for "Unverbindliche Offerte drucken"
    displayTaskDialog: boolean = false;
    taskData = {
        aufgabeart: '',
        titel: '',
        faelligAm: '',
        zugewiesenAn: '',
        beschreibung: '',
        automatischeBeschreibung: ''
    };

    // Available aufgabenart options from codes table
    aufgabenartOptions: Array<{ label: string; value: string }> = [];

    // Current offerte from store
    currentOfferte = this.offerteStore.currentOfferte;

    // View mode (read-only) from store metadata
    viewMode = this.offerteStore.isReadOnly;

    // Current offertenr (from route)
    currentOffertenr: string = 'new';

    // Loading state signal - tracks whether initial data load is complete
    // This prevents UI flickering while async operations complete
    private isLoadingComplete = signal(false);

    // Blocking loading state - shows full-screen loader during initial data fetch
    // When opening an existing offerte, this blocks all interaction until data is loaded
    isInitialDataLoading = signal(false);

    // Computed: Check if VTT has rejected the offerte
    isVttRejected = computed(() => {
        const offerte = this.currentOfferte();
        const fragebogen = offerte?.fragebogen;
        return !!(fragebogen?.genehmigung_art && GENEHMIGUNG_ART_REJECTED.includes(fragebogen.genehmigung_art));
    });

    // Computed: Check if offerte has been rejected (ablehnungsgrund is filled)
    isOfferteRejected = computed(() => {
        const offerte = this.currentOfferte();
        return !!offerte?.ablehnungsgrund;
    });

    // Computed: Check if offerte has been policiert (policiert_am is set)
    isOffertePoliciert = computed(() => {
        const offerte = this.currentOfferte();
        return !!offerte?.policiert_am;
    });

    // Computed: Check if checkliste exists in the current offerte
    hasCheckliste = computed(() => {
        // Don't evaluate until initial loading is complete to prevent flickering
        if (!this.isLoadingComplete()) {
            this.logger.debug('[PoliceComponent] hasCheckliste computed: WAITING FOR DATA LOAD');
            return false;
        }

        const offerte = this.currentOfferte();

        // Handle both array (from backend inconsistency) and single object
        // Also guard against empty arrays
        let checkliste;
        if (Array.isArray(offerte?.checkliste)) {
            checkliste = offerte.checkliste.length > 0 ? offerte.checkliste[0] : undefined;
        } else {
            checkliste = offerte?.checkliste;
        }

        const hasIt = !!(checkliste && checkliste.id);

        // Log with timestamp to track flickering
        this.logger.debug(`[${new Date().toISOString()}] hasCheckliste computed:`, {
            isLoadingComplete: this.isLoadingComplete(),
            hasCheckliste: hasIt,
            offertenr: offerte?.offertenr,
            checklisteRaw: offerte?.checkliste,
            isArray: Array.isArray(offerte?.checkliste),
            arrayLength: Array.isArray(offerte?.checkliste) ? offerte.checkliste.length : 'N/A',
            checkliste: checkliste,
            checklisteId: checkliste?.id,
            stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n') // Show where this was called from
        });
        return hasIt;
    });

    // Computed: Get the translation key for the print button label based on offerte art
    printButtonLabelKey = computed(() => {
        const offerte = this.currentOfferte();
        const art = offerte?.art;

        // Check if it's a Verlängerungsofferte
        if (art === OFFERTE_ART_VERL) {
            return 'fuv.police.buttons.verlaengerungsofferteDrucken';
        }

        // Default to Offertantrag drucken
        return 'fuv.police.buttons.offertantragDrucken';
    });

    // Data passed from person-search or betrieb-search (for initial navigation)

    // Store the previous URL to navigate back
    private previousUrl: string | null = null;

    // Navigation-driven read-only state to apply once store entries exist
    private pendingViewMode: boolean | null = null;

    constructor() {
        this.logger = this.logFactory.createLogger('PoliceComponent');

        // Watch for changes to ablehnungsgrund or policiert_am and automatically enable viewMode (read-only)
        // This ensures that when an offerte is rejected or policiert during the session, it becomes read-only
        effect(() => {
            const offerte = this.currentOfferte();
            const meta = this.offerteStore.currentMeta();
            const isReadOnly = meta?.isReadOnly ?? false;

            if (offerte?.ablehnungsgrund && !isReadOnly) {
                this.logger.debug('Ablehnungsgrund detected in effect - enabling view mode (read-only):', offerte.ablehnungsgrund);
                this.offerteStore.setReadOnlyFor(true);
            }
            if (offerte?.policiert_am && !isReadOnly) {
                this.logger.debug('Policiert_am detected in effect - enabling view mode (read-only):', offerte.policiert_am);
                this.offerteStore.setReadOnlyFor(true);
            }
        });

        // React when both person and betrieb are available on a new offerte to trigger creation flow
        effect(
            () => {
                const offerte = this.currentOfferte();
                if (!offerte) {
                    return;
                }

                const hasPerson = !!(offerte.person_boid && offerte.person);
                const hasBetrieb = !!(offerte.betrieb_boid && offerte.betrieb);
                const isNewOfferteRoute = this.route.snapshot.paramMap.get('offertenr') === 'new';
                const triggerKey = hasPerson && hasBetrieb ? `${offerte.person_boid}-${offerte.betrieb_boid}` : null;

                if (!isNewOfferteRoute || offerte.id || !triggerKey) {
                    return;
                }

                if (this.lastCreationTrigger === triggerKey) {
                    return;
                }

                this.lastCreationTrigger = triggerKey;
                this.logger.debug('Both Person and Betrieb detected via signals - verifying duplicates before creation:', triggerKey);

                this.checkForDuplicates().then((hasDuplicate) => {
                    if (hasDuplicate) {
                        this.logger.warn('Duplicate detected via reactive watcher - skipping offerte creation');
                        return;
                    }
                    this.checkAndCreateOfferteIfReady(true);
                });
            },
            { allowSignalWrites: true }
        );

        // Watch prefetch service to hide loading dialog only when checkliste is loaded
        // This prevents the dialog from disappearing too early
        effect(() => {
            const checklisteStatus = this.prefetchService.checklistePrefetchStatus();
            const isLoading = this.isInitialDataLoading();

            this.logger.debug('🔍 Prefetch effect triggered:', {
                isLoading,
                checklisteStatus,
                offertenr: this.currentOffertenr
            });

            // Only hide the dialog if we're currently showing it AND checkliste prefetch has completed
            // (either successfully found or confirmed as non-existent)
            if (isLoading && checklisteStatus.attempted) {
                this.logger.debug('✅ Checkliste prefetch completed - hiding loading dialog');
                this.isInitialDataLoading.set(false);
            }
        });
    }

    ngOnInit() {
        // Initialize steps with translations
        this.initializeSteps();

        // Subscribe to language changes to update labels
        this.translate.onLangChange.subscribe(() => {
            this.initializeSteps();
        });

        // Store the previous URL from navigation state or browser history
        const state = window.history.state;
        this.setPendingViewModeFromState(state);

        // Check if navigationId > 1 (means we navigated from somewhere, not a direct page load)
        if (state && state.navigationId && state.navigationId > 1) {
            // Try to get the previous URL from the navigation state
            const stateUrl = state.previousUrl || null;
            if (stateUrl) {
                // Store in offerte store to persist across page reloads
                this.offerteStore.setPreviousUrl(stateUrl);
                this.previousUrl = stateUrl;
            } else {
                // Try to get from store (in case of page reload)
                this.previousUrl = this.offerteStore.previousUrl();
            }
        } else {
            // Page reload or direct navigation - try to get previousUrl from store
            this.previousUrl = this.offerteStore.previousUrl();
        }

        this.logger.debug('Police component - checking history state:', state);
        this.logger.debug('Previous URL (from state or store):', this.previousUrl);

        // Check if we're loading an existing offerte by offertenr
        const offertenr = this.route.snapshot.paramMap.get('offertenr');
        this.currentOffertenr = offertenr || 'new';

        // Set the current offertenr in the store FIRST (to check for existing data)
        this.offerteStore.setKey(this.currentOffertenr);

        // Check if we have existing data in the store (from sessionStorage)
        const existingOfferte = this.offerteStore.currentOfferte();
        const hasNavigationState = !!state?.offerteData;

        this.logger.debug('🔍 Store check on page load:', {
            offertenr: this.currentOffertenr,
            hasExistingData: !!existingOfferte,
            hasNavigationState: hasNavigationState,
            existingData: existingOfferte
                ? {
                      hasPerson: !!existingOfferte.person,
                      hasBetrieb: !!existingOfferte.betrieb,
                      hasTaetigkeit: !!existingOfferte.bb,
                      hasVarianten: !!existingOfferte.variante
                  }
                : null
        });

        // Decide whether to preserve or reload data
        if (existingOfferte && !hasNavigationState) {
            // Data exists in store and we're not navigating from another page
            // This is a page refresh - preserve the data!
            this.logger.debug('✅ Page refresh detected - preserving data from sessionStorage');
            this.populateFromOfferteData(existingOfferte);
            if (this.isOfferteDataIncomplete(existingOfferte)) {
                this.logger.debug('Stored offerte is missing nested data - fetching full record from backend', {
                    offertenr: existingOfferte.offertenr,
                    hasBb: !!existingOfferte.bb,
                    hasBbMerkmale: !!existingOfferte.bb?.bb2merkmal?.length
                });
                this.isInitialDataLoading.set(true);
                this.loadExistingOfferte(this.currentOffertenr, existingOfferte.id);
            }
        } else if (offertenr && offertenr !== 'new') {
            // Loading an existing offerte by number
            if (hasNavigationState) {
                this.logger.debug('Using offerte data from navigation state - no API call needed');
                this.populateFromOfferteData(state.offerteData);
                if (this.isOfferteDataIncomplete(state.offerteData)) {
                    this.logger.debug('Navigation state offerte is incomplete - fetching full record from backend', {
                        offertenr,
                        hasBb: !!state.offerteData?.bb,
                        hasBbMerkmale: !!state.offerteData?.bb?.bb2merkmal?.length
                    });
                    this.isInitialDataLoading.set(true);
                    this.loadExistingOfferte(offertenr, state.offerteData?.id);
                }
            } else {
                // Fallback: Load from backend if data not available
                // Show blocking loader while fetching data
                this.logger.debug('No data in store or navigation - loading from backend');
                this.isInitialDataLoading.set(true);
                this.loadExistingOfferte(offertenr);
            }
        } else if (offertenr === 'new') {
            // New offerte
            if (hasNavigationState) {
                this.logger.debug('Using offerte data from navigation state for new offerte');
                this.populateFromOfferteData(state.offerteData);
            } else if (!existingOfferte) {
                // No existing data - fresh start, clear and initialize
                this.logger.debug('🧹 Fresh start - clearing store and initializing');
                this.offerteStore.clearAll();
                this.offerteStore.setKey(this.currentOffertenr);
                this.clearSavedStep();
                this.initializeOfferte(state);
            }
            // else: existingOfferte already handled above (page refresh case)
        }

        // Restore saved wizard step from offerte store (sessionStorage)
        this.restoreSavedStep();

        // Update step styles after checking for initial data
        this.updateStepStyles();

        // Mark loading as complete - UI can now show actual state
        // For page reloads: data is already in sessionStorage, show immediately
        // For new loads: checkliste will load async and trigger update via store signal
        this.markLoadingComplete();
    }

    /**
     * Mark that initial data loading is complete
     * This enables reactive UI elements like the checkliste button
     */
    private markLoadingComplete(): void {
        const offerte = this.offerteStore.currentOfferte();
        this.logger.debug('🔍 Marking loading complete', {
            offertenr: offerte?.offertenr,
            hasCheckliste: !!offerte?.checkliste,
            checklisteId: offerte?.checkliste?.id || (Array.isArray(offerte?.checkliste) && offerte.checkliste.length > 0 ? offerte.checkliste[0]?.id : null)
        });
        this.isLoadingComplete.set(true);
        this.logger.debug('✅ Component loading complete - UI ready');
    }

    /**
     * Detect if provided offerte data misses critical nested structures
     * Used to decide when we still need to fetch full details from the backend
     */
    private isOfferteDataIncomplete(offerte?: Offerte | null): boolean {
        if (!offerte) {
            return true;
        }

        const missingPerson = !(offerte.person_boid && offerte.person);
        const missingBetrieb = !(offerte.betrieb_boid && offerte.betrieb);
        const missingTaetigkeit = !offerte.bb || !offerte.bb.bb2merkmal || offerte.bb.bb2merkmal.length === 0;

        return missingPerson || missingBetrieb || missingTaetigkeit;
    }

    /**
     * Load existing offerte from backend by offertenr
     */
    private loadExistingOfferte(offertenr: string, id?: number | string | null): void {
        this.logger.debug('Loading existing offerte', { offertenr, id });

        const source$ = id ? this.offerteService.getOfferteById(id.toString()) : this.offerteService.searchOfferten({ offertenr }).pipe(map((offerten) => (offerten && offerten.length > 0 ? offerten[0] : undefined)));

        source$.subscribe({
            next: (offerte) => {
                if (offerte) {
                    this.logger.debug('Loaded complete offerte:', {
                        offertenr: offerte.offertenr,
                        id: offerte.id,
                        hasPerson: !!offerte.person,
                        hasBetrieb: !!offerte.betrieb,
                        hasTaetigkeit: !!offerte.bb,
                        hasBB: !!offerte.bb,
                        hasVarianten: !!offerte.variante,
                        variantenCount: offerte.variante?.length,
                        status: offerte.status,
                        hasCheckliste: !!offerte.checkliste
                    });

                    // Store complete offerte in store using proper setOfferte method
                    this.offerteStore.setOfferte(offertenr, offerte);
                    this.applyPendingViewMode();

                    // Check if offerte was declined (ablehnungsgrund is filled)
                    // If yes, automatically enable view mode (read-only) for the entire wizard
                    if (offerte.ablehnungsgrund) {
                        this.logger.debug('Offerte has ablehnungsgrund - enabling view mode (read-only):', offerte.ablehnungsgrund);
                        this.offerteStore.setReadOnlyFor(true);
                    }

                    // Auto-navigate to step 3 (Tätigkeit) for Verlängerung
                    if (offerte.art === OFFERTE_ART_VERL) {
                        this.logger.debug('Verlängerung detected - auto-navigating to step 3 (Tätigkeit)');
                        this.activeIndex = 2; // Step 3 "Tätigkeit" is index 2 (0=Person, 1=Betrieb, 2=Tätigkeit)
                    }

                    this.logger.debug('Offerte loaded and ready for editing');

                    // Note: Dialog will be hidden by the effect when prefetch service completes checkliste fetch
                    this.logger.debug('Waiting for prefetch service to complete checkliste fetch...');
                } else {
                    this.logger.error('Offerte not found:', { offertenr, id });
                    this.messageService.showError(
                        this.translate.instant('fuv.police.messages.offerteNotFound', { offertenr })
                    );
                }

                // Hide blocking loader regardless of success
                this.isInitialDataLoading.set(false);
            },
            error: (error) => {
                this.logger.error('Failed to load offerte:', error);
                this.messageService.showError(this.translate.instant('fuv.police.messages.loadOfferteError'));
                this.isInitialDataLoading.set(false);
            }
        });
    }

    /**
     * Populate component from offerte data passed via navigation state
     * This avoids re-fetching data that we already have from the search results
     */
    private populateFromOfferteData(offerte: Offerte): void {
        this.logger.debug('✅ Populating component from provided offerte data:', {
            offertenr: offerte.offertenr,
            id: offerte.id,
            hasPerson: !!offerte.person,
            hasBetrieb: !!offerte.betrieb,
            hasTaetigkeit: !!offerte.bb,
            hasBB: !!offerte.bb,
            hasVarianten: !!offerte.variante,
            variantenCount: offerte.variante?.length,
            status: offerte.status,
            hasCheckliste: !!offerte.checkliste
        });

        // Store complete offerte in store using proper setOfferte method
        const offertenr = offerte.offertenr || this.currentOffertenr || 'new';
        this.offerteStore.setOfferte(offertenr, offerte);
        this.applyPendingViewMode();

        // Set person and betrieb for component references
        // person already stored in offerte store signal
        // betrieb already stored inside offerte store

        // Check if offerte was declined (ablehnungsgrund is filled)
        // If yes, automatically enable view mode (read-only) for the entire wizard
        if (offerte.ablehnungsgrund) {
            this.logger.debug('Offerte has ablehnungsgrund - enabling view mode (read-only):', offerte.ablehnungsgrund);
            this.offerteStore.setReadOnlyFor(true);
        }

        // Note: Validation and step style updates are now handled in ngAfterViewInit()
        // to ensure child components are fully initialized before checking their validation state

        // Auto-navigate to step 3 (Tätigkeit) for Verlängerung
        if (offerte.art === OFFERTE_ART_VERL) {
            this.logger.debug('Verlängerung detected - auto-navigating to step 3 (Tätigkeit)');
            this.activeIndex = 2; // Step 3 "Tätigkeit" is index 2 (0=Person, 1=Betrieb, 2=Tätigkeit)
        }

        this.logger.debug('Offerte ready for viewing/editing (no API call needed)');
    }

    /**
     * Validate all steps when loading an existing offerte
     * This ensures that completed steps are properly marked and accessible
     * Also explicitly triggers validation on child components to surface any issues
     */
    private validateAllStepsOnLoad(): void {
        this.logger.debug('🔍 Validating all steps on load...');
        const offerte = this.offerteStore.currentOfferte();

        // Step 0: Person
        if (this.isStepComplete(0)) {
            this.completedSteps.add(0);
            this.logger.debug('✅ Step 0 (Person) is complete');
        } else {
            this.logger.warn('⚠️ Step 0 (Person) is incomplete');
        }

        // Step 1: Betrieb
        if (this.isStepComplete(1)) {
            this.completedSteps.add(1);
            this.logger.debug('✅ Step 1 (Betrieb) is complete');
        } else {
            this.logger.warn('⚠️ Step 1 (Betrieb) is incomplete');
        }

        // Step 2: Tätigkeit - explicitly trigger validation if component exists
        if (this.taetigkeitComponent) {
            const isValid = this.taetigkeitComponent.isFormValid();
            this.logger.debug(`🔍 Tätigkeit component validation: ${isValid ? '✅ valid' : '❌ invalid'}`);
        }
        if (this.isStepComplete(2)) {
            this.completedSteps.add(2);
            this.logger.debug('✅ Step 2 (Tätigkeit) is complete');
        } else {
            this.logger.warn('⚠️ Step 2 (Tätigkeit) is incomplete');
        }

        // Step 3: Varianten - explicitly trigger validation if component exists
        if (this.variantenComponent) {
            const isValid = this.variantenComponent.isStepValid();
            this.logger.debug(`🔍 Varianten component validation: ${isValid ? '✅ valid' : '❌ invalid'}`);
        }
        if (this.isStepComplete(3)) {
            this.completedSteps.add(3);
            this.logger.debug('✅ Step 3 (Varianten) is complete');
        } else {
            this.logger.warn('⚠️ Step 3 (Varianten) is incomplete');
        }

        // Step 4: Antragsfragen - explicitly check if component exists
        if (this.antragsfragenComponent) {
            const isValid = this.antragsfragenComponent.isStepValid();
            this.logger.debug(`🔍 Antragsfragen component validation: ${isValid ? '✅ valid' : '❌ invalid'}`);
        }
        if (this.isStepComplete(4)) {
            this.completedSteps.add(4);
            this.logger.debug('✅ Step 4 (Antragsfragen) is complete');
        } else {
            this.logger.warn('⚠️ Step 4 (Antragsfragen) is incomplete');
        }

        // Step 5: Abschluss - explicitly check if component exists
        if (this.abschlussComponent) {
            const isValid = this.abschlussComponent.isStepValid();
            this.logger.debug(`🔍 Abschluss component validation: ${isValid ? '✅ valid' : '❌ invalid'}`);
        }
        if (this.isStepComplete(5)) {
            this.completedSteps.add(5);
            this.logger.debug('✅ Step 5 (Abschluss) is complete');
        } else {
            this.logger.warn('⚠️ Step 5 (Abschluss) is incomplete');
        }

        // Step 6: Nachbearbeitung
        if (this.isStepComplete(6)) {
            this.completedSteps.add(6);
            this.logger.debug('✅ Step 6 (Nachbearbeitung) is complete');
        }

        // Determine the target active step based on offerte type and completion status
        // Reuse the offerte variable declared at the beginning of this method
        const isVerlaengerung = offerte?.art === OFFERTE_ART_VERL;

        // For Verlängerung, navigate to Tätigkeit (step 2) if earlier steps are complete
        // This allows users to review/modify the pre-filled Tätigkeit data
        if (isVerlaengerung && this.isStepComplete(0) && this.isStepComplete(1)) {
            this.activeIndex = 2; // Tätigkeit step
            this.logger.debug('📍 Verlängerung: Setting active step to 2 (Tätigkeit)');
        } else {
            // For regular offerten or when early steps incomplete, find first incomplete step
            let firstIncompleteStep = -1;
            for (let i = 0; i < this.items.length; i++) {
                if (!this.isStepComplete(i)) {
                    firstIncompleteStep = i;
                    break;
                }
            }

            if (firstIncompleteStep !== -1) {
                this.activeIndex = firstIncompleteStep;
                this.logger.debug(`📍 Setting active step to ${firstIncompleteStep} (first incomplete step)`);
            } else {
                // All steps complete, go to last step
                this.activeIndex = this.items.length - 1;
                this.logger.debug('📍 All steps complete, setting active step to last step');
            }
        }

        // Save the active step
        this.saveCurrentStep();

        this.logger.debug('🏁 Step validation complete:', {
            completedSteps: Array.from(this.completedSteps),
            activeIndex: this.activeIndex
        });
    }

    /**
     * Initialize offerte from navigation state or store
     */
    private initializeOfferte(state: any): void {
        // Check if we have a stored offerte in the store
        const storedOfferte = this.offerteStore.currentOfferte();

        // Check if this is a "new" offerte route
        const isNewOfferte = this.route.snapshot.paramMap.get('offertenr') === 'new';

        // Handle person from navigation state (coming from person-search)
        if (state && state.selectedPerson) {
            this.logger.debug('Found selectedPerson in state:', state.selectedPerson);

            // Update or create offerte with person data
            this.offerteStore.updateOfferte(null, {
                person_boid: state.selectedPerson.boid || state.selectedPerson.partnernr,
                person: state.selectedPerson
            });

            // Mark step 0 as completed since we have person data
            this.completedSteps.add(0);
            // Start at step 1 (FUV Betrieb)
            this.activeIndex = 1;
        } else if (storedOfferte?.person) {
            // Restore person from store
            this.completedSteps.add(0);
        }

        // Handle betrieb from navigation state (coming from betrieb-search)
        if (state && state.selectedBetrieb) {
            this.logger.debug('Found selectedBetrieb in state:', state.selectedBetrieb);

            // Update offerte with betrieb data
            this.offerteStore.updateOfferte(null, {
                betrieb_boid: state.selectedBetrieb.boid || state.selectedBetrieb.partnernr,
                betrieb: state.selectedBetrieb
            });

            // Mark step 1 as completed since we have betrieb data
            this.completedSteps.add(1);
        } else if (storedOfferte?.betrieb) {
            // Restore betrieb from store
            this.completedSteps.add(1);
        }

        // If no offerte exists in store and no navigation data, create new empty offerte
        if (!storedOfferte && !state?.selectedPerson && !state?.selectedBetrieb) {
            this.logger.debug('Creating new empty offerte');
            this.offerteStore.setOfferte(this.currentOffertenr, {} as Offerte);
            this.applyPendingViewMode();
        }

        this.logger.debug('Offerte initialized:', this.offerteStore.currentOfferte());

        // Check if we should create the offerte in backend now
        // Only create after BOTH person AND betrieb are completed
        this.checkAndCreateOfferteIfReady(isNewOfferte);
    }

    /**
     * Check if both Step 1 (Person) and Step 2 (Betrieb) are completed and create offerte if ready
     * Offerte should only be created in backend when we have both person_boid AND betrieb_boid
     * This is called after completing Step 2 (FUV Betrieb)
     * Flow: refreshFuvPerson + refreshFuvBetrieb → insertFuvOfferte → updateFuvOfferte → saveFuvAnspruchsberechtigte
     */
    private async checkAndCreateOfferteIfReady(isNewOfferte: boolean): Promise<void> {
        const currentOfferte = this.offerteStore.currentOfferte();

        this.logger.debug('🔍 checkAndCreateOfferteIfReady called:', {
            isNewOfferte,
            hasId: !!currentOfferte?.id,
            hasPerson: !!currentOfferte?.person_boid,
            hasBetrieb: !!currentOfferte?.betrieb_boid,
            personBoid: currentOfferte?.person_boid,
            betriebBoid: currentOfferte?.betrieb_boid
        });

        // Check if we already have an ID (offerte already created)
        if (currentOfferte?.id) {
            this.logger.debug('Offerte already has ID, skipping creation');
            return;
        }

        // Check if this is a new offerte route
        if (!isNewOfferte) {
            this.logger.debug('Not a new offerte route, skipping creation');
            return;
        }

        // Check if both person AND betrieb are present
        const hasPerson = !!(currentOfferte?.person_boid && currentOfferte?.person);
        const hasBetrieb = !!(currentOfferte?.betrieb_boid && currentOfferte?.betrieb);

        if (hasPerson && hasBetrieb) {
            this.logger.debug('✅ Both Person and Betrieb completed - triggering person and betrieb refresh before creating offerte');

            // IMPORTANT: Call refreshFuvPerson and refreshFuvBetrieb before inserting/updating offerte
            // This triggers backend sync with Syrius but we keep existing person/betrieb data in store
            forkJoin({
                person: this.personService.refreshPerson(currentOfferte.person_boid!),
                betrieb: this.betriebService.refreshBetrieb(currentOfferte.betrieb_boid!)
            }).subscribe({
                next: () => {
                    this.logger.debug('✅ Person and Betrieb refresh triggered successfully (backend synced)');

                    // Now create the offerte (using existing person/betrieb data from store)
                    this.createOfferteInBackend();
                },
                error: (error) => {
                    this.logger.error('Failed to trigger person/betrieb refresh:', error);
                    // Continue anyway - don't block offerte creation
                    this.createOfferteInBackend();
                }
            });
        } else {
            this.logger.debug('⏳ Waiting for both Person and Betrieb to be completed', {
                hasPerson,
                hasBetrieb
            });
        }
    }

    /**
     * Check if an offerte already exists for this person/betrieb combination
     * Returns a Promise that resolves to true if duplicate exists, false if not
     * This is called as soon as both person_boid and betrieb_boid are available
     */
    private checkForDuplicates(): Promise<boolean> {
        const currentOfferte = this.offerteStore.currentOfferte();

        if (!currentOfferte?.person_boid || !currentOfferte?.betrieb_boid) {
            this.logger.error('Cannot check for existing offerte - missing BOIDs');
            return Promise.resolve(false); // Can't check, allow proceeding
        }

        this.logger.debug('Checking for existing offerte:', {
            person_boid: currentOfferte.person_boid,
            betrieb_boid: currentOfferte.betrieb_boid
        });

        return new Promise((resolve) => {
            // Search for existing offerten with this person/betrieb combination
            this.offerteService
                .searchOfferte({
                    person_boid: currentOfferte.person_boid,
                    betrieb_boid: currentOfferte.betrieb_boid
                })
                .subscribe({
                    next: (existingOfferten) => {
                        if (existingOfferten && existingOfferten.length > 0) {
                            // Offerte already exists for this combination
                            this.logger.warn('Offerte already exists for this person/betrieb combination:', existingOfferten);
                            this.handleExistingOfferteFound(existingOfferten);
                            resolve(true); // Duplicate found - don't proceed
                        } else {
                            // No existing offerte - safe to proceed
                            this.logger.debug('No existing offerte found - can proceed');
                            resolve(false); // No duplicate - can proceed
                        }
                    },
                    error: (error) => {
                        this.logger.error('Error checking for existing offerte:', error);
                        // If error occurs, allow proceeding (fail-safe)
                        // TODO: Show error message to user
                        resolve(false); // Allow proceeding on error
                    }
                });
        });
    }

    /**
     * Handle case where offerte already exists for this person/betrieb combination
     * Show dialog to user and prepare for navigation back
     */
    private handleExistingOfferteFound(existingOfferten: Offerte[]): void {
        const offertenrList = existingOfferten.map((o) => o.offertenr).join(', ');

        this.logger.warn('Offerte already exists - showing dialog:', offertenrList);

        // Store the offerte number for display in dialog
        this.duplicateOffertenr = offertenrList;

        // Show the duplicate dialog
        this.displayDuplicateDialog = true;
    }

    /**
     * Called when user closes the duplicate offerte dialog
     * Clears the offerte state and navigates back to previous page
     */
    closeDuplicateDialog(): void {
        this.displayDuplicateDialog = false;

        this.logger.warn('Duplicate offerte detected - clearing state and navigating back');

        // Clear the current offerte state since this combination is not allowed
        this.offerteStore.deleteOfferte(null);
        this.logger.debug('Offerte state cleared');

        // Navigate back to previous page (person-detail or betrieb-detail)
        if (this.previousUrl) {
            this.logger.debug('Navigating to previous URL:', this.previousUrl);
            this.router.navigateByUrl(this.previousUrl);
        } else {
            // Fallback: use browser back
            this.logger.debug('Using browser back navigation');
            this.location.back();
        }
    }

    /**
     * Get the latest AVB code from codes service
     * Fetches codes from gruppe 'COT_FUV_AB' and returns the one with highest sorter
     * @returns Promise that resolves to the AVB code (e.g., 'COD_FUV_AVB_01_2026')
     */
    private async getLatestAvbCode(): Promise<string> {
        const DEFAULT_AVB = 'COD_FUV_AVB_01_2026'; // Fallback default

        try {
            const codes = await this.codesService.getCodesByGruppe('COT_FUV_AB').toPromise();

            if (!codes || codes.length === 0) {
                this.logger.warn('No AVB codes found in gruppe COT_FUV_AB, using default:', DEFAULT_AVB);
                return DEFAULT_AVB;
            }

            // Sort by sorter (number) in descending order and take the first one
            const sortedCodes = codes
                .filter((code) => code.sorter !== undefined && code.sorter !== null)
                .sort((a, b) => {
                    const sorterA = typeof a.sorter === 'number' ? a.sorter : parseInt(a.sorter as string, 10);
                    const sorterB = typeof b.sorter === 'number' ? b.sorter : parseInt(b.sorter as string, 10);
                    return sorterB - sorterA; // Descending order (highest first)
                });

            if (sortedCodes.length > 0) {
                const latestCode = sortedCodes[0].internal_name;
                this.logger.debug('Using latest AVB code:', latestCode, 'with sorter:', sortedCodes[0].sorter);
                return latestCode;
            }

            this.logger.warn('No AVB codes with sorter found, using default:', DEFAULT_AVB);
            return DEFAULT_AVB;
        } catch (error) {
            this.logger.error('Error fetching AVB codes:', error);
            return DEFAULT_AVB;
        }
    }

    /**
     * Create offerte in backend and update URL with returned offertenr
     * Called after completing Step 2 (FUV Betrieb) when both Person and Betrieb are available
     * Flow: insertFuvOfferte → updateFuvOfferte → saveFuvAnspruchsberechtigte
     */
    private async createOfferteInBackend(): Promise<void> {
        const currentOfferte = this.offerteStore.currentOfferte();

        this.logger.debug('createOfferteInBackend called with offerte:', {
            hasPerson: !!currentOfferte?.person,
            hasBetrieb: !!currentOfferte?.betrieb,
            person_boid: currentOfferte?.person_boid,
            betrieb_boid: currentOfferte?.betrieb_boid,
            betrieb: currentOfferte?.betrieb
        });

        if (!currentOfferte) {
            this.logger.error('Cannot create offerte - no offerte in store');
            return;
        }

        // Validate that both person_boid AND betrieb_boid are present
        if (!currentOfferte.person_boid || !currentOfferte.betrieb_boid) {
            this.logger.error('Cannot create offerte - missing person_boid or betrieb_boid', {
                person_boid: currentOfferte.person_boid,
                betrieb_boid: currentOfferte.betrieb_boid,
                hasPerson: !!currentOfferte.person,
                hasBetrieb: !!currentOfferte.betrieb
            });
            return;
        }

        // Prepare the minimal offerte data for insertion
        const now = new Date();
        const gueltab = OfferteDateHelper.toDateOnly(now)!;
        const defaultDurationYears = 4;
        const endDate = calculateContractEndDate(now, defaultDurationYears) || now;
        // gueltbis = +67 days (initial validity window)
        const gueltbisDate = new Date(now);
        gueltbisDate.setDate(gueltbisDate.getDate() + 67);
        const gueltbis = OfferteDateHelper.toDateOnly(gueltbisDate) || gueltab;
        // ablaufdatum = 4-year contract end (used in Tätigkeit step)
        const ablaufdatum = OfferteDateHelper.toDateOnly(endDate) || gueltab;

        // Get the latest AVB code from codes service
        const avbCode = await this.getLatestAvbCode();
        this.logger.debug('Using AVB code for new offerte:', avbCode);

        const offerteToInsert: Partial<Offerte> = {
            art: OFFERTE_ART_UNV,
            status: 'Offerte_Neu',
            gueltab: gueltab,
            gueltbis: gueltbis,
            ablaufdatum: ablaufdatum,
            avb: avbCode, // Use dynamically fetched AVB code
            person_boid: currentOfferte.person_boid,
            betrieb_boid: currentOfferte.betrieb_boid
        };

        this.logger.debug('Inserting new offerte:', offerteToInsert);

        this.offerteService.insertOfferte(offerteToInsert).subscribe({
            next: (response) => {
                this.logger.debug('Offerte created successfully:', response);

                // Response is an array with the created offerte
                const createdOfferte = Array.isArray(response) ? response[0] : response;

                if (createdOfferte && createdOfferte.offertenr) {
                    // Log the created offerte ID for debugging
                    this.logger.debug('Offerte created with ID:', createdOfferte.id);

                    // Update store with the complete offerte data (including id and offertenr)
                    this.offerteStore.updateOfferte(null, {
                        id: createdOfferte.id,
                        offertenr: createdOfferte.offertenr,
                        created: createdOfferte.created,
                        updated: createdOfferte.updated,
                        art: createdOfferte.art,
                        status: createdOfferte.status,
                        gueltab: createdOfferte.gueltab,
                        gueltbis: createdOfferte.gueltbis,
                        ablaufdatum: createdOfferte.ablaufdatum,
                        avb: createdOfferte.avb,
                        person: createdOfferte.person,
                        betrieb: createdOfferte.betrieb
                    });

                    // Verify store was updated
                    const verifyOfferte = this.offerteStore.currentOfferte();
                    this.logger.debug('✅ Store updated - offerte ID in store:', verifyOfferte?.id);

                    // After insert, immediately call updateFuvOfferte to set all additional fields
                    // This is required by the backend workflow
                    this.logger.debug('Calling updateFuvOfferte after insert with complete offerte data');
                    const offerteToUpdate = {
                        ...currentOfferte, // Include all fields from store
                        id: createdOfferte.id, // Use the ID we just got
                        offertenr: createdOfferte.offertenr,
                        created: createdOfferte.created,
                        updated: createdOfferte.updated,
                        art: createdOfferte.art,
                        status: createdOfferte.status,
                        gueltab: createdOfferte.gueltab,
                        gueltbis: createdOfferte.gueltbis,
                        ablaufdatum: createdOfferte.ablaufdatum,
                        avb: createdOfferte.avb,
                        person: createdOfferte.person,
                        betrieb: createdOfferte.betrieb
                    };

                    this.offerteService.updateOfferte(offerteToUpdate).subscribe({
                        next: (updateResponse) => {
                            this.logger.debug('✅ Offerte updated successfully after insert:', updateResponse);

                            // Update store with the response including BB data
                            const updatedOfferte = Array.isArray(updateResponse) ? updateResponse[0] : updateResponse;
                            if (updatedOfferte) {
                                this.logger.debug('Updating store with initial BB data:', {
                                    hasBB: !!updatedOfferte.bb,
                                    bb_boid: updatedOfferte.bb_boid,
                                    bb2merkmalCount: updatedOfferte.bb?.bb2merkmal?.length
                                });

                                this.offerteStore.updateOfferte(null, {
                                    bb: updatedOfferte.bb,
                                    bb_boid: updatedOfferte.bb_boid,
                                    updated: updatedOfferte.updated
                                });
                            }
                        },
                        error: (updateError) => {
                            this.logger.error('Failed to update offerte after insert:', updateError);
                            // Don't block user - continue anyway
                        }
                    });

                    // Rewrite URL from "/offerte/police/new" to "/offerte/police/{offertenr}"
                    this.logger.debug('Rewriting URL to:', createdOfferte.offertenr);

                    // Update currentOffertenr to the actual offertenr
                    this.currentOffertenr = createdOfferte.offertenr;

                    this.router.navigate(['fuv', 'offerte', 'police', createdOfferte.offertenr], {
                        replaceUrl: true, // Replace history entry instead of adding new one
                        state: {
                            previousUrl: this.previousUrl
                        }
                    });

                    this.logger.debug('Offerte creation complete - user can now proceed to next steps');
                }
            },
            error: (error) => {
                this.logger.error('Failed to create offerte:', error);
                // TODO: Show error message to user
            }
        });
    }

    /**
     * Handler for when taetigkeit defaults are applied
     * Auto-saves to backend to ensure defaults survive page reloads
     */
    onTaetigkeitDefaultsApplied(): void {
        this.logger.debug('[PoliceComponent] Taetigkeit defaults applied, auto-saving to backend to prevent recalculation on reload...');

        // Small delay to ensure store is updated with default values
        setTimeout(() => {
            this.autoSaveOfferte();
        }, 100);
    }

    /**
     * Handler for when BB calculation is complete in Varianten component
     * Persists the calculated BB data to the backend
     */
    onBBCalculated(): void {
        this.logger.log('BB calculation complete, persisting to backend');
        this.autoSaveOfferte();
    }

    /**
     * Auto-save offerte to backend after completing each step (from step 2 onwards)
     * This ensures the backend is always in sync with the current state
     * IMPORTANT: The taetigkeit component is responsible for building and updating the BB object
     * The store should already have the bb data when we call this method
     */
    private autoSaveOfferte(): void {
        const currentOfferte = this.offerteStore.currentOfferte();

        if (!currentOfferte) {
            this.logger.debug('No offerte to save');
            return;
        }

        // Only save if offerte has been created (has ID)
        if (!currentOfferte.id) {
            this.logger.debug('Offerte not yet created - skipping auto-save');
            return;
        }

        // Prepare variant data if we have it
        let varianteData: any[] | undefined = undefined;
        if (this.activeIndex >= 3 && this.variantenComponent) {
            // Step 4 (Varianten) or later - include variant data in API format
            // Always call prepareVariantDataForApi to get current state (even if empty)
            varianteData = this.variantenComponent.prepareVariantDataForApi();
            this.logger.debug('Including variant data in auto-save:', {
                varianteCount: varianteData?.length,
                variants: varianteData
            });
        }

        this.logger.debug('Auto-saving offerte to backend:', {
            id: currentOfferte.id,
            offertenr: currentOfferte.offertenr,
            step: this.activeIndex,
            hasBB: !!currentOfferte.bb,
            bb_boid: currentOfferte.bb_boid,
            hasTaetigkeit: !!currentOfferte.bb,
            hasVarianten: !!varianteData,
            variantenCount: varianteData?.length,
            bb2merkmalInRequest: currentOfferte.bb?.bb2merkmal?.map((m: any) => ({
                id: m.id,
                merkmal_boid: m.merkmal_boid
            }))
        });

        // Build offerte update object
        const offerteToUpdate = {
            ...currentOfferte,
            variante: varianteData // Include variant data if available
        };

        // Update offerte in backend
        // NOTE: The bb object should already be in currentOfferte if taetigkeit data exists
        this.offerteService.updateOfferte(offerteToUpdate).subscribe({
            next: (response) => {
                this.logger.debug('Offerte auto-saved successfully');

                // Show subtle success toast
                this.messageService.showSuccess(this.translate.instant('fuv.police.messages.saveSuccess'), { life: 2000 });

                // Update store with response (in case backend modified any fields)
                // IMPORTANT: This includes the bb object with bb2merkmal IDs and variant IDs
                const updatedOfferte = Array.isArray(response) ? response[0] : response;
                if (updatedOfferte) {
                    this.logger.debug('Updating store with response including BB and variant data:', {
                        hasBB: !!updatedOfferte.bb,
                        bb2merkmalCount: updatedOfferte.bb?.bb2merkmal?.length,
                        bb2merkmalIds: updatedOfferte.bb?.bb2merkmal?.map((m: any) => m.id),
                        hasVariante: !!updatedOfferte.variante,
                        varianteCount: updatedOfferte.variante?.length,
                        varianteIds: updatedOfferte.variante?.map((v: any) => ({ id: v.id, variante: v.variante }))
                    });

                    // Prepare store update - only update variant data if backend actually returned it
                    // This prevents clearing local variant data when backend response doesn't include them
                    const storeUpdate: any = {
                        updated: updatedOfferte.updated,
                        bb: updatedOfferte.bb, // Update BB data including bb2merkmal with IDs
                        bb_boid: updatedOfferte.bb_boid
                    };

                    // Only update variant data if backend actually returned variants (not an empty array)
                    if (updatedOfferte.variante && updatedOfferte.variante.length > 0) {
                        storeUpdate.variante = updatedOfferte.variante; // Update variant data with IDs from backend
                        this.logger.debug('Including backend variant data in store update:', updatedOfferte.variante.length, 'variants');
                    } else {
                        this.logger.debug('Backend returned no variants - preserving existing variant data in store');
                    }

                    // Preserve signature-related fields from backend response
                    // unterschrieben_art and unterschrieben_am are stored in backend
                    if (updatedOfferte.unterschrieben_art !== undefined) {
                        storeUpdate.unterschrieben_art = updatedOfferte.unterschrieben_art;
                    }
                    if (updatedOfferte.unterschrieben_am !== undefined) {
                        storeUpdate.unterschrieben_am = updatedOfferte.unterschrieben_am;
                    }
                    this.offerteStore.updateOfferte(null, storeUpdate);
                }
            },
            error: (error) => {
                this.logger.error('Failed to auto-save offerte:', error);
                // Show error toast to user
                this.messageService.showError(this.translate.instant('fuv.police.messages.saveError'));
            }
        });
    }

    ngAfterViewInit() {
        // Scroll to stepper after view is initialized
        this.scrollToStepper();

        // Trigger validation after child components are fully initialized
        // This ensures that @ViewChild references (taetigkeitComponent, variantenComponent, etc.)
        // are available and their validation methods can be called
        setTimeout(() => {
            this.validateAllStepsOnLoad();
            this.updateStepStyles();
        }, 0);
    }

    ngOnDestroy() {
        // Clear the offerte store when component is destroyed
        // This ensures clean state when navigating away from the offerte wizard
        this.logger.debug('PoliceComponent destroyed - clearing offerte store');
        this.offerteStore.deleteOfferte(null);
    }

    initializeSteps() {
        // Labels will be translation keys
        this.items = [
            { label: this.translate.instant('fuv.police.steps.person'), command: () => this.goToStep(0) },
            { label: this.translate.instant('fuv.police.steps.betrieb'), command: () => this.goToStep(1) },
            { label: this.translate.instant('fuv.police.steps.taetigkeit'), command: () => this.goToStep(2) },
            { label: this.translate.instant('fuv.police.steps.varianten'), command: () => this.goToStep(3) },
            { label: this.translate.instant('fuv.police.steps.antragsfragen'), command: () => this.goToStep(4) },
            { label: this.translate.instant('fuv.police.steps.abschluss'), command: () => this.goToStep(5) },
            { label: this.translate.instant('fuv.police.steps.nachbearbeitung'), command: () => this.goToStep(6) }
        ];

        // Update class for items based on completion
        this.updateStepStyles();
    }

    goToStep(index: number) {
        // Check if we can proceed to this step
        if (!this.canProceedToStep(index)) {
            this.logger.warn(`Cannot proceed to step ${index} - validation failed`);
            return;
        }

        // If moving forward (not backward), execute the same validation and save logic as nextStep()
        if (index > this.activeIndex) {
            // Process each step between current and target
            for (let step = this.activeIndex; step < index; step++) {
                // Validate and save current step before moving forward
                if (!this.validateAndSaveCurrentStep(step)) {
                    this.logger.warn(`Cannot proceed to step ${index} - step ${step} validation or save failed`);
                    return;
                }

                // Mark the step as completed
                this.completedSteps.add(step);

                // Auto-save offerte after completing Step 3 (Tätigkeit) and onwards
                if (step >= 2) {
                    this.autoSaveOfferte();
                }
            }
        }

        this.activeIndex = index;
        this.updateStatusForStep(index);
        this.saveCurrentStep();
        this.updateStepStyles();
        this.scrollToStepper();
    }

    /**
     * Validate and save the current step data
     * Returns true if validation passed and data was saved successfully
     */
    private validateAndSaveCurrentStep(stepIndex: number): boolean {
        // Step 3: Tätigkeit (activeIndex=2)
        if (stepIndex === 2 && this.taetigkeitComponent) {
            const isValid = this.taetigkeitComponent.validateForm();
            if (!isValid) {
                this.logger.warn('Step 3 (Tätigkeit) validation failed - cannot proceed to next step');
                return false;
            }
            if (this.taetigkeitComponent.hasUnsavedChanges()) {
                this.taetigkeitComponent.onDataChange();
                this.logger.debug('✅ Step 3 (Tätigkeit) data persisted to store');
            } else {
                this.logger.debug('Step 3 (Tätigkeit) has no changes; skipping persist');
            }
        }

        // Step 4: Varianten (activeIndex=3)
        if (stepIndex === 3 && this.variantenComponent) {
            const isValid = this.variantenComponent.validateForm();
            if (!isValid) {
                this.logger.warn('Step 4 (Varianten) validation failed - cannot proceed to next step');
                this.logger.warn('Validation requirements: Selected variant must have jahresverdienst and taggeldAb filled, with no validation errors, and checkliste requirement met for non-yearly payment');
                return false;
            }

            if (this.variantenComponent.hasUnsavedChanges()) {
                this.variantenComponent.onDataChange();
                this.logger.debug('✅ Step 4 (Varianten) data persisted to store');
            } else {
                this.logger.debug('Step 4 (Varianten) has no changes; skipping persist');
            }
        }

        // Step 5: Antragsfragen (activeIndex=4)
        if (stepIndex === 4 && this.antragsfragenComponent) {
            const canProceed = this.antragsfragenComponent.promptVttTask();
            if (!canProceed) {
                return false;
            }
            this.antragsfragenComponent.saveAntragsfragen();
            this.logger.debug('✅ Step 5 (Antragsfragen) saved to backend');
        }

        // Step 6: Abschluss (activeIndex=5)
        // No validation required - users can proceed to Nachbearbeitung without signing
        if (stepIndex === 5 && this.abschlussComponent) {
            // The abschluss data (isSigned, unterschrieben_art, etc.) is already in the store
            // from AbschlussComponent.updateSignedState()
            // Now we need to persist it to the backend
            this.logger.debug('✅ Step 6 (Abschluss) - proceeding without signature validation');
        }

        return true;
    }

    /**
     * Update offerte status based on step progression
     * - Offerte_Neu is initial (set on insert/store default)
     * - Offerte_Offen when reaching Tätigkeit (step 2) the first time
     * - Offerte_Abschluss when entering Abschluss (step 5) or beyond, unless already rejected/signed
     */
    private updateStatusForStep(targetStep: number): void {
        const offerte = this.offerteStore.currentOfferte();
        if (!offerte || this.viewMode()) {
            return;
        }

        const currentStatus = offerte.status;

        // Move to Bearbeitung when hitting Tätigkeit (step 2 or later) if still Neu/empty
        if (targetStep >= 2 && (!currentStatus || currentStatus === OFFERTE_STATUS_NEU)) {
            this.offerteStore.updateOfferte(null, { status: OFFERTE_STATUS_BEARBEITUNG });
        }

        // Set Abschluss when entering Abschluss step (index 5) or later, unless already rejected
        if (targetStep >= 5 && currentStatus !== OFFERTE_STATUS_REJECTED) {
            if (currentStatus !== OFFERTE_STATUS_ABSCHLUSS) {
                this.offerteStore.updateOfferte(null, { status: OFFERTE_STATUS_ABSCHLUSS });
            }
        }
    }

    /**
     * Check if user can proceed to a specific step based on validation requirements
     */
    canProceedToStep(targetStep: number): boolean {
        // In read-only mode, allow navigation to any step
        if (this.viewMode()) {
            return true;
        }

        // Can always go back to previous steps
        if (targetStep <= this.activeIndex) {
            return true;
        }

        // Check each prerequisite step
        for (let step = 0; step < targetStep; step++) {
            if (!this.isStepComplete(step)) {
                this.logger.warn(`Cannot proceed to step ${targetStep} - step ${step} is not complete`);
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a specific step is complete and valid
     */
    isStepComplete(step: number): boolean {
        // In read-only mode, consider all steps complete to allow free navigation
        if (this.viewMode()) {
            return true;
        }

        const offerte = this.offerteStore.currentOfferte();

        switch (step) {
            case 0: // Step 1: Versicherte Person
                return !!(offerte?.person_boid && offerte?.person);

            case 1: // Step 2: FUV Betrieb
                return !!(offerte?.betrieb_boid && offerte?.betrieb);

            case 2: // Step 3: Tätigkeit
                // BB data is only present after successful taetigkeit validation and calculation
                if (offerte?.bb && offerte.bb.bb2merkmal && offerte.bb.bb2merkmal.length > 0) {
                    return true;
                }
                // If component is available and we don't have BB yet, check component validation
                if (this.taetigkeitComponent) {
                    return this.taetigkeitComponent.isFormValid();
                }
                // If no component available and no BB data, assume incomplete
                return false;

            case 3: // Step 4: Varianten
                // Must have calculated variants and selected one, no validation errors
                if (!this.variantenComponent) {
                    // If component not available, check store
                    return !!(offerte?.variante && offerte.variante.length > 0);
                }
                return this.variantenComponent.isStepValid();

            case 4: // Step 5: Antragsfragen
                // Check if offerte has progressed past this step (status indicates completion)
                if (offerte?.status && offerte.status !== 'Offerte_Neu') {
                    return true;
                }
                // All questions must be answered
                if (this.antragsfragenComponent) {
                    return this.antragsfragenComponent.isStepValid();
                }
                // Check store for antragsfragen data
                return !!offerte?.fragebogen;

            case 5: // Step 6: Abschluss
                // Check if offerte has been completed (status indicates completion)
                if (offerte?.status && (offerte.status === 'Offerte_Abgeschlossen' || offerte.status === 'Police_Aktiv')) {
                    return true;
                }
                // Must have digital signature or physical return confirmation
                if (this.abschlussComponent) {
                    return this.abschlussComponent.isStepValid();
                }
                // Check store for signature/confirmation
                return !!this.offerteStore.currentMeta()?.isSigned;

            case 6: // Step 7: Nachbearbeitung
                // Nachbearbeitung is always accessible after Abschluss
                return true;

            default:
                return true;
        }
    }

    nextStep() {
        // Validate and save current step before proceeding
        if (!this.validateAndSaveCurrentStep(this.activeIndex)) {
            return;
        }

        if (this.activeIndex < this.items.length - 1) {
            // Mark current step as completed
            this.completedSteps.add(this.activeIndex);

            // Auto-save offerte after completing Step 3 (Tätigkeit) and onwards
            // This syncs the current state with the backend after each completed step
            // Note: Offerte creation happens automatically when both Person and Betrieb are selected
            if (this.activeIndex >= 2) {
                this.autoSaveOfferte();
            }

            // Proceed to next step
            this.activeIndex++;
            this.saveCurrentStep();
            this.updateStepStyles();
            this.scrollToStepper();
        }
    }

    // Method called by antragsfragen component when VTT check is done
    onVttCheckComplete(canProceed: boolean) {
        if (canProceed && this.activeIndex === 4) {
            // Now we can proceed to next step
            this.completedSteps.add(this.activeIndex);
            this.activeIndex++;
            this.saveCurrentStep();
            this.updateStepStyles();
            this.scrollToStepper();
        }
    }

    prevStep() {
        if (this.activeIndex > 0) {
            this.activeIndex--;
            this.saveCurrentStep();
            this.updateStepStyles();
            this.scrollToStepper();
        }
    }

    /**
     * Scrolls the page to bring the stepper into view, keeping title and stepper visible
     */
    private scrollToStepper() {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
            if (this.scrollTargetRef) {
                this.scrollTargetRef.nativeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });
            }
        }, 100);
    }

    updateStepStyles() {
        this.items.forEach((item, index) => {
            // Build array of CSS classes
            const classes: string[] = [];

            // Add completed class if step is completed
            if (this.completedSteps.has(index)) {
                classes.push('step-completed');
            }

            // Apply combined classes
            item.styleClass = classes.join(' ');

            // Disable steps that cannot be accessed
            // PrimeNG will automatically add 'p-disabled' class when disabled=true
            if (index > this.activeIndex && !this.canProceedToStep(index)) {
                item.disabled = true;
            } else {
                item.disabled = false;
            }
        });
    }

    /**
     * Check if the "Next" button should be disabled
     */
    isNextButtonDisabled(): boolean {
        // Already at last step
        if (this.activeIndex === this.items.length - 1) {
            return true;
        }

        // Check if we can proceed to next step
        const nextStepIndex = this.activeIndex + 1;
        return !this.canProceedToStep(nextStepIndex);
    }

    save() {
        // Implement save logic
        this.logger.debug('Save action triggered');
    }

    close() {
        const currentOfferte = this.offerteStore.currentOfferte();

        // Save offerte before closing if it was already created
        if (currentOfferte?.id) {
            this.logger.debug('Saving offerte before closing');

            // Prepare variant data if we have it
            let varianteData: any[] | undefined = undefined;
            if (this.activeIndex >= 3 && this.variantenComponent) {
                varianteData = this.variantenComponent.prepareVariantDataForApi();
            }

            // Build offerte update object
            const offerteToUpdate = {
                ...currentOfferte,
                variante: varianteData
            };

            // Update offerte in backend before navigating
            this.offerteService.updateOfferte(offerteToUpdate).subscribe({
                next: (response) => {
                    this.logger.debug('Offerte saved before closing');
                    this.navigateToPreviousOrDashboard();
                },
                error: (error) => {
                    this.logger.error('Failed to save offerte before closing:', error);
                    // Navigate anyway even if save fails
                    this.navigateToPreviousOrDashboard();
                }
            });
        } else {
            // No offerte to save, just navigate
            this.navigateToPreviousOrDashboard();
        }
    }

    /**
     * Navigate to previous URL or dashboard as fallback
     */
    private navigateToPreviousOrDashboard(): void {
        // Option 1: If we have a stored previous URL, navigate there
        if (this.previousUrl) {
            this.logger.debug('Navigating to previous URL:', this.previousUrl);
            this.router.navigateByUrl(this.previousUrl);
            return;
        }

        // Option 2: Try to get previousUrl from store (in case it was set but not in local variable)
        const storedPreviousUrl = this.offerteStore.previousUrl();
        if (storedPreviousUrl) {
            this.logger.debug('Navigating to previousUrl from store:', storedPreviousUrl);
            this.router.navigateByUrl(storedPreviousUrl);
            return;
        }

        // Option 3: Fallback to dashboard route if no previous URL is available
        this.logger.debug('No previous URL available - navigating to dashboard');
        this.router.navigate(['/']);
    }

    private setPendingViewModeFromState(state: any): void {
        if (state && typeof state.viewMode === 'boolean') {
            this.pendingViewMode = state.viewMode;
            this.logger.debug('Pending view mode captured from navigation state:', this.pendingViewMode);
        }
    }

    private applyPendingViewMode(): void {
        if (this.pendingViewMode === null) {
            return;
        }

        const key = this.currentOffertenr || this.offerteStore.currentKey();
        if (!key || !this.offerteStore.hasOfferte(key)) {
            this.logger.debug('Pending view mode not applied yet - offerte data missing', {
                key,
                pendingViewMode: this.pendingViewMode
            });
            return;
        }

        this.logger.debug('Applying pending view mode to store metadata', {
            key,
            pendingViewMode: this.pendingViewMode
        });
        this.offerteStore.setReadOnly(key, this.pendingViewMode);
        this.pendingViewMode = null;
    }

    openChecklisteDialog() {
        const offerte = this.currentOfferte();
        if (offerte?.id) {
            this.logger.debug('Opening checkliste modal for offerte:', offerte.id);
            this.checklisteModalService.openForOfferteId(offerte.id);
        } else {
            this.logger.error('Cannot open checkliste: No offerte ID available');
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('common.messages.error'),
                detail: this.translate.instant('fuv.police.messages.mustSaveFirst'),
                life: 3000
            });
        }
    }

    /**
     * Called when checkliste is successfully saved
     * Note: This is only used when checkliste is embedded in the wizard, not for modal mode
     */
    onChecklisteSaved(checkliste: any): void {
        this.logger.debug('✅ Checkliste saved successfully:', checkliste);
        this.logger.debug('✅ Checkliste ID from event:', checkliste?.id);

        // Explicitly update the store again to ensure the button turns green
        // This is a workaround to ensure the signal chain updates properly
        if (checkliste && checkliste.id) {
            this.logger.debug('✅ Explicitly updating store with checkliste from event');
            this.offerteStore.updateOfferte(null, { checkliste: checkliste });

            // Force verification of the update
            setTimeout(() => {
                const verifyOfferte = this.currentOfferte();
                this.logger.debug('✅ Verification after explicit update:', {
                    hasCheckliste: this.hasCheckliste(),
                    checklisteInStore: verifyOfferte?.checkliste,
                    checklisteId: (verifyOfferte?.checkliste as any)?.id
                });
            }, 100);
        }

        // The store has already been updated by the checkliste component
        // The hasCheckliste computed should now reflect the new state
        this.logger.debug('Current offerte after checkliste save:', this.currentOfferte());
        this.logger.debug('hasCheckliste after save:', this.hasCheckliste());

        // Verify the checkliste data structure in the store
        const offerte = this.currentOfferte();
        if (offerte) {
            this.logger.debug('Checkliste in store after save:', {
                checkliste: offerte.checkliste,
                isArray: Array.isArray(offerte.checkliste),
                hasId: !!(offerte.checkliste as any)?.id,
                id: (offerte.checkliste as any)?.id
            });
        }
    }

    openHelp() {
        this.logger.debug('Help button clicked - to be implemented');
        // TODO: Implement help functionality
    }

    printUnverbindlicheOfferte() {
        this.logger.debug('Print unverbindliche Offerte - saving offerte first');

        // Initialize task data with current offerte info
        const offerte = this.currentOfferte();
        if (!offerte) {
            this.messageService.showError(this.translate.instant('fuv.police.messages.noOfferte'));
            return;
        }

        // Only save if offerte has been created (has ID)
        if (!offerte.id) {
            this.logger.debug('Offerte not yet created - cannot print');
            this.messageService.showError(this.translate.instant('fuv.police.messages.mustSaveFirst'));
            return;
        }

        // Printing invalidates provisional signatures (reset digital/physical flags)
        this.offerteStore.invalidateSignature();

        // Validate that BB exists and has been calculated (check for bbtezu which is always present after calculation)
        if (!offerte.bb || !offerte.bb.bbtezu || offerte.bb.bbtezu.length === 0) {
            this.logger.error('Cannot print - BB not calculated (no technical assignment)', {
                hasBB: !!offerte.bb,
                bb_boid: offerte.bb_boid,
                bruttopraemiensatz: offerte.bb?.bruttopraemiensatz,
                hasbbtezu: !!(offerte.bb?.bbtezu && offerte.bb.bbtezu.length > 0),
                bbtezuCount: offerte.bb?.bbtezu?.length
            });
            this.messageService.showError(this.translate.instant('fuv.police.messages.tezuMissing'));
            return;
        }

        // Log the BB data BEFORE saving to verify it exists in store
        this.logger.debug('🔍 BB data in store BEFORE save:', {
            hasBB: !!offerte.bb,
            bb_boid: offerte.bb_boid,
            bruttopraemiensatz: offerte.bb?.bruttopraemiensatz,
            nettopraemiensatz: offerte.bb?.nettopraemiensatz,
            vksatz: offerte.bb?.vksatz,
            uvksatz: offerte.bb?.uvksatz,
            bb2merkmalCount: offerte.bb?.bb2merkmal?.length
        });

        // Prepare variant data if we have it
        let varianteData: any[] | undefined = undefined;
        if (this.activeIndex >= 3 && this.variantenComponent) {
            varianteData = this.variantenComponent.prepareVariantDataForApi();
        }

        // Build offerte update object
        const offerteToUpdate = {
            ...offerte,
            variante: varianteData
        };

        // Log the complete BB object being sent to backend
        this.logger.debug('🚀 Sending offerte update with BB to backend:', {
            offertenr: offerteToUpdate.offertenr,
            id: offerteToUpdate.id,
            hasBB: !!offerteToUpdate.bb,
            bb_boid: offerteToUpdate.bb_boid,
            bbInRequest: offerteToUpdate.bb
                ? {
                      bruttopraemiensatz: offerteToUpdate.bb.bruttopraemiensatz,
                      nettopraemiensatz: offerteToUpdate.bb.nettopraemiensatz,
                      vksatz: offerteToUpdate.bb.vksatz,
                      uvksatz: offerteToUpdate.bb.uvksatz,
                      basisstufe: offerteToUpdate.bb.basisstufe,
                      agenturkompetenz: offerteToUpdate.bb.agenturkompetenz,
                      bb2merkmalCount: offerteToUpdate.bb.bb2merkmal?.length,
                      bbtezuCount: offerteToUpdate.bb.bbtezu?.length
                  }
                : null
        });

        // Save offerte to backend FIRST before printing to ensure all calculated values are persisted
        // This includes bruttopraemiensatz and other calculated fields from TEZU
        this.logger.debug('Saving offerte to backend before printing to ensure all calculated fields are persisted');
        this.offerteService.updateOfferte(offerteToUpdate).subscribe({
            next: (response) => {
                this.logger.debug('Offerte saved successfully, now opening task dialog');

                // Update store with response
                const updatedOfferte = Array.isArray(response) ? response[0] : response;
                if (updatedOfferte) {
                    // Log the BB data returned from backend
                    this.logger.debug('🔍 BB data AFTER save (from backend response):', {
                        hasBB: !!updatedOfferte.bb,
                        bb_boid: updatedOfferte.bb_boid,
                        bruttopraemiensatz: updatedOfferte.bb?.bruttopraemiensatz,
                        nettopraemiensatz: updatedOfferte.bb?.nettopraemiensatz,
                        vksatz: updatedOfferte.bb?.vksatz,
                        uvksatz: updatedOfferte.bb?.uvksatz,
                        bb2merkmalCount: updatedOfferte.bb?.bb2merkmal?.length
                    });

                    const storeUpdate: any = {
                        updated: updatedOfferte.updated,
                        bb: updatedOfferte.bb,
                        bb_boid: updatedOfferte.bb_boid
                    };

                    if (updatedOfferte.variante && updatedOfferte.variante.length > 0) {
                        storeUpdate.variante = updatedOfferte.variante;
                    }

                    this.offerteStore.updateOfferte(null, storeUpdate);
                }

                // Now proceed with task dialog and printing
                this.openTaskDialogAndPrint();
            },
            error: (error) => {
                this.logger.error('Failed to save offerte before printing:', error);
                this.messageService.showError(this.translate.instant('fuv.police.messages.saveOfferteError'));
            }
        });
    }

    /**
     * Open task dialog and proceed with printing
     * Called after offerte has been saved to backend
     */
    private openTaskDialogAndPrint() {
        // IMPORTANT: Get the UPDATED offerte from store after save
        // This ensures we have the latest bb.bruttopraemiensatz and other calculated values
        const offerte = this.currentOfferte();
        const meta = this.offerteStore.currentMeta();
        if (!offerte) {
            this.logger.error('Cannot print - no offerte in store after save');
            return;
        }

        // Use begleitbrief from UI meta (0/1) instead of persisted yes/no
        const begleitbriefMeta = meta?.variantenUi?.begleitbrief;
        const begleitbriefValue = begleitbriefMeta === true ? '1' : begleitbriefMeta === false ? '0' : undefined;
        const offerteForPrint = {
            ...offerte,
            begleitbrief: begleitbriefValue as any
        };

        this.logger.debug('Opening task dialog and preparing to print with updated offerte', {
            offertenr: offerteForPrint.offertenr,
            hasBB: !!offerteForPrint.bb,
            bruttopraemiensatz: offerteForPrint.bb?.bruttopraemiensatz,
            nettopraemiensatz: offerteForPrint.bb?.nettopraemiensatz,
            hasFragebogen: !!offerteForPrint.fragebogen,
            fragebogenId: offerteForPrint.fragebogen?.id,
            begleitbrief: offerteForPrint.begleitbrief
        });

        // Calculate due date: today + 1 month
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() + 1);

        // Get visum from auth service (preferred_username from Keycloak)
        const userProfile = this.authService.getUserProfile();
        const visum = userProfile?.username || 'bp2';

        // Load aufgabenart options from codes service
        this.codesService.getCodesByGruppe('AufgabenDef').subscribe({
            next: (codes) => {
                // Filter for only WFD_FUVOff_Offerte_nachfassen for unverbindliche offerte
                this.aufgabenartOptions = codes
                    .filter((code) => code.aktiv === true && code.internal_name === WFD_FUV_OFFERTE_NACHFASSEN)
                    .sort((a, b) => a.sorter - b.sorter)
                    .map((code) => ({
                        label: this.codesService.getLocalizedLabel(code),
                        value: code.internal_name
                    }));

                // Set default aufgabeart if available
                const defaultAufgabeart = this.aufgabenartOptions.length > 0 ? this.aufgabenartOptions[0].value : '';
                const defaultTitel = this.aufgabenartOptions.length > 0 ? this.aufgabenartOptions[0].label : '';

                // Initialize task data
                this.taskData = {
                    aufgabeart: defaultAufgabeart,
                    titel: defaultTitel,
                    faelligAm: this.formatDateForInput(dueDate),
                    zugewiesenAn: DEFAULT_AUFGABE_AUSFUEHRENDER,
                    beschreibung: '',
                    automatischeBeschreibung: `Die Offerte wurde am ${this.formatDateForDisplay(today)} gedruckt. Ist die unterschriebene Offerte bereits eingegangen?`
                };

                // Show the task dialog first, then call print service after task creation
                this.displayTaskDialog = true;
            },
            error: (error) => {
                this.logger.error('Failed to load aufgabenart options', error);
                // Still show dialog with empty options
                this.taskData = {
                    aufgabeart: '',
                    titel: '',
                    faelligAm: this.formatDateForInput(dueDate),
                    zugewiesenAn: DEFAULT_AUFGABE_AUSFUEHRENDER,
                    beschreibung: '',
                    automatischeBeschreibung: `Die Offerte wurde am ${this.formatDateForDisplay(today)} gedruckt. Ist die unterschriebene Offerte bereits eingegangen?`
                };
                this.displayTaskDialog = true;
            }
        });

        // Prepare print parameters
        // Determine if antragsfragen are answered (check if fragebogen exists and has data)
        const hasAntragsfragen = !!(offerte.fragebogen && offerte.fragebogen.id);

        // Get selected variante from offerte.variante array
        // Find the variant with status=true, then map to "0", "1", "2" based on variante field (1=A, 2=B, 3=C)
        let selectedVarianteNr = '0'; // Default to "0" (Variante A)
        if (offerteForPrint.variante && Array.isArray(offerteForPrint.variante)) {
            const selectedVariant = offerteForPrint.variante.find((v: any) => v.status === true || v.status === 1);
            if (selectedVariant && selectedVariant.variante !== undefined) {
                // Map variante field (1, 2, 3) to array index ("0", "1", "2")
                selectedVarianteNr = String(selectedVariant.variante - 1);
            }
        }

        this.logger.log('About to call print service with updated offerte', {
            offertenr: offerteForPrint.offertenr,
            selectedVarianteNr,
            hasAntragsfragen,
            begleitbrief: offerteForPrint.begleitbrief,
            hasBB: !!offerteForPrint.bb,
            bb_boid: offerteForPrint.bb_boid,
            bruttopraemiensatz: offerteForPrint.bb?.bruttopraemiensatz,
            nettopraemiensatz: offerteForPrint.bb?.nettopraemiensatz,
            uvksatz: offerteForPrint.bb?.uvksatz,
            vksatz: offerteForPrint.bb?.vksatz
        });

        // Call print service to send print request to backend
        this.printService.printAndProcessOfferte(offerteForPrint, selectedVarianteNr, hasAntragsfragen).subscribe({
            next: () => {
                this.logger.debug('Print request sent successfully, OPUS URL opened in new tab');
                this.messageService.showSuccess(this.translate.instant('fuv.police.messages.printOfferteSuccess'));
            },
            error: (error) => {
                this.logger.error('Failed to send print request', error);

                // Extract error message from response
                let errorMsg = 'Fehler beim Drucken der Offerte';
                if (error?.error) {
                    if (typeof error.error === 'string') {
                        errorMsg += ': ' + error.error;
                    } else if (error.error.message) {
                        errorMsg += ': ' + error.error.message;
                    } else if (error.error.result) {
                        errorMsg += ': ' + error.error.result;
                    }
                } else if (error?.message) {
                    errorMsg += ': ' + error.message;
                }

                this.messageService.showError(errorMsg);
            }
        });
    }

    /**
     * Format date for input field (YYYY-MM-DD format)
     */
    private formatDateForInput(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${day}.${month}.${year}`;
    }

    /**
     * Format date for display (DD.MM.YYYY format)
     */
    private formatDateForDisplay(date: Date): string {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Save the task and close dialog
     */
    onTaskDialogSave(): void {
        this.logger.debug('Task dialog save clicked', this.taskData);

        // TODO: Implement actual task creation via backend service
        this.logger.warn('Task creation not yet implemented');
        this.messageService.showSuccess(this.translate.instant('fuv.police.messages.taskCreated'));

        // TODO: Trigger PDF generation/download for unverbindliche Offerte

        this.displayTaskDialog = false;
    }

    /**
     * Cancel task creation
     */
    onTaskDialogCancel(): void {
        this.logger.debug('Task dialog cancelled');
        this.displayTaskDialog = false;
    }

    /**
     * Handle aufgabenart selection change
     * Updates titel to match the selected aufgabenart text
     */
    onAufgabenartChange(): void {
        const selectedOption = this.aufgabenartOptions.find((opt) => opt.value === this.taskData.aufgabeart);
        if (selectedOption) {
            this.taskData.titel = selectedOption.label;
            this.logger.debug('Aufgabenart changed, updated titel', { aufgabeart: this.taskData.aufgabeart, titel: this.taskData.titel });
        }
    }

    printOffertantrag() {
        this.logger.debug('Print Offertantrag - saving offerte first');

        // Get current offerte
        const offerte = this.currentOfferte();
        if (!offerte) {
            this.messageService.showError(this.translate.instant('fuv.police.messages.noOfferte'));
            return;
        }

        // Only save if offerte has been created (has ID)
        if (!offerte.id) {
            this.logger.debug('Offerte not yet created - cannot print');
            this.messageService.showError(this.translate.instant('fuv.police.messages.mustSaveFirst'));
            return;
        }

        // Printing invalidates provisional signatures (reset digital/physical flags)
        this.offerteStore.invalidateSignature();

        // Validate that BB exists and has been calculated (check for bbtezu which is always present after calculation)
        if (!offerte.bb || !offerte.bb.bbtezu || offerte.bb.bbtezu.length === 0) {
            this.logger.error('Cannot print - BB not calculated (no technical assignment)', {
                hasBB: !!offerte.bb,
                bb_boid: offerte.bb_boid,
                bruttopraemiensatz: offerte.bb?.bruttopraemiensatz,
                hasbbtezu: !!(offerte.bb?.bbtezu && offerte.bb.bbtezu.length > 0),
                bbtezuCount: offerte.bb?.bbtezu?.length
            });
            this.messageService.showError(this.translate.instant('fuv.police.messages.tezuMissing'));
            return;
        }

        // Check SU status - warn if "Unklar" (SYR_SUStatus_Unklar)
        const suStatus = offerte.person?.sustatus as any;
        if (suStatus === 'SYR_SUStatus_Unklar') {
            this.logger.warn('SU Status is Unklar for person', {
                person_boid: offerte.person_boid,
                sustatus: suStatus
            });
            this.messageService.showWarning(
                'Der Versicherte hat einen unklaren S/U-Status. Bitte vor der Policierung sicherstellen, dass der S/U-Status verifiziert wird.',
                { life: 10000 } // Show warning for 10 seconds
            );
        }

        // Log the BB data BEFORE saving to verify it exists in store
        this.logger.debug('🔍 BB data in store BEFORE save:', {
            hasBB: !!offerte.bb,
            bb_boid: offerte.bb_boid,
            bruttopraemiensatz: offerte.bb?.bruttopraemiensatz,
            nettopraemiensatz: offerte.bb?.nettopraemiensatz,
            vksatz: offerte.bb?.vksatz,
            uvksatz: offerte.bb?.uvksatz,
            bb2merkmalCount: offerte.bb?.bb2merkmal?.length
        });

        // Prepare variant data if we have it
        let varianteData: any[] | undefined = undefined;
        if (this.activeIndex >= 3 && this.variantenComponent) {
            varianteData = this.variantenComponent.prepareVariantDataForApi();
        }

        // Build offerte update object
        const offerteToUpdate = {
            ...offerte,
            variante: varianteData
        };

        // Log the complete BB object being sent to backend
        this.logger.debug('🚀 Sending offerte update with BB to backend for Offertantrag:', {
            offertenr: offerteToUpdate.offertenr,
            id: offerteToUpdate.id,
            hasBB: !!offerteToUpdate.bb,
            bb_boid: offerteToUpdate.bb_boid,
            bbInRequest: offerteToUpdate.bb
                ? {
                      bruttopraemiensatz: offerteToUpdate.bb.bruttopraemiensatz,
                      nettopraemiensatz: offerteToUpdate.bb.nettopraemiensatz,
                      vksatz: offerteToUpdate.bb.vksatz,
                      uvksatz: offerteToUpdate.bb.uvksatz,
                      basisstufe: offerteToUpdate.bb.basisstufe,
                      agenturkompetenz: offerteToUpdate.bb.agenturkompetenz,
                      bb2merkmalCount: offerteToUpdate.bb.bb2merkmal?.length,
                      bbtezuCount: offerteToUpdate.bb.bbtezu?.length
                  }
                : null
        });

        // Save offerte to backend FIRST before printing to ensure all calculated values are persisted
        this.logger.debug('Saving offerte to backend before printing Offertantrag');
        this.offerteService.updateOfferte(offerteToUpdate).subscribe({
            next: (response) => {
                this.logger.debug('Offerte saved successfully, now opening task dialog for Offertantrag');

                // Update store with response
                const updatedOfferte = Array.isArray(response) ? response[0] : response;
                if (updatedOfferte) {
                    // Log the BB data returned from backend
                    this.logger.debug('🔍 BB data AFTER save (from backend response):', {
                        hasBB: !!updatedOfferte.bb,
                        bb_boid: updatedOfferte.bb_boid,
                        bruttopraemiensatz: updatedOfferte.bb?.bruttopraemiensatz,
                        nettopraemiensatz: updatedOfferte.bb?.nettopraemiensatz,
                        vksatz: updatedOfferte.bb?.vksatz,
                        uvksatz: updatedOfferte.bb?.uvksatz,
                        bb2merkmalCount: updatedOfferte.bb?.bb2merkmal?.length
                    });

                    const storeUpdate: any = {
                        updated: updatedOfferte.updated,
                        bb: updatedOfferte.bb,
                        bb_boid: updatedOfferte.bb_boid
                    };

                    if (updatedOfferte.variante && updatedOfferte.variante.length > 0) {
                        storeUpdate.variante = updatedOfferte.variante;
                    }

                    this.offerteStore.updateOfferte(null, storeUpdate);
                }

                // Now proceed with task dialog and printing for Offertantrag
                this.openTaskDialogAndPrintOffertantrag();
            },
            error: (error) => {
                this.logger.error('Failed to save offerte before printing Offertantrag:', error);
                this.messageService.showError(this.translate.instant('fuv.police.messages.saveOfferteError'));
            }
        });
    }

    /**
     * Open task dialog and proceed with printing Offertantrag
     * Called after offerte has been saved to backend
     */
    private openTaskDialogAndPrintOffertantrag() {
        // Get the UPDATED offerte from store after save
        const offerte = this.currentOfferte();
        const meta = this.offerteStore.currentMeta();
        if (!offerte) {
            this.logger.error('Cannot print Offertantrag - no offerte in store after save');
            return;
        }

        const begleitbriefMeta = meta?.variantenUi?.begleitbrief;
        const begleitbriefValue = begleitbriefMeta === true ? '1' : begleitbriefMeta === false ? '0' : undefined;
        const offerteForPrint = {
            ...offerte,
            begleitbrief: begleitbriefValue as any
        };

        this.logger.debug('Opening task dialog for Offertantrag with updated offerte', {
            offertenr: offerteForPrint.offertenr,
            hasBB: !!offerteForPrint.bb,
            bruttopraemiensatz: offerteForPrint.bb?.bruttopraemiensatz,
            nettopraemiensatz: offerteForPrint.bb?.nettopraemiensatz,
            hasFragebogen: !!offerteForPrint.fragebogen,
            fragebogenId: offerteForPrint.fragebogen?.id,
            begleitbrief: offerteForPrint.begleitbrief
        });

        // Calculate due date: today + 1 month
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() + 1);

        // Get visum from auth service (preferred_username from Keycloak)
        const userProfile = this.authService.getUserProfile();
        const visum = userProfile?.username || 'bp2';

        // Load aufgabenart options from codes service
        this.codesService.getCodesByGruppe('AufgabenDef').subscribe({
            next: (codes) => {
                // Filter for only WFD_FUVOff_Offerte_nachfassen for offertantrag
                this.aufgabenartOptions = codes
                    .filter((code) => code.aktiv === true && code.internal_name === WFD_FUV_OFFERTE_NACHFASSEN)
                    .sort((a, b) => a.sorter - b.sorter)
                    .map((code) => ({
                        label: this.codesService.getLocalizedLabel(code),
                        value: code.internal_name
                    }));

                // Set default aufgabeart if available
                const defaultAufgabeart = this.aufgabenartOptions.length > 0 ? this.aufgabenartOptions[0].value : '';
                const defaultTitel = this.aufgabenartOptions.length > 0 ? this.aufgabenartOptions[0].label : '';

                // Initialize task data with Offertantrag-specific text
                this.taskData = {
                    aufgabeart: defaultAufgabeart,
                    titel: defaultTitel,
                    faelligAm: this.formatDateForInput(dueDate),
                    zugewiesenAn: DEFAULT_AUFGABE_AUSFUEHRENDER,
                    beschreibung: '',
                    automatischeBeschreibung: `Die Offerte wurde am ${this.formatDateForDisplay(today)} gedruckt. Ist die unterschriebene Offerte bereits eingegangen?`
                };

                // Show the task dialog first, then call print service after task creation
                this.displayTaskDialog = true;
            },
            error: (error) => {
                this.logger.error('Failed to load aufgabenart options', error);
                // Still show dialog with empty options
                this.taskData = {
                    aufgabeart: '',
                    titel: '',
                    faelligAm: this.formatDateForInput(dueDate),
                    zugewiesenAn: DEFAULT_AUFGABE_AUSFUEHRENDER,
                    beschreibung: '',
                    automatischeBeschreibung: `Die Offerte wurde am ${this.formatDateForDisplay(today)} gedruckt. Ist die unterschriebene Offerte bereits eingegangen?`
                };
                this.displayTaskDialog = true;
            }
        });

        // Prepare print parameters for Offertantrag
        // Determine if antragsfragen are answered (check if fragebogen exists and has data)
        const hasAntragsfragen = !!(offerteForPrint.fragebogen && offerteForPrint.fragebogen.id);

        // Get selected variante from offerte.variante array
        let selectedVarianteNr = '0'; // Default to "0" (Variante A)
        if (offerteForPrint.variante && Array.isArray(offerteForPrint.variante)) {
            const selectedVariant = offerteForPrint.variante.find((v: any) => v.status === true || v.status === 1);
            if (selectedVariant && selectedVariant.variante !== undefined) {
                // Map variante field (1, 2, 3) to array index ("0", "1", "2")
                selectedVarianteNr = String(selectedVariant.variante - 1);
            }
        }

        this.logger.log('About to call print service for Offertantrag with updated offerte', {
            offertenr: offerteForPrint.offertenr,
            selectedVarianteNr,
            hasAntragsfragen,
            begleitbrief: offerteForPrint.begleitbrief,
            hasBB: !!offerteForPrint.bb,
            bb_boid: offerteForPrint.bb_boid,
            bruttopraemiensatz: offerteForPrint.bb?.bruttopraemiensatz,
            nettopraemiensatz: offerteForPrint.bb?.nettopraemiensatz,
            uvksatz: offerteForPrint.bb?.uvksatz,
            vksatz: offerteForPrint.bb?.vksatz
        });

        // Call print service to send print request to backend for Offertantrag
        this.printService.printAndProcessOfferte(offerteForPrint, selectedVarianteNr, hasAntragsfragen, true).subscribe({
            next: () => {
                this.logger.debug('Offertantrag print request sent successfully, OPUS URL opened in new tab');
                this.messageService.showSuccess(this.translate.instant('fuv.police.messages.printOffertantragSuccess'));
            },
            error: (error) => {
                this.logger.error('Failed to send Offertantrag print request', error);

                // Extract error message from response
                let errorMsg = 'Fehler beim Drucken des Offertantrags';
                if (error?.error) {
                    if (typeof error.error === 'string') {
                        errorMsg += ': ' + error.error;
                    } else if (error.error.message) {
                        errorMsg += ': ' + error.error.message;
                    } else if (error.error.result) {
                        errorMsg += ': ' + error.error.result;
                    }
                } else if (error?.message) {
                    errorMsg += ': ' + error.message;
                }

                this.messageService.showError(errorMsg);
            }
        });
    }

    /**
     * Save the current active step to offerte store (sessionStorage)
     */
    private saveCurrentStep(): void {
        const currentOfferte = this.offerteStore.currentOfferte();
        if (currentOfferte) {
            this.offerteStore.updateMeta(null, { wizardStep: this.activeIndex });
            this.logger.debug(`Saved current step ${this.activeIndex} to offerte store`);
        }
    }

    /**
     * Restore the saved step from offerte store (sessionStorage)
     */
    private restoreSavedStep(): void {
        const currentMeta = this.offerteStore.currentMeta();
        const wizardStep = currentMeta?.wizardStep as number | undefined;
        if (wizardStep !== undefined) {
            const stepIndex = wizardStep;
            // Validate that the step index is valid
            if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex < this.items.length) {
                this.activeIndex = stepIndex;
                this.logger.debug(`Restored step ${stepIndex} from offerte store`);
            }
        }
    }

    /**
     * Clear saved step from offerte store (call this when offerte is completed or cancelled)
     */
    private clearSavedStep(): void {
        const currentOfferte = this.offerteStore.currentOfferte();
        if (currentOfferte) {
            this.offerteStore.updateMeta(null, { wizardStep: undefined });
            this.logger.debug(`Cleared saved step from offerte store`);
        }
    }
}
