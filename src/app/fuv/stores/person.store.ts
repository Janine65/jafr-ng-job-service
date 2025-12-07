import { computed } from '@angular/core';
import { Offerte } from '@app/fuv/models/offerte.model';
import { Person } from '@app/fuv/models/person.model';
import { Vertrag } from '@app/fuv/models/vertrag.model';
import {
    patchState, signalStore, withComputed, withHooks, withMethods, withState
} from '@ngrx/signals';

/**
 * Person detail state
 */
export interface PersonState {
    selectedPartnerNr: string | null;
    data: Person | null;
    offerten: Offerte[];
    vertraege: Vertrag[];
    loadingPerson: boolean;
    loadingRelations: boolean;
    error: string | null;
}

/**
 * Initial state
 */
const initialState: PersonState = {
    selectedPartnerNr: null,
    data: null,
    offerten: [],
    vertraege: [],
    loadingPerson: false,
    loadingRelations: false,
    error: null
};

/**
 * Person Store using NgRx SignalStore
 */
export const PersonStore = signalStore(
    { providedIn: 'root' },

    // State definition
    withState(initialState),

    // Computed values
    withComputed((store) => ({
        /**
         * Check if person is loaded
         */
        hasPersonData: computed(() => store.data() !== null),

        /**
         * Get total offerten count
         */
        offertenCount: computed(() => store.offerten().length),

        /**
         * Get total vertraege count
         */
        vertraegeCount: computed(() => store.vertraege().length),

        /**
         * Check if any loading is in progress
         */
        isLoading: computed(() => store.loadingPerson() || store.loadingRelations()),

        /**
         * Check if there's an error
         */
        hasError: computed(() => store.error() !== null)
    })),

    // Methods
    withMethods((store) => ({
        /**
         * Set selected person partner number
         */
        setSelectedPerson(partnerNr: string | null): void {
            patchState(store, { selectedPartnerNr: partnerNr });
        },

        /**
         * Set person data
         */
        setPersonData(person: Person | null): void {
            patchState(store, {
                data: person,
                loadingPerson: false,
                error: null
            });
        },

        /**
         * Set person offerten
         */
        setPersonOfferten(offerten: Offerte[]): void {
            patchState(store, {
                offerten,
                loadingRelations: false
            });
        },

        /**
         * Set person vertraege
         */
        setPersonVertraege(vertraege: Vertrag[]): void {
            patchState(store, {
                vertraege,
                loadingRelations: false
            });
        },

        /**
         * Remove an offerte from the list (used after deletion)
         */
        removeOfferte(offerteId: number): void {
            const currentOfferten = store.offerten();
            const updatedOfferten = currentOfferten.filter((o) => o.id !== offerteId);
            patchState(store, { offerten: updatedOfferten });
        },

        /**
         * Set person loading state
         */
        setPersonLoading(loading: boolean): void {
            patchState(store, { loadingPerson: loading });
        },

        /**
         * Set person relations loading state
         */
        setPersonRelationsLoading(loading: boolean): void {
            patchState(store, { loadingRelations: loading });
        },

        /**
         * Set person error
         */
        setPersonError(error: string | null): void {
            patchState(store, {
                error,
                loadingPerson: false,
                loadingRelations: false
            });
        },

        /**
         * Clear person state
         */
        clearPerson(): void {
            patchState(store, initialState);
        }
    })),

    // Lifecycle hooks
    withHooks({
        onInit() {}
    })
);
