# Offerte Field Helpers Usage Guide

## Overview

The field helpers ensure correct format and type for all offerte fields through automatic validation and transformation. They handle:
- Date formatting (accepts Date objects, converts to required string formats)
- Code validation (validates against cached code tables)
- Type safety and enum validation

## Date Helpers

### OfferteDateHelper (Static Class)

Handles all date conversions without dependency injection.

#### Format dates to API-compliant strings

```typescript
import { OfferteDateHelper, DateFormat } from '@app/fuv/utils/offerte-field-helpers';

// Format to YYYY-MM-DD (for gueltab, gueltbis, ablaufdatum, etc.)
const gueltab = OfferteDateHelper.toDateOnly(new Date()); // "2025-11-21"
const gueltab = OfferteDateHelper.toDateOnly('2025-11-21'); // "2025-11-21" (already formatted)

// Format to YYYY-MM-DDTHH:mm:ss (for created, updated, statusab)
const created = OfferteDateHelper.toDateTimeNoTz(new Date()); // "2025-11-21T16:43:54"

// Format to ISO 8601 with timezone (for metadata)
const timestamp = OfferteDateHelper.toDateTimeISO(new Date()); // "2025-11-21T16:43:54.123Z"

// Parse string/Date to Date object
const dateObj = OfferteDateHelper.parse('2025-11-21'); // Date object
const dateObj = OfferteDateHelper.parse(new Date()); // Date object

// Current timestamp helpers
const now = OfferteDateHelper.now(); // "2025-11-21T16:43:54"
const today = OfferteDateHelper.today(); // "2025-11-21"

// Validate date format
const isValid = OfferteDateHelper.isValidDateFormat('2025-11-21', DateFormat.DATE_ONLY); // true
const isValid = OfferteDateHelper.isValidDateFormat('invalid', DateFormat.DATE_ONLY); // false
```

#### Component usage example

```typescript
import { Component, inject } from '@angular/core';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { OfferteDateHelper } from '@app/fuv/utils/offerte-field-helpers';

@Component({
  selector: 'app-offerte-form',
  template: `
    <p-calendar [(ngModel)]="gueltabDate" (ngModelChange)="onDateChange()" />
  `
})
export class OfferteFormComponent {
  readonly store = inject(OfferteTypedStore);
  
  gueltabDate: Date = new Date();

  onDateChange() {
    // Automatically convert Date to correct format for API
    this.store.updateCurrentOfferte({
      gueltab: OfferteDateHelper.toDateOnly(this.gueltabDate),
      statusab: OfferteDateHelper.now(), // Always update statusab
    });
  }

  loadOfferte() {
    const offerte = this.store.currentOfferte();
    if (offerte?.gueltab) {
      // Parse string to Date for calendar component
      this.gueltabDate = OfferteDateHelper.parse(offerte.gueltab) || new Date();
    }
  }
}
```

## Code Helpers

### OfferteCodeHelper (Injectable Service)

Validates codes against cached code tables from CodesService.

#### Basic validation

```typescript
import { inject } from '@angular/core';
import { OfferteCodeHelper } from '@app/fuv/utils/offerte-field-helpers';

export class MyComponent {
  private codeHelper = inject(OfferteCodeHelper);

  async validateOfferteArt(art: string) {
    // Validates against OfferteArt gruppe
    const validArt = await this.codeHelper.validateArt(art);
    if (!validArt) {
      console.error('Invalid art code:', art);
    }
    return validArt; // Returns art if valid, null if invalid
  }

  async validateStatus(status: string) {
    const validStatus = await this.codeHelper.validateStatus(status);
    return validStatus; // Returns status if valid, null if invalid
  }

  async validateAvb(avb: string) {
    const validAvb = await this.codeHelper.validateAvb(avb);
    return validAvb;
  }

  async validateStellungImBetrieb(stellung: string) {
    const valid = await this.codeHelper.validateStellungImBetrieb(stellung);
    return valid;
  }

  async validateBeschaeftGrad(grad: string) {
    const valid = await this.codeHelper.validateBeschaeftGrad(grad);
    return valid;
  }

  async validateKanal(kanal: string) {
    const valid = await this.codeHelper.validateKanal(kanal);
    return valid;
  }

  // Enum validations (not from code table)
  validatePraemienzahlung(value: string) {
    return this.codeHelper.validatePraemienzahlung(value);
    // Returns value if one of: 'jaehrlich', 'halbjaehrlich', 'vierteljaehrlich', 'monatlich'
  }

  validateUnterschriebenArt(value: string) {
    return this.codeHelper.validateUnterschriebenArt(value);
    // Returns value if one of: 'physisch', 'elektronisch'
  }

  validateBegleitbrief(value: string | boolean) {
    return this.codeHelper.validateBegleitbrief(value);
    // Converts boolean to 'yes'/'no', validates string
  }
}
```

#### Get dropdown options

```typescript
export class OfferteFormComponent {
  private codeHelper = inject(OfferteCodeHelper);

  // For async loading (Promise-based)
  artOptions: Array<{ label: string; value: string }> = [];
  statusOptions: Array<{ label: string; value: string }> = [];
  avbOptions: Array<{ label: string; value: string }> = [];

  async ngOnInit() {
    // Load dropdown options from code tables
    this.artOptions = await this.codeHelper.getCodeOptions('OfferteArt');
    this.statusOptions = await this.codeHelper.getCodeOptions('OfferteStatus');
    this.avbOptions = await this.codeHelper.getCodeOptions('COT_FUV_AVB');
    
    // Get inactive codes too (activeOnly = false)
    const allAvb = await this.codeHelper.getCodeOptions('COT_FUV_AVB', false);
  }

  // For signal-based approach (reactive)
  artOptionsSignal = this.codeHelper.getCodeOptionsSignal('OfferteArt');
  statusOptionsSignal = this.codeHelper.getCodeOptionsSignal('OfferteStatus');

  // Template usage:
  // <p-dropdown [options]="artOptionsSignal()" />
}
```

#### Get code labels

```typescript
export class OfferteDisplayComponent {
  private codeHelper = inject(OfferteCodeHelper);

  async displayArtLabel(artCode: string) {
    const label = await this.codeHelper.getCodeLabel(artCode, 'OfferteArt');
    console.log('Art label:', label); // Localized label
  }

  async getCodeEntry(code: string) {
    const entry = await this.codeHelper.getCodeEntry(code, 'OfferteArt');
    // Returns full CodeTableEntry with all fields
    console.log('Code entry:', entry);
  }
}
```

#### Batch validation

```typescript
export class OfferteValidator {
  private codeHelper = inject(OfferteCodeHelper);

  async validateMultipleCodes(offerte: Offerte) {
    // Validate multiple codes efficiently (preloads all gruppes)
    const results = await this.codeHelper.validateCodes([
      { code: offerte.art, gruppe: 'OfferteArt' },
      { code: offerte.status, gruppe: 'OfferteStatus' },
      { code: offerte.avb, gruppe: 'COT_FUV_AVB' },
      { code: offerte.stellung_im_betrieb, gruppe: 'COT_STELLUNG_IM_BETRIEB' },
      { code: offerte.beschaeft_grad, gruppe: 'COT_Beschaeftigungsgrad' },
      { code: offerte.kanal, gruppe: 'Verkaufskanal' },
    ]);

    return results; // Array of validated codes (null for invalid)
  }
}
```

## Combined Validator

### OfferteFieldValidator (Injectable Service)

Validates all fields at once.

#### Validate all code fields

```typescript
import { inject } from '@angular/core';
import { OfferteFieldValidator } from '@app/fuv/utils/offerte-field-helpers';

export class OfferteFormComponent {
  private validator = inject(OfferteFieldValidator);

  async validateCodes() {
    const offerte = this.store.currentOfferte();
    if (!offerte) return;

    const errors = await this.validator.validateAllCodeFields(offerte);
    
    if (Object.keys(errors).length > 0) {
      console.error('Code validation errors:', errors);
      // errors = {
      //   art: 'Invalid code: XYZ not found in gruppe OfferteArt',
      //   praemienzahlung: 'Invalid value: must be one of jaehrlich, halbjaehrlich, ...'
      // }
      
      // Update store metadata
      this.store.updateCurrentMeta({
        isValid: false,
        validationErrors: { codes: Object.values(errors) },
      });
    } else {
      this.store.updateCurrentMeta({
        isValid: true,
        validationErrors: {},
      });
    }
  }
}
```

#### Validate all date fields

```typescript
export class OfferteFormComponent {
  private validator = inject(OfferteFieldValidator);

  validateDates() {
    const offerte = this.store.currentOfferte();
    if (!offerte) return;

    const errors = this.validator.validateAllDateFields(offerte);
    
    if (Object.keys(errors).length > 0) {
      console.error('Date validation errors:', errors);
      // errors = {
      //   gueltab: 'Invalid date format: must be YYYY-MM-DD',
      //   created: 'Invalid datetime format: must be YYYY-MM-DDTHH:mm:ss'
      // }
    }
  }
}
```

## Store Integration

### Automatic validation on update

```typescript
import { Component, inject } from '@angular/core';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { 
  OfferteDateHelper, 
  OfferteCodeHelper, 
  OfferteFieldValidator 
} from '@app/fuv/utils/offerte-field-helpers';

@Component({
  selector: 'app-offerte-edit',
  template: `...`
})
export class OfferteEditComponent {
  readonly store = inject(OfferteTypedStore);
  private codeHelper = inject(OfferteCodeHelper);
  private validator = inject(OfferteFieldValidator);

  async updateWithValidation(changes: Partial<Offerte>) {
    // Normalize dates
    if (changes.gueltab) {
      changes.gueltab = OfferteDateHelper.toDateOnly(changes.gueltab);
    }
    if (changes.gueltbis) {
      changes.gueltbis = OfferteDateHelper.toDateOnly(changes.gueltbis);
    }

    // Always update statusab when making changes
    changes.statusab = OfferteDateHelper.now();

    // Validate codes before updating
    if (changes.art) {
      const validArt = await this.codeHelper.validateArt(changes.art);
      if (!validArt) {
        console.error('Invalid art code');
        return;
      }
    }

    if (changes.status) {
      const validStatus = await this.codeHelper.validateStatus(changes.status);
      if (!validStatus) {
        console.error('Invalid status code');
        return;
      }
    }

    // Update store
    this.store.updateCurrentOfferte(changes);

    // Validate all fields
    await this.validateAll();
  }

  async validateAll() {
    const offerte = this.store.currentOfferte();
    if (!offerte) return;

    // Validate codes
    const codeErrors = await this.validator.validateAllCodeFields(offerte);
    
    // Validate dates
    const dateErrors = this.validator.validateAllDateFields(offerte);

    // Combine errors
    const allErrors = { ...codeErrors, ...dateErrors };

    // Update metadata
    this.store.updateCurrentMeta({
      isValid: Object.keys(allErrors).length === 0,
      validationErrors: allErrors,
    });
  }
}
```

### Save with format enforcement

```typescript
export class OfferteSaveService {
  readonly store = inject(OfferteTypedStore);
  private codeHelper = inject(OfferteCodeHelper);

  async saveOfferte() {
    const offerte = this.store.currentOfferte();
    if (!offerte) return;

    // Ensure all dates are in correct format
    const prepared: Partial<Offerte> = {
      ...offerte,
      gueltab: OfferteDateHelper.toDateOnly(offerte.gueltab),
      gueltbis: OfferteDateHelper.toDateOnly(offerte.gueltbis),
      ablaufdatum: OfferteDateHelper.toDateOnly(offerte.ablaufdatum),
      selbst_seit: OfferteDateHelper.toDateOnly(offerte.selbst_seit),
      statusab: OfferteDateHelper.now(), // Always set to current time
      created: offerte.created || OfferteDateHelper.now(),
      updated: OfferteDateHelper.now(),
    };

    // Validate all codes before saving
    const codeErrors = await this.codeHelper.validateCodes([
      { code: prepared.art, gruppe: 'OfferteArt' },
      { code: prepared.status, gruppe: 'OfferteStatus' },
      { code: prepared.avb, gruppe: 'COT_FUV_AVB' },
      { code: prepared.stellung_im_betrieb, gruppe: 'COT_STELLUNG_IM_BETRIEB' },
      { code: prepared.beschaeft_grad, gruppe: 'COT_Beschaeftigungsgrad' },
      { code: prepared.kanal, gruppe: 'Verkaufskanal' },
    ]);

    const hasInvalidCodes = codeErrors.some(result => result === null);
    if (hasInvalidCodes) {
      throw new Error('Invalid codes detected, cannot save');
    }

    // Save to API
    await this.apiService.saveOfferte(prepared);

    // Mark as synced
    this.store.markCurrentAsSynced();
  }
}
```

## Enums and Constants

### Use provided enums for type safety

```typescript
import { 
  Praemienzahlung, 
  UnterschriebenArt, 
  Begleitbrief,
  OfferteCodeGruppen 
} from '@app/fuv/utils/offerte-field-helpers';

// Type-safe enum usage
offerte.praemienzahlung = Praemienzahlung.JAEHRLICH; // 'jaehrlich'
offerte.unterschrieben_art = UnterschriebenArt.ELEKTRONISCH; // 'elektronisch'
offerte.begleitbrief = Begleitbrief.YES; // 'yes'

// Code gruppe constants
const artCodes = await codesService.getCodesByGruppe(OfferteCodeGruppen.ART);
const statusCodes = await codesService.getCodesByGruppe(OfferteCodeGruppen.STATUS);
```

## Best Practices

1. **Always use OfferteDateHelper for date conversions** - Ensures correct format
2. **Validate codes before storing** - Prevents invalid codes in database
3. **Use signal-based code options** - Better performance in reactive components
4. **Batch validate codes when possible** - More efficient than individual validation
5. **Update statusab on every change** - Use `OfferteDateHelper.now()`
6. **Store metadata validation errors** - Keep errors with the offerte data
7. **Use enums instead of magic strings** - Better type safety and refactoring

## Performance Tips

1. **Code validation caching** - First validation loads codes, subsequent calls use cache
2. **Signal-based code options** - computed() handles memoization automatically
3. **Batch validation** - Preloads all gruppes at once, then validates
4. **Session storage** - Codes are cached in session storage (24h validity)

## Error Handling

```typescript
try {
  const validArt = await this.codeHelper.validateArt('INVALID_CODE');
  if (!validArt) {
    // Handle invalid code
    this.showError('Invalid art code');
  }
} catch (error) {
  // Handle API errors
  console.error('Failed to validate code:', error);
}
```
