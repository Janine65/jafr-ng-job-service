## Offerte Police Migration (Signals + Typed Store)

- [x] Police component: switch to typed store (setKey, metadata for view mode + wizard step), remove legacy data shims.
- [x] Police service: date handling via OfferteDateHelper.
- [x] Versicherte Person: signal-based, store-driven.
- [x] Betrieb: signal-based, store-driven.
- [x] Tätigkeit: migrate to typed store/meta (persist BB/top-level fields, UI-only in metadata; drop legacy `taetigkeit` storage).
- [x] Varianten: refactor to typed store (init/load/save/calc) and move UI-only state to metadata (hash now in meta; BB + top-level fields used, legacy Tätigkeit references removed).
- [x] Antragsfragen: migrate to typed store, move VTT flags to metadata, drop legacy outputs, ensure save/validation flows use new helpers.
- [x] Abschluss: update signature/validation flow to metadata + typed store.
- [x] Nachbearbeitung: refactor to typed store, remove legacy conversions, keep metadata for UI-only flags.
- [x] Checkliste: migrate loading/saving to typed store and metadata; remove redundant effects/modal duplication.
- [x] Audit codebase for remaining legacy store calls (`updateCurrentOfferte`, `clearCurrentOfferte`, `viewMode`, `taetigkeit` field, `vttTask*`, `isSigned` on offerte) and replace with typed store/meta (remaining references are documentation/examples only).

## Remaining tasks

- [ ] Review police/offerte-police components for any lingering legacy patterns; optional clean-up only (build is green).
- [ ] Add unit coverage for `taetigkeit.validation` helpers to lock in auto-correction behaviour and avoid regressions.
- [ ] Watch TEZU hash updates when Tätigkeit/Varianten write to the store to ensure no recomputation loops appear in navigation flows.
- [ ] Confirm Tätigkeit autocomplete bindings and percentage change tracking behave under rapid edits (debounced save vs. signal updates).
- [ ] Move this: private readonly VALID_ZAHLUNGSWEISE = ['jaehrlich', 'halbjaehrlich', 'vierteljaehrlich'] as const; in variante.component.ts to police.constants.ts (all constants)
