# Offerte Field Helpers

## Overview

Production-ready helpers that ensure correct format and type for all offerte fields. These helpers automatically validate against code tables and enforce proper date formats.

## What's Included

### 1. **OfferteDateHelper** (Static Class)
- ✅ Accepts Date objects or strings
- ✅ Converts to API-required formats
- ✅ Three date formats supported:
  - `DATE_ONLY`: YYYY-MM-DD (e.g., "2025-11-21")
  - `DATETIME_NO_TZ`: YYYY-MM-DDTHH:mm:ss (e.g., "2025-11-21T11:06:38")
  - `DATETIME_ISO`: YYYY-MM-DDTHH:mm:ss.sssZ (e.g., "2025-11-21T11:06:38.000Z")
- ✅ Format validation methods
- ✅ Helper methods: `now()`, `today()`, `parse()`

### 2. **OfferteCodeHelper** (Injectable Service)
- ✅ Validates codes against cached code tables (from CodesService)
- ✅ Ensures codes exist in specified gruppe before storing
- ✅ Provides localized labels for codes
- ✅ Generates dropdown options for forms
- ✅ Signal-based reactive options
- ✅ Batch validation for performance
- ✅ Automatic caching for fast subsequent lookups

### 3. **OfferteFieldValidator** (Injectable Service)
- ✅ Validates all code fields at once
- ✅ Validates all date fields at once
- ✅ Returns detailed error messages
- ✅ Integration-ready for store metadata

## Quick Start

### Date Formatting

```typescript
import { OfferteDateHelper } from '@app/fuv/utils';

// Convert Date to string for API
const gueltab = OfferteDateHelper.toDateOnly(new Date()); // "2025-11-21"
const statusab = OfferteDateHelper.now(); // "2025-11-21T16:43:54"

// Parse string to Date for UI components
const dateObj = OfferteDateHelper.parse('2025-11-21');
```

### Code Validation

```typescript
import { inject } from '@angular/core';
import { OfferteCodeHelper } from '@app/fuv/utils';

export class MyComponent {
  private codeHelper = inject(OfferteCodeHelper);

  async validateAndStore(art: string) {
    // Validates against OfferteArt gruppe in code table
    const validArt = await this.codeHelper.validateArt(art);
    
    if (validArt) {
      this.store.updateCurrentOfferte({ art: validArt });
    } else {
      this.showError('Invalid art code');
    }
  }
}
```

### Get Dropdown Options

```typescript
export class OfferteFormComponent {
  private codeHelper = inject(OfferteCodeHelper);

  // Signal-based (reactive)
  artOptions = this.codeHelper.getCodeOptionsSignal('OfferteArt');
  
  // Template: <p-dropdown [options]="artOptions()" />
}
```

## Key Features

### Type Safety
All field values are validated according to their type:
- **Code fields**: Validated against code table gruppes
- **Date fields**: Enforced format validation
- **Enum fields**: TypeScript enums for compile-time safety

### Performance
- **Caching**: Code validation results are cached per gruppe
- **Session Storage**: Code tables cached for 24 hours
- **Batch Validation**: Preloads all gruppes at once
- **Signal-Based**: Automatic memoization via computed()

### Integration with Store
Works seamlessly with OfferteTypedStore:
```typescript
// Validate before update
const validArt = await this.codeHelper.validateArt(newArt);
if (validArt) {
  this.store.updateCurrentOfferte({ 
    art: validArt,
    statusab: OfferteDateHelper.now() // Always update statusab
  });
}

// Validate all fields
const errors = await this.validator.validateAllCodeFields(offerte);
this.store.updateCurrentMeta({ 
  isValid: Object.keys(errors).length === 0,
  validationErrors: errors 
});
```

## Supported Fields

### Date Fields
| Field | Format | Helper Method |
|-------|--------|---------------|
| gueltab | YYYY-MM-DD | `toDateOnly()` |
| gueltbis | YYYY-MM-DD | `toDateOnly()` |
| ablaufdatum | YYYY-MM-DD | `toDateOnly()` |
| selbst_seit | YYYY-MM-DD | `toDateOnly()` |
| gedruckt_am | YYYY-MM-DD | `toDateOnly()` |
| policiert_am | YYYY-MM-DD | `toDateOnly()` |
| unterschrieben_am | YYYY-MM-DD | `toDateOnly()` |
| created | YYYY-MM-DDTHH:mm:ss | `toDateTimeNoTz()` |
| updated | YYYY-MM-DDTHH:mm:ss | `toDateTimeNoTz()` |
| statusab | YYYY-MM-DDTHH:mm:ss | `toDateTimeNoTz()` or `now()` |

### Code Fields (from Code Tables)
| Field | Gruppe | Helper Method |
|-------|--------|---------------|
| art | OfferteArt | `validateArt()` |
| status | OfferteStatus | `validateStatus()` |
| avb | COT_FUV_AVB | `validateAvb()` |
| stellung_im_betrieb | COT_STELLUNG_IM_BETRIEB | `validateStellungImBetrieb()` |
| beschaeft_grad | COT_Beschaeftigungsgrad | `validateBeschaeftGrad()` |
| kanal | Verkaufskanal | `validateKanal()` |

### Enum Fields (Fixed Values)
| Field | Values | Helper Method |
|-------|--------|---------------|
| praemienzahlung | jaehrlich, halbjaehrlich, vierteljaehrlich, monatlich | `validatePraemienzahlung()` |
| unterschrieben_art | physisch, elektronisch | `validateUnterschriebenArt()` |
| begleitbrief | yes, no | `validateBegleitbrief()` |

## Constants and Enums

```typescript
import { 
  Praemienzahlung, 
  UnterschriebenArt, 
  Begleitbrief,
  OfferteCodeGruppen,
  DateFormat
} from '@app/fuv/utils';

// Type-safe enums
offerte.praemienzahlung = Praemienzahlung.JAEHRLICH;
offerte.unterschrieben_art = UnterschriebenArt.ELEKTRONISCH;
offerte.begleitbrief = Begleitbrief.YES;

// Code gruppe constants
const artGruppe = OfferteCodeGruppen.ART; // 'OfferteArt'
const statusGruppe = OfferteCodeGruppen.STATUS; // 'OfferteStatus'

// Date format validation
const isValid = OfferteDateHelper.isValidDateFormat(date, DateFormat.DATE_ONLY);
```

## Best Practices

1. **Always validate codes before storing** - Prevents invalid data
   ```typescript
   const validArt = await this.codeHelper.validateArt(art);
   if (validArt) {
     this.store.updateCurrentOfferte({ art: validArt });
   }
   ```

2. **Use OfferteDateHelper for all date conversions** - Ensures correct format
   ```typescript
   const gueltab = OfferteDateHelper.toDateOnly(userInputDate);
   ```

3. **Update statusab on every change** - Track when offerte was last modified
   ```typescript
   this.store.updateCurrentOfferte({
     ...changes,
     statusab: OfferteDateHelper.now()
   });
   ```

4. **Batch validate for better performance** - Preloads all gruppes
   ```typescript
   const results = await this.codeHelper.validateCodes([
     { code: offerte.art, gruppe: 'OfferteArt' },
     { code: offerte.status, gruppe: 'OfferteStatus' },
     // ...
   ]);
   ```

5. **Store validation errors in metadata** - Keep errors with the data
   ```typescript
   const errors = await this.validator.validateAllCodeFields(offerte);
   this.store.updateCurrentMeta({ validationErrors: errors });
   ```

6. **Use signal-based options for forms** - Better performance
   ```typescript
   readonly artOptions = this.codeHelper.getCodeOptionsSignal('OfferteArt');
   ```

7. **Use enums instead of magic strings** - Type safety
   ```typescript
   // Good
   offerte.praemienzahlung = Praemienzahlung.JAEHRLICH;
   
   // Bad
   offerte.praemienzahlung = 'jaehrlich';
   ```

## Files

- `offerte-field-helpers.ts` - Main implementation
- `offerte-field-helpers.usage.md` - Detailed usage guide with examples
- `README.md` - This file (overview and quick start)
- `index.ts` - Exports for easy imports

## See Also

- [Detailed Usage Guide](./offerte-field-helpers.usage.md) - Complete examples and patterns
- [Offerte Typed Store](../stores/README.md) - Store integration
- [Codes Service](../services/codes.service.ts) - Code table management

## Implementation Status

✅ **Complete and Production-Ready**
- All date formats supported
- All code fields validated
- All enum fields validated
- Signal-based reactive options
- Caching and performance optimized
- Comprehensive documentation
- TypeScript type safety throughout

## Example: Complete Form with Validation

```typescript
import { Component, inject, signal } from '@angular/core';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { 
  OfferteDateHelper, 
  OfferteCodeHelper, 
  OfferteFieldValidator 
} from '@app/fuv/utils';

@Component({
  selector: 'app-offerte-form',
  template: `
    <!-- Date fields with auto-formatting -->
    <p-calendar 
      [(ngModel)]="gueltabDate" 
      (ngModelChange)="updateGueltab()" />
    
    <!-- Code dropdown with validation -->
    <p-dropdown 
      [options]="artOptions()"
      [(ngModel)]="selectedArt"
      (ngModelChange)="updateArt()" />
    
    <!-- Validation errors -->
    @if (validationErrors()) {
      <div class="errors">
        @for (error of Object.values(validationErrors()); track error) {
          <p class="error">{{ error }}</p>
        }
      </div>
    }
    
    <!-- Save button -->
    <button 
      (click)="save()" 
      [disabled]="!isValid()">
      Save
    </button>
  `
})
export class OfferteFormComponent {
  readonly store = inject(OfferteTypedStore);
  private codeHelper = inject(OfferteCodeHelper);
  private validator = inject(OfferteFieldValidator);

  // Signals for reactive UI
  readonly artOptions = this.codeHelper.getCodeOptionsSignal('OfferteArt');
  readonly validationErrors = signal<Record<string, string>>({});
  readonly isValid = signal(true);

  // Form fields
  gueltabDate: Date = new Date();
  selectedArt: string = '';

  ngOnInit() {
    // Load from store
    const offerte = this.store.currentOfferte();
    if (offerte) {
      this.gueltabDate = OfferteDateHelper.parse(offerte.gueltab) || new Date();
      this.selectedArt = offerte.art || '';
    }
  }

  updateGueltab() {
    this.store.updateCurrentOfferte({
      gueltab: OfferteDateHelper.toDateOnly(this.gueltabDate),
      statusab: OfferteDateHelper.now(),
    });
  }

  async updateArt() {
    const validArt = await this.codeHelper.validateArt(this.selectedArt);
    if (validArt) {
      this.store.updateCurrentOfferte({
        art: validArt,
        statusab: OfferteDateHelper.now(),
      });
      await this.validateAll();
    } else {
      this.validationErrors.set({ art: 'Invalid art code' });
      this.isValid.set(false);
    }
  }

  async validateAll() {
    const offerte = this.store.currentOfferte();
    if (!offerte) return;

    const codeErrors = await this.validator.validateAllCodeFields(offerte);
    const dateErrors = this.validator.validateAllDateFields(offerte);
    const allErrors = { ...codeErrors, ...dateErrors };

    this.validationErrors.set(allErrors);
    this.isValid.set(Object.keys(allErrors).length === 0);
    
    this.store.updateCurrentMeta({
      isValid: this.isValid(),
      validationErrors: allErrors,
    });
  }

  async save() {
    await this.validateAll();
    if (this.isValid()) {
      // Save logic here
      this.store.markCurrentAsSynced();
    }
  }
}
```
