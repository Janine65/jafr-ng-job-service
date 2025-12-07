import { computed, inject, Signal } from '@angular/core';
import {
    patchState, signalStore, withComputed, withHooks, withMethods, withState
} from '@ngrx/signals';

import {
    OFFERTE_STATUS_BEARBEITUNG, OFFERTE_STATUS_NEU, OFFERTE_STATUS_SIGNED_ELECTRONICALLY,
    OFFERTE_STATUS_SIGNED_PHYSICALLY
} from '../components/offerte-police/police.constants';
import { Offerte, OfferteMetaData, OfferteUtils } from '../models/offerte.model';
import {
    OfferteCodeGruppen, OfferteCodeHelper, OfferteDateHelper
} from '../utils/offerte-field-helpers';

/**
 * Combined offerte data with metadata
 */
interface OfferteWithMeta {
    data: Offerte;
    meta: OfferteMetaData;
    original: Offerte; // For change detection
}

/**
 * State structure for typed offerte store
 * Supports multiple offerten with individual metadata tracking
 */
interface OfferteTypedState {
    /**
     * Map of offerten by key (typically offertenr)
     */
    offerten: Record<string, OfferteWithMeta>;

    /**
     * ly active offerte key
     */
    currentKey: string | null;

    /**
     * Previous URL for navigation back
     */
    previousUrl: string | null;
}

/**
 * Initial state
 */
const initialState: OfferteTypedState = {
    offerten: {},
    currentKey: null,
    previousUrl: null
};

/**
 * Session storage key
 */
const STORAGE_KEY = 'offerte_typed_state_v1';

/**
 * Load state from sessionStorage
 */
function loadFromStorage(): OfferteTypedState {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as OfferteTypedState;

            // Reconstruct Set objects for modifiedFields
            Object.keys(parsed.offerten).forEach((key) => {
                const offerte = parsed.offerten[key];
                if (offerte.meta.modifiedFields && Array.isArray(offerte.meta.modifiedFields)) {
                    offerte.meta.modifiedFields = new Set(offerte.meta.modifiedFields);
                }
            });

            return {
                offerten: parsed.offerten || {},
                currentKey: parsed.currentKey || null,
                previousUrl: parsed.previousUrl || null
            };
        }
    } catch (error) {
        console.error('[OfferteTypedStore] Failed to load from storage:', error);
    }
    return initialState;
}

/**
 * Save state to sessionStorage
 */
function saveToStorage(state: OfferteTypedState): void {
    try {
        // Convert Set objects to arrays for serialization
        const serializable = {
            ...state,
            offerten: Object.keys(state.offerten).reduce(
                (acc, key) => {
                    const offerte = state.offerten[key];
                    acc[key] = {
                        ...offerte,
                        meta: {
                            ...offerte.meta,
                            modifiedFields: offerte.meta.modifiedFields ? Array.from(offerte.meta.modifiedFields) : []
                        }
                    };
                    return acc;
                },
                {} as Record<string, any>
            )
        };

        const serialized = JSON.stringify(serializable);
        const sizeInKB = (serialized.length / 1024).toFixed(2);
        console.log(`[OfferteTypedStore] Saving to sessionStorage (${sizeInKB} KB)`);
        sessionStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
        console.error('[OfferteTypedStore] Failed to save to storage:', error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.error('[OfferteTypedStore] SessionStorage quota exceeded!');
        }
    }
}

/**
 * Typed Offerte Store using NgRx SignalStore
 * Provides typed access to complete offerte structure with metadata tracking
 */
export const OfferteTypedStore = signalStore(
    { providedIn: 'root' },

    // State definition
    withState(loadFromStorage()),

    // Computed values
    withComputed((store) => ({
        /**
         * Get the current offerte data
         */
        currentOfferte: computed(() => {
            const key = store.currentKey();
            if (!key) return null;
            return store.offerten()[key]?.data || null;
        }),

        /**
         * Get the current offerte metadata
         */
        currentMeta: computed(() => {
            const key = store.currentKey();
            if (!key) return null;
            return store.offerten()[key]?.meta || null;
        }),

        /**
         * Check if current offerte is modified
         */
        isModified: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            return store.offerten()[key]?.meta.isModified || false;
        }),

        /**
         * Check if current offerte is valid
         */
        isValid: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            return store.offerten()[key]?.meta.isValid !== false;
        }),

        /**
         * Check if current offerte is loading
         */
        isLoading: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            return store.offerten()[key]?.meta.isLoading || false;
        }),

        /**
         * Check if current offerte is saving
         */
        isSaving: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            return store.offerten()[key]?.meta.isSaving || false;
        }),

        /**
         * Get all offerte keys
         */
        offerteKeys: computed(() => {
            return Object.keys(store.offerten());
        }),

        /**
         * Get count of offerten
         */
        offertenCount: computed(() => {
            return Object.keys(store.offerten()).length;
        }),

        /**
         * Get all modified offerte keys
         */
        modifiedOfferteKeys: computed(() => {
            return Object.keys(store.offerten()).filter((key) => store.offerten()[key]?.meta.isModified);
        }),

        /**
         * Check if current offerte is a Verlaengerung
         * True when either vertrag_boid is set OR art is 'OfferteArtVerl'
         */
        isVerlaengerung: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            const offerte = store.offerten()[key]?.data;
            if (!offerte) return false;
            return !!offerte.vertrag_boid || offerte.art === 'OfferteArtVerl';
        }),

        /**
         * Check if current offerte is signed (automatically true when both policiert_am AND policiert_durch are set)
         */
        isSigned: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            const offerte = store.offerten()[key]?.data;
            if (!offerte) return false;
            return !!(offerte.policiert_am && offerte.policiert_durch);
        }),

        /**
         * Check if current offerte is signed provisionally
         */
        isSignedProvisionally: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            return store.offerten()[key]?.meta.isSignedProvisionally || false;
        }),

        /**
         * Check if current offerte is persisted
         */
        isPersisted: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            return store.offerten()[key]?.meta.isPersisted || false;
        }),

        /**
         * Check if current offerte is in read-only mode
         * This replaces the old viewMode flag
         */
        isReadOnly: computed(() => {
            const key = store.currentKey();
            if (!key) return false;
            return store.offerten()[key]?.meta.isReadOnly || false;
        })
    })),

    // Methods
    withMethods((store) => {
        const codeHelper = inject(OfferteCodeHelper);

        const sanitizeOfferte = (existing: Offerte, changes: Partial<Offerte>): Offerte => {
            const merged: Offerte = { ...existing, ...changes };
            delete (merged as any).agenturkompetenz;
            delete (merged as any).user;
            delete (merged as any).betriebName;

            if (merged.gueltab) {
                const normalizedGueltab = OfferteDateHelper.toDateOnly(merged.gueltab);
                if (normalizedGueltab) {
                    merged.gueltab = normalizedGueltab;
                    merged.gueltab_date = new Date(`${normalizedGueltab}T00:00:00.000Z`).toISOString();
                } else {
                    merged.gueltab_date = undefined;
                }
            } else {
                merged.gueltab_date = undefined;
            }

            if (merged.gueltbis) {
                const normalizedGueltbis = OfferteDateHelper.toDateOnly(merged.gueltbis);
                if (normalizedGueltbis) {
                    merged.gueltbis = normalizedGueltbis;
                    merged.gueltbis_date = new Date(`${normalizedGueltbis}T00:00:00.000Z`).toISOString();
                } else {
                    merged.gueltbis_date = undefined;
                }
            } else {
                merged.gueltbis_date = undefined;
            }

            if (merged.ablaufdatum) {
                const normalized = OfferteDateHelper.toDateOnly(merged.ablaufdatum);
                if (normalized) {
                    merged.ablaufdatum = normalized;
                    merged.ablaufdatum_date = new Date(`${normalized}T00:00:00.000Z`).toISOString();
                } else {
                    merged.ablaufdatum_date = undefined;
                }
            } else {
                merged.ablaufdatum_date = undefined;
            }

            if (merged.avb) {
                merged.avb_text = merged.avb_text || merged.avb;
            } else {
                merged.avb_text = null;
            }

            return merged;
        };

        /**
         * Derive read-only and signed flags directly from offerte data
         * This ensures backend-loaded offres that are already policiert or rejected
         * immediately reflect a locked state in the store metadata.
         */
        const deriveReadOnlyState = (offerte: Offerte, currentMeta?: OfferteMetaData) => {
            const hasSignature = !!(offerte.unterschrieben_am && offerte.unterschrieben_art);
            const isPoliciert = !!(offerte.policiert_am && offerte.policiert_durch);
            const isRejected = !!offerte.ablehnungsgrund;

            const isSigned = !!(currentMeta?.isSigned || isPoliciert || hasSignature);
            const isReadOnly = !!(currentMeta?.isReadOnly || isPoliciert || isRejected || hasSignature);

            return { isSigned, isReadOnly };
        };

        const resolveAvbLabel = (key: string, avb?: string) => {
            if (!avb) return;
            codeHelper
                .getCodeLabel(avb, OfferteCodeGruppen.AVB)
                .then((label: string) => {
                    const currentOfferten = store.offerten();
                    const entry = currentOfferten[key];
                    if (!entry || entry.data.avb !== avb) return;
                    if (entry.data.avb_text === label) return;

                    const patched = {
                        ...currentOfferten,
                        [key]: {
                            ...entry,
                            data: {
                                ...entry.data,
                                avb_text: label
                            }
                        }
                    };

                    patchState(store, { offerten: patched });
                    saveToStorage({
                        offerten: patched,
                        currentKey: store.currentKey(),
                        previousUrl: store.previousUrl()
                    });
                })
                .catch(() => {});
        };

        const setKey = (key: string | null): void => {
            patchState(store, { currentKey: key });
            saveToStorage({
                offerten: store.offerten(),
                currentKey: key,
                previousUrl: store.previousUrl()
            });
        };

        const updateMeta = (key: string | null, changes: Partial<OfferteMetaData>): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const current = store.offerten()[key];

            const updatedOfferten = {
                ...store.offerten(),
                [key]: {
                    ...current,
                    meta: {
                        ...current.meta,
                        ...changes
                    }
                }
            };

            patchState(store, { offerten: updatedOfferten });
            saveToStorage({
                offerten: updatedOfferten,
                currentKey: store.currentKey(),
                previousUrl: store.previousUrl()
            });
        };

        const setReadOnlyFor = (value: boolean): void => {
            const key = store.currentKey();
            if (!key) {
                console.warn('[OfferteTypedStore] Cannot set read-only mode - no current offerte');
                return;
            }
            updateMeta(key, { isReadOnly: value });
        };

        const setPreviousUrl = (previousUrl: string | null): void => {
            patchState(store, { previousUrl });
            saveToStorage({
                offerten: store.offerten(),
                currentKey: store.currentKey(),
                previousUrl
            });
        };

        const getOfferte = (key: string): Offerte | null => store.offerten()[key]?.data || null;
        const getMeta = (key: string): OfferteMetaData | null => store.offerten()[key]?.meta || null;

        const setOfferte = (key: string, offerte: Offerte, setAs = true): void => {
            const sanitized = sanitizeOfferte({} as Offerte, offerte);
            const original = OfferteUtils.deepCopy(sanitized);
            const derivedState = deriveReadOnlyState(sanitized);
            const updatedOfferten = {
                ...store.offerten(),
                [key]: {
                    data: sanitized,
                    original,
                    meta: {
                        isModified: false,
                        isSigned: derivedState.isSigned,
                        isPersisted: false,
                        isSignedProvisionally: false,
                        isVerlaengerung: false,
                        isValid: true,
                        isReadOnly: derivedState.isReadOnly,
                        isLoading: false,
                        isSaving: false,
                        modifiedFields: new Set<string>(),
                        lastModified: new Date().toISOString(),
                        validationErrors: {},
                        lastSyncedAt: new Date().toISOString()
                    }
                }
            };

            patchState(store, {
                offerten: updatedOfferten,
                currentKey: setAs ? key : store.currentKey()
            });

            saveToStorage({
                offerten: updatedOfferten,
                currentKey: setAs ? key : store.currentKey(),
                previousUrl: store.previousUrl()
            });

            resolveAvbLabel(key, sanitized.avb);
        };

        const updateOfferte = (key: string | null, changes: Partial<Offerte>): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const current = store.offerten()[key];

            const fallback: OfferteWithMeta = current || {
                data: {} as Offerte,
                original: {} as Offerte,
                meta: {
                    isModified: false,
                    modifiedFields: new Set<string>(),
                    lastModified: new Date().toISOString(),
                    lastSyncedAt: undefined
                }
            };

            const updated = sanitizeOfferte(fallback.data, changes);
            if (!updated.status) {
                updated.status = OFFERTE_STATUS_NEU;
            }

            const modifiedFields = OfferteUtils.getModifiedFields(fallback.original, updated);
            const isModified = modifiedFields.size > 0;

            const derivedState = deriveReadOnlyState(updated, fallback.meta);

            const updatedOfferten = {
                ...store.offerten(),
                [key]: {
                    ...fallback,
                    data: updated,
                    meta: {
                        ...fallback.meta,
                        isModified,
                        modifiedFields,
                        lastModified: new Date().toISOString(),
                        isSigned: derivedState.isSigned,
                        isReadOnly: derivedState.isReadOnly
                    }
                }
            };

            patchState(store, { offerten: updatedOfferten });
            saveToStorage({
                offerten: updatedOfferten,
                currentKey: store.currentKey(),
                previousUrl: store.previousUrl()
            });

            resolveAvbLabel(key, updated.avb);
        };

        const invalidateSignature = (): void => {
            const key = store.currentKey();
            if (!key) return;
            const current = store.offerten()[key];
            if (!current) return;

            const data = { ...current.data };
            if (data.status === OFFERTE_STATUS_SIGNED_ELECTRONICALLY || data.status === OFFERTE_STATUS_SIGNED_PHYSICALLY) {
                data.status = OFFERTE_STATUS_BEARBEITUNG;
            }
            data.unterschrieben_art = undefined;
            data.unterschrieben_am = undefined;

            const updatedOfferten = {
                ...store.offerten(),
                [key]: {
                    ...current,
                    data,
                    meta: {
                        ...current.meta,
                        isSignedProvisionally: false,
                        abschluss: undefined
                    }
                }
            };

            patchState(store, { offerten: updatedOfferten });
            saveToStorage({
                offerten: updatedOfferten,
                currentKey: store.currentKey(),
                previousUrl: store.previousUrl()
            });
        };

        const setVerlaengerung = (key: string | null = null): void => {
            updateOfferte(key, { art: 'OfferteArtVerl' });
        };

        const updateNestedStructure = <K extends keyof Offerte>(key: string | null, structureName: K, changes: Partial<Offerte[K]>): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const current = store.offerten()[key];

            const currentStructure = current.data[structureName];
            const updated = {
                ...current.data,
                [structureName]: {
                    ...(currentStructure as any),
                    ...changes
                }
            };

            const modifiedFields = OfferteUtils.getModifiedFields(current.original, updated);
            const isModified = modifiedFields.size > 0;

            const updatedOfferten = {
                ...store.offerten(),
                [key]: {
                    ...current,
                    data: updated,
                    meta: {
                        ...current.meta,
                        isModified,
                        modifiedFields,
                        lastModified: new Date().toISOString()
                    }
                }
            };

            patchState(store, { offerten: updatedOfferten });
            saveToStorage({
                offerten: updatedOfferten,
                currentKey: store.currentKey(),
                previousUrl: store.previousUrl()
            });
        };

        const resetOfferte = (key: string | null): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const current = store.offerten()[key];

            const updatedOfferten = {
                ...store.offerten(),
                [key]: {
                    ...current,
                    data: OfferteUtils.deepCopy(current.original),
                    meta: {
                        ...current.meta,
                        isModified: false,
                        modifiedFields: new Set<string>(),
                        lastModified: new Date().toISOString()
                    }
                }
            };

            patchState(store, { offerten: updatedOfferten });
            saveToStorage({
                offerten: updatedOfferten,
                currentKey: store.currentKey(),
                previousUrl: store.previousUrl()
            });
        };

        const markAsSynced = (key: string | null): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const current = store.offerten()[key];
            const updatedOfferten = {
                ...store.offerten(),
                [key]: {
                    ...current,
                    original: OfferteUtils.deepCopy(current.data),
                    meta: {
                        ...current.meta,
                        isModified: false,
                        modifiedFields: new Set<string>(),
                        lastSyncedAt: new Date().toISOString(),
                        syncError: null
                    }
                }
            };

            patchState(store, { offerten: updatedOfferten });
            saveToStorage({
                offerten: updatedOfferten,
                currentKey: store.currentKey(),
                previousUrl: store.previousUrl()
            });
        };

        const deleteOfferte = (key: string | null): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }

            const updatedOfferten = { ...store.offerten() };
            delete updatedOfferten[key];

            const newKey = store.currentKey() === key ? null : store.currentKey();

            patchState(store, {
                offerten: updatedOfferten,
                currentKey: newKey
            });

            saveToStorage({
                offerten: updatedOfferten,
                currentKey: newKey,
                previousUrl: store.previousUrl()
            });
        };

        const clearAll = (): void => {
            patchState(store, initialState);
            saveToStorage(initialState);
        };

        const clearPersistedState = (): void => {
            try {
                sessionStorage.removeItem(STORAGE_KEY);
            } catch (error) {
                console.error('[OfferteTypedStore] Failed to clear persisted state:', error);
            }
        };

        const getAllOfferten = (): Offerte[] => Object.values(store.offerten()).map((item) => item.data);
        const hasOfferte = (key: string): boolean => !!store.offerten()[key];

        const getModifiedFields = (key: string | null): Set<string> => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            return store.offerten()[key]?.meta.modifiedFields || new Set();
        };

        const isVerlaengerungFn = (key: string | null): boolean => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const offerte = store.offerten()[key]?.data;
            if (!offerte) return false;
            return !!offerte.vertrag_boid;
        };

        const isSignedFn = (key: string | null): boolean => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const offerte = store.offerten()[key]?.data;
            if (!offerte) return false;
            return !!(offerte.policiert_am && offerte.policiert_durch);
        };

        const isReadOnlyFn = (key: string | null): boolean => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            return store.offerten()[key]?.meta.isReadOnly || false;
        };

        const setReadOnly = (key: string | null, value: boolean): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            updateMeta(key, { isReadOnly: value });
        };

        const isSignedProvisionallyFn = (key: string): boolean => store.offerten()[key]?.meta.isSignedProvisionally || false;

        const setSignedProvisionally = (key: string | null, value: boolean): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            updateMeta(key, { isSignedProvisionally: value });
        };

        const isPersistedFn = (key: string | null): boolean => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            return store.offerten()[key]?.meta.isPersisted || false;
        };

        const setPersisted = (key: string | null, value: boolean): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            updateMeta(key, { isPersisted: value });
        };

        const updateOfferteProtected = (key: string | null, changes: Partial<Offerte>): void => {
            if (!key) {
                key = store.currentKey() || 'new';
            }
            const current = store.offerten()[key];

            const isSigned = !!(current.data.policiert_am && current.data.policiert_durch);
            if (isSigned) {
                if ('policiert_am' in changes || 'policiert_durch' in changes) {
                    console.warn('[OfferteTypedStore] Cannot overwrite policiert_am or policiert_durch - offerte is signed');
                    const { policiert_am, policiert_durch, ...rest } = changes;
                    changes = rest;
                }
            }

            const isVerlaengerung = !!current.data.vertrag_boid;
            if (isVerlaengerung) {
                if ('vertrag_boid' in changes) {
                    console.warn('[OfferteTypedStore] Cannot overwrite vertrag_boid - offerte is a Verlaengerung');
                    const { vertrag_boid, ...rest } = changes;
                    changes = rest;
                }
            }

            if (Object.keys(changes).length === 0) {
                console.log('[OfferteTypedStore] No changes to apply after protection checks');
                return;
            }

            updateOfferte(key, changes);
        };

        return {
            setKey,
            setReadOnlyFor,
            setPreviousUrl,
            getOfferte,
            getMeta,
            setOfferte,
            updateOfferte,
            updateMeta,
            invalidateSignature,
            setVerlaengerung,
            updateNestedStructure,
            resetOfferte,
            markAsSynced,
            deleteOfferte,
            clearAll,
            clearPersistedState,
            getAllOfferten,
            hasOfferte,
            getModifiedFields,
            isVerlaengerung: isVerlaengerungFn,
            isSigned: isSignedFn,
            isReadOnly: isReadOnlyFn,
            setReadOnly,
            isSignedProvisionally: isSignedProvisionallyFn,
            setSignedProvisionally,
            isPersisted: isPersistedFn,
            setPersisted,
            updateOfferteProtected
        };
    }),

    // Lifecycle hooks
    withHooks({
        onInit() {
            console.log('[OfferteTypedStore] Initialized');
        },
        onDestroy() {
            console.log('[OfferteTypedStore] Destroyed');
        }
    })
);
