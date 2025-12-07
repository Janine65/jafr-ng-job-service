import { computed } from '@angular/core';
import { Betrieb } from '@app/fuv/models/betrieb.model';
import { Offerte } from '@app/fuv/models/offerte.model';
import { Vertrag } from '@app/fuv/models/vertrag.model';
import {
    patchState, signalStore, withComputed, withHooks, withMethods, withState
} from '@ngrx/signals';

/**
 * Betrieb detail state
 */
export interface BetriebState {
    selectedPartnerNr: string | null;
    data: Betrieb | null;
    offerten: Offerte[];
    vertraege: Vertrag[];
    loadingBetrieb: boolean;
    loadingRelations: boolean;
    error: string | null;
}

/**
 * Initial state
 */
const initialState: BetriebState = {
    selectedPartnerNr: null,
    data: null,
    offerten: [],
    vertraege: [],
    loadingBetrieb: false,
    loadingRelations: false,
    error: null
};

/**
 * Betrieb Store using NgRx SignalStore
 */
export const BetriebStore = signalStore(
    { providedIn: 'root' },

    // State definition
    withState(initialState),

    // Computed values
    withComputed((store) => ({
        /**
         * Check if betrieb is loaded
         */
        hasBetriebData: computed(() => store.data() !== null),

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
        isLoading: computed(() => store.loadingBetrieb() || store.loadingRelations()),

        /**
         * Check if there's an error
         */
        hasError: computed(() => store.error() !== null)
    })),

    // Methods
    withMethods((store) => ({
        /**
         * Set selected betrieb partner number
         */
        setSelectedBetrieb(partnerNr: string | null): void {
            patchState(store, { selectedPartnerNr: partnerNr });
        },

        /**
         * Set betrieb data
         */
        setBetriebData(betrieb: Betrieb | null): void {
            patchState(store, {
                data: betrieb,
                loadingBetrieb: false,
                error: null
            });
        },

        /**
         * Set betrieb offerten
         */
        setBetriebOfferten(offerten: Offerte[]): void {
            patchState(store, {
                offerten,
                loadingRelations: false
            });
        },

        /**
         * Set betrieb vertraege
         */
        setBetriebVertraege(vertraege: Vertrag[]): void {
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
         * Set betrieb loading state
         */
        setBetriebLoading(loading: boolean): void {
            patchState(store, { loadingBetrieb: loading });
        },

        /**
         * Set betrieb relations loading state
         */
        setBetriebRelationsLoading(loading: boolean): void {
            patchState(store, { loadingRelations: loading });
        },

        /**
         * Set betrieb error
         */
        setBetriebError(error: string | null): void {
            patchState(store, {
                error,
                loadingBetrieb: false,
                loadingRelations: false
            });
        },

        /**
         * Clear betrieb state
         */
        clearBetrieb(): void {
            patchState(store, initialState);
        }
    })),

    // Lifecycle hooks
    withHooks({
        onInit() {
        }
    })
);
