import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
// PrimeNG imports
import { PanelModule } from 'primeng/panel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import {
    Component, computed, effect, ElementRef, EventEmitter, inject, Input, OnInit, Output, signal,
    untracked, ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { BB } from '@app/fuv/models/bb.model';
import { MerkmalApiResponse } from '@app/fuv/models/merkmal.model';
import { Offerte } from '@app/fuv/models/offerte.model';
import { Variante } from '@app/fuv/models/variante.model';
// Import API models (source of truth for data structures)
import {
    TechnischeZuweisung, VarianteDetails, VariantenData
} from '@app/fuv/models/varianten.model';
import { BankService } from '@app/fuv/services/bank.service';
// Services and Models
import { BBService } from '@app/fuv/services/bb.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { MerkmalService } from '@app/fuv/services/merkmal.service';
import { VariaService } from '@app/fuv/services/varia.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { NumberFormatDirective } from '@app/shared/directives/number-format.directive';
import { isEmptyFieldValue } from '@app/shared/helpers/form-helpers';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, LogFactoryService } from '@syrius/core';

import { TezuService } from '../../../services/tezu.service';
// Import calculation constants and formulas
import {
    calculatePraemiensatzBrutto, FAMILY_MEMBER_CODES, MIN_JAHRESVERDIENST_FAMILY_MEMBERS,
    MIN_JAHRESVERDIENST_OWNERS, OWNER_CODES
} from '../police.constants';
import { mapVariantsToApi } from './varianten.helpers';
import {
    computeTezuHashFromOfferte, getSelectedVarianteFromStore, parseBegleitbriefValue,
    resolveAgenturkompetenz, toNumber, toString, toUiVariante
} from './varianten.utils';
// Import validation schema
import {
    VALID_ZAHLUNGSWEISE, validateIban, validateJahresverdienstWithContext, validatePraemienzahlung
} from './varianten.validation';

import type { JahresverdienstValidationError } from './varianten.validation';

// Import pipes
// ZuweisungstypPipe removed - using CodesService with TEZU_TYPE groupe instead

// Component-specific interface that makes variants required (they're always initialized)
// This prevents template errors about "possibly undefined" while keeping API model optional
interface ComponentVariantenData extends VariantenData {
    varianteA: VarianteDetails;
    varianteB: VarianteDetails;
    varianteC: VarianteDetails;
}

@Component({
    selector: 'app-varianten',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, PanelModule, TableModule, InputTextModule, SelectModule, RadioButtonModule, SelectButtonModule, ButtonModule, TooltipModule, NumberFormatDirective],
    templateUrl: './varianten.component.html'
})
export class VariantenComponent implements OnInit {
    @Input() viewMode: boolean = false; // Read-only mode flag
    @Output() dataChange = new EventEmitter<VariantenData>();
    @Output() bbCalculated = new EventEmitter<void>(); // Emit when BB calculation is complete

    private bbService = inject(BBService);
    private bankService = inject(BankService);
    private codesService = inject(CodesService);
    private merkmalService = inject(MerkmalService);
    private variaService = inject(VariaService);
    private offerteStore = inject(OfferteTypedStore);
    private authService = inject(AuthService);
    private logger = inject(LogFactoryService).createLogger('VariantenComponent');
    private translateService = inject(TranslateService);

    // ========================================
    // STATE MANAGEMENT (Signals)
    // ========================================

    // Loading and calculation state
    isCalculating = signal(false);
    calculatedBB = signal<BB | null>(null);
    calculationError = signal<string | null>(null);

    // VersVerdienst validation
    maxVersVerdienst = signal<number | null>(null);
    verdienstErrors = signal<{ [key in 'varianteA' | 'varianteB' | 'varianteC']?: string }>({});
    showValidation = signal(false);

    // Bank lookup state
    ibanError = signal<string | null>(null);
    isLoadingBank = signal(false);
    ibanSignal = signal<string>(''); // Track IBAN changes to trigger automatic bank lookup
    ibanLoaded = signal<boolean>(false); // Track when IBAN has been loaded from store

    // Zahlungsweise validation
    invalidZahlungsweiseWarning = signal<string | null>(null);

    // Stufe calculation signals - reactive values for basisstufe and agenturkompetenz
    basisstufeSignal = signal<number>(0);
    agenturkompetenzSignal = signal<number>(0);

    // Base nettopraemiensatz from merkmal
    baseNettopraemiensatzSignal = signal<number>(0);

    @ViewChild('errorMessageA') errorMessageA?: ElementRef;
    @ViewChild('validationErrorBanner') validationErrorBanner?: ElementRef;

    // Expose currentOfferte for template
    currentOfferte = this.offerteStore.currentOfferte;
    currentMeta = this.offerteStore.currentMeta;

    technischeZuweisungen: TechnischeZuweisung[] = [];

    // Code maps for efficient label lookups
    private stellungImBetriebCodeMap = this.codesService.getCodeMapSignal('COT_FUV_StellungBetrieb');
    private arbeitspensumCodeMap = this.codesService.getCodeMapSignal('COT_Beschaeftigungsgrad');
    private tezuTypeCodeMap = this.codesService.getCodeMapSignal('TEZU_TYPE');
    private tezuService = inject(TezuService);

    // ========================================
    // COMPUTED PROPERTIES (Auto-updating)
    // ========================================

    /**
     * Calculate stufe reactively based on basisstufe and agenturkompetenz
     * Formula: stufe = basisstufe + agenturkompetenz
     */
    calculatedStufe = computed(() => {
        const basisstufe = this.basisstufeSignal();
        const agenturkompetenz = this.agenturkompetenzSignal();
        const result = basisstufe + agenturkompetenz;

        this.logger.log('Computed stufe recalculated:', {
            basisstufe,
            agenturkompetenz,
            calculatedStufe: result,
            formula: `${basisstufe} + (${agenturkompetenz}) = ${result}`
        });

        return result;
    });

    /**
     * Calculate prämiensatz brutto reactively based on base nettopraemiensatz and agenturkompetenz
     * Formula: prämiensatz brutto = base_nettopraemiensatz * (1 + agenturkompetenz / 100)
     * This is used for premium calculations instead of the base nettopraemiensatz
     */
    calculatedPraemiensatzBrutto = computed(() => {
        const baseNettopraemiensatz = this.baseNettopraemiensatzSignal();
        const agenturkompetenz = this.agenturkompetenzSignal();
        const result = calculatePraemiensatzBrutto(baseNettopraemiensatz, agenturkompetenz);

        this.logger.log('Calculated prämiensatz brutto', {
            baseNettopraemiensatz,
            agenturkompetenz,
            praemiensatzBrutto: result,
            formula: `${baseNettopraemiensatz} * (1 + ${agenturkompetenz}/100) = ${result}`
        });

        return result;
    });

    /**
     * Formatted prämiensatz brutto for display (includes % symbol)
     */
    formattedPraemiensatzBrutto = computed(() => {
        const value = this.calculatedPraemiensatzBrutto();
        return `${value.toFixed(4)} %`;
    });

    /**
     * Check if the selected variant has validation errors
     */
    hasValidationErrors = computed(() => {
        this.variantStateVersion(); // re-run when UI changes
        const selected = this.variantenData.selectedVariante;
        if (!selected) return false;
        const selectedVarianteKey = `variante${selected}` as 'varianteA' | 'varianteB' | 'varianteC';
        return !!this.verdienstErrors()[selectedVarianteKey];
    });

    /**
     * Get validation error for the selected variant (computed)
     */
    selectedVarianteError = computed(() => {
        this.variantStateVersion(); // re-run when UI changes
        const selected = this.variantenData.selectedVariante;
        if (!selected) return undefined;
        const selectedVarianteKey = `variante${selected}` as 'varianteA' | 'varianteB' | 'varianteC';
        return this.verdienstErrors()[selectedVarianteKey];
    });

    /**
     * Get validation error for Variante A (computed)
     */
    varianteAError = computed(() => this.verdienstErrors()['varianteA']);

    /**
     * Get validation error for Variante B (computed)
     */
    varianteBError = computed(() => this.verdienstErrors()['varianteB']);

    /**
     * Get validation error for Variante C (computed)
     */
    varianteCError = computed(() => this.verdienstErrors()['varianteC']);

    /**
     * Check if step is valid - auto-recomputes when dependencies change
     */
    isStepValid = computed(() => {
        this.variantStateVersion(); // track UI mutations
        // Must have selected a variant (A, B, or C)
        if (!this.variantenData.selectedVariante) {
            return false;
        }

        // Get the selected variant data
        const selectedVarianteKey = `variante${this.variantenData.selectedVariante}` as 'varianteA' | 'varianteB' | 'varianteC';
        const selectedVariante = this.variantenData[selectedVarianteKey];

        // Guard against undefined selectedVariante
        if (!selectedVariante) {
            return false;
        }

        // Check that selected variant has jahresverdienst filled
        if (!selectedVariante.verdienst || toNumber(selectedVariante.verdienst) <= 0) {
            return false;
        }

        // Check that selected variant has taggeldAb filled
        if (!selectedVariante.taggeld || selectedVariante.taggeld.trim() === '') {
            return false;
        }

        // Must not have any validation errors
        if (this.hasValidationErrors()) {
            return false;
        }

        // Check that zahlungweise (praemienzahlung) is selected
        if (!this.variantenData.praemienzahlung) {
            return false;
        }

        // Check checkliste requirement for payment type
        const offerte = this.offerteStore.currentOfferte();
        const checkliste = Array.isArray(offerte?.checkliste) ? offerte.checkliste[0] : offerte?.checkliste;
        const hasCheckliste = !!(checkliste && checkliste.id);

        // Only enforce checkliste validation for non-yearly payments
        if (this.variantenData.praemienzahlung !== 'jaehrlich' && !hasCheckliste) {
            return false;
        }

        return true;
    });

    // ========================================
    // DATA & CONFIGURATION
    // ========================================

    // Reactive dropdown options - signal-based for Angular 20+
    // Note: Agenturkompetenz stores internal_name (code) in backend, displays numeric label in UI
    private agenturkompetenzCodes = this.codesService.getActiveCodesByGruppeSignal('COT_FUV_Agenturkompetenz');
    agenturkompetenzOptions = computed(() => {
        const codes = this.agenturkompetenzCodes();
        return codes
            .map((code) => {
                const label = this.codesService.getLocalizedLabel(code);
                return {
                    label: label,
                    value: code.internal_name // Store internal_name (code) instead of numeric value
                };
            })
            .sort((a, b) => {
                // Sort by numeric value of label
                const aNum = parseInt(a.label, 10);
                const bNum = parseInt(b.label, 10);
                return aNum - bNum;
            });
    });

    // Map for converting between internal_name and numeric display value
    private agenturkompetenzMap = computed(() => {
        const codes = this.agenturkompetenzCodes();
        return new Map(codes.map((code) => [code.internal_name, parseInt(this.codesService.getLocalizedLabel(code), 10)]));
    });

    // Reverse map: numeric value -> internal_name
    private agenturkompetenzReverseMap = computed(() => {
        const codes = this.agenturkompetenzCodes();
        return new Map(codes.map((code) => [parseInt(this.codesService.getLocalizedLabel(code), 10), code.internal_name]));
    });

    // Tracks UI mutations so computed signals re-evaluate on plain object changes
    private variantStateVersion = signal(0);

    /**
     * Get the code (internal_name) for a numeric agenturkompetenz value
     */
    private getAgenturkompetenzCode(numericValue: number): string | undefined {
        return this.agenturkompetenzReverseMap().get(numericValue);
    }

    hasUnsavedChanges(): boolean {
        const metaUi = this.currentMeta()?.variantenUi;
        // If we do not have a cached meta snapshot yet, treat the state as clean.
        // This prevents false positives when merely opening the step (and avoids
        // invalidating signatures without user interaction).
        if (!metaUi) return false;
        return JSON.stringify(metaUi) !== JSON.stringify(this.variantenData);
    }

    /**
     * Get the numeric display value for an agenturkompetenz code
     */
    private getAgenturkompetenzValue(code: string): number {
        return this.agenturkompetenzMap().get(code) || 0;
    }

    // Taggeld ab options - uses internal_name as value (e.g., COD_15_TAGE) for backend compatibility
    private taggeldCodes = this.codesService.getActiveCodesByGruppeSignal('COT_TAGGELDAUFSCHUB');
    taggeldOptions = computed(() => {
        const codes = this.taggeldCodes();
        return codes
            .map((code) => ({
                label: this.codesService.getLocalizedLabel(code),
                value: code.internal_name // Use internal_name (e.g., COD_15_TAGE) instead of label
            }))
            .sort((a, b) => {
                // Sort by extracting numeric value from label (e.g., "15. Tag" -> 15)
                const aNum = parseInt(a.label, 10);
                const bNum = parseInt(b.label, 10);
                return aNum - bNum;
            });
    });

    // Begleitschreiben options for SelectButton
    begleitschreibenOptions: { label: string; value: boolean }[] = [];

    variantenData: ComponentVariantenData = {
        agenturkompetenz: '', // Store internal_name (code) instead of numeric value
        klasse: '',
        basisstufe: '0',
        stufe: '0',
        praemiensatz: '',

        selectedVariante: undefined,
        varianteA: {
            verdienst: '0',
            monatsverdienst: '0',
            taggeld: '',
            taggeldaufschubrabatt: '0',
            taggeldj: '0',
            taggeldm: '0',
            ivrentej: '0',
            ivrentem: '0',
            jahrespraemie_ohne_rabatt: '0',
            rabatt: '0',
            jahrespraemie: '0',
            nettopraemie: '0'
        },
        varianteB: {
            verdienst: '0',
            monatsverdienst: '0',
            taggeld: '',
            taggeldaufschubrabatt: '0',
            taggeldj: '0',
            taggeldm: '0',
            ivrentej: '0',
            ivrentem: '0',
            jahrespraemie_ohne_rabatt: '0',
            rabatt: '0',
            jahrespraemie: '0',
            nettopraemie: '0'
        },
        varianteC: {
            verdienst: '0',
            monatsverdienst: '0',
            taggeld: '',
            taggeldaufschubrabatt: '0',
            taggeldj: '0',
            taggeldm: '0',
            ivrentej: '0',
            ivrentem: '0',
            jahrespraemie_ohne_rabatt: '0',
            rabatt: '0',
            jahrespraemie: '0',
            nettopraemie: '0'
        },

        praemienzahlung: undefined,

        name_bank: '',
        plz_bank: '',
        ort_bank: '',
        iban: '',
        kontoinhaber: '',

        begleitbrief: false
    };

    // Backward compatibility for callers in police.component
    prepareVariantDataForApi(): Variante[] {
        const offerte = this.offerteStore.currentOfferte();
        return mapVariantsToApi(this.variantenData, Array.isArray(offerte?.variante) ? offerte!.variante : [], this.authService.getUserProfile()?.username || 'system', this.calculateMindestverdienst(), offerte?.bb?.vksatz);
    }

    // ========================================
    // CONSTRUCTOR & LIFECYCLE
    // ========================================

    // Flag to track if data has been initially loaded in ngOnInit
    private initialDataLoaded = false;

    constructor() {
        this.translateService
            .stream(['common.status.yes', 'common.status.no'])
            .pipe(takeUntilDestroyed())
            .subscribe((translations) => {
                this.begleitschreibenOptions = [
                    { label: translations['common.status.yes'], value: true },
                    { label: translations['common.status.no'], value: false }
                ];
            });

        // React to changes in the offerte store - auto-sync varianten data
        // This effect helps reload data after backend saves that return updated IDs
        effect(() => {
            const offerte = this.offerteStore.currentOfferte();

            // Skip the effect during initial load (ngOnInit handles that)
            // This prevents the effect from overwriting data loaded in ngOnInit
            if (!this.initialDataLoaded) {
                return;
            }

            // Load variante data when available (after backend save updates)
            if (offerte?.variante && Array.isArray(offerte.variante) && offerte.variante.length > 0) {
                this.logger.log('Loading variante data from store', {
                    varianteCount: offerte.variante.length,
                    currentVarianteA: this.variantenData.varianteA?.verdienst,
                    storeVarianteA: offerte.variante.find((v: any) => v.variante === 1)?.verdienst
                });
                this.loadVariantenDataFromStore(offerte);
            } else if (offerte?.variante && Array.isArray(offerte.variante) && offerte.variante.length === 0) {
                this.logger.log('Store has empty variante array, keeping local data', {
                    localVarianteA: this.variantenData.varianteA?.verdienst,
                    localVarianteB: this.variantenData.varianteB?.verdienst,
                    localVarianteC: this.variantenData.varianteC?.verdienst
                });
                // Don't overwrite local data if store is empty - the user may have just entered data
                // that hasn't been saved to the store yet
            }

            // Load calculated BB when available
            if (offerte?.bb && offerte.bb.bbtezu && offerte.bb.bbtezu.length > 0) {
                this.loadBBFromStore(offerte.bb!);
            }
        });

        // Sync computed stufe back to variantenData.stufe (reactive calculation)
        effect(() => {
            const stufe = this.calculatedStufe();
            this.variantenData.stufe = toString(stufe);
        });

        // Automatically fetch bank details when IBAN is loaded from store (for Verlängerung)
        effect(() => {
            const iban = this.ibanSignal();
            const isLoaded = this.ibanLoaded();

            // Only trigger automatic lookup when IBAN was loaded from store (not user input)
            if (isLoaded && iban && iban.trim() !== '') {
                this.logger.log('IBAN loaded from store, triggering automatic bank lookup', { iban });

                // Check if bank details are already present (to avoid unnecessary API call)
                if (!this.variantenData.name_bank || this.variantenData.name_bank.trim() === '') {
                    this.logger.log('Bank details missing, fetching from API');
                    // Use untracked to avoid creating unnecessary dependencies
                    untracked(() => {
                        // Validate and fetch bank details
                        const validationResult = validateIban(iban);
                        if (validationResult.success && validationResult.isSwiss) {
                            this.lookupBankByIban(iban);
                        }
                    });
                } else {
                    this.logger.log('Bank details already present, skipping fetch', {
                        name_bank: this.variantenData.name_bank,
                        plz_bank: this.variantenData.plz_bank,
                        ort_bank: this.variantenData.ort_bank
                    });
                }

                // Reset the loaded flag after processing
                this.ibanLoaded.set(false);
            }
        });
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    ngOnInit(): void {
        // Load maximum versicherter Verdienst from cache (prefetched at app init)
        this.loadMaxVersVerdienst();

        // Load from store if available
        const offerte = this.offerteStore.currentOfferte();

        // ALWAYS use backend format (variante array) as single source of truth
        // Convert to UI format on-the-fly when needed
        if (offerte?.variante && Array.isArray(offerte.variante)) {
            this.logger.log('Loading variante from store on init', {
                varianteCount: offerte.variante.length,
                variants: offerte.variante.map((v: any) => ({
                    variante: v.variante,
                    verdienst: v.verdienst,
                    taggeld: v.taggeld,
                    id: v.id
                }))
            });
            this.loadVariantenDataFromStore(offerte);
            this.logger.log('After loading from store', {
                varianteA_verdienst: this.variantenData.varianteA?.verdienst,
                varianteB_verdienst: this.variantenData.varianteB?.verdienst,
                varianteC_verdienst: this.variantenData.varianteC?.verdienst,
                praemienzahlung: this.variantenData.praemienzahlung
            });
        } else {
            this.logger.log('No variante data in store on init');
        }

        // Check if BB has been calculated (has bbtezu data from backend)
        const hasBBCalculated = offerte?.bb && offerte.bb.bbtezu && offerte.bb.bbtezu.length > 0;

        // In read-only mode, skip TEZU calculation and only load from store
        if (this.viewMode) {
            this.logger.log('Read-only mode: Skipping TEZU calculation, loading from store only');
            if (hasBBCalculated) {
                this.loadBBFromStore(offerte.bb!);
            } else {
                this.logger.warn('Read-only mode: No BB data available in store');
            }
        } else {
            // Check if tätigkeiten data has changed since last TEZU calculation
            const meta = this.currentMeta();
            const currentTezuHash = computeTezuHashFromOfferte(offerte, meta);
            const storedTezuHash = (meta?.tezuHash as string | undefined) || undefined;

            // Determine if recalculation is needed:
            // - If no BB exists → calculate
            // - If BB exists but no hash stored → assume BB is valid, store hash
            // - If BB exists and hash changed → recalculate
            // - If BB exists and hash matches → load from store
            const needsRecalculation = !hasBBCalculated || (storedTezuHash && currentTezuHash !== storedTezuHash);

            this.logger.log('TEZU calculation check:', {
                hasBBCalculated,
                currentTezuHash,
                storedTezuHash,
                hashesMatch: storedTezuHash ? currentTezuHash === storedTezuHash : 'N/A',
                needsRecalculation
            });

            if (hasBBCalculated && !needsRecalculation && offerte?.bb) {
                // Already calculated and tätigkeiten haven't changed - load from store
                this.loadBBFromStore(offerte.bb);

                // If hash wasn't stored yet (e.g., old offerte from backend), store it now
                if (!storedTezuHash && currentTezuHash) {
                    this.logger.debug('Initializing TEZU hash for existing offerte (BB exists, no hash):', currentTezuHash);
                    this.offerteStore.updateMeta(null, { tezuHash: currentTezuHash });
                }
            } else if (needsRecalculation && (meta?.tezuCalculationBasis || offerte?.bb)) {
                // Recalculation needed: either no BB yet OR tätigkeiten changed
                if (storedTezuHash && currentTezuHash !== storedTezuHash) {
                    this.logger.log('Tätigkeiten data changed - recalculating BB', {
                        oldHash: storedTezuHash,
                        newHash: currentTezuHash
                    });
                } else {
                    this.logger.debug('BB not yet calculated, calling backend to calculate from Tätigkeit data');
                }
                this.calculateTechnischeZuweisung();
            } else {
                this.logger.warn('No Tätigkeit data - cannot calculate BB');
                this.calculationError.set(this.translateService.instant('fuv.police.varianten.error.noTaetigkeitData'));
            }
        }

        // Mark initial data as loaded to allow effects to run
        this.initialDataLoaded = true;

        // Ensure loaded data is saved to store (in case it wasn't there before or got cleared)
        // This ensures the store always has the current state after ngOnInit
        if (offerte?.variante && offerte.variante.length > 0) {
            this.onDataChange();
        }
    }

    // ========================================
    // BB CALCULATION & DATA LOADING
    // ========================================

    /**
     * Calculate technical assignment (Technische Zuweisung) from Tätigkeit data
     * Now uses BBService for business logic separation
     */
    calculateTechnischeZuweisung(): void {
        if (this.isCalculating()) {
            this.logger.warn('TEZU calculation already in progress, skipping duplicate call');
            return;
        }

        const offerte = this.offerteStore.currentOfferte();
        const userId = this.authService.getUserProfile()?.username || 'system';

        this.isCalculating.set(true);
        this.calculationError.set(null);

        this.tezuService.calculateTechnischeZuweisung(offerte, userId).subscribe({
            next: (bb) => {
                this.logger.log('BB calculation result:', bb);

                this.calculatedBB.set(bb);

                // Map BBTeZu to TechnischeZuweisung for display
                this.technischeZuweisungen = bb.bbtezu.map((tezu) => ({
                    zuweisungstyp: this.getZuweisungstyp(tezu.type),
                    anteil: toString(tezu.anteil),
                    klasse: tezu.klasse,
                    bezeichnungKlasse: this.bbService.getLocalizedKlasseBezeichnung(tezu),
                    unterklassenteil: tezu.ukt,
                    bezeichnungUnterklassenteil: this.bbService.getLocalizedUktBezeichnung(tezu)
                }));

                // Update form data with calculated values from BB
                // Note: bb.basisstufe is a fallback - the correct basisstufe comes from merkmal.stufe
                this.variantenData.basisstufe = toString(bb.basisstufe || 0);
                this.variantenData.klasse = bb.bbtezu[0]?.klasse || '';

                // Only update agenturkompetenz from BB if it has a value
                // Don't overwrite existing value with null/empty from BB
                if (bb.agenturkompetenz != null && bb.agenturkompetenz !== '') {
                    const rawValue = bb.agenturkompetenz;

                    // Try to determine if it's a code (string that's not purely numeric) or a number
                    const isNumericString = typeof rawValue === 'string' && /^-?\d+$/.test(rawValue);
                    const isNumber = typeof rawValue === 'number';

                    if (!isNumber && !isNumericString) {
                        // It's already a code (internal_name like "COD_-2")
                        this.variantenData.agenturkompetenz = String(rawValue);
                        const numericValue = this.getAgenturkompetenzValue(String(rawValue));
                        this.agenturkompetenzSignal.set(numericValue);
                        this.logger.debug('Loaded agenturkompetenz code from BB after calculation:', { code: rawValue, numericValue });
                    } else {
                        // It's a numeric value (old format) - convert to code
                        const numericValue = isNumber ? rawValue : parseInt(String(rawValue), 10);
                        const code = this.getAgenturkompetenzCode(numericValue);

                        if (code) {
                            this.variantenData.agenturkompetenz = code;
                            this.agenturkompetenzSignal.set(numericValue);
                            this.logger.debug('Converted numeric agenturkompetenz to code after calculation:', { numericValue, code });
                        } else {
                            this.logger.warn('Could not find code for numeric agenturkompetenz after calculation:', numericValue);
                            // Default to 0 if no code found
                            const defaultCode = this.getAgenturkompetenzCode(0);
                            if (defaultCode) {
                                this.variantenData.agenturkompetenz = defaultCode;
                                this.agenturkompetenzSignal.set(0);
                            } else {
                                this.variantenData.agenturkompetenz = '';
                                this.agenturkompetenzSignal.set(0);
                            }
                        }
                    }
                } else {
                    // Keep the existing value and update the signal to match
                    const numericValue = this.variantenData.agenturkompetenz ? this.getAgenturkompetenzValue(this.variantenData.agenturkompetenz) : 0;
                    this.agenturkompetenzSignal.set(numericValue);
                }

                // Update the stored hash to match the current tätigkeiten data
                // This prevents unnecessary recalculations when navigating back to this step
                const meta = this.currentMeta();
                const currentTezuHash = computeTezuHashFromOfferte(offerte, meta);

                // Save to store for later use (including the updated hash)
                this.offerteStore.updateOfferte(null, { bb });
                this.offerteStore.updateMeta(null, { tezuHash: currentTezuHash });

                this.logger.log('BB calculation successful:', {
                    basisstufe: this.variantenData.basisstufe,
                    klasse: this.variantenData.klasse,
                    agenturkompetenz: this.variantenData.agenturkompetenz,
                    technischeZuweisungen: this.technischeZuweisungen.length,
                    tezuHash: currentTezuHash
                });

                // Populate additional fields (basisstufe from merkmal.stufe, stufe calculated, prämiensatz) from merkmal data
                // This will overwrite basisstufe with the correct value
                this.populateFieldsFromMerkmal(bb);

                // Emit event to trigger backend save
                this.logger.log('Emitting bbCalculated event to trigger backend save');
                this.bbCalculated.emit();

                this.isCalculating.set(false);
            },
            error: (error) => {
                this.logger.error('BB calculation failed:', error);

                // Extract meaningful error message with better fallback handling
                const detailPrefix = this.translateService.instant('fuv.police.varianten.error.detailPrefix');
                let errorMessage = this.translateService.instant('fuv.police.varianten.error.tezuCalculationFailed');

                // Try to extract meaningful error message from different error structures
                if (error?.error?.result) {
                    // Backend specific error result
                    errorMessage = `${errorMessage} ${detailPrefix} ${error.error.result}`;
                } else if (error?.error?.message) {
                    // HTTP error with message
                    errorMessage = `${errorMessage} ${detailPrefix} ${error.error.message}`;
                } else if (error?.message && typeof error.message === 'string') {
                    // Standard error message
                    errorMessage = `${errorMessage} ${detailPrefix} ${error.message}`;
                } else if (error?.statusText) {
                    // HTTP status text
                    errorMessage = `${errorMessage} ${detailPrefix} HTTP ${error.status || ''}: ${error.statusText}`;
                } else if (typeof error === 'string') {
                    // Error is already a string
                    errorMessage = `${errorMessage} ${detailPrefix} ${error}`;
                }

                this.calculationError.set(errorMessage);
                this.isCalculating.set(false);
            }
        });
    }

    /**
     * Load BB data from store (already calculated)
     */
    private loadBBFromStore(bb: BB): void {
        this.calculatedBB.set(bb);

        // Map to display format
        this.technischeZuweisungen = bb.bbtezu.map((tezu) => ({
            zuweisungstyp: this.getZuweisungstyp(tezu.type),
            anteil: toString(tezu.anteil), // Convert number to string for API model
            klasse: tezu.klasse,
            bezeichnungKlasse: this.bbService.getLocalizedKlasseBezeichnung(tezu),
            unterklassenteil: tezu.ukt,
            bezeichnungUnterklassenteil: this.bbService.getLocalizedUktBezeichnung(tezu)
        }));

        // Update form data from BB
        this.logger.log('Processing BB data', {
            'bb.basisstufe (raw)': bb.basisstufe,
            'typeof bb.basisstufe': typeof bb.basisstufe,
            'bb.agenturkompetenz': bb.agenturkompetenz
        });

        // Note: bb.basisstufe from backend might be incorrect - will be overwritten by merkmal.stufe
        // For now, use it as a fallback if merkmal data is not available
        const basisstufeValue = bb.basisstufe || 0;
        this.variantenData.basisstufe = toString(basisstufeValue);
        this.basisstufeSignal.set(basisstufeValue);

        this.variantenData.klasse = bb.bbtezu[0]?.klasse || '';

        // Only update agenturkompetenz from BB if it has a value
        // Store the internal_name (code), but update signal with numeric value for calculations
        if (bb.agenturkompetenz != null && bb.agenturkompetenz !== '') {
            const rawValue = bb.agenturkompetenz;

            // Try to determine if it's a code (string that's not purely numeric) or a number
            const isNumericString = typeof rawValue === 'string' && /^-?\d+$/.test(rawValue);
            const isNumber = typeof rawValue === 'number';

            if (!isNumber && !isNumericString) {
                // It's already a code (internal_name like "COD_-2")
                this.variantenData.agenturkompetenz = String(rawValue);
                const numericValue = this.getAgenturkompetenzValue(String(rawValue));
                this.agenturkompetenzSignal.set(numericValue);
                this.logger.debug('Loaded agenturkompetenz code from BB:', { code: rawValue, numericValue });
            } else {
                // It's a numeric value (old format) - convert to code
                const numericValue = isNumber ? rawValue : parseInt(String(rawValue), 10);
                const code = this.getAgenturkompetenzCode(numericValue);

                if (code) {
                    this.variantenData.agenturkompetenz = code;
                    this.agenturkompetenzSignal.set(numericValue);
                    this.logger.debug('Converted numeric agenturkompetenz to code:', { numericValue, code });
                } else {
                    this.logger.warn('Could not find code for numeric agenturkompetenz:', numericValue);
                    // Default to 0 if no code found
                    const defaultCode = this.getAgenturkompetenzCode(0);
                    if (defaultCode) {
                        this.variantenData.agenturkompetenz = defaultCode;
                        this.agenturkompetenzSignal.set(0);
                        this.logger.debug('Using default agenturkompetenz (0):', defaultCode);
                    } else {
                        this.variantenData.agenturkompetenz = '';
                        this.agenturkompetenzSignal.set(0);
                    }
                }
            }
        } else {
            // No value from BB - use default of 0 if available
            const defaultCode = this.getAgenturkompetenzCode(0);
            if (defaultCode && !this.variantenData.agenturkompetenz) {
                this.variantenData.agenturkompetenz = defaultCode;
                this.agenturkompetenzSignal.set(0);
                this.logger.debug('Using default agenturkompetenz (0) for empty BB:', defaultCode);
            } else {
                const numericValue = this.variantenData.agenturkompetenz ? this.getAgenturkompetenzValue(this.variantenData.agenturkompetenz) : 0;
                this.agenturkompetenzSignal.set(numericValue);
            }
        }

        this.logger.log('BB loaded from store:', {
            basisstufe: this.variantenData.basisstufe,
            klasse: this.variantenData.klasse,
            agenturkompetenz_code: this.variantenData.agenturkompetenz,
            agenturkompetenz_value: this.agenturkompetenzSignal(),
            technischeZuweisungen: this.technischeZuweisungen.length
        });

        // Populate additional fields (basisstufe, stufe, prämiensatz) from merkmal data
        // This will overwrite basisstufe with the correct value from merkmal
        this.populateFieldsFromMerkmal(bb);
    }

    // ========================================
    // DATA TRANSFORMATION & PERSISTENCE
    // ========================================

    /**
     * Load variant data from store and convert from strings to numbers
     */
    private loadVariantenDataFromStore(offerte: Offerte | null): void {
        if (!offerte) return;

        const metaUi = this.currentMeta()?.variantenUi;
        if (metaUi) {
            this.variantenData = JSON.parse(JSON.stringify(metaUi));
            return;
        }

        const varianten = Array.isArray(offerte.variante) ? offerte.variante : [];
        const selectedVariante = getSelectedVarianteFromStore(varianten);

        // Agenturkompetenz can be numeric (old) or code; normalize to code and numeric signal
        const agenturkompetenzRaw = offerte.bb?.agenturkompetenz ?? varianten[0]?.agtstufe;
        if (agenturkompetenzRaw !== undefined && agenturkompetenzRaw !== null && agenturkompetenzRaw !== '') {
            const isNumericString = typeof agenturkompetenzRaw === 'string' && /^-?\d+$/.test(agenturkompetenzRaw);
            const isNumber = typeof agenturkompetenzRaw === 'number';
            if (!isNumber && !isNumericString) {
                this.variantenData.agenturkompetenz = String(agenturkompetenzRaw);
                this.agenturkompetenzSignal.set(this.getAgenturkompetenzValue(String(agenturkompetenzRaw)));
            } else {
                const numericValue = isNumber ? agenturkompetenzRaw : parseInt(String(agenturkompetenzRaw), 10);
                const code = this.getAgenturkompetenzCode(numericValue);
                if (code) {
                    this.variantenData.agenturkompetenz = code;
                    this.agenturkompetenzSignal.set(numericValue);
                } else {
                    this.logger.warn('Could not map agenturkompetenz numeric value from store to code:', numericValue);
                    this.variantenData.agenturkompetenz = '';
                    this.agenturkompetenzSignal.set(0);
                }
            }
        } else {
            const defaultCode = this.getAgenturkompetenzCode(0);
            if (defaultCode) {
                this.variantenData.agenturkompetenz = defaultCode;
                this.agenturkompetenzSignal.set(0);
            }
        }

        if (offerte.klasse) {
            this.variantenData.klasse = offerte.klasse;
        }

        if (offerte.basisstufe !== undefined && offerte.basisstufe !== null) {
            const basisstufeValue = Number(offerte.basisstufe) || 0;
            this.variantenData.basisstufe = toString(basisstufeValue);
            this.basisstufeSignal.set(basisstufeValue);
        }

        // Variants A/B/C direct from store array
        const varianteA = varianten.find((v) => v.variante === 1);
        const varianteB = varianten.find((v) => v.variante === 2);
        const varianteC = varianten.find((v) => v.variante === 3);
        this.variantenData.varianteA = toUiVariante(varianteA);
        this.variantenData.varianteB = toUiVariante(varianteB);
        this.variantenData.varianteC = toUiVariante(varianteC);

        // Recalculate derived fields for populated variants
        (['varianteA', 'varianteB', 'varianteC'] as const).forEach((key) => {
            const variante = this.variantenData[key];
            if (variante && toNumber(variante.verdienst) > 0) {
                this.calculateVarianteFields(key, true);
            }
        });

        // Selected variant and praemiensatz from store
        if (selectedVariante) {
            this.variantenData.selectedVariante = selectedVariante;
        }

        // Payment and bank details
        if (offerte.praemienzahlung) {
            const zahlResult = validatePraemienzahlung(offerte.praemienzahlung);
            if (zahlResult.isValid) {
                this.variantenData.praemienzahlung = zahlResult.cleaned as VariantenData['praemienzahlung'];
                this.invalidZahlungsweiseWarning.set(null);
            } else {
                if (zahlResult.warningKey) {
                    this.invalidZahlungsweiseWarning.set(this.translateService.instant(zahlResult.warningKey, zahlResult.warningParams));
                } else {
                    this.invalidZahlungsweiseWarning.set(null);
                }
                this.variantenData.praemienzahlung = undefined;
            }
        }
        this.variantenData.name_bank = offerte.name_bank || '';
        this.variantenData.plz_bank = offerte.plz_bank || '';
        this.variantenData.ort_bank = offerte.ort_bank || '';
        if (offerte.iban) {
            this.variantenData.iban = offerte.iban;
            this.ibanSignal.set(offerte.iban);
            this.ibanLoaded.set(true);
        }
        this.variantenData.kontoinhaber = offerte.kontoinhaber || '';
        this.variantenData.begleitbrief = parseBegleitbriefValue(offerte.begleitbrief, false);

        this.logger.log('Variant data restored from store', {
            selectedVariante,
            klasse: this.variantenData.klasse,
            basisstufe: this.variantenData.basisstufe
        });

        // Cache restored UI snapshot to prevent false-positive change detection
        this.offerteStore.updateMeta(null, {
            variantenUi: JSON.parse(JSON.stringify(this.variantenData))
        });
    }

    /**
     * Prepare variant data for API submission (converts to OfferteVariante[] format)
     * Maps selected variant to status=true, others to status=false
     * Silently validates non-selected variants and clears invalid data
     */
    /**
     * Load maximum versicherter Verdienst from cache (already prefetched)
     */
    private loadMaxVersVerdienst(): void {
        this.logger.log('Loading max VersVerdienst from cache...');

        this.variaService.getMaxVersVerdienst().subscribe({
            next: (maxValue) => {
                this.maxVersVerdienst.set(maxValue);
                this.logger.log('Max VersVerdienst loaded:', maxValue);

                // Re-validate only the selected variant if it has a verdienst value
                if (this.variantenData.selectedVariante) {
                    const selectedVarianteKey = `variante${this.variantenData.selectedVariante}` as 'varianteA' | 'varianteB' | 'varianteC';
                    const selectedVariante = this.variantenData[selectedVarianteKey];
                    if (selectedVariante && toNumber(selectedVariante.verdienst) > 0) {
                        this.validateJahresverdienst(selectedVarianteKey, selectedVariante.verdienst);
                    }
                }
            },
            error: (error) => {
                this.logger.error('Failed to load max VersVerdienst:', error);
                // Don't block the UI, just log the error
            }
        });
    }

    /**
     * Validate jahresverdienst against maximum allowed value and minimum based on stellungImBetrieb
     */
    private validateJahresverdienst(variantKey: 'varianteA' | 'varianteB' | 'varianteC', value: string | undefined): boolean {
        const numValue = toNumber(value);
        const offerte = this.offerteStore.currentOfferte();
        const stellungImBetrieb = offerte?.stellung_im_betrieb;
        const arbeitspensum = offerte?.beschaeft_grad;

        let percentage = 100;
        if (arbeitspensum) {
            const codeEntry = this.arbeitspensumCodeMap().get(arbeitspensum);
            if (codeEntry) {
                const label = this.codesService.getLocalizedLabel(codeEntry);
                const match = label.match(/(\d+(?:[.,]\d+)?)\s*%/);
                if (match) {
                    percentage = parseFloat(match[1].replace(',', '.'));
                }
            }
        }

        let stellungLabel = '';
        if (stellungImBetrieb) {
            const codeEntry = this.stellungImBetriebCodeMap().get(stellungImBetrieb);
            if (codeEntry) {
                stellungLabel = this.codesService.getLocalizedLabel(codeEntry);
            }
        }

        const validationResult = validateJahresverdienstWithContext({
            value: numValue,
            maxVersVerdienst: this.maxVersVerdienst(),
            isFamilyMember: !!stellungImBetrieb && this.isFamilyMember(stellungImBetrieb),
            isOwner: !!stellungImBetrieb && this.isOwner(stellungImBetrieb),
            percentage,
            stellungLabel
        });

        if (!validationResult.success) {
            const errors = { ...this.verdienstErrors() };
            errors[variantKey] = this.translateVerdienstError(validationResult.error);
            this.verdienstErrors.set(errors);
            this.scrollToFirstError();
            return false;
        }

        const currentErrors = { ...this.verdienstErrors() };
        delete currentErrors[variantKey];
        this.verdienstErrors.set(currentErrors);
        return true;
    }

    /**
     * Scroll to the first validation error message
     */
    private scrollToFirstError(): void {
        setTimeout(() => {
            if (this.errorMessageA) {
                this.errorMessageA.nativeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            }
        }, 100);
    }

    private translateVerdienstError(error?: JahresverdienstValidationError): string {
        if (!error) {
            return this.translateService.instant('fuv.police.varianten.validation.errors.generic');
        }

        switch (error.type) {
            case 'familyMemberMinimum': {
                const label = error.stellungLabel || this.getDefaultStellungLabel('familyMemberMinimum');
                return this.translateService.instant('fuv.police.varianten.validation.errors.familyMemberMin', {
                    label,
                    percentage: this.formatPercentage(error.percentage),
                    minValue: this.formatCurrency(error.minValue)
                });
            }
            case 'ownerMinimum': {
                const label = error.stellungLabel || this.getDefaultStellungLabel('ownerMinimum');
                return this.translateService.instant('fuv.police.varianten.validation.errors.ownerMin', {
                    label,
                    percentage: this.formatPercentage(error.percentage),
                    minValue: this.formatCurrency(error.minValue)
                });
            }
            case 'maxExceeded':
                return this.translateService.instant('fuv.police.varianten.validation.errors.maxValue', {
                    maxValue: this.formatCurrency(error.maxValue)
                });
            case 'negativeValue':
                return this.translateService.instant('fuv.police.varianten.validation.errors.negativeValue');
            default:
                return this.translateService.instant('fuv.police.varianten.validation.errors.generic');
        }
    }

    private getDefaultStellungLabel(type: 'familyMemberMinimum' | 'ownerMinimum'): string {
        const key = type === 'familyMemberMinimum' ? 'fuv.police.varianten.validation.defaults.familyMemberLabel' : 'fuv.police.varianten.validation.defaults.ownerLabel';
        return this.translateService.instant(key);
    }

    private formatCurrency(value?: number | null): string {
        if (value === undefined || value === null) {
            return '0';
        }
        return value.toLocaleString('de-CH');
    }

    private formatPercentage(value?: number): string {
        if (value === undefined || value === null || Number.isNaN(value)) {
            return '100';
        }
        return value.toLocaleString('de-CH', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
    }

    /**
     * Check if a stellungImBetrieb code represents a family member
     * Family members require a minimum jahresverdienst of 44'460 CHF
     */
    private isFamilyMember(stellungImBetrieb: string): boolean {
        return FAMILY_MEMBER_CODES.includes(stellungImBetrieb);
    }

    /**
     * Check if a stellungImBetrieb code represents a business owner or other non-family member
     * Owners require a minimum jahresverdienst of 66'690 CHF
     */
    private isOwner(stellungImBetrieb: string): boolean {
        return OWNER_CODES.includes(stellungImBetrieb);
    }

    /**
     * Calculate minimum allowed jahresverdienst based on stellungImBetrieb and arbeitspensum
     */
    private calculateMindestverdienst(): number {
        const offerte = this.offerteStore.currentOfferte();
        const stellungImBetrieb = offerte?.stellung_im_betrieb;
        const arbeitspensum = offerte?.beschaeft_grad;

        let percentage = 100;
        if (arbeitspensum) {
            const codeEntry = this.arbeitspensumCodeMap().get(arbeitspensum);
            if (codeEntry) {
                const label = this.codesService.getLocalizedLabel(codeEntry);
                const match = label.match(/(\d+(?:[.,]\d+)?)\s*%/);
                if (match) {
                    percentage = parseFloat(match[1].replace(',', '.'));
                }
            }
        }

        if (stellungImBetrieb && this.isFamilyMember(stellungImBetrieb)) {
            return Math.round(MIN_JAHRESVERDIENST_FAMILY_MEMBERS * (percentage / 100));
        }
        if (stellungImBetrieb && this.isOwner(stellungImBetrieb)) {
            return Math.round(MIN_JAHRESVERDIENST_OWNERS * (percentage / 100));
        }

        return 0;
    }

    /**
     * Validate all required fields and show errors to user
     * This method is called when clicking "Next" button
     */
    validateForm(): boolean {
        // Skip validation in read-only mode - always return true
        if (this.viewMode) {
            this.logger.log('Skipping validation in read-only mode');
            return true;
        }

        this.showValidation.set(true);

        // Re-validate the selected variant's jahresverdienst to ensure errors are up-to-date
        if (this.variantenData.selectedVariante) {
            const selectedVarianteKey = `variante${this.variantenData.selectedVariante}` as 'varianteA' | 'varianteB' | 'varianteC';
            const selectedVariante = this.variantenData[selectedVarianteKey];

            if (selectedVariante && toNumber(selectedVariante.verdienst) > 0) {
                this.validateJahresverdienst(selectedVarianteKey, selectedVariante.verdienst);
            }
        }

        const isValid = this.isStepValid();

        if (!isValid) {
            this.logger.error('Varianten validation errors detected');

            // Scroll to error banner after a short delay to ensure it's rendered
            // Using longer delay to ensure DOM update from *ngIf
            setTimeout(() => {
                this.scrollToErrorBanner();
            }, 200);
        } else {
        }

        return isValid;
    }

    /**
     * Scroll to the validation error banner
     */
    private scrollToErrorBanner(): void {
        this.logger.log('Scrolling to error banner', {
            validationErrorBanner: !!this.validationErrorBanner,
            nativeElement: !!this.validationErrorBanner?.nativeElement
        });

        if (this.validationErrorBanner) {
            this.validationErrorBanner.nativeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
            // Optional: Add focus for accessibility
            this.validationErrorBanner.nativeElement.focus();
        } else {
            this.logger.warn('validationErrorBanner ViewChild not found - banner may not be rendered yet');
        }
    }

    /**
     * Get validation error for a specific field
     */
    getVarianteError(variantKey: 'varianteA' | 'varianteB' | 'varianteC'): string | undefined {
        return this.verdienstErrors()[variantKey];
    }

    /**
     * Get validation error for the selected variant
     */
    getSelectedVarianteError(): string | undefined {
        if (!this.variantenData.selectedVariante) return undefined;
        const selectedVarianteKey = `variante${this.variantenData.selectedVariante}` as 'varianteA' | 'varianteB' | 'varianteC';
        return this.verdienstErrors()[selectedVarianteKey];
    }

    /**
     * Check if a specific field has an error - only shows after validation is triggered
     * This follows the same pattern as taetigkeit component
     */
    hasError(varianteKey: 'varianteA' | 'varianteB' | 'varianteC', field: 'verdienst' | 'taggeld'): boolean {
        if (!this.showValidation()) return false;

        const variante = this.variantenData[varianteKey];
        if (!variante) return false;

        if (field === 'verdienst') {
            // Check if there's a validation error or if verdienst is empty/zero
            return !!this.verdienstErrors()[varianteKey] || toNumber(variante.verdienst) <= 0 || !variante.verdienst;
        } else if (field === 'taggeld') {
            // Check if taggeld is empty
            return !variante.taggeld || variante.taggeld.trim() === '';
        }

        return false;
    }

    /**
     * Check if the selected variant has a specific type of error
     */
    hasSelectedVarianteError(errorType: 'verdienst' | 'taggeld'): boolean {
        if (!this.showValidation() || !this.variantenData.selectedVariante) return false;

        const selectedVarianteKey = `variante${this.variantenData.selectedVariante}` as 'varianteA' | 'varianteB' | 'varianteC';
        const selectedVariante = this.variantenData[selectedVarianteKey];

        if (!selectedVariante) return false;

        if (errorType === 'verdienst') {
            return !!this.verdienstErrors()[selectedVarianteKey] || toNumber(selectedVariante.verdienst) <= 0;
        } else if (errorType === 'taggeld') {
            return !selectedVariante.taggeld || selectedVariante.taggeld.trim() === '';
        }

        return false;
    }

    /**
     * Check if a top-level form field has an error or is empty
     * Used for validation of agenturkompetenz, praemienzahlung, etc.
     */
    hasFieldError(fieldName: string): boolean {
        if (!this.showValidation()) return false;

        // Check if field is empty based on field name
        switch (fieldName) {
            case 'agenturkompetenz':
                return !this.variantenData.agenturkompetenz || this.variantenData.agenturkompetenz.trim() === '';
            case 'praemienzahlung':
                return !this.variantenData.praemienzahlung || this.variantenData.praemienzahlung.trim() === '';
            case 'selectedVariante':
                return !this.variantenData.selectedVariante || this.variantenData.selectedVariante.trim() === '';
            default:
                return false;
        }
    }

    /**
     * Validate that the praemienzahlung (payment method) is set
     * This is a simple check - if not set, normal validation will catch it
     */

    /**
     * Check if a variante field is empty (for orange styling)
     * Returns true if field is empty but not showing a validation error
     * Orange styling appears by default for empty fields, turns red only when validation errors exist
     * @param variante - 'varianteA', 'varianteB', or 'varianteC'
     * @param fieldName - The field name to check
     * @returns True if empty and should show orange styling
     */
    isVarianteFieldEmpty(variante: 'varianteA' | 'varianteB' | 'varianteC', fieldName: string): boolean {
        const varianteData = this.variantenData[variante];
        if (!varianteData) return false;

        // Don't show orange if there's already a validation error (red takes precedence)
        if (fieldName === 'verdienst' && this.verdienstErrors()[variante]) {
            return false;
        }

        return isEmptyFieldValue((varianteData as any)[fieldName], { treatZeroAsEmpty: true });
    }

    /**
     * Check if a top-level field is empty (for orange styling)
     * Used for agenturkompetenz, praemienzahlung, etc.
     * Orange styling appears by default for empty fields, turns red only when validation errors exist
     */
    isTopLevelFieldEmpty(fieldName: string): boolean {
        // Don't show orange if there's already a validation error (red takes precedence)
        if (this.hasFieldError(fieldName)) {
            return false;
        }

        const treatZeroAsEmpty = fieldName !== 'begleitbrief';
        return isEmptyFieldValue((this.variantenData as any)[fieldName], { treatZeroAsEmpty });
    }

    /**
     * Get German label for assignment type using codes service
     * Looks up the label from the TEZU_TYPE code gruppe
     * @param type The assignment type code (e.g., 'HZ', 'NZ')
     * @returns The localized label from codes service or the original type if not found
     */
    getZuweisungstyp(type: string): string {
        const codeMap = this.tezuTypeCodeMap();
        const codeEntry = codeMap.get(type);
        if (codeEntry) {
            return this.codesService.getLocalizedLabel(codeEntry);
        }
        // Fallback to original value if not found
        return type;
    }

    /**
     * Populate form fields from merkmal data
     * Searches for the merkmal by internalname from BB and populates stufe and prämiensatz
     */
    private populateFieldsFromMerkmal(bb: BB): void {
        // Get the first bb2merkmal's internalname
        const merkmalInternalname = bb.bb2merkmal?.[0]?.merkmal_internalname;

        if (!merkmalInternalname) {
            this.logger.warn('No merkmal_internalname found in BB');
            return;
        }

        // Search for the merkmal by internalname
        this.merkmalService.getAllMerkmale().subscribe({
            next: (merkmale: MerkmalApiResponse[]) => {
                const merkmal = merkmale.find((m) => m.internalname === merkmalInternalname);

                if (merkmal) {
                    this.logger.log('Found merkmal for BB', {
                        internalname: merkmal.internalname,
                        stufe: merkmal.stufe,
                        klasse: merkmal.klasse,
                        nettopraemiensatz: merkmal.nettopraemiensatz
                    });

                    // merkmal.stufe is the base value - it should go into basisstufe
                    const baseStufe = merkmal.stufe || 0;
                    this.variantenData.basisstufe = toString(baseStufe);

                    // Update signal - this will trigger automatic recalculation of stufe
                    this.basisstufeSignal.set(baseStufe);

                    // Store the base nettopraemiensatz for prämiensatz brutto calculation
                    const baseNettopraemiensatz = merkmal.nettopraemiensatz || 0;
                    this.baseNettopraemiensatzSignal.set(baseNettopraemiensatz);

                    // Populate prämiensatz from merkmal - this will be overwritten by computed value
                    this.variantenData.praemiensatz = merkmal.nettopraemiensatz ? `${merkmal.nettopraemiensatz.toFixed(4)} %` : '';

                    this.logger.log('Populated fields from merkmal', {
                        basisstufe: baseStufe,
                        agenturkompetenz: this.agenturkompetenzSignal(),
                        stufe: this.calculatedStufe(),
                        baseNettopraemiensatz: baseNettopraemiensatz,
                        calculation_stufe: `${baseStufe} + (${this.agenturkompetenzSignal()}) = ${this.calculatedStufe()}`,
                        calculation_praemiensatz: `${baseNettopraemiensatz} * (1 + ${this.agenturkompetenzSignal()}/100) = ${this.calculatedPraemiensatzBrutto()}`,
                        praemiensatz: this.variantenData.praemiensatz
                    });
                } else {
                    this.logger.warn('Merkmal not found for internalname:', merkmalInternalname);
                }
            },
            error: (error: Error) => {
                this.logger.error('Error fetching merkmal data:', error);
            }
        });
    }

    onDataChange(): void {
        if (this.currentMeta()?.variantenUi && !this.hasUnsavedChanges()) {
            this.logger.debug('[Varianten] onDataChange skipped - no changes detected');
            return;
        }

        this.variantStateVersion.update((v) => v + 1);

        // Changing variants invalidates any provisional signature
        this.offerteStore.invalidateSignature();

        // Emit event for parent component (if needed)
        this.dataChange.emit(this.variantenData);

        const currentOfferte = this.offerteStore.currentOfferte();
        const currentBB = currentOfferte?.bb;
        const varianteDataForApi = mapVariantsToApi(
            this.variantenData,
            Array.isArray(currentOfferte?.variante) ? currentOfferte!.variante : [],
            this.authService.getUserProfile()?.username || 'system',
            this.calculateMindestverdienst(),
            currentBB?.vksatz
        );

        // Update BB object with calculated bruttopraemiensatz
        // This ensures the print service has access to the calculated premium rate
        // IMPORTANT: We use spread operator to preserve ALL existing BB fields including:
        // - vksatz and uvksatz (calculated by backend during TEZU)
        // - bbtezu array (technische zuweisung)
        // - bb2merkmal array (tätigkeiten)
        let updatedBB = currentBB;
        if (currentBB) {
            updatedBB = {
                ...currentBB, // Preserve all existing fields including vksatz, uvksatz, bbtezu, bb2merkmal
                bruttopraemiensatz: this.calculatedPraemiensatzBrutto(),
                nettopraemiensatz: this.baseNettopraemiensatzSignal(),
                agenturkompetenz: this.variantenData.agenturkompetenz || currentBB.agenturkompetenz,
                basisstufe: this.basisstufeSignal()
            };
            this.logger.log('[onDataChange] Updated BB with calculated prämiensatz:', {
                bruttopraemiensatz: updatedBB.bruttopraemiensatz,
                nettopraemiensatz: updatedBB.nettopraemiensatz,
                agenturkompetenz: updatedBB.agenturkompetenz,
                basisstufe: updatedBB.basisstufe,
                vksatz: updatedBB.vksatz,
                uvksatz: updatedBB.uvksatz
            });
        }

        // Persist UI buffer into meta for round-trips (UI-only fields like begleitbrief)
        this.offerteStore.updateMeta(null, { variantenUi: JSON.parse(JSON.stringify(this.variantenData)) });

        this.offerteStore.updateOfferte(null, {
            variante: varianteDataForApi,
            bb: updatedBB, // Update BB with calculated values
            // Map all fields from variantenData - using same names as backend wherever possible
            klasse: this.variantenData.klasse,
            basisstufe: this.variantenData.basisstufe ? Number(this.variantenData.basisstufe) : undefined,
            praemienzahlung: this.variantenData.praemienzahlung,
            name_bank: this.variantenData.name_bank,
            plz_bank: this.variantenData.plz_bank,
            ort_bank: this.variantenData.ort_bank,
            iban: this.variantenData.iban,
            kontoinhaber: this.variantenData.kontoinhaber
        });

        // If validation was shown previously and the form is now valid, clear the flag
        if (this.showValidation() && this.isStepValid()) {
            this.showValidation.set(false);
        }
    }

    /**
     * Calculate all dependent fields for a specific variant
     * Called when jahresverdienst or taggeldAb changes
     */
    calculateVarianteFields(variantKey: 'varianteA' | 'varianteB' | 'varianteC', skipDataChange = false): void {
        const variante = this.variantenData[variantKey];

        if (!variante) {
            this.logger.warn(`Cannot calculate fields for ${variantKey}: variant is undefined`);
            return;
        }

        const updated = this.tezuService.computeVarianteFields(variante, this.calculatedPraemiensatzBrutto());
        this.variantenData[variantKey] = updated;

        // Trigger data change event (unless explicitly skipped, e.g., during initial load)
        if (!skipDataChange) {
            this.onDataChange();
        }
    }

    /**
     * Handle changes to Agenturkompetenz
     * Updates the signal which triggers automatic recalculation of stufe and prämiensatz brutto
     */
    onAgenturkompetenzChange(): void {
        // Convert internal_name to numeric value for calculations
        const numericValue = this.variantenData.agenturkompetenz ? this.getAgenturkompetenzValue(this.variantenData.agenturkompetenz) : 0;

        // Update the signal - this will trigger the computed stufe and praemiensatzBrutto to recalculate
        this.agenturkompetenzSignal.set(numericValue);

        // Update the displayed praemiensatz field with the new calculated brutto value
        const praemiensatzBrutto = this.calculatedPraemiensatzBrutto();
        this.variantenData.praemiensatz = `${praemiensatzBrutto.toFixed(4)} %`;

        this.logger.log('Agenturkompetenz changed, recalculated values', {
            agenturkompetenz_code: this.variantenData.agenturkompetenz,
            agenturkompetenz_value: numericValue,
            baseNettopraemiensatz: this.baseNettopraemiensatzSignal(),
            basisstufe: this.basisstufeSignal(),
            calculatedStufe: this.calculatedStufe(),
            praemiensatzBrutto: praemiensatzBrutto,
            formula_praemiensatz: `${this.baseNettopraemiensatzSignal()} * (1 + ${numericValue}/100) = ${praemiensatzBrutto}`,
            formula_stufe: `${this.basisstufeSignal()} + ${numericValue} = ${this.calculatedStufe()}`
        });

        // Recalculate all variant fields with the new prämiensatz brutto
        // Only recalculate if the variant has a jahresverdienst value
        if (this.variantenData.varianteA && this.variantenData.varianteA.verdienst && toNumber(this.variantenData.varianteA.verdienst) > 0) {
            this.calculateVarianteFields('varianteA');
        }
        if (this.variantenData.varianteB && this.variantenData.varianteB.verdienst && toNumber(this.variantenData.varianteB.verdienst) > 0) {
            this.calculateVarianteFields('varianteB');
        }
        if (this.variantenData.varianteC && this.variantenData.varianteC.verdienst && toNumber(this.variantenData.varianteC.verdienst) > 0) {
            this.calculateVarianteFields('varianteC');
        }

        // Trigger data change to save to store
        this.onDataChange();
    }

    /**
     * Handle changes to Jahresverdienst for a specific variant
     */
    onVerdienstChange(variantKey: 'varianteA' | 'varianteB' | 'varianteC'): void {
        const variante = this.variantenData[variantKey];

        if (!variante) {
            this.logger.warn(`Cannot handle jahresverdienst change for ${variantKey}: variant is undefined`);
            return;
        }

        // Validate jahresverdienst first
        const isValid = this.validateJahresverdienst(variantKey, variante.verdienst);

        // Calculate fields regardless of validation (but show error if invalid)
        this.calculateVarianteFields(variantKey);

        if (!isValid) {
            this.logger.warn(`${variantKey} has an invalid jahresverdienst value`);
        }
    }

    /**
     * Handle changes to Taggeld Ab for a specific variant
     */
    onTaggeldChange(variantKey: 'varianteA' | 'varianteB' | 'varianteC'): void {
        this.calculateVarianteFields(variantKey);
    }

    /**
     * Copy Jahresverdienst from Variante A to B and C
     */
    copyVerdienst(): void {
        if (!this.variantenData.varianteA || !this.variantenData.varianteB || !this.variantenData.varianteC) {
            this.logger.warn('Cannot copy jahresverdienst: one or more variants are undefined');
            return;
        }

        const sourceValue = this.variantenData.varianteA.verdienst;
        this.variantenData.varianteB.verdienst = sourceValue;
        this.variantenData.varianteC.verdienst = sourceValue;

        // Trigger validation and recalculation for both variants
        this.onVerdienstChange('varianteB');
        this.onVerdienstChange('varianteC');
    }

    /**
     * Copy Taggeld Ab from Variante A to B and C
     */
    copyTaggeld(): void {
        if (!this.variantenData.varianteA || !this.variantenData.varianteB || !this.variantenData.varianteC) {
            this.logger.warn('Cannot copy taggeldAb: one or more variants are undefined');
            return;
        }

        const sourceValue = this.variantenData.varianteA.taggeld;
        this.variantenData.varianteB.taggeld = sourceValue;
        this.variantenData.varianteC.taggeld = sourceValue;

        // Trigger recalculation for both variants
        this.onTaggeldChange('varianteB');
        this.onTaggeldChange('varianteC');
    }

    /**
     * Toggle variant selection - allow deselecting by clicking again
     */
    toggleVarianteSelection(variant: 'A' | 'B' | 'C'): void {
        const previousSelection = this.variantenData.selectedVariante;

        if (this.variantenData.selectedVariante === variant) {
            this.variantenData.selectedVariante = undefined; // Use undefined instead of null
        } else {
            this.variantenData.selectedVariante = variant;
        }

        // Clear validation errors for the previously selected variant when switching
        if (previousSelection && previousSelection !== variant) {
            const previousVarianteKey = `variante${previousSelection}` as 'varianteA' | 'varianteB' | 'varianteC';
            const errors = { ...this.verdienstErrors() };
            delete errors[previousVarianteKey];
            this.verdienstErrors.set(errors);
        }

        // Validate the newly selected variant if it has data
        if (variant && variant !== previousSelection) {
            const selectedVarianteKey = `variante${variant}` as 'varianteA' | 'varianteB' | 'varianteC';
            const selectedVariante = this.variantenData[selectedVarianteKey];
            if (selectedVariante && toNumber(selectedVariante.verdienst) > 0) {
                this.validateJahresverdienst(selectedVarianteKey, selectedVariante.verdienst);
            }
        }

        this.onDataChange();
    }

    /**
     * Toggle prämienzahlung selection - allow deselecting by clicking again
     */
    togglePraemienzahlung(value: VariantenData['praemienzahlung']): void {
        if (this.variantenData.praemienzahlung === value) {
            this.variantenData.praemienzahlung = undefined;
        } else {
            this.variantenData.praemienzahlung = value;
        }

        this.onDataChange();
    }

    /**
     * Handle IBAN input change
     * Validates IBAN format and looks up bank details if valid
     */
    onIbanChange(): void {
        const iban = this.variantenData.iban;

        // Update signal with current IBAN (but don't set ibanLoaded flag for manual input)
        this.ibanSignal.set(iban || '');

        // Reset error state
        this.ibanError.set(null);

        // Skip validation for empty IBAN
        if (!iban || iban.trim() === '') {
            // Clear bank fields
            this.variantenData.name_bank = '';
            this.variantenData.plz_bank = '';
            this.variantenData.ort_bank = '';
            this.onDataChange();
            return;
        } // Validate IBAN format
        const validationResult = validateIban(iban);

        if (!validationResult.success) {
            this.ibanError.set(this.translateService.instant('fuv.police.varianten.iban.errors.invalidFormat'));
            this.logger.warn('Invalid IBAN format:', {
                iban,
                error: this.ibanError
            });

            // Clear bank fields on invalid IBAN
            this.variantenData.name_bank = '';
            this.variantenData.plz_bank = '';
            this.variantenData.ort_bank = '';
            this.onDataChange();
            return;
        }

        // Format IBAN with spaces
        if (validationResult.formattedIban && validationResult.formattedIban !== iban) {
            this.variantenData.iban = validationResult.formattedIban;
        }

        // Only look up bank details for Swiss IBANs
        // For non-Swiss IBANs, clearing bank info and allow user to enter manually
        if (validationResult.isSwiss) {
            // Look up bank details for Swiss IBAN
            this.lookupBankByIban(iban);
        } else {
            // Clear bank fields for manual entry
            this.variantenData.name_bank = '';
            this.variantenData.plz_bank = '';
            this.variantenData.ort_bank = '';
            this.ibanError.set(null);
            this.onDataChange();
        }
    }

    /**
     * Look up bank details by Swiss IBAN
     * Extracts clearing number and calls bank search API
     */
    private lookupBankByIban(iban: string): void {
        this.isLoadingBank.set(true);
        this.ibanError.set(null);

        this.bankService.searchBankByIban(iban).subscribe({
            next: (banks) => {
                this.isLoadingBank.set(false);

                if (banks && banks.length > 0) {
                    const bank = banks[0]; // Use first match

                    this.logger.log('Found bank for IBAN', {
                        bank_institut: bank.bank_institut,
                        plz: bank.plz,
                        ort: bank.ort,
                        clearingnummer: bank.clearingnummer
                    });

                    // Populate bank fields
                    this.variantenData.name_bank = bank.bank_institut || '';
                    this.variantenData.plz_bank = bank.plz || '';
                    this.variantenData.ort_bank = bank.ort || '';

                    this.onDataChange();
                } else {
                    this.logger.warn('No bank found for IBAN:', iban);
                    this.ibanError.set(this.translateService.instant('fuv.police.varianten.iban.errors.noBankFound'));

                    // Clear bank fields if no match
                    this.variantenData.name_bank = '';
                    this.variantenData.plz_bank = '';
                    this.variantenData.ort_bank = '';
                    this.onDataChange();
                }
            },
            error: (error) => {
                this.isLoadingBank.set(false);
                this.logger.error('Error looking up bank:', error);
                this.ibanError.set(this.translateService.instant('fuv.police.varianten.iban.errors.lookupFailed'));

                // Clear bank fields on error
                this.variantenData.name_bank = '';
                this.variantenData.plz_bank = '';
                this.variantenData.ort_bank = '';
                this.onDataChange();
            }
        });
    }
}
