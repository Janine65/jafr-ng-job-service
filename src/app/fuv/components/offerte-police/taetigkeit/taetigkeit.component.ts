import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import {
    Component, computed, effect, ElementRef, inject, Input, OnInit, output, signal, ViewChild
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MerkmalApiResponse } from '@app/fuv/models/merkmal.model';
import { Offerte, OfferteMetaData } from '@app/fuv/models/offerte.model';
import { TaetigkeitData } from '@app/fuv/models/taetigkeit.model';
import { CodeLabelPipe } from '@app/fuv/pipes/code-label.pipe';
import { BBService } from '@app/fuv/services/bb.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { MerkmalService } from '@app/fuv/services/merkmal.service';
import { TaetigkeitService } from '@app/fuv/services/taetigkeit.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { OfferteDateHelper } from '@app/fuv/utils/offerte-field-helpers';
import { isEmptyFieldValue } from '@app/shared/helpers/form-helpers';
import {
    calculateContractEndDate, calculateYearsBetween, formatDateSwiss
} from '@app/shared/utils/date-helpers';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, LogFactoryService } from '@syrius/core';

import {
    CODE_GRUPPE_ANZAHL_MITARBEITER, CODE_GRUPPE_ARBEITSPENSUM, CODE_GRUPPE_AVB,
    CODE_GRUPPE_DAUER_VERTRAG, CODE_GRUPPE_STELLUNG_IM_BETRIEB, CODE_GRUPPE_VERKAUFSKANAL,
    DEFAULT_VERKAUFSKANAL_NEW, DEFAULT_VERKAUFSKANAL_VERL, DEFAULT_VERTRAGSDAUER, OFFERTE_ART_UNV,
    OFFERTE_ART_VERL
} from '../police.constants';
import {
    runTaetigkeitFormValidation, validateAndCorrectAvb, validateAndCorrectEndDate
} from './taetigkeit.validation';

@Component({
    selector: 'app-taetigkeit',
    standalone: true,
    imports: [CommonModule, FormsModule, PanelModule, ButtonModule, InputTextModule, SelectModule, AutoCompleteModule, DatePickerModule, InputNumberModule, TooltipModule, TranslateModule, CodeLabelPipe],
    templateUrl: './taetigkeit.component.html'
})
export class TaetigkeitComponent implements OnInit {
    @Input() viewMode: boolean = false;

    // ===== Outputs =====
    taetigkeitChange = output<TaetigkeitData>();
    validationChange = output<boolean>();
    defaultsApplied = output<void>(); // Emitted when defaults are set and need backend save
    changeDetected = output<{ fieldsChanged: Record<string, boolean>; taetigkeitenChanges: { added: number; removed: number; modified: boolean }; hasChanges: boolean }>(); // Emitted when any field changes
    taetigkeitenChangeDetected = output<{ added: number; removed: number; modified: boolean; hasChanges: boolean }>(); // Emitted when tätigkeiten array changes

    // View refs
    @ViewChild('validationErrorBanner') validationErrorBanner?: ElementRef;

    // Dependencies
    public offerteStore = inject(OfferteTypedStore);
    private codesService = inject(CodesService);
    private merkmalService = inject(MerkmalService);
    private taetigkeitService = inject(TaetigkeitService);
    private bbService = inject(BBService);
    private authService = inject(AuthService);
    private logger = inject(LogFactoryService).createLogger('TaetigkeitComponent');

    // Current offerte and meta data (signals from store)
    readonly currentOfferte = this.offerteStore.currentOfferte;
    readonly currentMeta = this.offerteStore.currentMeta;
    readonly isReadOnly = computed(() => this.viewMode || this.currentMeta()?.isReadOnly === true);
    readonly isVerlaengerungView = computed(() => this.offerteStore.currentOfferte()?.art === OFFERTE_ART_VERL || this.currentMeta()?.isVerlaengerung === true);

    // Change tracking signals
    vertragGueltigAbChanged = signal<boolean>(false);
    vertragGueltigBisChanged = signal<boolean>(false);
    vertragsdauerChanged = signal<boolean>(false);
    verkaufskanalChanged = signal<boolean>(false);
    taetigkeitsbeschreibungChanged = signal<boolean>(false);
    stellungImBetriebChanged = signal<boolean>(false);
    arbeitspensumChanged = signal<boolean>(false);
    selbststaendigSeitChanged = signal<boolean>(false);
    anzahlMitarbeiterChanged = signal<boolean>(false);
    stellenprozenteChanged = signal<boolean>(false);

    // Track tätigkeiten array changes (add/remove/modify)
    taetigkeitenAdded = signal<number>(0); // Count of items added
    taetigkeitenRemoved = signal<number>(0); // Count of items removed
    taetigkeitenModified = signal<boolean>(false); // Any item modified

    // Track if ANY field has changed
    hasChanges = computed(
        () =>
            this.vertragGueltigAbChanged() ||
            this.vertragGueltigBisChanged() ||
            this.vertragsdauerChanged() ||
            this.verkaufskanalChanged() ||
            this.taetigkeitsbeschreibungChanged() ||
            this.stellungImBetriebChanged() ||
            this.arbeitspensumChanged() ||
            this.selbststaendigSeitChanged() ||
            this.anzahlMitarbeiterChanged() ||
            this.stellenprozenteChanged() ||
            this.taetigkeitenModified() ||
            this.taetigkeitenAdded() > 0 ||
            this.taetigkeitenRemoved() > 0
    );

    // Computed signal for detailed change summary
    changeSummary = computed(() => ({
        fieldsChanged: {
            vertragGueltigAb: this.vertragGueltigAbChanged(),
            vertragGueltigBis: this.vertragGueltigBisChanged(),
            vertragsdauer: this.vertragsdauerChanged(),
            verkaufskanal: this.verkaufskanalChanged(),
            taetigkeitsbeschreibung: this.taetigkeitsbeschreibungChanged(),
            stellungImBetrieb: this.stellungImBetriebChanged(),
            arbeitspensum: this.arbeitspensumChanged(),
            selbststaendigSeit: this.selbststaendigSeitChanged(),
            anzahlMitarbeiter: this.anzahlMitarbeiterChanged(),
            stellenprozente: this.stellenprozenteChanged()
        },
        taetigkeitenChanges: {
            added: this.taetigkeitenAdded(),
            removed: this.taetigkeitenRemoved(),
            modified: this.taetigkeitenModified()
        },
        hasChanges: this.hasChanges()
    }));

    // Validation state
    showValidation = signal<boolean>(false);
    validationErrors: Map<string, string> = new Map();

    // Date correction notification
    showDateCorrectionNotification = false;
    correctedEndDate: string | null = null;

    // AVB correction notification
    showAvbCorrectionNotification = false;
    correctedAvb: string | null = null;

    // Reactive dropdown options
    vertragsdauerOptions = this.codesService.getCodeOptionsSignal(CODE_GRUPPE_DAUER_VERTRAG, true);
    verkaufskanalOptions = this.codesService.getCodeOptionsSignal(CODE_GRUPPE_VERKAUFSKANAL, true);
    stellungOptions = this.codesService.getCodeOptionsSignal(CODE_GRUPPE_STELLUNG_IM_BETRIEB, true);
    arbeitspensumOptions = this.codesService.getCodeOptionsSignal(CODE_GRUPPE_ARBEITSPENSUM, true);
    mitarbeiterOptions = this.codesService.getCodeOptionsSignal(CODE_GRUPPE_ANZAHL_MITARBEITER, true);

    // Initialize tätigkeiten (UI form data)
    taetigkeitData: TaetigkeitData = {
        vertragGueltigAb: undefined,
        avb: undefined,
        vertragsdauer: undefined,
        vertragGueltigBis: undefined,
        verkaufskanal: undefined,
        taetigkeitsbeschreibung: '',
        stellungImBetrieb: undefined,
        arbeitspensum: undefined,
        taetigkeiten: [{ taetigkeit: '', prozent: '0' }],
        selbststaendigSeit: undefined,
        anzahlMitarbeiter: undefined,
        stellenprozente: undefined
    };

    // Filtered tätigkeiten for autocomplete - one array per row
    filteredTaetigkeiten: Array<Array<{ label: string; value: string }>> = [];

    // Code maps
    private vertragsdauerCodeMap = this.codesService.getCodeMapSignal(CODE_GRUPPE_DAUER_VERTRAG);
    private avbCodeMap = this.codesService.getCodeMapSignal(CODE_GRUPPE_AVB);

    // Cache full merkmal data for BB calculation
    private merkmalCache: Map<string, { internalname: string; statefrom: string }> = new Map();

    // Store complete merkmal data for potential use
    private fullMerkmalCache: Map<string, any> = new Map();

    // Track whether dates were provided by backend/store to decide if we should auto-correct
    private hasBackendDateData = false;
    // Track if we populated default dates/duration for a fresh offerte (to suppress correction hint)
    private defaultsAppliedForDates = false;

    // Tätigkeiten from MerkmalService - converted to signal
    private activeMerkmaleSignal = toSignal(this.merkmalService.getActiveMerkmale(), { initialValue: [] });

    private isReadOnlyMode(): boolean {
        return this.viewMode || this.offerteStore.isReadOnly();
    }

    private initialized = false; // Set as soon as component is initialized
    private initializing = true; // suppress onDataChange during first render

    taetigkeitenOptions = computed(() => {
        const merkmale = this.activeMerkmaleSignal();
        return merkmale.map((merkmal: MerkmalApiResponse) => {
            // Cache merkmal metadata for BB calculation
            this.merkmalCache.set(merkmal.boid, {
                internalname: merkmal.internalname,
                statefrom: merkmal.statefrom
            });

            // Cache full merkmal object for potential use
            this.fullMerkmalCache.set(merkmal.boid, merkmal);

            return {
                label: this.merkmalService.getLocalizedBezeichnung(merkmal),
                value: merkmal.boid
            };
        });
    });

    // Computed signal for vertragsdauer (extracted from store)
    vertragsdauerComputed = computed(() => {
        const meta = this.currentMeta();
        if (meta?.vertragsdauer) {
            return meta.vertragsdauer;
        }

        const offerte = this.currentOfferte();
        if (offerte?.gueltab && offerte.ablaufdatum) {
            const ab = OfferteDateHelper.parse(offerte.gueltab);
            const bis = OfferteDateHelper.parse(offerte.ablaufdatum);
            if (ab && bis) {
                const years = calculateYearsBetween(ab, bis);
                return this.getCodeByDurationYears(years) || null;
            }
        }

        return null;
    });

    // Lifecycle
    constructor() {
        // React to changes in the offerte store
        effect(
            () => {
                const currentOfferte = this.currentOfferte();
                const currentMeta = this.currentMeta();

                if (!currentOfferte) return;

                // Sync local form data representation for validation/UI
                this.taetigkeitData = this.buildTaetigkeitDataFromStore(currentOfferte, currentMeta);
                this.hasBackendDateData = !!(currentOfferte.gueltab || currentOfferte.gueltbis);

                if (!this.initialized) {
                    this.resetChangeTracking();
                    this.initialized = true;
                }
            },
            { allowSignalWrites: true }
        );

        // Auto-clear validation errors and hide validation banner when isReadOnly becomes true
        effect(() => {
            if (this.isReadOnlyMode()) {
                this.showValidation.set(false);
                this.validationErrors.clear();
                this.logger.log('Validation cleared due to read-only mode activation');
            }
        });
    }

    ngOnInit(): void {
        const currentOfferte = this.currentOfferte();
        const currentMeta = this.currentMeta();
        this.hasBackendDateData = !!(currentOfferte?.gueltab || currentOfferte?.gueltbis);
        this.taetigkeitData = this.buildTaetigkeitDataFromStore(currentOfferte, currentMeta);
        this.applyDefaults(currentOfferte);
        this.ensureVertragsdauer();
        this.applyInitialCorrections();
    }

    ngAfterViewInit(): void {
        // Allow change handlers after initial view stabilizes
        setTimeout(() => (this.initializing = false), 0);
    }

    // Getters/Setters (view bindings)
    // Getters/setters for date fields (convert between Date objects and ISO strings)
    get vertragGueltigAb(): Date | null {
        if (this.taetigkeitData.vertragGueltigAb) {
            return this.taetigkeitData.vertragGueltigAb;
        }
        const offerte = this.currentOfferte();
        return offerte?.gueltab ? OfferteDateHelper.parse(offerte.gueltab) : null;
    }

    set vertragGueltigAb(value: Date | null) {
        this.taetigkeitData.vertragGueltigAb = value || undefined;
        this.offerteStore.updateOfferte(null, {
            gueltab: OfferteDateHelper.toDateOnly(value) || undefined
        });
    }

    get vertragGueltigBis(): Date | null {
        if (this.taetigkeitData.vertragGueltigBis) {
            return this.taetigkeitData.vertragGueltigBis;
        }
        const offerte = this.currentOfferte();
        return offerte?.ablaufdatum ? OfferteDateHelper.parse(offerte.ablaufdatum) : null;
    }

    set vertragGueltigBis(value: Date | null) {
        this.taetigkeitData.vertragGueltigBis = value || undefined;
        this.offerteStore.updateOfferte(null, {
            ablaufdatum: OfferteDateHelper.toDateOnly(value) || undefined
        });
    }

    get selbststaendigSeit(): Date | null {
        if (this.taetigkeitData.selbststaendigSeit) {
            return this.taetigkeitData.selbststaendigSeit;
        }
        const offerte = this.currentOfferte();
        return offerte?.selbst_seit ? OfferteDateHelper.parse(offerte.selbst_seit) : null;
    }

    set selbststaendigSeit(value: Date | null) {
        this.selbststaendigSeitChanged.set(true);
        this.taetigkeitData.selbststaendigSeit = value || undefined;
        this.offerteStore.updateOfferte(null, {
            selbst_seit: OfferteDateHelper.toDateOnly(value) || undefined
        });
        this.onDataChange();
    }

    get vertragsdauer(): string | null {
        return this.taetigkeitData.vertragsdauer ?? this.vertragsdauerComputed() ?? null;
    }

    set vertragsdauer(value: string | null) {
        this.taetigkeitData.vertragsdauer = value || undefined;
        const current = this.offerteStore.currentMeta()?.vertragsdauer ?? null;
        if (current === value) {
            return;
        }
        this.offerteStore.updateMeta(null, {
            vertragsdauer: value || null
        });
    }

    // Getters/setters for UI-only fields from currentMeta.tezuCalculationBasis
    get stellenprozenteValue(): number | null {
        const value = this.taetigkeitData.stellenprozente;
        if (value === undefined || value === null) {
            return null;
        }
        const parsed = typeof value === 'string' ? parseFloat(value) : value;
        return Number.isNaN(parsed) ? null : parsed;
    }

    set stellenprozenteValue(value: number | null) {
        this.taetigkeitData.stellenprozente = value !== null && value !== undefined ? value.toString() : undefined;
        this.stellenprozenteChanged.set(true);
        this.onDataChange();
    }

    get taetigkeitenList() {
        return this.taetigkeitData.taetigkeiten || [{ taetigkeit: '', prozent: '0' }];
    }

    set taetigkeitenList(value: Array<any>) {
        this.taetigkeitData.taetigkeiten = value;
    }

    /**
     * Log current change tracking state (useful for debugging)
     */
    public logChangeSummary(): void {
        const summary = this.changeSummary();
        this.logger.log('Change Summary:', summary);
    }

    /**
     * Get current change tracking state
     * Useful for parent components to check if form has unsaved changes
     */
    public getChangeSummary() {
        return this.changeSummary();
    }

    /**
     * Check if there are any unsaved changes
     * Useful for navigation guards or save prompts
     */
    public hasUnsavedChanges(): boolean {
        return this.hasChanges();
    }

    /**
     * Get duration (years) from vertragsdauer code sorter
     */
    private getDurationYearsFromCode(internalName: string | null): number | null {
        if (!internalName) return null;
        const code = this.vertragsdauerCodeMap().get(internalName);
        return code ? (code.sorter as number) : null;
    }

    /**
     * Get vertragsdauer code by duration in years
     */
    private getCodeByDurationYears(years: number | null): string | undefined {
        if (years === null) return undefined;
        const codeMap = this.vertragsdauerCodeMap();
        for (const [internalName, code] of codeMap.entries()) {
            if (code.sorter === years && code.aktiv === true) {
                return internalName;
            }
        }
        return undefined;
    }

    /**
     * Reset all change tracking signals
     * Call this after saving data or when loading fresh data
     */
    private resetChangeTracking(): void {
        this.vertragGueltigAbChanged.set(false);
        this.vertragGueltigBisChanged.set(false);
        this.vertragsdauerChanged.set(false);
        this.verkaufskanalChanged.set(false);
        this.taetigkeitsbeschreibungChanged.set(false);
        this.stellungImBetriebChanged.set(false);
        this.arbeitspensumChanged.set(false);
        this.selbststaendigSeitChanged.set(false);
        this.anzahlMitarbeiterChanged.set(false);
        this.stellenprozenteChanged.set(false);
        this.taetigkeitenAdded.set(0);
        this.taetigkeitenRemoved.set(0);
        this.taetigkeitenModified.set(false);
        this.logger.log('Change tracking signals reset');
    }

    /**
     * Filter tätigkeiten based on search query for autocomplete
     * Used by AutoComplete component
     * @param event - Contains the query string from the autocomplete
     * @param index - The index of the tätigkeit row being filtered
     */
    public filterTaetigkeiten(event: any, index: number): void {
        const query = event.query.toLowerCase();
        const allOptions = this.taetigkeitenOptions();

        // Filter options based on query
        const filtered = allOptions.filter((option) => option.label.toLowerCase().includes(query));

        // Store filtered results for this specific row
        this.filteredTaetigkeiten[index] = filtered;
    }

    /**
     * Get the option object for a given tätigkeit value (boid)
     * Used to initialize the autocomplete with the current value
     */
    public getTaetigkeitOption(value: string | null | undefined): { label: string; value: string } | null {
        if (!value) return null;
        const option = this.taetigkeitenOptions().find((opt) => opt.value === value);
        return option || null;
    }

    /**
     * TrackBy function for *ngFor to maintain component identity
     * Prevents input focus loss when array is recreated
     */
    public trackByIndex(index: number): number {
        return index;
    }

    onDataChange(): void {
        // Skip in read-only mode or during initialization
        if (this.isReadOnlyMode() || this.initializing) {
            return;
        }

        // Skip if no changes detected
        if (!this.hasChanges()) {
            return;
        }

        // Any change in Tätigkeit invalidates provisional signatures
        this.offerteStore.invalidateSignature();

        const variantsCleared = this.persistTaetigkeitToStore();
        if (variantsCleared) {
            this.logger.log('Cleared variant data and rebuilt BB due to tätigkeit change');
        }
        this.taetigkeitChange.emit(this.taetigkeitData);
    }

    /**
     * Set Vertrag gültig ab to today's date
     * Called when the "set to today" button is clicked
     */
    setVertragGueltigAbToToday(): void {
        // Don't allow action in view mode
        if (this.isReadOnlyMode()) {
            return;
        }
        this.vertragGueltigAb = new Date();
        this.onVertragGueltigAbChange();
        this.logger.log('Set vertragGueltigAb to today:', this.vertragGueltigAb);
    }

    /**
     * Called when Vertrag gültig ab (start date) changes
     * Recalculates vertragGueltigBis based on vertragsdauer
     */
    onVertragGueltigAbChange(): void {
        this.vertragGueltigAbChanged.set(true);
        if (this.vertragGueltigAb && this.vertragsdauer) {
            const years = this.getDurationYearsFromCode(this.vertragsdauer);
            if (years !== null) {
                this.vertragGueltigBis = calculateContractEndDate(this.vertragGueltigAb, years) || null;
            }
        }
        this.onDataChange();
    }

    /**
     * Called when Vertrag gültig bis (end date) changes
     * Recalculates vertragsdauer based on the difference
     */
    onVertragGueltigBisChange(): void {
        this.vertragGueltigBisChanged.set(true);
        if (this.vertragGueltigAb && this.vertragGueltigBis) {
            const years = calculateYearsBetween(this.vertragGueltigAb, this.vertragGueltigBis);
            this.vertragsdauer = this.getCodeByDurationYears(years) || null;
        }
        this.onDataChange();
    }

    /**
     * Called when Dauer des Vertrages (duration) changes
     * Recalculates vertragGueltigBis based on vertragGueltigAb
     */
    onVertragsdauerChange(): void {
        this.vertragsdauerChanged.set(true);
        if (this.vertragGueltigAb && this.vertragsdauer) {
            const years = this.getDurationYearsFromCode(this.vertragsdauer);
            if (years !== null) {
                this.vertragGueltigBis = calculateContractEndDate(this.vertragGueltigAb, years) || null;
            }
        }
        this.onDataChange();
    }

    onVerkaufskanalChange(): void {
        this.verkaufskanalChanged.set(true);
        this.onDataChange();
    }

    onTaetigkeitsbeschreibungChange(): void {
        this.taetigkeitsbeschreibungChanged.set(true);
        this.onDataChange();
    }

    onStellungImBetriebChange(): void {
        this.stellungImBetriebChanged.set(true);
        this.onDataChange();
    }

    onArbeitspensumChange(): void {
        this.arbeitspensumChanged.set(true);
        this.onDataChange();
    }

    onAnzahlMitarbeiterChange(): void {
        this.anzahlMitarbeiterChanged.set(true);
        this.onDataChange();
    }

    onTaetigkeitSelected(index: number, option: { label: string; value: string } | string | null): void {
        const value = typeof option === 'string' ? option : (option?.value ?? '');
        this.updateTaetigkeitAt(index, value);
    }

    onTaetigkeitCleared(index: number): void {
        this.updateTaetigkeitAt(index, '');
    }

    onTaetigkeitPercentChange(index: number, value: string | number): void {
        if (!this.taetigkeitData.taetigkeiten?.[index]) {
            return;
        }
        this.taetigkeitData.taetigkeiten[index].prozent = value as any;
        this.taetigkeitenModified.set(true);
        this.onDataChange();
    }

    private updateTaetigkeitAt(index: number, value: string): void {
        if (!this.taetigkeitData.taetigkeiten || !this.taetigkeitData.taetigkeiten[index]) {
            return;
        }
        this.taetigkeitData.taetigkeiten[index].taetigkeit = value;
        this.taetigkeitenModified.set(true);
        this.onDataChange();
    }

    /**
     * Dismiss the date correction notification
     */
    dismissDateCorrectionNotification(): void {
        this.showDateCorrectionNotification = false;
        this.correctedEndDate = null;
    }

    /**
     * Dismiss the AVB correction notification
     */
    dismissAvbCorrectionNotification(): void {
        this.showAvbCorrectionNotification = false;
        this.correctedAvb = null;
    }

    /**
     * Dismiss all correction notifications (date and AVB)
     */
    public dismissAllCorrectionNotifications(): void {
        this.dismissDateCorrectionNotification();
        this.dismissAvbCorrectionNotification();
    }

    private isVerlaengerung(): boolean {
        const offerte = this.offerteStore.currentOfferte();
        return offerte?.art === OFFERTE_ART_VERL || this.offerteStore.currentMeta()?.isVerlaengerung === true;
    }

    public addTaetigkeit(): void {
        const current = this.taetigkeitenList;
        const updated = [...current, { taetigkeit: '', prozent: '0' }];
        this.taetigkeitenList = updated;

        // Track that a tätigkeit was added
        this.taetigkeitenAdded.update((count) => count + 1);
        this.logger.log('Tätigkeit added. Total added:', this.taetigkeitenAdded());

        // Trigger change detection
        this.onDataChange();
    }

    public removeTaetigkeit(index: number): void {
        const current = this.taetigkeitenList;
        if (current && current.length > 1) {
            const updated = [...current];
            updated.splice(index, 1);
            this.taetigkeitenList = updated;

            // Track that a tätigkeit was removed
            this.taetigkeitenRemoved.update((count) => count + 1);
            this.logger.log('Tätigkeit removed. Total removed:', this.taetigkeitenRemoved());

            // Trigger change detection
            this.onDataChange();
        }
    }

    public getTaetigkeitenTotalPercentage(): number {
        const taetigkeiten = this.taetigkeitenList;
        if (!taetigkeiten) return 0;
        return taetigkeiten.reduce((sum, item) => {
            const prozent = typeof item.prozent === 'string' ? parseFloat(item.prozent) : item.prozent;
            return sum + (prozent || 0);
        }, 0);
    }

    /**
     * Generic empty check for Tätigkeit fields.
     * Handles primitives as well as array fields without relying on the field name.
     */
    public isTaetigkeitFieldEmpty(value: unknown): boolean {
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return true;
            }

            // Treat arrays with only empty items as empty
            return value.every((item) => isEmptyFieldValue(item, { treatZeroAsEmpty: true }));
        }

        return isEmptyFieldValue(value, { treatZeroAsEmpty: true });
    }

    /**
     * Get CSS class for total percentage display based on validation
     */
    public getTaetigkeitenTotalPercentageClass(): string {
        const total = this.getTaetigkeitenTotalPercentage();
        if (total === 100) {
            return 'text-green-600';
        } else if (total > 100) {
            return 'text-red-600';
        } else {
            return 'text-orange-600';
        }
    }

    /**
     * Ensure vertragsdauer and dates are consistent when loading data
     */
    private ensureVertragsdauer(): void {
        const codeMapSize = this.vertragsdauerCodeMap().size;
        if (codeMapSize === 0) {
            return;
        }

        // Case 1: Calculate vertragsdauer if missing but both dates are present
        if (!this.vertragsdauer && this.vertragGueltigAb && this.vertragGueltigBis) {
            const years = calculateYearsBetween(this.vertragGueltigAb, this.vertragGueltigBis);
            this.vertragsdauer = this.getCodeByDurationYears(years) || null;
        }
        // Case 2: Calculate vertragGueltigBis if missing but start date and duration are present
        else if (this.vertragsdauer && this.vertragGueltigAb && !this.vertragGueltigBis) {
            const years = this.getDurationYearsFromCode(this.vertragsdauer);
            if (years !== null) {
                this.vertragGueltigBis = calculateContractEndDate(this.vertragGueltigAb, years) || null;
            }
        }
    }

    /**
     * Apply default values based on offerte type
     * - Vertragsdauer: Always default to 4 Jahre (Ablauf_4)
     * - Verkaufskanal: COD_SUAbklaerung for new offerte (OfferteArtUnv),
     *                  COD_DirektmarketingAktionen for Verlängerung (OfferteArtVerl)
     */
    private applyDefaults(offerte: Offerte | null): void {
        this.logger.log('Applying defaults for offerte type:', offerte?.art);
        this.defaultsAppliedForDates = false;

        const isNewOfferte = !offerte?.id || offerte?.offertenr === 'new';

        // For brand-new offerten, treat existing cached dates as non-authoritative
        if (isNewOfferte) {
            this.hasBackendDateData = false;
            this.showDateCorrectionNotification = false;
            this.correctedEndDate = null;
        }

        // Default start date to today if none present (new offerte)
        if (!this.vertragGueltigAb) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.vertragGueltigAb = today;
            this.defaultsAppliedForDates = true;

            // Persist default start date for new offerten
            if (isNewOfferte) {
                this.offerteStore.updateOfferte(null, { gueltab: OfferteDateHelper.toDateOnly(today) || undefined });
            }
        }

        // Default Vertragsdauer to 4 Jahre (override stale cached value for new offerte)
        if (!this.vertragsdauer || isNewOfferte) {
            this.vertragsdauer = DEFAULT_VERTRAGSDAUER;
            this.defaultsAppliedForDates = true;

            // Calculate vertragGueltigBis based on vertragGueltigAb + 4 years
            if (this.vertragGueltigAb) {
                this.vertragGueltigBis = calculateContractEndDate(this.vertragGueltigAb, 4) || null;
                this.logger.log('Calculated vertragGueltigBis:', this.vertragGueltigBis);

                if (isNewOfferte) {
                    this.offerteStore.updateOfferte(null, {
                        gueltbis: OfferteDateHelper.toDateOnly(this.vertragGueltigBis) || undefined
                    });
                }
            }

            if (isNewOfferte) {
                this.offerteStore.updateMeta(null, { vertragsdauer: this.vertragsdauer });
            }
        }
        // Default Verkaufskanal based on offerte type
        if (!offerte?.kanal && !this.taetigkeitData.verkaufskanal) {
            if (offerte?.art === OFFERTE_ART_VERL) {
                // Verlängerung - use COD_DirektmarketingAktionen
                this.offerteStore.updateOfferte(null, { kanal: DEFAULT_VERKAUFSKANAL_VERL });
                this.taetigkeitData.verkaufskanal = DEFAULT_VERKAUFSKANAL_VERL;
                this.logger.log('Set default verkaufskanal for Verlängerung:', DEFAULT_VERKAUFSKANAL_VERL);
            } else if (offerte?.art === OFFERTE_ART_UNV) {
                // New offerte - use COD_SUAbklaerung
                this.offerteStore.updateOfferte(null, { kanal: DEFAULT_VERKAUFSKANAL_NEW });
                this.taetigkeitData.verkaufskanal = DEFAULT_VERKAUFSKANAL_NEW;
                this.logger.log('Set default verkaufskanal for new offerte:', DEFAULT_VERKAUFSKANAL_NEW);
            }
        }
    }

    private applyInitialCorrections(): void {
        // Only auto-correct if data originated from backend/store; skip for initial defaults (new oferte)
        const userChanged = this.vertragsdauerChanged() || this.vertragGueltigAbChanged() || this.vertragGueltigBisChanged();
        if (this.defaultsAppliedForDates && !userChanged) {
            return;
        }
        if (!this.hasBackendDateData && !userChanged) {
            return;
        }

        const endDateResult = validateAndCorrectEndDate({
            vertragGueltigAb: this.vertragGueltigAb,
            vertragGueltigBis: this.vertragGueltigBis,
            vertragsdauerCode: this.vertragsdauer,
            getDurationYearsFromCode: (internalName) => this.getDurationYearsFromCode(internalName),
            isReadOnly: this.isReadOnlyMode()
        });

        // Only surface correction when data came from backend/store or after user edits
        if (endDateResult.shouldCorrect && endDateResult.expectedEndDate && (this.hasBackendDateData || userChanged)) {
            this.correctedEndDate = endDateResult.currentEndDate ? formatDateSwiss(endDateResult.currentEndDate) : null;
            this.vertragGueltigBis = endDateResult.expectedEndDate;
            this.showDateCorrectionNotification = true;
            this.onDataChange();
        }

        const avbResult = validateAndCorrectAvb({
            currentAvb: this.currentOfferte()?.avb,
            avbCodeMap: this.avbCodeMap(),
            isReadOnly: this.isReadOnlyMode()
        });

        if (avbResult.shouldUpdate && avbResult.latestAvb) {
            this.correctedAvb = avbResult.currentAvb || null;
            this.offerteStore.updateOfferte(null, { avb: avbResult.latestAvb });
            this.showAvbCorrectionNotification = true;
            this.onDataChange();
        }
    }

    /**
     * Compute a hash of tätigkeiten fields that affect TEZU calculation
     * This hash is used to detect when TEZU needs to be recalculated (step varianten)
     */
    private computeTezuHash(data: any): string {
        const relevantFields = {
            taetigkeiten: (data.taetigkeiten || []).map((t: any) => ({
                merkmal_boid: t.taetigkeit,
                prozent: t.prozent,
                merkmal_internalname: t.merkmal_internalname
            })),
            stellenprozente: data.stellenprozente || '',
            anzahlMitarbeiter: data.anzahlMitarbeiter || ''
        };

        // Simple JSON stringify as hash (for change detection)
        return JSON.stringify(relevantFields);
    }

    private buildTaetigkeitDataFromStore(offerte: Offerte | null, meta: OfferteMetaData | null): TaetigkeitData {
        const tezuBasis = meta?.tezuCalculationBasis;
        const bb = offerte?.bb;

        const parse = (value?: string | Date | null): Date | undefined => {
            if (!value) return undefined;
            if (value instanceof Date) return value;
            return OfferteDateHelper.parse(value) || undefined;
        };

        const taetigkeiten = tezuBasis?.taetigkeiten ||
            bb?.bb2merkmal?.map((m) => ({
                taetigkeit: m.merkmal_boid,
                prozent: m.prozent?.toString() ?? '0',
                merkmal_id: m.merkmal?.id,
                merkmal_internalname: (m as any).merkmal_internalname ?? m.merkmal?.internalname,
                merkmal_statefrom: (m as any).merkmal_statefrom ?? m.merkmal?.statefrom
            })) || [{ taetigkeit: '', prozent: '0' }];

        const vertragGueltigAb = parse(offerte?.gueltab ?? bb?.gueltab);
        const vertragGueltigBis = parse(offerte?.ablaufdatum ?? bb?.gueltbis);

        return {
            vertragGueltigAb,
            vertragGueltigBis,
            avb: offerte?.avb,
            vertragsdauer: this.getCodeByDurationYears(vertragGueltigAb && vertragGueltigBis ? calculateYearsBetween(vertragGueltigAb, vertragGueltigBis) : null) || undefined,
            verkaufskanal: offerte?.kanal,
            taetigkeitsbeschreibung: bb?.taetigkeit ?? '',
            stellungImBetrieb: offerte?.stellung_im_betrieb,
            arbeitspensum: offerte?.beschaeft_grad,
            taetigkeiten,
            selbststaendigSeit: parse(offerte?.selbst_seit),
            anzahlMitarbeiter: bb?.anzahlma,
            stellenprozente: tezuBasis?.stellenprozente?.toString() ?? (bb?.stellenprozente !== undefined ? bb.stellenprozente.toString() : undefined)
        };
    }

    private persistTaetigkeitToStore(): boolean {
        if (this.initializing) {
            return false;
        }

        const enrichedData = this.taetigkeitService.enrichTaetigkeitData(this.taetigkeitData, this.merkmalCache, this.fullMerkmalCache);
        this.logger.log('Persisting enriched data to store:', enrichedData);

        const tezuHash = this.computeTezuHash({
            taetigkeiten: enrichedData.taetigkeiten,
            stellenprozente: this.taetigkeitData.stellenprozente,
            anzahlMitarbeiter: this.taetigkeitData.anzahlMitarbeiter
        });

        const currentOfferte = this.currentOfferte();
        const previousHash = this.currentMeta()?.tezuHash;
        const hasCalculatedBB = !!currentOfferte?.bb?.bbtezu && currentOfferte.bb.bbtezu.length > 0;
        const userId = this.authService.getUserProfile()?.username;

        if (!userId) {
            this.logger.error('Cannot persist taetigkeit: username not available');
            return false;
        }

        const bb = this.bbService.buildBBFromTaetigkeit(this.taetigkeitData, currentOfferte?.bb, userId);

        // Sync metadata representation
        this.offerteStore.updateMeta(null, {
            tezuCalculationBasis: {
                ...this.currentMeta()?.tezuCalculationBasis,
                stellenprozente: this.taetigkeitData.stellenprozente ? Number(this.taetigkeitData.stellenprozente) : undefined,
                taetigkeiten: enrichedData.taetigkeiten,
                anzahlMitarbeiter: this.taetigkeitData.anzahlMitarbeiter
            },
            tezuHash
        });

        const tezuUnchanged = previousHash && previousHash === tezuHash && hasCalculatedBB;

        if (tezuUnchanged) {
            this.logger.debug('TEZU hash unchanged and BB already calculated - keeping existing BB/variants', {
                tezuHash
            });
            // Only update top-level fields without clearing variants
            this.offerteStore.updateOfferte(null, {
                beschaeft_grad: this.taetigkeitData.arbeitspensum || undefined,
                stellung_im_betrieb: this.taetigkeitData.stellungImBetrieb || undefined,
                selbst_seit: OfferteDateHelper.toDateOnly(this.taetigkeitData.selbststaendigSeit) || undefined,
                gueltab: OfferteDateHelper.toDateOnly(this.taetigkeitData.vertragGueltigAb) || undefined,
                ablaufdatum: OfferteDateHelper.toDateOnly(this.taetigkeitData.vertragGueltigBis) || undefined,
                kanal: this.taetigkeitData.verkaufskanal || undefined,
                avb: this.taetigkeitData.avb || undefined
            });
            return false;
        }

        // Clear variant data first (but keep BB structure for IDs)
        this.offerteStore.updateOfferte(null, {
            variante: undefined
        });

        this.offerteStore.updateOfferte(null, {
            bb: bb || undefined,
            bb_boid: bb?.boid,
            beschaeft_grad: this.taetigkeitData.arbeitspensum || undefined,
            stellung_im_betrieb: this.taetigkeitData.stellungImBetrieb || undefined,
            selbst_seit: OfferteDateHelper.toDateOnly(this.taetigkeitData.selbststaendigSeit) || undefined,
            gueltab: OfferteDateHelper.toDateOnly(this.taetigkeitData.vertragGueltigAb) || undefined,
            ablaufdatum: OfferteDateHelper.toDateOnly(this.taetigkeitData.vertragGueltigBis) || undefined,
            kanal: this.taetigkeitData.verkaufskanal || undefined,
            avb: this.taetigkeitData.avb || undefined
        });

        this.logger.log('Synced Tätigkeit data into offerte (BB + top-level fields), metadata updated with TEZU basis/hash');
        return true;
    }

    /**
     * Validate all required fields using Zod schema validation
     * This method shows validation errors to the user (called when clicking "Next")
     */
    validateForm(): boolean {
        if (this.isReadOnlyMode()) {
            this.logger.log('Skipping validation in read-only mode');
            this.showValidation.set(false); // Ensure validation is hidden
            this.validationErrors.clear();
            this.validationChange.emit(true);
            return true;
        }

        this.showValidation.set(true);

        // Check if this is an existing offerte
        const currentOfferte = this.offerteStore.currentOfferte();
        const isExistingOfferte = !!currentOfferte?.offertenr && currentOfferte.offertenr !== 'new';

        const validationResult = runTaetigkeitFormValidation(this.taetigkeitData, {
            isReadOnly: false,
            allowPastDates: isExistingOfferte,
            isVerlaengerung: this.isVerlaengerung()
        });

        if (!validationResult.isValid) {
            this.validationErrors = validationResult.errors;
            this.logger.error('Zod validation errors:', Array.from(this.validationErrors.entries()));
            if (validationResult.zodError) {
                this.logger.error('Full Zod error:', validationResult.zodError);
            }

            setTimeout(() => {
                this.scrollToErrorBanner();
            }, 100);
        } else {
            this.validationErrors.clear();
            this.logger.log('Form validation passed');
        }

        this.validationChange.emit(validationResult.isValid);
        return validationResult.isValid;
    }

    /**
     * Scroll to the validation error banner
     */
    private scrollToErrorBanner(): void {
        if (this.validationErrorBanner) {
            this.validationErrorBanner.nativeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
            // Optional: Add focus for accessibility
            this.validationErrorBanner.nativeElement.focus();
        }
    }

    /**
     * Validate form silently without showing errors to user
     * Used for checking if step is complete (e.g., for enabling/disabling navigation)
     */
    isFormValid(): boolean {
        // Skip validation in read-only mode - always return true
        if (this.isReadOnlyMode()) {
            return true;
        }

        // Check if this is an existing offerte (allow past dates for existing offerten)
        const currentOfferte = this.offerteStore.currentOfferte();
        const isExistingOfferte = !!currentOfferte?.offertenr && currentOfferte.offertenr !== 'new';
        const result = runTaetigkeitFormValidation(this.taetigkeitData, {
            isReadOnly: false,
            allowPastDates: isExistingOfferte,
            isVerlaengerung: this.isVerlaengerung()
        });

        return result.isValid;
    }

    /**
     * Check if a specific field has validation error
     * Always returns false in viewMode (read-only mode)
     */
    hasError(fieldName: string): boolean {
        // Never show errors in view mode
        if (this.isReadOnlyMode()) {
            return false;
        }
        return this.showValidation() && this.validationErrors.has(fieldName);
    }

    /**
     * Get specific error message for a field from validation
     * @param fieldName - The field name to get error for
     * @returns The error message or null if no error
     */
    getFieldError(fieldName: string): string | null {
        if (!this.hasError(fieldName)) {
            return null;
        }
        return this.validationErrors.get(fieldName) || null;
    }

    /**
     * Check if a field is empty (for orange styling)
     * Returns true if field is empty but not showing a validation error
     * Orange styling appears by default for empty fields, turns red only when validation errors exist
     * @param fieldName - The field name to check
     * @returns True if empty and should show orange styling
     */
    isFieldEmpty(fieldName: string): boolean {
        if (this.isReadOnlyMode() || this.hasError(fieldName)) {
            return false;
        }

        const value = (this.taetigkeitData as any)[fieldName];
        return this.isTaetigkeitFieldEmpty(value);
    }
}
