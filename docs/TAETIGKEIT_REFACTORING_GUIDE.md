# Tätigkeit Component Refactoring Guide

## Overview
This guide explains how to refactor the `taetigkeit.component.ts` to properly use the offerte store with helpers.

## Key Changes Required

### 1. Store Structure

#### Fields in `currentOfferte` (Offerte model):
- `gueltab` - Contract start date (string: YYYY-MM-DD)
- `gueltbis` - Contract end date (string: YYYY-MM-DD) 
- `avb` - AVB code (string, Code type)
- `kanal` - Sales channel (string, Code type)
- `stellung_im_betrieb` - Position in company (string, Code type)
- `beschaeft_grad` - Work percentage (string, Code type)
- `selbst_seit` - Self-employed since (string: YYYY-MM-DD)
- `bb.taetigkeit` - Activity description (string, nested in BB)
- `bb.anzahlma` - Number of employees (string, nested in BB)

#### UI-Only Fields in `currentMeta.tezuCalculationBasis`:
```typescript
{
  stellenprozente: number,  // Employee percentages without owner
  taetigkeiten: Array<{    // Activity list (dynamic)
    taetigkeit: string,     // merkmal_boid
    prozent: string,
    merkmal_id?: number,
    merkmal_internalname?: string,
    merkmal_statefrom?: string
  }>
}
```

### 2. Component Bindings

#### Direct Store Bindings (with Date conversion):
```typescript
// READ from store (convert string to Date for PrimeNG)
get vertragGueltigAb(): Date | null {
  const offerte = this.currentOfferte();
  return offerte?.gueltab ? OfferteDateHelper.parse(offerte.gueltab) : null;
}

// WRITE to store (convert Date to string)
set vertragGueltigAb(value: Date | null) {
  this.offerteStore.updateOfferte(null, {
    gueltab: OfferteDateHelper.toDateOnly(value)
  });
}
```

#### Code Field Bindings (no conversion needed):
```typescript
// Code fields can be bound directly since they're already strings
// The dropdown uses codesService.getCodeOptionsSignal() for options
// Example for verkaufskanal:
get verkaufskanal(): string | null {
  return this.currentOfferte()?.kanal || null;
}

set verkaufskanal(value: string | null) {
  this.offerteStore.updateOfferte(null, { kanal: value });
}
```

#### UI-Only Field Bindings:
```typescript
// Stellenprozente (from currentMeta)
get stellenprozente(): number | null {
  return this.currentMeta()?.tezuCalculationBasis?.stellenprozente ?? null;
}

set stellenprozente(value: number | null) {
  const current = this.currentMeta();
  this.offerteStore.updateMeta(null, {
    tezuCalculationBasis: {
      ...current?.tezuCalculationBasis,
      stellenprozente: value
    }
  });
}

// Taetigkeiten list (from currentMeta)
get taetigkeiten() {
  return this.currentMeta()?.tezuCalculationBasis?.taetigkeiten ?? [{ taetigkeit: '', prozent: '0' }];
}

set taetigkeiten(value: Array<any>) {
  const current = this.currentMeta();
  this.offerteStore.updateMeta(null, {
    tezuCalculationBasis: {
      ...current?.tezuCalculationBasis,
      taetigkeiten: value
    }
  });
}
```

### 3. Helper Usage

#### When to Use Helpers:

**OfferteDateHelper** - Use for date conversion:
```typescript
// Convert Date object to string for API/storage
OfferteDateHelper.toDateOnly(date)        // → "2025-11-21"
OfferteDateHelper.toDateTimeNoTz(date)    // → "2025-11-21T11:06:38"

// Parse string to Date object for PrimeNG
OfferteDateHelper.parse(dateString)       // → Date object
```

**OfferteCodeHelper** - Use for validation (injectable service):
```typescript
// Validate code exists in code table
await this.codeHelper.validateKanal(kanal)
await this.codeHelper.validateAvb(avb)

// Get localized label
await this.codeHelper.getCodeLabel(code, gruppe)
```

**CodesService** - Use for dropdowns (already used correctly):
```typescript
// Get dropdown options (already in component)
this.verkaufskanalOptions = this.codesService.getCodeOptionsSignal(CODE_GRUPPE_VERKAUFSKANAL, true);
```

#### When NOT to Use Helpers:

- ❌ Don't use helpers for dropdown options → Use `codesService.getCodeOptionsSignal()`
- ❌ Don't use helpers for every field access → Only when validation/transformation needed
- ❌ Don't use helpers in templates → Use in component methods only

### 4. HTML Template Bindings

```html
<!-- Date fields - bind with getter/setter that converts -->
<p-datepicker
  [(ngModel)]="vertragGueltigAb"
  (ngModelChange)="onVertragGueltigAbChange()"
/>

<!-- Code fields - bind directly to store -->
<p-select
  [options]="verkaufskanalOptions()"
  [(ngModel)]="verkaufskanal"
  (onChange)="onVerkaufskanalChange()"
/>

<!-- Display code labels -->
<input 
  [value]="(currentOfferte()?.avb | codeLabel | async) || '-'" 
  [disabled]="true"
/>

<!-- UI-only fields - bind to getters/setters -->
<input
  [(ngModel)]="stellenprozente"
  (ngModelChange)="onStellenprozenteChange()"
/>

<!-- Taetigkeiten array -->
<div *ngFor="let item of taetigkeiten; let i = index">
  <p-autocomplete
    [(ngModel)]="item.taetigkeit"
    (ngModelChange)="onTaetigkeitItemChange()"
  />
</div>
```

### 5. Validation with Helpers

Use helpers only during form submission or validation:

```typescript
async validateForm(): Promise<boolean> {
  const offerte = this.currentOfferte();
  if (!offerte) return false;

  // Validate code fields
  const validKanal = await this.codeHelper.validateKanal(offerte.kanal);
  if (!validKanal) {
    this.validationErrors.set('kanal', 'Invalid sales channel');
    return false;
  }

  // Date validation (use existing logic)
  // ...

  return true;
}
```

## Implementation Steps

1. ✅ Add `TezuCalculationBasis` interface to `offerte.model.ts`
2. ✅ Update `OfferteMetaData` to include `tezuCalculationBasis`
3. ⏳ Create getters/setters for all fields in component
4. ⏳ Update all methods to use getters/setters instead of `taetigkeitData`
5. ⏳ Update HTML template to use new bindings
6. ⏳ Keep dropdown options as-is (already correct)
7. ⏳ Add optional validation with helpers on form submit

## Key Takeaways

- **Store is source of truth**: All data should read/write from `currentOfferte` or `currentMeta`
- **Helpers for transformation**: Use `OfferteDateHelper` for date conversion
- **Helpers for validation**: Use `OfferteCodeHelper` optionally for validation
- **Dropdowns use CodesService**: Already correctly implemented
- **UI-only fields in Meta**: `stellenprozente` and `taetigkeiten` go in `currentMeta.tezuCalculationBasis`

