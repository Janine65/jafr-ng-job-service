/**
 * Variante structure as returned by the API
 */
export interface Variante {
    id?: number;
    created?: string;
    updated?: string;
    offertenr?: string;
    variante?: number;
    status?: boolean;
    agtstufe?: number | null;
    taggeld?: string | null;
    verdienst?: number;
    mind_verdienst?: number | null;
    nettopraemie?: number | null;
    jahrespraemie_ohne_rabatt?: number | null;
    taggeldaufschubrabatt?: number | null;
    jahrespraemie_ohne_minimal?: number | null;
    verwaltungskostenpraemie?: number | null;
    jahrespraemie?: number | null;
    updatedby?: string;
    taggeldj?: number | null;
    taggeldm?: number | null;
    ivrentej?: number | null;
    ivrentem?: number | null;
    rabatt?: number | null;
}
