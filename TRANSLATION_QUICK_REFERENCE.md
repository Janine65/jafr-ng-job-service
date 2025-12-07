# Translation Quick Reference - Offerte-Police

## Common Field Labels (Already Existed)
Use these keys from `common.partner`:
```
{{ 'common.partner.name' | translate }}          → Name
{{ 'common.partner.vorname' | translate }}       → Vorname
{{ 'common.partner.strasse' | translate }}       → Strasse
{{ 'common.partner.plz' | translate }}           → PLZ
{{ 'common.partner.ort' | translate }}           → Ort
{{ 'common.partner.email' | translate }}         → E-Mail
{{ 'common.partner.telefon' | translate }}       → Telefon
{{ 'common.partner.mobile' | translate }}        → Mobil
{{ 'common.partner.svnr' | translate }}          → SV-Nr.
{{ 'common.partner.suvanr' | translate }}        → Suva-Nr.
{{ 'common.partner.uidNr' | translate }}         → UID-Nr.
{{ 'common.partner.audit' | translate }}         → Audit
{{ 'common.partner.klasse' | translate }}        → Klasse
{{ 'common.partner.basisstufe' | translate }}    → Basisstufe
{{ 'common.partner.stufe' | translate }}         → Stufe
{{ 'common.partner.stellung' | translate }}      → Stellung im Betrieb
{{ 'common.partner.bonitaet' | translate }}      → Bonität
```

## Common Yes/No (Newly Added)
```
{{ 'common.yes' | translate }}                   → Ja / Oui / Sì
{{ 'common.no' | translate }}                    → Nein / Non / No
```

## Versicherte Person (New)
```
{{ 'fuv.police.versichertePerson.geschlecht' | translate }}     → Geschlecht
{{ 'fuv.police.versichertePerson.zivilstand' | translate }}     → Zivilstand
{{ 'fuv.police.versichertePerson.plzOrt' | translate }}         → PLZ, Ort
```

## FUV Betrieb (New)
```
{{ 'fuv.police.fuvBetrieb.name1' | translate }}                 → Name1
{{ 'fuv.police.fuvBetrieb.name2' | translate }}                 → Name2
{{ 'fuv.police.fuvBetrieb.plzOrt' | translate }}                → PLZ, Ort
```

## Varianten Labels (New)
```
{{ 'fuv.police.varianten.labels.varianteA' | translate }}               → Variante A
{{ 'fuv.police.varianten.labels.varianteB' | translate }}               → Variante B
{{ 'fuv.police.varianten.labels.varianteC' | translate }}               → Variante C
{{ 'fuv.police.varianten.labels.jahresverdienst' | translate }}         → Jahresverdienst
{{ 'fuv.police.varianten.labels.monatsverdienst' | translate }}         → Monatsverdienst
{{ 'fuv.police.varianten.labels.taggeldAb' | translate }}               → Taggeld ab
{{ 'fuv.police.varianten.labels.rabatt' | translate }}                  → Rabatt
{{ 'fuv.police.varianten.labels.praemiensatzBrutto' | translate }}      → Prämiensatz (brutto)
{{ 'fuv.police.varianten.labels.geldleistungen' | translate }}          → Geldleistungen
{{ 'fuv.police.varianten.labels.ibanNr' | translate }}                  → IBAN-Nr.
{{ 'fuv.police.varianten.labels.nameGeldinstitut' | translate }}        → Name Geldinstitut
{{ 'fuv.police.varianten.labels.kontoinhaber' | translate }}            → Kontoinhaber
{{ 'fuv.police.varianten.labels.begleitschreiben' | translate }}        → Begleitschreiben
```

## Checkliste (New)
```
{{ 'fuv.police.checkliste.loading.title' | translate }}                 → Daten werden geladen
{{ 'fuv.police.checkliste.sections.rendement' | translate }}            → Rendement
{{ 'fuv.police.checkliste.buttons.save' | translate }}                  → Speichern
{{ 'fuv.police.checkliste.buttons.createVttTask' | translate }}         → Aufgabe VTT erstellen
{{ 'fuv.police.checkliste.buttons.callCrif' | translate }}              → CRIF aufrufen
{{ 'fuv.police.checkliste.buttons.fetchCrifData' | translate }}         → CRIF-Daten automatisch abrufen
```

## Antragsfragen (New)
```
{{ 'fuv.police.antragsfragen.summary.title' | translate }}              → Zusammenfassung
{{ 'fuv.police.antragsfragen.summary.recordedOn' | translate }}         → Aufgenommen am
{{ 'fuv.police.antragsfragen.summary.changedOn' | translate }}          → Geändert am
{{ 'fuv.police.antragsfragen.summary.answered' | translate }}           → Beantwortet
{{ 'fuv.police.antragsfragen.summary.open' | translate }}               → Offen
{{ 'fuv.police.antragsfragen.labels.ifYesWhich' | translate }}          → Wenn ja, welche?
{{ 'fuv.police.antragsfragen.labels.digitallySigned' | translate }}     → Digital unterschrieben
```

## Taetigkeit (New)
```
{{ 'fuv.police.taetigkeit.tooltips.setTodayDate' | translate }}         → Heutiges Datum setzen
```

## Nachbearbeitung (New)
```
{{ 'fuv.police.nachbearbeitung.labels.offerteAbschliessen' | translate }}  → Offerte abschliessen
```

## Usage Examples

### In HTML Template
```html
<!-- Simple label -->
<label>{{ 'common.partner.name' | translate }}</label>

<!-- With binding -->
<label [innerText]="'common.partner.vorname' | translate"></label>

<!-- In button -->
<p-button [label]="'fuv.police.checkliste.buttons.save' | translate"></p-button>

<!-- In placeholder -->
<input [placeholder]="'fuv.police.antragsfragen.placeholders.pleaseProvideDetails' | translate" />

<!-- In tooltip -->
<i [pTooltip]="'fuv.police.taetigkeit.tooltips.setTodayDate' | translate"></i>
```

### In TypeScript Component
```typescript
import { TranslateService } from '@ngx-translate/core';

constructor(private translate: TranslateService) {}

// Get translation
const label = this.translate.instant('common.partner.name');

// Get translation with parameters
const message = this.translate.instant('fuv.police.varianten.validation.verdienstMissing', { variant: 'A' });
```

