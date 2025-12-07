import { Observable } from 'rxjs';

import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
    AntragsfragenData
} from '@app/fuv/components/offerte-police/antragsfragen/antragsfragen.model';
import { Betrieb } from '@app/fuv/models/betrieb.model';
import { Offerte } from '@app/fuv/models/offerte.model';
import { Person } from '@app/fuv/models/person.model';
import { AbschlussData } from '@app/fuv/models/police.abschluss.model';
import { NachbearbeitungData } from '@app/fuv/models/police.nachbearbeitung.model';
import { TaetigkeitData } from '@app/fuv/models/taetigkeit.model';
import { VariantenData } from '@app/fuv/models/varianten.model';
import * as PoliceCreationActions from '@app/fuv/state/police-creation.actions';
import * as PoliceCreationSelectors from '@app/fuv/state/police-creation.selectors';
import { Store } from '@ngrx/store';

/**
 * Police Service
 *
 * Manages the state for the FUV Police Offerte creation wizard.
 * This service provides methods to:
 * - Initialize new offerte creation
 * - Update data for each step
 * - Navigate between steps
 * - Save the offerte
 * - Access current state through observables
 */
@Injectable({
    providedIn: 'root'
})
export class PoliceService {
    private store = inject(Store);
    private router = inject(Router);

    // State observables
    currentOfferte$: Observable<Offerte | null> = this.store.select(PoliceCreationSelectors.selectCurrentOfferte);
    activeStepIndex$: Observable<number> = this.store.select(PoliceCreationSelectors.selectActiveStepIndex);
    completedSteps$: Observable<number[]> = this.store.select(PoliceCreationSelectors.selectCompletedSteps);
    isDirty$: Observable<boolean> = this.store.select(PoliceCreationSelectors.selectIsDirty);
    isSaving$: Observable<boolean> = this.store.select(PoliceCreationSelectors.selectIsSaving);
    saveError$: Observable<string | null> = this.store.select(PoliceCreationSelectors.selectSaveError);
    hasUnsavedChanges$: Observable<boolean> = this.store.select(PoliceCreationSelectors.selectHasUnsavedChanges);
    offerteProgress$: Observable<number> = this.store.select(PoliceCreationSelectors.selectOfferteProgress);

    // Step data observables
    personData$: Observable<Person | null> = this.store.select(PoliceCreationSelectors.selectPersonData);
    betriebData$: Observable<Betrieb | null> = this.store.select(PoliceCreationSelectors.selectBetriebData);
    taetigkeitData$: Observable<TaetigkeitData | null> = this.store.select(PoliceCreationSelectors.selectTaetigkeitData);
    variantenData$: Observable<VariantenData | null> = this.store.select(PoliceCreationSelectors.selectVariantenData);
    antragsfragenData$: Observable<AntragsfragenData | null> = this.store.select(PoliceCreationSelectors.selectAntragsfragenData);
    abschlussData$: Observable<AbschlussData | null> = this.store.select(PoliceCreationSelectors.selectAbschlussData);
    nachbearbeitungData$: Observable<NachbearbeitungData | null> = this.store.select(PoliceCreationSelectors.selectNachbearbeitungData);

    /**
     * Initialize a new offerte creation process
     * @param person Optional person to pre-fill step 0
     * @param betrieb Optional betrieb to pre-fill step 1
     */
    initializeNewOfferte(person?: Person, betrieb?: Betrieb): void {
        this.store.dispatch(PoliceCreationActions.initializeNewOfferte({ person, betrieb }));
    }

    /**
     * Load an existing offerte for editing
     * @param offertenr The offerte number to load
     */
    loadOfferteForEditing(offertenr: string): void {
        this.store.dispatch(PoliceCreationActions.loadOfferteForEditing({ offertenr }));
    }

    /**
     * Update person data (Step 0)
     */
    updatePersonData(person: Person): void {
        this.store.dispatch(PoliceCreationActions.updatePersonData({ person }));
    }

    /**
     * Update betrieb data (Step 1)
     */
    updateBetriebData(betrieb: Betrieb): void {
        this.store.dispatch(PoliceCreationActions.updateBetriebData({ betrieb }));
    }

    /**
     * Update taetigkeit data (Step 2)
     */
    updateTaetigkeitData(taetigkeit: TaetigkeitData): void {
        this.store.dispatch(PoliceCreationActions.updateTaetigkeitData({ taetigkeit }));
    }

    /**
     * Update varianten data (Step 3)
     */
    updateVariantenData(varianten: VariantenData): void {
        this.store.dispatch(PoliceCreationActions.updateVariantenData({ varianten }));
    }

    /**
     * Update antragsfragen data (Step 4)
     */
    updateAntragsfragenData(antragsfragen: AntragsfragenData): void {
        this.store.dispatch(PoliceCreationActions.updateAntragsfragenData({ antragsfragen }));
    }

    /**
     * Update abschluss data (Step 5)
     */
    updateAbschlussData(abschluss: AbschlussData): void {
        this.store.dispatch(PoliceCreationActions.updateAbschlussData({ abschluss }));
    }

    /**
     * Update nachbearbeitung data (Step 6)
     */
    updateNachbearbeitungData(nachbearbeitung: NachbearbeitungData): void {
        this.store.dispatch(PoliceCreationActions.updateNachbearbeitungData({ nachbearbeitung }));
    }

    /**
     * Set the active step index
     */
    setActiveStep(stepIndex: number): void {
        this.store.dispatch(PoliceCreationActions.setActiveStep({ stepIndex }));
    }

    /**
     * Mark a step as completed
     */
    markStepCompleted(stepIndex: number): void {
        this.store.dispatch(PoliceCreationActions.markStepCompleted({ stepIndex }));
    }

    /**
     * Mark a step as incomplete
     */
    markStepIncomplete(stepIndex: number): void {
        this.store.dispatch(PoliceCreationActions.markStepIncomplete({ stepIndex }));
    }

    /**
     * Save the current offerte
     */
    saveOfferte(): void {
        this.store.dispatch(PoliceCreationActions.saveOfferte());
    }

    /**
     * Reset the police creation state
     */
    reset(): void {
        this.store.dispatch(PoliceCreationActions.resetPoliceCreation());
    }

    /**
     * Clear save error message
     */
    clearSaveError(): void {
        this.store.dispatch(PoliceCreationActions.clearSaveError());
    }

    /**
     * Check if a step is completed
     */
    isStepCompleted(stepIndex: number): Observable<boolean> {
        return this.store.select(PoliceCreationSelectors.selectIsStepCompleted(stepIndex));
    }

    /**
     * Check if can navigate to a step
     */
    canNavigateToStep(stepIndex: number): Observable<boolean> {
        return this.store.select(PoliceCreationSelectors.selectCanNavigateToStep(stepIndex));
    }

    /**
     * Navigate to offerte list and reset state
     */
    navigateToOfferteList(): void {
        this.reset();
        this.router.navigate(['/fuv/offerten']);
    }

    /**
     * Navigate to a specific step
     */
    navigateToStep(stepIndex: number): void {
        this.setActiveStep(stepIndex);
    }
}
