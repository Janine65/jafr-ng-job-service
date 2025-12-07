import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Subject } from 'rxjs';
import { distinctUntilChanged, filter, map, takeUntil, tap } from 'rxjs/operators';

import { CommonModule, NgIf } from '@angular/common';
import {
    ChangeDetectorRef, Component, computed, effect, inject, OnDestroy, OnInit
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Betrieb } from '@app/fuv/models/betrieb.model';
import { Offerte } from '@app/fuv/models/offerte.model';
import { Vertrag } from '@app/fuv/models/vertrag.model';
import { CodeLabelPipe } from '@app/fuv/pipes/code-label.pipe';
import { BetriebService } from '@app/fuv/services/betrieb.service';
import { ChecklisteModalService } from '@app/fuv/services/checkliste-modal.service';
import { CodesService } from '@app/fuv/services/codes.service';
import { OfferteService } from '@app/fuv/services/offerte.service';
import { BetriebStore } from '@app/fuv/stores/betrieb.store';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import {
    LoadingSpinnerComponent
} from '@app/shared/components/loading-spinner/loading-spinner.component';
import { UidNrFormatPipe } from '@app/shared/pipes/uid-nr-format.pipe';
import { PermissionService } from '@app/shared/services/permission.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppMessageService, LogFactoryService } from '@syrius/core';
import { ColumnDefinition, DataTableComponent } from '@syrius/data-table';

import { ExternalService } from '../../../shared/services/external.service';
import {
    OFFERTE_STATUS_ABSCHLUSS, OFFERTE_STATUS_REJECTED
} from '../offerte-police/police.constants';
import {
    BETRIEB_OFFERTEN_COLUMN_DEFS, BETRIEB_OFFERTEN_TABLE_CONFIG, BETRIEB_VERTRAEGE_COLUMN_DEFS,
    BETRIEB_VERTRAEGE_TABLE_CONFIG
} from './betrieb-detail.tables';

@Component({
    selector: 'app-betrieb-detail',
    standalone: true,
    imports: [CommonModule, TranslateModule, LoadingSpinnerComponent, CardModule, ButtonModule, DataTableComponent, NgIf, ConfirmDialogModule, UidNrFormatPipe, CodeLabelPipe],
    providers: [ConfirmationService],
    templateUrl: './betrieb-detail.component.html'
})
export class BetriebDetailComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private confirmationService = inject(ConfirmationService);
    private messageService = inject(AppMessageService);
    private logger = inject(LogFactoryService).createLogger('BetriebDetailComponent');
    private betriebStore = inject(BetriebStore);
    private betriebService = inject(BetriebService);
    private offerteService = inject(OfferteService);
    private offerteStore = inject(OfferteTypedStore);
    private translateService = inject(TranslateService);
    private externalService = inject(ExternalService);
    private codesService = inject(CodesService);
    private checklisteModalService = inject(ChecklisteModalService);
    private cdr = inject(ChangeDetectorRef);
    private permissionService = inject(PermissionService);

    private destroy$ = new Subject<void>();

    // Track offerten being deleted (for loading state)
    private deletingOffertenIds = new Set<number>();

    // Track verträge that already have Vertragsverlängerung offerten (for menu disable logic)
    private vertraegeWithVerlaengerungMap = new Map<string, boolean>();

    // Expose signals directly for template
    readonly betrieb = this.betriebStore.data;
    readonly offerten = this.betriebStore.offerten;
    readonly vertraege = this.betriebStore.vertraege;
    readonly loadingBetrieb = this.betriebStore.loadingBetrieb;
    readonly loadingRelations = this.betriebStore.loadingRelations;
    readonly error = this.betriebStore.error;

    offertenColumnDefs: ColumnDefinition<any>[];
    vertraegeColumnDefs: ColumnDefinition<any>[];
    readonly offertenTableConfig = { ...BETRIEB_OFFERTEN_TABLE_CONFIG };
    readonly vertraegeTableConfig = { ...BETRIEB_VERTRAEGE_TABLE_CONFIG };
    readonly offertenTableData = computed(() => (this.offerten() as any[]) || []);
    readonly vertraegeTableData = computed(() => (this.vertraege() as any[]) || []);

    constructor() {
        // Initialize column definitions with actions
        this.offertenColumnDefs = this.initializeOffertenColumns();
        this.vertraegeColumnDefs = this.initializeVertraegeColumns();

        // Use effect to react to error changes
        effect(() => {
            const error = this.error();
            if (error) {
                this.messageService.showError(error);
            }
        });

        // Effect to check for existing Vertragsverlängerung offerten when vertraege data changes
        effect(() => {
            const vertraege = this.vertraege();
            if (vertraege && vertraege.length > 0) {
                this.checkVertraegeForVerlaengerung(vertraege);
            }
        });
    }

    /**
     * Initialize offerten column definitions with action menu and reactive code resolvers
     */
    private initializeOffertenColumns(): ColumnDefinition<any>[] {
        const columns = [...BETRIEB_OFFERTEN_COLUMN_DEFS];

        const betriebColumn = columns.find((col) => col.field === 'betrieb');
        if (betriebColumn) {
            betriebColumn.transform = (rowData: Offerte) => this.getBetriebDisplayName(rowData);
        }

        const userColumn = columns.find((col) => col.field === 'updatedby');
        if (userColumn) {
            userColumn.field = 'updatedby';
            userColumn.transform = (rowData: Offerte) => rowData.updatedby || '';
        }

        // Add async transform for code table fields using reactive approach
        const statusColumn = columns.find((col) => col.field === 'status');
        if (statusColumn) {
            statusColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.status || '');
            statusColumn.async = true;
        }

        const artColumn = columns.find((col) => col.field === 'art');
        if (artColumn) {
            artColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.art || '');
            artColumn.async = true;
        }

        const stellungColumn = columns.find((col) => col.field === 'stellung_im_betrieb');
        if (stellungColumn) {
            stellungColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.stellung_im_betrieb || '');
            stellungColumn.async = true;
        }

        const beschaeftGradColumn = columns.find((col) => col.field === 'beschaeft_grad');
        if (beschaeftGradColumn) {
            beschaeftGradColumn.transform = (rowData: Offerte) => this.codesService.resolveCode(rowData.beschaeft_grad || '');
            beschaeftGradColumn.async = true;
        }

        // Add action menu
        const actionsColumn = columns.find((col) => col.type === 'actions');

        if (actionsColumn) {
            const permissions = this.permissionService.getPermissions('fuv_offerte', 'offerte');
            const actions: any[] = [];

            // View action - requires Read permission
            if (permissions.canRead) {
                actions.push({
                    label: 'common.actions.view',
                    icon: 'pi pi-eye',
                    command: (offerte: Offerte) => {
                        this.viewOfferte(offerte);
                    }
                });
            }

            // Edit action - requires Update permission and offerte must not be rejected or concluded
            if (permissions.canUpdate) {
                actions.push({
                    label: 'common.actions.edit',
                    icon: 'pi pi-pencil',
                    command: (offerte: Offerte) => {
                        this.editOfferte(offerte);
                    },
                    // Disable edit for rejected or concluded offerten
                    disabled: (offerte: Offerte) => offerte.status === OFFERTE_STATUS_REJECTED || offerte.status === OFFERTE_STATUS_ABSCHLUSS
                });
            }

            // Delete action - requires Delete permission and offerte must not be concluded
            if (permissions.canDelete) {
                actions.push({
                    label: 'common.actions.delete',
                    icon: 'pi pi-trash',
                    command: (offerte: Offerte) => {
                        // Check if already deleting
                        if (offerte.id && this.deletingOffertenIds.has(offerte.id)) {
                            this.messageService.showInfo('Diese Offerte wird bereits gelöscht');
                            return;
                        }

                        this.deleteOfferte(offerte);
                    },
                    // Disable delete for concluded offerten
                    disabled: (offerte: Offerte) => offerte.status === OFFERTE_STATUS_ABSCHLUSS
                });
            }

            // Checkliste erfassen action - requires Create permission and offerte must not be rejected or concluded
            if (permissions.canCreate) {
                actions.push({
                    label: 'Checkliste erfassen',
                    icon: 'pi pi-list',
                    command: (offerte: Offerte) => {
                        this.openChecklisteModal(offerte);
                    },
                    // Disable checkliste for rejected or concluded offerten
                    disabled: (offerte: Offerte) => offerte.status === OFFERTE_STATUS_REJECTED || offerte.status === OFFERTE_STATUS_ABSCHLUSS
                });
            }

            actionsColumn.actions = actions;
        }

        return columns;
    }

    /**
     * Initialize verträge column definitions with action menu
     */
    private initializeVertraegeColumns(): ColumnDefinition<any>[] {
        const columns = [...BETRIEB_VERTRAEGE_COLUMN_DEFS];

        const betriebColumn = columns.find((col) => col.field === 'betrieb');
        if (betriebColumn) {
            betriebColumn.transform = (rowData: Vertrag) => this.getBetriebDisplayName(rowData);
        }

        // Add action menu
        const actionsColumn = columns.find((col) => col.type === 'actions');

        if (actionsColumn) {
            const permissions = this.permissionService.getPermissions('fuv_offerte', 'offerte');
            const actions: any[] = [];

            // Offerte erfassen - requires Create permission
            if (permissions.canCreate) {
                actions.push({
                    label: 'Vertragsverlängerung erfassen',
                    icon: 'pi pi-file',
                    command: (vertrag: Vertrag) => {
                        this.createOfferteFromVertrag(vertrag);
                    },
                    // Disable if there's already an offerte for this vertrag (checked via API)
                    disabled: (vertrag: Vertrag) => {
                        // Get all vertrag_boid values from this vertrag's produkts
                        const vertragBoids = vertrag.produkt?.map((p) => p.vertrag_boid).filter((boid): boid is string => !!boid) || [];
                        if (vertragBoids.length === 0) {
                            return false; // No produkt boids, allow action
                        }
                        // Check cache first - if any of the vertrag BOIDs has a Verlängerung, disable
                        return vertragBoids.some((boid) => this.vertraegeWithVerlaengerungMap.get(boid) === true);
                    }
                });
            }

            // Checkliste erfassen - requires Create permission
            if (permissions.canCreate) {
                actions.push({
                    label: 'Checkliste erfassen',
                    icon: 'pi pi-list',
                    command: (vertrag: Vertrag) => {
                        this.openChecklisteModalFromVertrag(vertrag);
                    }
                });
            }

            actionsColumn.actions = actions;
        }

        return columns;
    }

    ngOnInit(): void {
        // Load permissions
        this.permissionService.loadPermissions().subscribe({
            next: () => {
                this.logger.debug('Permissions loaded successfully');
                // Reinitialize column definitions now that permissions are loaded
                this.offertenColumnDefs = this.initializeOffertenColumns();
                this.vertraegeColumnDefs = this.initializeVertraegeColumns();
            },
            error: (error) => {
                this.logger.error('Failed to load permissions', { error });
            }
        });

        this.route.paramMap
            .pipe(
                takeUntil(this.destroy$),
                map((params) => params.get('partnernr')),
                tap((partnernr) => {
                    if (!partnernr) {
                        this.logger.warn('Missing betrieb partnernr in route params');
                        this.messageService.showError('Could not load Betrieb.');
                    }
                }),
                filter((partnernr): partnernr is string => !!partnernr),
                distinctUntilChanged(),
                tap((partnernr) => {
                    // Load betrieb detail data via service
                    this.betriebService.loadBetriebDetail(partnernr);
                })
            )
            .subscribe();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onBack(): void {
        this.router.navigate(['fuv', 'search', 'betrieb']);
    }

    /**
     * Opens the offerte in police component (row click handler)
     */
    openOfferte(event: Record<string, unknown>): void {
        const offerte = event as Offerte;

        if (!offerte?.offertenr) {
            this.logger.warn('Missing offertenr for offerte selection');
            return;
        }
        const viewMode = this.shouldOpenInReadOnlyMode(offerte);
        this.prepareOfferteNavigation(offerte, viewMode);
        this.navigateToPolice(offerte, viewMode);
    }

    /**
     * Check if user can create a new offerte
     */
    canCreateOfferte(): boolean {
        return this.permissionService.canCreate('fuv_offerte', 'offerte');
    }

    createOfferte(): void {
        // Get the current betrieb value directly from the signal
        const betrieb = this.betrieb();
        if (betrieb) {
            // Clear any existing 'new' offerte from the store to ensure a fresh start
            this.offerteStore.deleteOfferte('new');

            this.router.navigate(['fuv', 'offerte', 'police', 'new'], {
                state: {
                    selectedBetrieb: betrieb,
                    previousUrl: this.router.url
                }
            });
        }
    }

    /**
     * View offerte - Navigate to police component (read-only mode)
     */
    private viewOfferte(offerte: Offerte): void {
        if (!offerte?.offertenr) {
            return;
        }

        this.prepareOfferteNavigation(offerte, true);
        this.navigateToPolice(offerte, true);
    }

    /**
     * Edit offerte - Navigate to police component with existing offerte
     */
    private editOfferte(offerte: Offerte): void {
        this.logger.debug('Editing offerte', { offertenr: offerte.offertenr });
        if (!offerte?.offertenr) {
            return;
        }

        this.prepareOfferteNavigation(offerte, false);
        this.navigateToPolice(offerte, false);
    }

    private prepareOfferteNavigation(offerte: Offerte, viewMode: boolean): void {
        const offertenr = offerte.offertenr;
        if (!offertenr) {
            return;
        }

        this.offerteStore.setOfferte(offertenr, offerte);
        this.offerteStore.setKey(offertenr);
        this.offerteStore.setReadOnly(offertenr, viewMode);
        this.offerteStore.setPreviousUrl(this.router.url);
    }

    private navigateToPolice(offerte: Offerte, viewMode: boolean): void {
        if (!offerte.offertenr) {
            return;
        }

        this.router.navigate(['fuv', 'offerte', 'police', offerte.offertenr], {
            state: {
                previousUrl: this.router.url,
                viewMode,
                offerteData: offerte
            }
        });
    }

    private shouldOpenInReadOnlyMode(offerte: Offerte): boolean {
        const permissions = this.permissionService.getPermissions('fuv_offerte', 'offerte');
        const isRejectedOrConcluded = offerte.status === OFFERTE_STATUS_REJECTED || offerte.status === OFFERTE_STATUS_ABSCHLUSS;
        return !(permissions.canUpdate && !isRejectedOrConcluded);
    }

    /**
     * Delete offerte with confirmation dialog
     */
    private deleteOfferte(offerte: Offerte): void {
        if (!offerte.id) {
            this.messageService.showError('Offerte ID fehlt - Löschen nicht möglich');
            return;
        }

        // Check if already deleting
        if (this.deletingOffertenIds.has(offerte.id)) {
            this.logger.debug('Offerte is already being deleted, ignoring duplicate request');
            return;
        }

        // Show confirmation dialog
        this.confirmationService.confirm({
            message: `Soll die Offerte ${offerte.offertenr} wirklich gelöscht werden?`,
            header: 'Offerte löschen',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Ja',
            rejectLabel: 'Nein',
            acceptButtonStyleClass: 'p-button-danger',
            rejectButtonStyleClass: 'p-button-text',
            accept: () => {
                // User confirmed - proceed with deletion
                this.performDelete(offerte);
            }
        });
    }

    /**
     * Perform the actual deletion after confirmation
     */
    private performDelete(offerte: Offerte): void {
        const offerteId = offerte.id!;

        // Mark as deleting
        this.deletingOffertenIds.add(offerteId);
        this.logger.debug('Started deleting offerte, marked as loading', { offerteId });

        // Show immediate feedback toast
        this.messageService.showInfo(`Offerte ${offerte.offertenr} wird gelöscht...`);

        // Trigger change detection to update the UI
        this.cdr.detectChanges();

        this.offerteService.deleteOfferte(offerteId.toString()).subscribe({
            next: () => {
                this.logger.debug('Offerte deleted successfully:', offerte.offertenr);
                this.messageService.showSuccess(`Offerte ${offerte.offertenr} wurde gelöscht`);

                // Remove from deleting set
                this.deletingOffertenIds.delete(offerteId);

                // Remove from store instead of reloading all data
                this.betriebStore.removeOfferte(offerteId);
            },
            error: (error: any) => {
                this.logger.error('Failed to delete offerte:', error);
                this.messageService.showError(`Fehler beim Löschen der Offerte: ${error.message || 'Unbekannter Fehler'}`);

                // Remove from deleting set on error
                this.deletingOffertenIds.delete(offerteId);
                this.cdr.detectChanges();
            }
        });
    }

    /**
     * Opens CRM for the current betrieb
     */
    onOpenCrm(betrieb: Betrieb): void {
        if (betrieb.partnernr) {
            this.externalService.openCrm(betrieb.partnernr);
        }
    }

    /**
     * Opens SYRIUS for the current betrieb
     */
    onOpenSyrius(betrieb: Betrieb): void {
        if (betrieb.partnernr) {
            this.externalService.openSyrius(betrieb.partnernr);
        }
    }

    /**
     * Opens eDossier (IDMS) for the current betrieb
     */
    onOpenIdms(betrieb: Betrieb): void {
        if (betrieb.partnernr) {
            this.externalService.openIdms(betrieb.partnernr);
        }
    }

    /**
     * Opens CRIF for the current betrieb
     */
    onOpenCrif(betrieb: Betrieb): void {
        this.externalService.openCrifBetrieb(betrieb);
    }

    /**
     * Opens documents (IDMS/eDossier) for the current betrieb
     */
    onOpenDocuments(betrieb: Betrieb): void {
        if (betrieb.partnernr) {
            this.externalService.openIdms(betrieb.partnernr);
        }
    }

    /**
     * Open checkliste modal for an offerte
     */
    private openChecklisteModal(offerte: Offerte): void {
        this.checklisteModalService.openForOfferte(offerte);
    }

    /**
     * Open checkliste modal for a vertrag
     */
    private openChecklisteModalFromVertrag(vertrag: Vertrag): void {
        try {
            this.checklisteModalService.openForVertrag(vertrag);
        } catch (error) {
            this.logger.error('Failed to open checkliste for vertrag', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Fehler',
                detail: 'Checkliste konnte nicht geöffnet werden',
                life: 3000
            });
        }
    }

    /**
     * Check all verträge for existing Vertragsverlängerung offerten using API
     * Updates vertraegeWithVerlaengerungMap cache for use in menu disabled logic
     */
    private checkVertraegeForVerlaengerung(vertraege: Vertrag[]): void {
        // Extract all unique vertrag_boids from all produkts
        const vertragBoids = new Set<string>();
        vertraege.forEach((vertrag) => {
            vertrag.produkt?.forEach((produkt) => {
                if (produkt.vertrag_boid) {
                    vertragBoids.add(produkt.vertrag_boid);
                }
            });
        });

        // For each vertrag_boid, check if there's an offerte with that vertrag_boid
        vertragBoids.forEach((boid) => {
            // Only check if not already in cache
            if (!this.vertraegeWithVerlaengerungMap.has(boid)) {
                this.offerteService.searchOfferten({ vertrag_boid: boid }).subscribe({
                    next: (offerten) => {
                        // If we find any offerten with this vertrag_boid, mark it as having a Verlängerung
                        this.vertraegeWithVerlaengerungMap.set(boid, offerten.length > 0);
                        this.logger.debug('Checked vertrag_boid for Verlängerung', {
                            boid,
                            hasVerlaengerung: offerten.length > 0,
                            offertenCount: offerten.length
                        });
                    },
                    error: (error) => {
                        this.logger.error('Error checking for Vertragsverlängerung', { boid, error });
                        // On error, assume false (allow action)
                        this.vertraegeWithVerlaengerungMap.set(boid, false);
                    }
                });
            }
        });
    }

    /**
     * Create a new offerte from an existing vertrag (Verlängerung)
     * Maps vertrag data directly (no API call needed since we already have the data)
     */
    private createOfferteFromVertrag(vertrag: Vertrag): void {
        if (!vertrag.vertragsnr) {
            this.messageService.showError('Vertragsnummer fehlt');
            return;
        }

        // Create and persist complete Verlängerung offerte
        // This will: map data, load BB/Checkliste, refresh person/betrieb, insert and update offerte
        this.offerteService.createAndPersistVerlaengerung(vertrag).subscribe({
            next: (createdOfferte) => {
                this.logger.debug('Verlängerung offerte created and persisted', createdOfferte);

                // Navigate to police component with the created offerte number (offertenr)
                // Pass the complete offerte data in state to avoid re-fetching from backend
                this.router.navigate(['fuv', 'offerte', 'police', createdOfferte.offertenr], {
                    state: {
                        previousUrl: this.router.url,
                        fromVertrag: true,
                        offerteData: createdOfferte // Pass complete offerte data including taetigkeit
                    }
                });
            },
            error: (error) => {
                this.logger.error('Failed to create Verlängerung offerte', error);
                this.messageService.showError('Fehler beim Erstellen der Vertragsverlängerung');
            }
        });
    }

    protected getBetriebNameForDisplay(betrieb?: Betrieb | null): string {
        if (!betrieb) {
            return '';
        }

        const combined = this.combineNameParts(betrieb.name1, betrieb.name2);
        if (combined) {
            return combined;
        }

        return betrieb.nl_name1?.trim() || '';
    }

    private getBetriebDisplayName(rowData: { betrieb?: Betrieb | null; betriebName?: string | null }): string {
        const formatted = this.getBetriebNameForDisplay(rowData.betrieb);
        if (formatted) {
            return formatted;
        }

        return '';
    }

    private combineNameParts(name1?: string | null, name2?: string | null): string {
        const parts = [name1, name2].map((part) => part?.trim()).filter((part): part is string => !!part);
        return parts.join(' ');
    }
}
