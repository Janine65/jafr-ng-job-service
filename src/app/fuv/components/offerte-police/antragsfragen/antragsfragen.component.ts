import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { v4 as uuidv4 } from 'uuid';

import { CommonModule } from '@angular/common';
import {
    Component, computed, effect, EventEmitter, inject, Input, OnInit, Output, signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Antwort, Frage, Fragebogen } from '@app/fuv/models/fragen.model';
import { AntragsfragenModalService } from '@app/fuv/services/antragsfragen-modal.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { FragenService } from '@app/fuv/services/fragen.service';
import { KpmService } from '@app/fuv/services/kpm.service';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { ExternalService } from '@app/shared/services/external.service';
import { PermissionService } from '@app/shared/services/permission.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, AuthService, LogFactoryService, Logger } from '@syrius/core';

import {
    DEFAULT_AUFGABE_AUSFUEHRENDER, GENEHMIGUNG_ART_APPROVED, GENEHMIGUNG_ART_REJECTED,
    OFFERTE_ART_VER, WFD_FUV_OFFERTE_NACHFASSEN, WFD_FUV_OFFERTE_PRUEFEN_VTT
} from '../police.constants';
import { Antragsfrage } from './antragsfragen.model';
import { validateAntragsfragenFormData } from './antragsfragen.validation';

@Component({
    selector: 'app-antragsfragen',
    standalone: true,
    imports: [CommonModule, FormsModule, PanelModule, RadioButtonModule, TextareaModule, TranslateModule, DialogModule, ButtonModule, InputTextModule, SelectModule, MessageModule, TooltipModule],
    templateUrl: './antragsfragen.component.html'
})
export class AntragsfragenComponent implements OnInit {
    @Input() viewMode: boolean = false; // Read-only mode flag
    @Output() vttCheckRequired = new EventEmitter<boolean>();

    private fragenService = inject(FragenService);
    private offerteStore = inject(OfferteTypedStore);
    private logFactory = inject(LogFactoryService);
    private messageService = inject(AppMessageService);
    private translate = inject(TranslateService);
    private permissionService = inject(PermissionService);
    private codesService = inject(CodesService);
    private kpmService = inject(KpmService);
    private authService = inject(AuthService);
    private externalService = inject(ExternalService);
    private antragsfragenModalService = inject(AntragsfragenModalService);
    private logger: Logger;

    // Optional: Injected when component is opened in a dialog
    private dialogConfig = inject(DynamicDialogConfig, { optional: true });
    private dialogRef = inject(DynamicDialogRef, { optional: true });

    // Track if component is in modal mode
    isModalMode = false;

    // Permission signals
    isLoadingPermissions = signal<boolean>(true);
    canReadAntragsfragen = signal<boolean>(false);
    canUpdateAntragsfragen = signal<boolean>(false);
    hasAnyPermission = computed(() => this.canReadAntragsfragen() || this.canUpdateAntragsfragen());

    // Computed: Check if user can actually update (considering both permission and viewMode)
    canActuallyUpdateAntragsfragen = computed(() => !this.viewMode && this.canUpdateAntragsfragen());

    // Backend data
    allFragen: Frage[] = [];
    fragebogen: Fragebogen | null = null;

    // Loading state (using signals for reactivity)
    isLoadingFragen = signal<boolean>(false); // Loading questions (fragen)
    isLoadingFragebogen = signal<boolean>(false); // Loading answers (fragebogen)
    isLoading = computed(() => this.isLoadingPermissions() || this.isLoadingFragen() || this.isLoadingFragebogen()); // Combined loading state

    // Loading message as a regular signal (updated manually)
    loadingMessageKey = signal<string>('fuv.police.antragsfragen.loading.permissions');
    aufgenommenAm: string = '';
    geaendertAm: string = '';
    answeredYes = signal<number>(0);
    answeredNo = signal<number>(0);
    unanswered = signal<number>(0);
    private questionCount = signal<number>(0);
    private readonly excludedSubQuestionBoids = new Set(['5675']); // sub-question boids that should not count towards summary
    summaryCounts = computed(() => {
        if (this.questionCount() > 0) {
            return {
                yes: this.answeredYes(),
                no: this.answeredNo(),
                unanswered: this.unanswered()
            };
        }

        const fb = this.offerteStore.currentOfferte()?.fragebogen;
        const answers = (fb?.antworten || []).filter((a) => !this.excludedSubQuestionBoids.has(a.frage_boid));
        if (answers.length > 0) {
            const yes = answers.filter((a) => a.codevalue === '-10110').length;
            const no = answers.filter((a) => a.codevalue === '-10111').length;
            const totalFromStore = new Set(answers.filter((a) => a.codevalue === '-10110' || a.codevalue === '-10111').map((a) => a.frage_boid)).size;
            const totalQuestions = this.questionCount() || totalFromStore || yes + no;
            const unanswered = Math.max(totalQuestions - (yes + no), 0);
            return { yes, no, unanswered };
        }
        return {
            yes: 0,
            no: 0,
            unanswered: 0
        };
    });
    showVttDialog: boolean = false;
    showTaskCreationDialog: boolean = false;
    showVttBeurteilungDialog: boolean = false; // VTT assessment dialog
    vttBeurteilungActiveTab: number = 0; // Active tab in VTT Beurteilung dialog (0 = VTT Beurteilung, 1 = Aufgabe in Syrius)
    vttTaskCreated = signal<boolean>(false); // Use signal for reactivity
    vttTaskDeclined: boolean = false; // Track if user explicitly declined VTT task creation
    vttTaskCreatedAm: string = '';
    vttTaskBeschreibung: string = ''; // Store the task beschreibung (ergänzende Bemerkungen)
    validationErrors: string[] = [];
    private lastVttPromptHash: string | null = null;

    // Computed signal that checks BOTH local signal AND store for VTT task existence
    // This ensures the info box shows immediately regardless of which source updates first
    isVttAufgabeCreated = computed(() => {
        // Check local signal first (updated immediately in modal)
        if (this.vttTaskCreated()) {
            return true;
        }
        // Check store (may be updated from modal or previous session)
        if (this.offerteStore.currentMeta()?.vttTaskCreated || this.offerteStore.currentMeta()?.aufgabe_boid) {
            return true;
        }
        // Check fragebogen (persisted in DB)
        if (this.fragebogen?.aufgabe_boid) {
            return true;
        }
        return false;
    });

    // Show status box when a task exists OR when an assessment has been recorded on the fragebogen
    vttStatusVisible = computed(() => {
        if (this.isVttAufgabeCreated()) {
            return true;
        }
        const fragebogen = this.fragebogen || this.offerteStore.currentOfferte()?.fragebogen || null;
        return this.hasVttAssessment(fragebogen);
    });

    // VTT Beurteilung form data
    vttBeurteilung = {
        beurteilungsart: '',
        bemerkung: ''
    };

    // VTT Beurteilung options from codes service
    beurteilungsartOptions: Array<{ label: string; value: string }> = [];

    // Task details for Aufgabe in Syrius tab
    aufgabeDetails: any = null;
    isLoadingAufgabeDetails: boolean = false;

    // Computed properties for assessment status display
    get hasAssessment(): boolean {
        return !!this.fragebogen?.genehmigung_art;
    }

    get isApproved(): boolean {
        return GENEHMIGUNG_ART_APPROVED.includes(this.fragebogen?.genehmigung_art || '');
    }

    get isRejected(): boolean {
        return GENEHMIGUNG_ART_REJECTED.includes(this.fragebogen?.genehmigung_art || '');
    }

    get assessmentStatusLabel(): string {
        if (this.isApproved) {
            return this.translate.instant('fuv.police.antragsfragen.summary.approved');
        } else if (this.isRejected) {
            return this.translate.instant('fuv.police.antragsfragen.summary.notApproved');
        }
        return this.translate.instant('fuv.police.antragsfragen.summary.createdExpectingAssessment');
    }

    get assessmentStatusIcon(): string {
        if (this.isApproved) {
            return 'pi pi-check-circle';
        } else if (this.isRejected) {
            return 'pi pi-times-circle';
        }
        return 'pi pi-clock';
    }

    get assessmentStatusColor(): string {
        if (this.isApproved) {
            return 'text-green-600';
        } else if (this.isRejected) {
            return 'text-red-600';
        }
        return 'text-yellow-600';
    }

    get assessmentTypeLabel(): string {
        if (!this.fragebogen?.genehmigung_art) {
            return '';
        }
        // Find the label from beurteilungsartOptions
        const option = this.beurteilungsartOptions.find((opt) => opt.value === this.fragebogen?.genehmigung_art);
        return option?.label || this.fragebogen.genehmigung_art;
    }

    get vttDetailsTooltip(): string {
        if (!this.hasAssessment) {
            return '';
        }

        let tooltip = `<div class="text-left">`;
        tooltip += `<div class="font-semibold mb-1">${this.assessmentTypeLabel}</div>`;

        if (this.fragebogen?.genehmigung_bemerkung) {
            tooltip += `<div class="text-sm"><strong>Bemerkung:</strong><br/>${this.fragebogen.genehmigung_bemerkung}</div>`;
        }

        tooltip += `</div>`;
        return tooltip;
    }

    // Antragsfragen loaded from service
    private _antragsfragen: Antragsfrage[] = [];

    // Getter for template access - use the array directly
    get antragsfragen(): Antragsfrage[] {
        return this._antragsfragen;
    }

    // Guard to prevent duplicate prefetch for the same person
    private hasPrefetchedForPerson: string | null = null;

    constructor() {
        this.logger = this.logFactory.createLogger('AntragsfragenComponent');

        // Check if in modal mode and override viewMode from dialog config
        this.isModalMode = !!this.dialogConfig?.data?.mode;
        if (this.isModalMode && this.dialogConfig?.data?.viewOnly !== undefined) {
            this.viewMode = this.dialogConfig.data.viewOnly;
        }
        this.logger.debug('Mode:', this.isModalMode ? 'Modal' : 'Embedded', 'viewMode:', this.viewMode);

        // Watch for person_boid changes and prefetch Fragebogen answers
        effect(() => {
            const offerte = this.offerteStore.currentOfferte();
            const person_boid = offerte?.person?.boid;

            if (person_boid && this.hasPrefetchedForPerson !== person_boid) {
                this.logger.debug('Person available, prefetching Fragebogen:', person_boid);
                this.hasPrefetchedForPerson = person_boid;
                this.prefetchFragebogen(person_boid);
            } else if (person_boid && this.hasPrefetchedForPerson === person_boid) {
                this.logger.debug('Already prefetched for person:', person_boid, '- skipping duplicate load');
            }
        });

        // Keep summary in sync when fragebogen in store changes (e.g., after modal save)
        effect(() => {
            const fb = this.offerteStore.currentOfferte()?.fragebogen;
            const answers = (fb?.antworten || []).filter((a) => !this.excludedSubQuestionBoids.has(a.frage_boid));
            if (answers.length > 0) {
                const yes = answers.filter((a) => a.codevalue === '-10110').length;
                const no = answers.filter((a) => a.codevalue === '-10111').length;
                const totalQuestions = this.questionCount() || this._antragsfragen.length || yes + no;
                const unanswered = Math.max(totalQuestions - (yes + no), 0);

                this.answeredYes.set(yes);
                this.answeredNo.set(no);
                this.unanswered.set(unanswered);
                this.questionCount.set(totalQuestions);

                if (fb?.updated) {
                    this.geaendertAm = this.formatDateTime(fb.updated);
                }
                if (fb?.created) {
                    this.aufgenommenAm = this.formatDateTime(fb.created);
                }
            }
        });
    }

    // Task creation form data (automatischeBeschreibung is generated dynamically)
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

    // Zugewiesen an options - only 'sir' from constant
    zugewiesenAnOptions = [{ label: DEFAULT_AUFGABE_AUSFUEHRENDER, value: DEFAULT_AUFGABE_AUSFUEHRENDER }];

    ngOnInit() {
        // Check if we should trigger VTT dialog immediately (after save with 3+ yes answers)
        const shouldTriggerVtt = this.dialogConfig?.data?.triggerVttDialog;
        if (shouldTriggerVtt) {
            this.logger.debug('triggerVttDialog flag detected - will show VTT dialog after data loads');
        }

        // Load permissions
        this.isLoadingPermissions.set(true);
        this.loadingMessageKey.set('fuv.police.antragsfragen.loading.permissions');

        this.permissionService.loadPermissions().subscribe({
            next: () => {
                const permissions = this.permissionService.getPermissions('fuv_offerte', 'antragsfragen');
                this.canReadAntragsfragen.set(permissions.canRead);
                this.canUpdateAntragsfragen.set(permissions.canUpdate);

                this.logger.debug('Permissions loaded:', {
                    canRead: this.canReadAntragsfragen(),
                    canUpdate: this.canUpdateAntragsfragen()
                });

                this.isLoadingPermissions.set(false);
                this.loadingMessageKey.set('fuv.police.antragsfragen.loading.questions');

                // If VTT dialog should be triggered, check after permissions load
                if (shouldTriggerVtt) {
                    this.checkAndTriggerVttDialog();
                }
            },
            error: (error) => {
                this.logger.error('Error loading permissions:', error);
                // Default to no permissions on error
                this.canReadAntragsfragen.set(false);
                this.canUpdateAntragsfragen.set(false);
                this.isLoadingPermissions.set(false);
            }
        });

        // Check if VTT task was already created or declined
        // Note: aufgabe_boid is stored in the fragebogen, not in the offerte
        // We'll check it after loading the fragebogen
        const meta = this.offerteStore.currentMeta();
        if (meta?.vttTaskDeclined) {
            // User previously declined
            this.vttTaskDeclined = true;
            this.logger.debug('VTT task was previously declined');
        }

        // IMPORTANT: Also check if VTT task was already created
        // This ensures the flag is set when navigating back to this step
        if (meta?.vttTaskCreated || meta?.aufgabe_boid) {
            this.vttTaskCreated.set(true);
            this.logger.debug('VTT task was previously created, restored from store');
        }

        this.loadFragenAndAntworten();
        this.taskData.faelligAm = this.getDefaultFaelligAm();
    } /**
     * Prefetch Fragebogen (answers) when person becomes available
     * This runs in the background before the user reaches this step
     */
    private prefetchFragebogen(person_boid: string): void {
        this.isLoadingFragebogen.set(true);

        // Show very subtle loading notification
        this.messageService.add({
            severity: 'info',
            summary: 'Laden...',
            detail: 'Antragsfragen werden geladen',
            life: 1500
        });

        this.fragenService.searchFuvFragebogen(person_boid, false).subscribe({
            next: (fragebogenList: Fragebogen[]) => {
                if (fragebogenList && fragebogenList.length > 0) {
                    this.fragebogen = fragebogenList[0] || null; // Use most recent
                    this.logger.debug('✅ Fragebogen prefetched:', this.fragebogen.antworten?.length || 0, 'answers');

                    // Update offerte store with fragebogen data
                    this.offerteStore.updateOfferte(null, {
                        fragebogen: this.fragebogen,
                        fragen_boid: this.fragebogen.boid
                    });
                    this.syncVttFlagsFromFragebogen(this.fragebogen);

                    // Show subtle success notification
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Geladen',
                        detail: 'Antragsfragen bereit',
                        life: 1500
                    });
                } else {
                    this.logger.debug('No existing fragebogen found for person');
                }
                this.isLoadingFragebogen.set(false);
            },
            error: (error: unknown) => {
                this.logger.error('Error prefetching fragebogen:', error);

                // Show subtle error notification
                this.messageService.add({
                    severity: 'warn',
                    summary: this.translate.instant('common.messages.info'),
                    detail: this.translate.instant('common.messages.loadFailed'),
                    life: 2000
                });
                this.isLoadingFragebogen.set(false);
            }
        });
    }

    /**
     * Load questions from cache (prefetched on app init) and existing answers (prefetched when person available)
     */
    loadFragenAndAntworten() {
        const now = this.getCurrentDateTime();
        this.isLoadingFragen.set(true);

        // Always start from the latest store data (modal saves update the store first)
        const storeFragebogen = this.offerteStore.currentOfferte()?.fragebogen;
        if (storeFragebogen) {
            this.fragebogen = storeFragebogen;
        }

        // Load questions from cache (already prefetched)
        this.fragenService.searchFuvFrage().subscribe({
            next: (fragen: Frage[]) => {
                this.allFragen = fragen.sort((a, b) => a.sort.localeCompare(b.sort));
                this.logger.debug('Loaded questions:', fragen.length);

                // Initialize empty antragsfragen structure
                this._antragsfragen = this.getEmptyAntragsfragen();
                this.questionCount.set(this._antragsfragen.length);

                // Check if we already have prefetched Fragebogen
                if (this.fragebogen) {
                    const currentFragebogen = this.fragebogen;
                    this.logger.debug('Using prefetched fragebogen with', currentFragebogen.antworten.length, 'answers');

                    // Check offerte store first (it might have more recent data from modal)
                    const storeHasTask = this.offerteStore.currentMeta()?.vttTaskCreated || !!this.offerteStore.currentMeta()?.aufgabe_boid;

                    // Check if aufgabe_boid exists in fragebogen or store (task already created)
                    if (currentFragebogen.aufgabe_boid || storeHasTask || this.hasVttAssessment(currentFragebogen)) {
                        this.vttTaskCreated.set(true);
                        this.logger.debug('VTT status found - fragebogen:', currentFragebogen.aufgabe_boid, 'store:', storeHasTask, 'assessment:', currentFragebogen.genehmigung_art);
                    }

                    // Update offerte store with complete fragebogen data (may have been loaded earlier)
                    this.offerteStore.updateOfferte(null, {
                        fragebogen: currentFragebogen,
                        fragen_boid: currentFragebogen.boid
                    });
                    this.syncVttFlagsFromFragebogen(currentFragebogen);

                    // Map existing answers to UI structure
                    this.mapAnswersToUI(currentFragebogen);

                    // Set timestamps from fragebogen
                    this.aufgenommenAm = this.formatDateTime(currentFragebogen.created);
                    this.geaendertAm = this.formatDateTime(currentFragebogen.updated);

                    this.updateSummary();
                    this.isLoadingFragen.set(false);
                } else {
                    // No prefetched data, try to load it now (fallback)
                    const offerte = this.offerteStore.currentOfferte();
                    const person_boid = offerte?.person?.boid;

                    if (person_boid) {
                        this.logger.debug('Fragebogen not prefetched, loading now for person:', person_boid);
                        this.isLoadingFragebogen.set(true);

                        this.fragenService.searchFuvFragebogen(person_boid, false).subscribe({
                            next: (fragebogenList: Fragebogen[]) => {
                                const found = fragebogenList?.[0];
                                if (found) {
                                    this.fragebogen = found;
                                    const currentFragebogen = found;
                                    this.logger.debug('Found existing fragebogen with', currentFragebogen.antworten.length, 'answers');

                                    // Check offerte store first (it might have more recent data from modal)
                                    const storeHasTask = this.offerteStore.currentMeta()?.vttTaskCreated || !!this.offerteStore.currentMeta()?.aufgabe_boid;

                                    // Check if aufgabe_boid exists in fragebogen or store (task already created)
                                    if (currentFragebogen.aufgabe_boid || storeHasTask || this.hasVttAssessment(currentFragebogen)) {
                                        this.vttTaskCreated.set(true);
                                        this.logger.debug('VTT status found - fragebogen:', currentFragebogen.aufgabe_boid, 'store:', storeHasTask, 'assessment:', currentFragebogen.genehmigung_art);
                                    }

                                    // Update offerte store with complete fragebogen data
                                    this.offerteStore.updateOfferte(null, {
                                        fragebogen: currentFragebogen,
                                        fragen_boid: currentFragebogen.boid
                                    });
                                    this.syncVttFlagsFromFragebogen(currentFragebogen);

                                    // Map existing answers to UI structure
                                    this.mapAnswersToUI(currentFragebogen);

                                    // Set timestamps from fragebogen
                                    this.aufgenommenAm = this.formatDateTime(currentFragebogen.created);
                                    this.geaendertAm = this.formatDateTime(currentFragebogen.updated);
                                } else {
                                    this.logger.debug('No existing fragebogen found, starting fresh');
                                    this.aufgenommenAm = now;
                                }

                                this.updateSummary();
                                this.isLoadingFragebogen.set(false);
                                this.isLoadingFragen.set(false);
                            },
                            error: (error) => {
                                this.logger.error('Error loading fragebogen:', error);
                                this.aufgenommenAm = now;
                                this.updateSummary();
                                this.isLoadingFragebogen.set(false);
                                this.isLoadingFragen.set(false);
                            }
                        });
                    } else {
                        this.logger.debug('No person BOID available, starting fresh');
                        this.aufgenommenAm = now;
                        this.updateSummary();
                        this.isLoadingFragen.set(false);
                    }
                }
            },
            error: (error: unknown) => {
                this.logger.error('Error loading fragen:', error);
                this.isLoadingFragen.set(false);
            }
        });
    }

    /**
     * Map backend answers to UI structure
     */
    private mapAnswersToUI(fragebogen: Fragebogen) {
        fragebogen.antworten.forEach((antwort) => {
            // Find which question this answer belongs to (main question)
            const frage = this._antragsfragen.find((f) => f.frage_boid === antwort.frage_boid);
            if (frage) {
                // Map codevalue: -10110 = ja, -10111 = nein
                if (antwort.codevalue === '-10110') {
                    frage.antwort = 'ja';
                } else if (antwort.codevalue === '-10111') {
                    frage.antwort = 'nein';
                }

                // Map textvalue (in case it's the main question with text)
                if (antwort.textvalue) {
                    frage.details = antwort.textvalue;
                }
            } else {
                // This might be a detail question - find the parent question
                const parentFrage = this._antragsfragen.find((f) => {
                    if (!f.frage_boid) return false;
                    const detailsBoid = this.getDetailsBoid(f.frage_boid);
                    return detailsBoid === antwort.frage_boid;
                });

                if (parentFrage && antwort.textvalue) {
                    parentFrage.details = antwort.textvalue;
                }

                // Special case: frage1 behandlung question (boid: 5675)
                if (antwort.frage_boid === '5675') {
                    const frage1 = this._antragsfragen.find((f) => f.id === 'frage1');
                    if (frage1) {
                        if (antwort.codevalue === '-10110') {
                            frage1.behandlung = 'ja';
                        } else if (antwort.codevalue === '-10111') {
                            frage1.behandlung = 'nein';
                        }
                    }
                }
            }
        });

        this.updateSummary();
    }

    /**
     * Build dynamic antragsfragen structure from backend questions
     * Groups questions by titel_boid and extracts main questions
     */
    private getEmptyAntragsfragen(): Antragsfrage[] {
        if (this.allFragen.length === 0) {
            this.logger.warn('No questions loaded from backend');
            return [];
        }

        const grouped = this.fragenService.groupQuestionsByTitle(this.allFragen);
        const antragsfragen: Antragsfrage[] = [];
        let frageIndex = 1;

        // Sort groups by the sort field of their main question
        const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
            const mainA = this.fragenService.getMainQuestion(a[1]);
            const mainB = this.fragenService.getMainQuestion(b[1]);
            if (!mainA || !mainB) return 0;
            return mainA.sort.localeCompare(mainB.sort);
        });

        sortedGroups.forEach(([titel_boid, questions]) => {
            const mainQuestion = this.fragenService.getMainQuestion(questions);
            if (!mainQuestion) return;

            // Check if this is frage1 (chronische Beschwerden) which has behandlung field
            const isFrage1 = questions.some((q) => q.boid === '5675'); // behandlung question exists

            antragsfragen.push({
                id: `frage${frageIndex}`,
                frageText: mainQuestion.bezeichnungdt, // Use German text from backend
                antwort: '',
                details: '',
                behandlung: isFrage1 ? '' : undefined,
                frage_boid: mainQuestion.boid
            });

            frageIndex++;
        });

        this.logger.debug('Built', antragsfragen.length, 'questions from backend');
        return antragsfragen;
    }

    /**
     * Save antragsfragen to backend
     * Called when user clicks "Next" button
     */
    saveAntragsfragen() {
        const offerte = this.offerteStore.currentOfferte();
        const person_boid = offerte?.person?.boid;

        if (!person_boid) {
            this.logger.error('Cannot save: No person BOID available');
            return;
        }

        // Clear previous validation errors
        this.validationErrors = [];

        // Update summary to get current counts
        this.updateSummary();

        // First check if all questions are answered
        if (this.unanswered() > 0) {
            const answerAllMessage = this.translate.instant('fuv.police.antragsfragen.validation.answerAll', {
                count: this.unanswered()
            });
            this.validationErrors = [answerAllMessage];
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('fuv.police.antragsfragen.validation.toastTitle'),
                detail: answerAllMessage,
                life: 4000
            });
            // Don't close modal - stay in modal to fix errors
            return;
        }

        // Then validate that all "Ja" answers have details
        const validation = this.validateAnswers();
        if (!validation.valid) {
            this.validationErrors = validation.missingDetails;
            const fillDetailsMessage = this.translate.instant('fuv.police.antragsfragen.validation.fillDetails');
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('fuv.police.antragsfragen.validation.toastTitle'),
                detail: fillDetailsMessage,
                life: 4000
            });
            // Don't close modal - stay in modal to fix errors
            return;
        }

        // Check if VTT task dialog should be shown (3+ "ja" answers)
        if (this.checkVttRequired()) {
            this.logger.debug('3+ questions answered with "ja" - closing Antragsfragen modal first, then showing VTT dialog');

            // First, save the data
            this.performSave(person_boid, true); // Pass true to indicate VTT is required
            return; // VTT dialog will be shown after save completes
        }

        // If validation passes and no VTT required, proceed with save
        this.performSave(person_boid, false);
    }

    /**
     * Actually perform the save operation
     * @param person_boid Person BOID
     * @param showVttDialogAfterSave If true, shows VTT dialog after successful save
     * @param emitVttCheckAfterSave If true, emits vttCheckRequired(true) after successful save (used after task creation)
     */
    private performSave(person_boid: string, showVttDialogAfterSave: boolean = false, emitVttCheckAfterSave: boolean = false) {
        // Show subtle "saving" notification
        this.messageService.add({
            severity: 'info',
            summary: 'Speichern...',
            detail: 'Antragsfragen werden gespeichert',
            life: 2000
        });

        // Map UI structure to backend format
        const antworten: any[] = [];
        const fragebogenBoid = this.fragebogen?.boid || this.offerteStore.currentOfferte()?.fragen_boid;

        this._antragsfragen.forEach((frage) => {
            if (!frage.frage_boid) return;

            const existingMain = this.fragebogen?.antworten?.find((a) => a.frage_boid === frage.frage_boid && a.codevalue !== null);
            // Map antwort to codevalue
            const codevalue = frage.antwort === 'ja' ? '-10110' : frage.antwort === 'nein' ? '-10111' : null;

            // Add main answer
            antworten.push({
                id: existingMain?.id,
                codevalue: codevalue,
                textvalue: null,
                fragebogen_boid: fragebogenBoid,
                frage_boid: frage.frage_boid,
                frage_statefrom: '1900-01-01',
                updatedby: this.authService.getUserProfile()?.username || 'system'
            });

            // Add details if present
            if (frage.details && frage.details.trim()) {
                // Find the details question BOID (usually next boid after main question)
                const detailsBoid = this.getDetailsBoid(frage.frage_boid);
                if (detailsBoid) {
                    const existingDetail = this.fragebogen?.antworten?.find((a) => a.frage_boid === detailsBoid && a.textvalue !== null);
                    antworten.push({
                        id: existingDetail?.id,
                        codevalue: null,
                        textvalue: frage.details,
                        fragebogen_boid: fragebogenBoid,
                        frage_boid: detailsBoid,
                        frage_statefrom: '1900-01-01',
                        updatedby: this.authService.getUserProfile()?.username || 'system'
                    });
                }
            }

            // Add behandlung for frage1
            if (frage.id === 'frage1' && frage.behandlung) {
                const existingBehandlung = this.fragebogen?.antworten?.find((a) => a.frage_boid === '5675');
                const behandlungCode = frage.behandlung === 'ja' ? '-10110' : frage.behandlung === 'nein' ? '-10111' : null;
                antworten.push({
                    id: existingBehandlung?.id,
                    codevalue: behandlungCode,
                    textvalue: null,
                    fragebogen_boid: fragebogenBoid,
                    frage_boid: '5675', // behandlung question
                    frage_statefrom: '1900-01-01',
                    updatedby: this.authService.getUserProfile()?.username || 'system'
                });
            }
        });

        // Get aufgabe_boid from offerte store (if task was created)
        const offerte = this.offerteStore.currentOfferte();
        const aufgabe_boid = this.offerteStore.currentMeta()?.aufgabe_boid || this.fragebogen?.aufgabe_boid || null;

        const fragebogenData = {
            person_boid: person_boid,
            antworten: antworten,
            gueltab: new Date().toISOString().split('T')[0],
            gueltbis: '3000-01-01',
            aufgabe_boid: aufgabe_boid,
            genehmigung_art: this.fragebogen?.genehmigung_art || undefined,
            genehmigung_bemerkung: this.fragebogen?.genehmigung_bemerkung || undefined
        };

        // Update or insert
        const nextFragebogenState = {
            ...(this.fragebogen || {}),
            ...fragebogenData,
            boid: this.fragebogen?.boid || fragebogenBoid
        } as Fragebogen;

        if (this.fragebogen && this.fragebogen.id) {
            const currentFragebogen = this.fragebogen;
            this.fragenService
                .updateFuvFragebogen({
                    ...fragebogenData,
                    id: currentFragebogen.id,
                    boid: currentFragebogen.boid, // Keep existing fragebogen boid for updates
                    antworten: antworten.map((a) => ({
                        ...a,
                        fragebogen_boid: currentFragebogen.boid
                    }))
                })
                .subscribe({
                    next: () => {
                        this.logger.debug('Fragebogen updated successfully');

                        // Update the fragebogen in offerte store
                        // Merge local fragebogen state with latest answers before pushing to store
                        this.fragebogen = {
                            ...nextFragebogenState,
                            id: currentFragebogen.id,
                            boid: currentFragebogen.boid
                        };

                        this.offerteStore.updateOfferte(null, {
                            fragebogen: this.fragebogen,
                            fragen_boid: this.fragebogen.boid,
                            art: OFFERTE_ART_VER // Change offerte art to OfferteArtVer after saving antragsfragen
                        });
                        this.syncVttFlagsFromFragebogen(this.fragebogen);

                        // Show subtle success notification
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Gespeichert',
                            detail: 'Antragsfragen erfolgreich gespeichert',
                            life: 2000
                        });

                        // Emit vttCheckRequired if requested (after task creation)
                        // This ensures backend is synced before proceeding to next step
                        if (emitVttCheckAfterSave) {
                            this.logger.debug('Emitting vttCheckRequired(true) after successful save');
                            this.vttCheckRequired.emit(true);
                        }

                        // Close the modal on successful save
                        // Pass showVttDialog flag so embedded view knows to trigger VTT dialog
                        this.closeQuestionsModal({
                            saved: true,
                            fragebogen: this.fragebogen || undefined,
                            showVttDialog: showVttDialogAfterSave
                        });
                    },
                    error: (error: unknown) => {
                        this.logger.error('Error updating fragebogen:', error);
                        // Show subtle error notification
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Fehler',
                            detail: 'Speichern fehlgeschlagen',
                            life: 3000
                        });

                        // Emit vttCheckRequired even on error if requested, to unblock UI
                        if (emitVttCheckAfterSave) {
                            this.logger.warn('Emitting vttCheckRequired(true) despite save error to unblock UI');
                            this.vttCheckRequired.emit(true);
                        }

                        // Don't close modal on error - let user try again
                    }
                });
        } else {
            // Generate a new UUIDv4 for the fragebogen boid
            const fragebogen_boid = uuidv4();
            this.fragenService.insertFuvFragebogen({ ...fragebogenData, boid: fragebogen_boid }).subscribe({
                next: (result: Fragebogen) => {
                    // Store the created fragebogen for future updates
                    if (result && result.id) {
                        this.fragebogen = { ...nextFragebogenState, ...result, boid: result.boid || nextFragebogenState.boid } as Fragebogen;

                        // Update the fragebogen in offerte store
                        this.offerteStore.updateOfferte(null, {
                            fragebogen: this.fragebogen,
                            fragen_boid: this.fragebogen.boid,
                            art: OFFERTE_ART_VER // Change offerte art to OfferteArtVer after saving antragsfragen
                        });
                        this.syncVttFlagsFromFragebogen(this.fragebogen);
                    }
                    this.logger.debug('Fragebogen created successfully:', result);
                    // Show subtle success notification
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Gespeichert',
                        detail: 'Antragsfragen erfolgreich gespeichert',
                        life: 2000
                    });

                    // Emit vttCheckRequired if requested (after task creation)
                    // This ensures backend is synced before proceeding to next step
                    if (emitVttCheckAfterSave) {
                        this.logger.debug('Emitting vttCheckRequired(true) after successful save');
                        this.vttCheckRequired.emit(true);
                    }

                    // Close the modal on successful save
                    // Pass showVttDialog flag so embedded view knows to trigger VTT dialog
                    this.closeQuestionsModal({
                        saved: true,
                        fragebogen: this.fragebogen || undefined,
                        showVttDialog: showVttDialogAfterSave
                    });
                },
                error: (error) => {
                    this.logger.error('Error creating fragebogen:', error);
                    // Show subtle error notification
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Fehler',
                        detail: 'Speichern fehlgeschlagen',
                        life: 3000
                    });

                    // Emit vttCheckRequired even on error if requested, to unblock UI
                    if (emitVttCheckAfterSave) {
                        this.logger.warn('Emitting vttCheckRequired(true) despite save error to unblock UI');
                        this.vttCheckRequired.emit(true);
                    }

                    // Don't close modal on error - let user try again
                }
            });
        }
    }

    /**
     * Get the details/textvalue question BOID for a main question (dynamically from backend)
     * Looks for the first Text-type follow-up question in the same group
     */
    private getDetailsBoid(mainBoid: string): string | null {
        // Find the question group containing this main question
        const mainQuestion = this.allFragen.find((q) => q.boid === mainBoid);
        if (!mainQuestion) return null;

        // Get all questions in the same group
        const groupQuestions = this.allFragen.filter((q) => q.titel_boid === mainQuestion.titel_boid);

        // Find follow-up questions (after the main question, sorted by sort field)
        const sortedQuestions = groupQuestions.sort((a, b) => a.sort.localeCompare(b.sort));
        const mainIndex = sortedQuestions.findIndex((q) => q.boid === mainBoid);

        if (mainIndex === -1) return null;

        // Find first Text-type question after main question
        const detailsQuestion = sortedQuestions.slice(mainIndex + 1).find((q) => q.variabletyp === 'Text');
        return detailsQuestion?.boid || null;
    }

    /**
     * Format backend datetime to display format
     */
    private formatDateTime(isoString: string): string {
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    getDefaultFaelligAm(): string {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}.${month}.${year}`;
    }

    onDataChange(frage?: Antragsfrage) {
        if (frage && frage.antwort !== 'ja') {
            frage.details = '';
            if (frage.behandlung !== undefined) {
                frage.behandlung = '';
            }
        }

        this.updateSummary();
        // Update the "changed at" timestamp when user makes changes
        const now = this.getCurrentDateTime();
        this.geaendertAm = now;
        this.lastVttPromptHash = null;

        // Update geaendertAm for all questions
        this._antragsfragen.forEach((frage: Antragsfrage) => {
            frage.geaendertAm = now;
        });

        // Clear validation errors when user makes changes
        if (this.validationErrors.length > 0) {
            this.validationErrors = [];
        }
    }

    // Method to check if VTT review is needed (called by parent component)
    checkVttRequired(): boolean {
        // Always recompute to avoid stale signals
        this.updateSummary();
        const yesCount = this._antragsfragen.filter((f) => f.antwort === 'ja').length;

        // Use the freshest fragebogen reference (local or store)
        const fragebogen = this.fragebogen || this.offerteStore.currentOfferte()?.fragebogen;
        const meta = this.offerteStore.currentMeta();

        // Determine if a task already exists or an assessment was made
        const hasBackendTask = !!(fragebogen?.aufgabe_boid || meta?.aufgabe_boid);
        const hasAssessment = this.hasVttAssessment(fragebogen);

        // Sync local flag from reliable sources only (avoid stale vttTaskCreated meta)
        if ((hasBackendTask || hasAssessment) && !this.vttTaskCreated()) {
            this.logger.warn('[checkVttRequired] Syncing vttTaskCreated from backend state');
            this.vttTaskCreated.set(true);
        }

        const required = yesCount >= 3 && !hasBackendTask && !hasAssessment && !this.vttTaskDeclined;

        this.logger.debug('[checkVttRequired]', {
            answeredYes: yesCount,
            vttTaskCreated: this.vttTaskCreated(),
            vttTaskDeclined: this.vttTaskDeclined,
            hasBackendTask,
            hasAssessment,
            required
        });

        return required;
    }

    // Method to validate that all "Ja" answers have required details filled using Zod
    validateAnswers(): { valid: boolean; missingDetails: string[] } {
        const result = validateAntragsfragenFormData(this._antragsfragen);

        if (result.success) {
            return {
                valid: true,
                missingDetails: []
            };
        }

        // Extract error messages from Zod validation
        const missingDetails = result.error.issues.map((err: any) => err.message);

        this.logger.debug('Validation failed:', result.error.issues);

        return {
            valid: false,
            missingDetails
        };
    }

    // Method to show VTT dialog (called by parent component)
    promptVttTask(): boolean {
        // Skip validation in read-only mode - always return true
        if (this.viewMode) {
            this.logger.log('Skipping validation in read-only mode');
            return true;
        }

        // Clear previous validation errors
        this.validationErrors = [];

        // First check if all questions are answered
        this.updateSummary(); // Update the summary counts
        if (this.unanswered() > 0) {
            const answerAllMessage = this.translate.instant('fuv.police.antragsfragen.validation.answerAll', {
                count: this.unanswered()
            });
            this.validationErrors = [answerAllMessage];
            // Scroll to top to show error message
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.logger.warn(`Cannot proceed: ${this.unanswered()} unanswered questions`);
            return false; // Cannot proceed
        }

        if (this.checkVttRequired()) {
            // Then validate that all "Ja" answers have details
            const validation = this.validateAnswers();
            if (!validation.valid) {
                // Set validation errors to display
                this.validationErrors = validation.missingDetails;
                // Scroll to top to show error message
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return false; // Cannot proceed
            }

            // Only show the dialog again when answers changed since last prompt
            const currentHash = this.getAnswersHash();
            if (currentHash === this.lastVttPromptHash) {
                this.logger.debug('VTT dialog already shown for current answers hash - skipping re-prompt');
                return true;
            }
            this.lastVttPromptHash = currentHash;

            this.showVttDialog = true;
            return false; // Cannot proceed yet (need to complete VTT dialog)
        }
        return true; // Can proceed (less than 3 "Ja" or task already created)
    }

    updateSummary() {
        let jaCount = 0;
        let neinCount = 0;
        let unansweredCount = 0;

        this._antragsfragen.forEach((frage: Antragsfrage) => {
            if (frage.antwort === 'ja') {
                jaCount++;
            } else if (frage.antwort === 'nein') {
                neinCount++;
            } else {
                unansweredCount++;
            }
        });

        const total = this._antragsfragen.length || jaCount + neinCount;
        const normalizedUnanswered = total ? Math.max(total - (jaCount + neinCount), 0) : unansweredCount;

        this.answeredYes.set(jaCount);
        this.answeredNo.set(neinCount);
        this.unanswered.set(normalizedUnanswered);
        this.questionCount.set(this._antragsfragen.length);
    }

    private getAnswersHash(): string {
        const minimal = this._antragsfragen.map((f) => ({
            id: f.id,
            antwort: f.antwort,
            details: f.details,
            behandlung: f.behandlung
        }));
        return JSON.stringify(minimal);
    }

    getCurrentDateTime(): string {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    /**
     * Check if fields should be disabled (read-only)
     * Returns true if user is in view-only mode OR doesn't have update permission
     */
    isFieldDisabled(): boolean {
        return this.viewMode || !this.canUpdateAntragsfragen();
    }

    private hasVttAssessment(fragebogen?: Fragebogen | null): boolean {
        return !!(fragebogen?.genehmigung_art || fragebogen?.genehmigung_bemerkung);
    }

    private syncVttFlagsFromFragebogen(fb?: Fragebogen | null): void {
        const fragebogen = fb || this.fragebogen;
        const hasTask = !!fragebogen?.aufgabe_boid || !!this.offerteStore.currentMeta()?.aufgabe_boid;
        const hasAssessment = this.hasVttAssessment(fragebogen);

        if (hasTask || hasAssessment) {
            this.vttTaskCreated.set(true);
        }

        this.offerteStore.updateMeta(null, {
            aufgabe_boid: fragebogen?.aufgabe_boid || this.offerteStore.currentMeta()?.aufgabe_boid || undefined,
            vttTaskCreated: hasTask || hasAssessment,
            vttAssessmentVisible: hasAssessment
        });
    }

    toggleQuestions(viewOnly: boolean = false) {
        // Open modal using the DynamicDialog service for fullscreen capability
        if (this.canReadAntragsfragen()) {
            const offerte = this.offerteStore.currentOfferte();
            if (!offerte?.id) {
                this.logger.error('Cannot open modal: No offerte ID available');
                this.messageService.add({
                    severity: 'error',
                    summary: 'Fehler',
                    detail: 'Offerte-ID fehlt',
                    life: 3000
                });
                return;
            }

            // Use the modal service to open with fullscreen capability
            this.logger.debug('Opening questions via modal service in', viewOnly ? 'view-only' : 'edit', 'mode');
            const dialogRef = this.antragsfragenModalService.openForOfferte(offerte.id, viewOnly);

            // Subscribe to dialog close to reload data
            dialogRef.onClose.subscribe((result: { saved: boolean; fragebogen?: any; showVttDialog?: boolean } | undefined) => {
                this.logger.debug('Modal closed with result:', result);

                // Reload data if saved
                if (result?.saved) {
                    if (result.fragebogen) {
                        this.fragebogen = result.fragebogen;
                    } else {
                        this.fragebogen = this.offerteStore.currentOfferte()?.fragebogen || this.fragebogen;
                    }
                    this.logger.debug('Reloading fragebogen data after save');
                    this.loadFragenAndAntworten();

                    // Note: VTT dialog handling is done by AntragsfragenModalService
                    // The service will reopen the modal with triggerVttDialog flag if needed
                    // We don't show the dialog here to avoid duplicate dialogs
                }
            });
        } else {
            this.logger.warn('No permission to view antragsfragen');
            this.messageService.add({
                severity: 'warn',
                summary: 'Keine Berechtigung',
                detail: 'Sie haben keine Berechtigung, die Antragsfragen anzuzeigen',
                life: 3000
            });
        }
    }

    closeQuestionsModal(result?: { saved: boolean; fragebogen?: Fragebogen; showVttDialog?: boolean }) {
        if (this.isModalMode && this.dialogRef) {
            // In modal mode, close the dynamic dialog with result
            this.dialogRef.close(result);
        }
        // Note: No else needed - when using modal service, dialog is always in modal mode
    }

    onVttDialogConfirm() {
        // Generate dynamic task description based on answered questions
        this.taskData.automatischeBeschreibung = this.generateTaskDescription();

        // Get visum from auth service (preferred_username from Keycloak)
        const userProfile = this.authService.getUserProfile();
        const visum = userProfile?.username || 'GE';

        // Load aufgabenart options from codes service (only show WFD_FUVOff_Offerte_pruefen_VTT)
        this.codesService.getCodesByGruppe('AufgabenDef').subscribe({
            next: (codes) => {
                // Filter to show ONLY WFD_FUVOff_Offerte_pruefen_VTT for antragsfragen VTT task
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
                this.logger.debug('Opening task creation dialog with aufgabenart options:', this.aufgabenartOptions.length);
                this.showVttDialog = false;
                this.showTaskCreationDialog = true;
            },
            error: (error) => {
                this.logger.error('Failed to load aufgabenart options', error);
                // Still show dialog with empty options
                this.taskData.aufgabeart = '';
                this.taskData.titel = '';
                this.taskData.zugewiesenAn = DEFAULT_AUFGABE_AUSFUEHRENDER;

                this.showVttDialog = false;
                this.showTaskCreationDialog = true;
            }
        });
    }

    /**
     * Generate dynamic task description listing all "Ja" answers
     * Includes Sv-Nr from person data and direct link to offerte
     */
    private generateTaskDescription(): string {
        const jaQuestions = this._antragsfragen.filter((f) => f.antwort === 'ja');

        if (jaQuestions.length === 0) {
            return 'Keine Antragsfragen mit Ja beantwortet.';
        }

        // Get Sv-Nr and offerte details from offerte store
        const offerte = this.offerteStore.currentOfferte();
        const svnr = offerte?.person?.svnr || 'N/A';
        const offertenr = offerte?.offertenr;

        // Build direct link to this offerte and step (Antragsfragen is step 5)
        const baseUrl = window.location.origin;
        const offerteLink = offertenr ? `${baseUrl}/fuv/offerte/police/${offertenr}?step=5` : '';

        let description = `Sv-Nr: ${svnr}\n\n`;

        // Add direct link to offerte if available
        if (offerteLink) {
            description += `Direkt zur Offerte (Schritt Antragsfragen):\n${offerteLink}\n\n`;
        }

        description += 'Folgende Antragsfragen wurden mit Ja beantwortet:\n\n';

        jaQuestions.forEach((frage, index) => {
            // Extract question number from id (e.g., "frage1" -> "1")
            const frageNum = frage.id.replace('frage', '');
            description += `Frage ${frageNum}: ${frage.frageText}\n`;
        });

        return description;
    }

    onVttDialogCancel() {
        // User declined to create VTT task
        this.logger.debug('VTT task creation cancelled - user declined');
        this.showVttDialog = false;
        this.vttTaskDeclined = true; // Mark as declined to prevent re-prompting

        // Update offerte store to persist the declined state
        this.offerteStore.updateMeta(null, { vttTaskDeclined: true });

        // Save the antragsfragen after user declines VTT task creation
        // Emit vttCheckRequired AFTER save completes to ensure backend is synced
        const offerte = this.offerteStore.currentOfferte();
        const person_boid = offerte?.person?.boid;

        if (person_boid) {
            this.performSave(person_boid, false, true); // Pass true to emit event after save
        } else {
            // No person BOID - emit immediately to unblock UI
            this.vttCheckRequired.emit(true);
        }
    }

    onTaskCreationSave() {
        const offerte = this.offerteStore.currentOfferte();

        if (!offerte?.id) {
            this.logger.error('Cannot create task: No offerte ID available');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Keine Offerte-ID verfügbar',
                life: 3000
            });
            return;
        }

        // Check if we're updating an existing aufgabe or creating a new one
        const aufgabe_boid = this.offerteStore.currentMeta()?.aufgabe_boid;
        const isUpdate = !!aufgabe_boid;

        this.logger.debug(`${isUpdate ? 'Updating' : 'Creating'} VTT task with data:`, this.taskData);

        // Show loading notification
        this.messageService.add({
            severity: 'info',
            summary: isUpdate ? 'Aktualisieren...' : 'Erstellen...',
            detail: isUpdate ? 'Aufgabe wird aktualisiert' : 'Aufgabe wird erstellt',
            life: 2000
        });

        if (isUpdate) {
            // Build change request (same structure as create)
            const changeRequest = this.kpmService.buildChangeAufgabeRequest({
                workflowDef: this.taskData.aufgabeart,
                titel: this.taskData.titel,
                beschreibung: this.taskData.automatischeBeschreibung + '\n\n' + this.taskData.beschreibung,
                faelligkeitsDatum: this.parseFaelligAm(this.taskData.faelligAm),
                ausfuehrender: this.taskData.zugewiesenAn,
                partnernr: offerte.person?.partnernr || '',
                partnerId: offerte.person?.partnernr || '',
                objektId: offerte.person?.partnernr || '',
                objektMetaId: '-3',
                prioritaet: ''
            });

            this.logger.debug('Task update request:', changeRequest);

            // Update the task (aufgabe_boid is passed as query parameter)
            this.kpmService.changeSyriusAufgabe(aufgabe_boid, changeRequest).subscribe({
                next: (response) => {
                    this.logger.debug('Task updated successfully:', response);

                    // Update the task beschreibung in local state
                    this.vttTaskBeschreibung = this.taskData.beschreibung;

                    this.showTaskCreationDialog = false;

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Aktualisiert',
                        detail: 'Aufgabe erfolgreich aktualisiert',
                        life: 3000
                    });

                    // Now save the antragsfragen after task update
                    // Emit vttCheckRequired after save completes
                    const person_boid = offerte?.person?.boid;
                    if (person_boid) {
                        this.performSave(person_boid, false, true); // Pass true to emit event after save
                    } else {
                        this.logger.error('Cannot save after task update: No person BOID available');
                        // Still emit to unblock UI even if save failed
                        this.vttCheckRequired.emit(true);
                    }
                },
                error: (error) => {
                    this.logger.error('Error updating task:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Fehler',
                        detail: error.message || 'Fehler beim Aktualisieren der Aufgabe',
                        life: 5000
                    });
                }
            });
        } else {
            // Build create request
            const createRequest = this.kpmService.buildCreateAufgabeRequest({
                workflowDef: this.taskData.aufgabeart,
                titel: this.taskData.titel,
                beschreibung: this.taskData.automatischeBeschreibung + '\n\n' + this.taskData.beschreibung,
                faelligkeitsDatum: this.parseFaelligAm(this.taskData.faelligAm),
                ausfuehrender: this.taskData.zugewiesenAn,
                partnernr: offerte.person?.partnernr || '',
                partnerId: offerte.person?.partnernr || '',
                objektId: offerte.person?.partnernr || '',
                objektMetaId: '-3',
                prioritaet: ''
            });

            this.logger.debug('Task create request:', createRequest);

            // Create the task
            this.kpmService.createSyriusAufgabe(createRequest).subscribe({
                next: (response) => {
                    this.logger.debug('Task created successfully:', response);

                    // Extract aufgabe_boid from response (response has aufgabeId in camelCase)
                    const new_aufgabe_boid = response['aufgabeId'] || response['aufgabe_id'] || response['boid'];

                    if (!new_aufgabe_boid) {
                        this.logger.warn('No aufgabe_boid in response:', response);
                    } else {
                        this.logger.debug('Extracted aufgabe_boid:', new_aufgabe_boid);
                    }

                    // Mark task as created
                    this.vttTaskCreated.set(true);
                    this.vttTaskCreatedAm = this.getCurrentDateTime();
                    this.vttTaskBeschreibung = this.taskData.beschreibung; // Store the ergänzende Bemerkungen
                    this.showTaskCreationDialog = false;

                    // Also update local fragebogen object (initialize if null)
                    if (!this.fragebogen) {
                        // Initialize fragebogen object if it doesn't exist yet
                        this.fragebogen = {
                            id: 0,
                            created: '',
                            updated: '',
                            boid: offerte?.person?.boid || '',
                            gueltab: '',
                            gueltbis: '',
                            person_boid: offerte?.person?.boid || '',
                            antworten: [],
                            updatedby: '',
                            aufgabe_boid: new_aufgabe_boid,
                            genehmigung_art: '',
                            genehmigung_bemerkung: ''
                        };
                    } else {
                        this.fragebogen.aufgabe_boid = new_aufgabe_boid;
                    }

                    // Update store with task info and fragebogen
                    this.offerteStore.updateOfferte(null, {
                        fragebogen: this.fragebogen, // Update the fragebogen object in store
                        fragen_boid: this.fragebogen.boid
                    });
                    this.offerteStore.updateMeta(null, {
                        aufgabe_boid: new_aufgabe_boid,
                        vttTaskCreated: true
                    });

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Erstellt',
                        detail: 'Aufgabe erfolgreich erstellt',
                        life: 3000
                    });

                    // Now save the antragsfragen after task creation (this will persist aufgabe_boid to backend)
                    // IMPORTANT: Only emit vttCheckRequired AFTER save completes to ensure backend is in sync
                    const person_boid = offerte?.person?.boid;
                    if (person_boid) {
                        this.performSave(person_boid, false, true); // Pass true to emit event after save
                    } else {
                        this.logger.error('Cannot save after task creation: No person BOID available');
                        // Still emit to unblock UI even if save failed
                        this.vttCheckRequired.emit(true);
                    }
                },
                error: (error) => {
                    this.logger.error('Error creating task:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Fehler',
                        detail: error.message || 'Fehler beim Erstellen der Aufgabe',
                        life: 5000
                    });
                }
            });
        }
    }

    /**
     * Parse Fällig am date from DD.MM.YYYY format to YYYY-MM-DD format
     */
    private parseFaelligAm(dateStr: string): string {
        try {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
            }
        } catch (error) {
            this.logger.error('Error parsing date:', error);
        }
        // Fallback to today's date in ISO format
        return new Date().toISOString().split('T')[0];
    }

    onTaskCreationCancel() {
        // Cancel task creation - return to questions without saving
        this.logger.debug('Task creation cancelled');
        this.showTaskCreationDialog = false;
        this.vttCheckRequired.emit(false);

        // Don't save antragsfragen if task creation is cancelled
    }

    /**
     * Check if we're editing an existing task
     */
    isEditingTask(): boolean {
        const offerte = this.offerteStore.currentOfferte();
        return !!this.offerteStore.currentMeta()?.aufgabe_boid;
    }

    /**
     * Handle aufgabenart selection change
     * Updates titel to match the selected aufgabenart text
     */
    onAufgabenartChange(): void {
        const selectedOption = this.aufgabenartOptions.find((opt) => opt.value === this.taskData.aufgabeart);
        if (selectedOption) {
            this.taskData.titel = selectedOption.label;
            this.logger.debug('Aufgabenart changed, updated titel', {
                aufgabeart: this.taskData.aufgabeart,
                titel: this.taskData.titel
            });
        }
    }

    /**
     * Check if step is valid and ready to proceed:
     * - All questions must be answered (using Zod validation)
     * - If 3+ "Ja" answers, VTT task must be created
     * - All "Ja" answers must have details
     */
    isStepValid(): boolean {
        // Skip validation in read-only mode - always return true
        if (this.viewMode) {
            return true;
        }

        // Use Zod validation to check all requirements
        const validation = this.validateAnswers();

        if (!validation.valid) {
            this.logger.debug('Step invalid: Validation failed', validation.missingDetails);
            return false;
        }

        // Check if VTT task is required and created
        if (this.checkVttRequired() && !this.vttTaskCreated()) {
            this.logger.debug('Step invalid: VTT task required but not created');
            return false;
        }

        this.logger.debug('Step valid: All questions answered and validated');
        return true;
    }

    /**
     * Check if a VTT task exists for this offerte
     * Uses the isVttAufgabeCreated computed signal which checks all sources
     * This is just an alias for better readability in the template
     */
    hasVttTask = computed(() => this.isVttAufgabeCreated());

    /**
     * Handle VTT Beurteilung button click
     * Opens a dialog with two tabs: VTT Beurteilung and Aufgabe in Syrius
     */
    onVttBeurteilungClick(): void {
        const offerte = this.offerteStore.currentOfferte();
        // Try to get aufgabe_boid from offerte store first, then from fragebogen
        const aufgabe_boid = this.offerteStore.currentMeta()?.aufgabe_boid || this.fragebogen?.aufgabe_boid;

        if (!aufgabe_boid) {
            this.logger.error('No aufgabe_boid available');
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Keine Aufgabe verfügbar',
                life: 3000
            });
            return;
        }

        this.logger.debug('Opening VTT Beurteilung dialog for aufgabe_boid:', aufgabe_boid);

        // Load Beurteilungsart options from codes service
        this.loadBeurteilungsartOptions();

        // Check if aufgabe details are already in store (prefetched)
        const cachedDetails = this.offerteStore.currentMeta()?.aufgabeDetails;

        if (cachedDetails) {
            this.logger.debug('Using cached aufgabe details from store');
            this.aufgabeDetails = cachedDetails;
            this.isLoadingAufgabeDetails = false;
        } else {
            // Load aufgabe details if not cached
            this.logger.debug('Aufgabe details not cached, loading now');
            this.loadAufgabeDetails(aufgabe_boid);
        }

        // Initialize form with existing values from fragebogen if available
        if (this.fragebogen) {
            this.vttBeurteilung.beurteilungsart = this.fragebogen.genehmigung_art || '';
            this.vttBeurteilung.bemerkung = this.fragebogen.genehmigung_bemerkung || '';
        }

        // Set active tab to first tab and show dialog
        this.vttBeurteilungActiveTab = 0;
        this.showVttBeurteilungDialog = true;
    }

    /**
     * Load Beurteilungsart options from codes service (gruppe: GenehmigungOfferte)
     */
    private loadBeurteilungsartOptions(): void {
        this.codesService.getCodesByGruppe('GenehmigungOfferte').subscribe({
            next: (codes) => {
                this.beurteilungsartOptions = codes
                    .filter((code) => code.aktiv === true)
                    .map((code) => ({
                        label: this.codesService.getLocalizedLabel(code),
                        value: code.internal_name
                    }));
                this.logger.debug('Loaded Beurteilungsart options:', this.beurteilungsartOptions.length);
            },
            error: (error) => {
                this.logger.error('Error loading Beurteilungsart options:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Fehler',
                    detail: 'Fehler beim Laden der Beurteilungsarten',
                    life: 3000
                });
            }
        });
    }

    /**
     * Load aufgabe details for the Aufgabe in Syrius tab
     */
    private loadAufgabeDetails(aufgabe_boid: string): void {
        this.isLoadingAufgabeDetails = true;
        this.kpmService.getAufgabeDetails(aufgabe_boid).subscribe({
            next: (details) => {
                this.aufgabeDetails = details;
                this.isLoadingAufgabeDetails = false;
                this.logger.debug('Loaded aufgabe details:', details);

                // Cache the details in the store for future use
                this.offerteStore.updateMeta(null, { aufgabeDetails: details });
            },
            error: (error) => {
                this.logger.error('Error loading aufgabe details:', error);
                this.isLoadingAufgabeDetails = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Fehler',
                    detail: 'Fehler beim Laden der Aufgabendetails',
                    life: 3000
                });
            }
        });
    }

    /**
     * Save VTT Beurteilung (assessment)
     */
    onVttBeurteilungSave(): void {
        if (!this.vttBeurteilung.beurteilungsart) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validierung',
                detail: 'Bitte wähle eine Beurteilungsart',
                life: 3000
            });
            return;
        }

        // Update fragebogen with genehmigung_art and genehmigung_bemerkung
        if (this.fragebogen) {
            this.fragebogen.genehmigung_art = this.vttBeurteilung.beurteilungsart;
            this.fragebogen.genehmigung_bemerkung = this.vttBeurteilung.bemerkung;

            // Save to backend
            const offerte = this.offerteStore.currentOfferte();
            const person_boid = offerte?.person?.boid;
            if (person_boid) {
                this.performSave(person_boid);
                this.showVttBeurteilungDialog = false;
            } else {
                this.logger.error('Cannot save VTT Beurteilung: No person BOID available');
                this.messageService.add({
                    severity: 'error',
                    summary: 'Fehler',
                    detail: 'Keine Person-BOID verfügbar',
                    life: 3000
                });
            }
        }
    }

    /**
     * Close VTT Beurteilung dialog
     */
    closeVttBeurteilungDialog(): void {
        this.showVttBeurteilungDialog = false;
        this.vttBeurteilungActiveTab = 0;
    }

    /**
     * Open task in Syrius using external service
     */
    openInSyrius(): void {
        const aufgabe_boid = this.offerteStore.currentMeta()?.aufgabe_boid || this.fragebogen?.aufgabe_boid;
        if (aufgabe_boid) {
            this.externalService.openSyriusAufgabe(aufgabe_boid);
        }
    }

    /**
     * Check if VTT dialog should be triggered and show it
     * Called after data is loaded when triggerVttDialog flag is set
     */
    private checkAndTriggerVttDialog(): void {
        // Wait a bit for data to load
        setTimeout(() => {
            this.updateSummary();

            if (this.checkVttRequired()) {
                this.logger.debug('Triggering VTT dialog after reopening modal');
                this.showVttDialog = true;
            } else {
                this.logger.debug('VTT not required or already handled');
            }
        }, 500);
    }
}
