# Offerte Field Helpers - Implementation Summary

## What Was Created

Production-ready helpers to ensure correct format and type for all offerte fields, with automatic date conversion and code validation against cached code tables.

## Files Created

### Core Implementation
1. **`src/app/fuv/utils/offerte-field-helpers.ts`** (527 lines)
   - `OfferteDateHelper` - Static class for date conversions
   - `OfferteCodeHelper` - Injectable service for code validation
   - `OfferteFieldValidator` - Injectable service for batch validation
   - Enums: `Praemienzahlung`, `UnterschriebenArt`, `Begleitbrief`, `DateFormat`
   - Constants: `OfferteCodeGruppen`

### Documentation
2. **`src/app/fuv/utils/README.md`** - Overview and quick start guide
3. **`src/app/fuv/utils/offerte-field-helpers.usage.md`** - Detailed usage with examples
4. **`src/app/fuv/utils/index.ts`** - Export file for easy imports

### Updated Files
5. **`src/app/fuv/models/offerte.model.ts`** - Updated OfferteUtils to reference helpers

## Key Features

### 1. Date Helpers (`OfferteDateHelper`)

**Accepts:** `Date` objects or strings  
**Converts to:** Required API string formats

```typescript
import { OfferteDateHelper } from '@app/fuv/utils';

// YYYY-MM-DD format (gueltab, gueltbis, ablaufdatum, etc.)
const gueltab = OfferteDateHelper.toDateOnly(new Date()); // "2025-11-21"

// YYYY-MM-DDTHH:mm:ss format (created, updated, statusab)
const statusab = OfferteDateHelper.now(); // "2025-11-21T16:43:54"

// Parse to Date object
const dateObj = OfferteDateHelper.parse('2025-11-21');
```

**Supported Methods:**
- `toDateOnly(date)` - Convert to YYYY-MM-DD
- `toDateTimeNoTz(date)` - Convert to YYYY-MM-DDTHH:mm:ss
- `toDateTimeISO(date)` - Convert to ISO 8601 with timezone
- `parse(date)` - Parse to Date object
- `now()` - Current timestamp (YYYY-MM-DDTHH:mm:ss)
- `today()` - Current date (YYYY-MM-DD)
- `isValidDateFormat(str, format)` - Validate format

### 2. Code Helpers (`OfferteCodeHelper`)

**Validates codes against CodesService** - Ensures codes exist in cached code tables before storing.

```typescript
import { inject } from '@angular/core';
import { OfferteCodeHelper } from '@app/fuv/utils';

export class MyComponent {
  private codeHelper = inject(OfferteCodeHelper);

  async validateArt(art: string) {
    // Returns art if valid, null if not found in OfferteArt gruppe
    const validArt = await this.codeHelper.validateArt(art);
    return validArt;
  }

  // Get dropdown options (signal-based)
  readonly artOptions = this.codeHelper.getCodeOptionsSignal('OfferteArt');
}
```

**Supported Methods:**
- `validateArt(art)` - Validate against OfferteArt gruppe
- `validateStatus(status)` - Validate against OfferteStatus gruppe
- `validateAvb(avb)` - Validate against COT_FUV_AVB gruppe
- `validateStellungImBetrieb(stellung)` - Validate against COT_STELLUNG_IM_BETRIEB gruppe
- `validateBeschaeftGrad(grad)` - Validate against COT_Beschaeftigungsgrad gruppe
- `validateKanal(kanal)` - Validate against Verkaufskanal gruppe
- `validatePraemienzahlung(value)` - Validate enum (jaehrlich, halbjaehrlich, etc.)
- `validateUnterschriebenArt(value)` - Validate enum (physisch, elektronisch)
- `validateBegleitbrief(value)` - Validate yes/no
- `getCodeOptions(gruppe)` - Get dropdown options (async)
- `getCodeOptionsSignal(gruppe)` - Get dropdown options (signal)
- `getCodeLabel(code, gruppe)` - Get localized label
- `validateCodes(codes[])` - Batch validate multiple codes

**Caching:** First validation loads codes from API, subsequent calls use cached values.

### 3. Combined Validator (`OfferteFieldValidator`)

**Validates all fields at once** - Returns error messages for invalid fields.

```typescript
import { inject } from '@angular/core';
import { OfferteFieldValidator } from '@app/fuv/utils';

export class MyComponent {
  private validator = inject(OfferteFieldValidator);

  async validateAll() {
    const offerte = this.store.currentOfferte();
    
    // Validate all code fields
    const codeErrors = await this.validator.validateAllCodeFields(offerte);
    // { art: 'Invalid code: XYZ not found in gruppe OfferteArt' }
    
    // Validate all date fields
    const dateErrors = this.validator.validateAllDateFields(offerte);
    // { gueltab: 'Invalid date format: must be YYYY-MM-DD' }
    
    // Store errors in metadata
    this.store.updateCurrentMeta({
      isValid: Object.keys({...codeErrors, ...dateErrors}).length === 0,
      validationErrors: {...codeErrors, ...dateErrors}
    });
  }
}
```

## Integration with Store

### Example: Update with validation

```typescript
import { Component, inject } from '@angular/core';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { OfferteDateHelper, OfferteCodeHelper } from '@app/fuv/utils';

@Component({
  selector: 'app-offerte-form'
})
export class OfferteFormComponent {
  readonly store = inject(OfferteTypedStore);
  private codeHelper = inject(OfferteCodeHelper);

  gueltabDate: Date = new Date();

  async onDateChange() {
    // Automatic format conversion
    this.store.updateCurrentOfferte({
      gueltab: OfferteDateHelper.toDateOnly(this.gueltabDate),
      statusab: OfferteDateHelper.now(), // Always update statusab
    });
  }

  async onArtChange(newArt: string) {
    // Validate before storing
    const validArt = await this.codeHelper.validateArt(newArt);
    
    if (validArt) {
      this.store.updateCurrentOfferte({ 
        art: validArt,
        statusab: OfferteDateHelper.now()
      });
    } else {
      this.showError('Invalid art code');
    }
  }
}
```

### Example: Get dropdown options

```typescript
export class OfferteFormComponent {
  private codeHelper = inject(OfferteCodeHelper);

  // Signal-based (reactive, auto-updating)
  readonly artOptions = this.codeHelper.getCodeOptionsSignal('OfferteArt');
  readonly statusOptions = this.codeHelper.getCodeOptionsSignal('OfferteStatus');
  readonly avbOptions = this.codeHelper.getCodeOptionsSignal('COT_FUV_AVB');

  // Template: <p-dropdown [options]="artOptions()" [(ngModel)]="selectedArt" />
}
```

### Example: Save with format enforcement

```typescript
export class OfferteSaveService {
  readonly store = inject(OfferteTypedStore);
  private codeHelper = inject(OfferteCodeHelper);

  async saveOfferte() {
    const offerte = this.store.currentOfferte();
    if (!offerte) return;

    // Ensure all dates in correct format
    const prepared = {
      ...offerte,
      gueltab: OfferteDateHelper.toDateOnly(offerte.gueltab),
      gueltbis: OfferteDateHelper.toDateOnly(offerte.gueltbis),
      statusab: OfferteDateHelper.now(),
      updated: OfferteDateHelper.now(),
    };

    // Validate all codes
    const codeErrors = await this.codeHelper.validateCodes([
      { code: prepared.art, gruppe: 'OfferteArt' },
      { code: prepared.status, gruppe: 'OfferteStatus' },
      { code: prepared.avb, gruppe: 'COT_FUV_AVB' },
    ]);

    if (codeErrors.some(r => r === null)) {
      throw new Error('Invalid codes detected');
    }

    // Save to API
    await this.apiService.saveOfferte(prepared);
    this.store.markCurrentAsSynced();
  }
}
```

## Supported Fields

### Date Fields
✅ gueltab, gueltbis, ablaufdatum, selbst_seit (YYYY-MM-DD)  
✅ gedruckt_am, policiert_am, unterschrieben_am (YYYY-MM-DD)  
✅ created, updated, statusab (YYYY-MM-DDTHH:mm:ss)

### Code Fields (from Code Tables)
✅ art (OfferteArt)  
✅ status (OfferteStatus)  
✅ avb (COT_FUV_AVB)  
✅ stellung_im_betrieb (COT_STELLUNG_IM_BETRIEB)  
✅ beschaeft_grad (COT_Beschaeftigungsgrad)  
✅ kanal (Verkaufskanal)

### Enum Fields (Fixed Values)
✅ praemienzahlung (jaehrlich, halbjaehrlich, vierteljaehrlich, monatlich)  
✅ unterschrieben_art (physisch, elektronisch)  
✅ begleitbrief (yes, no)

## Type-Safe Enums

```typescript
import { 
  Praemienzahlung, 
  UnterschriebenArt, 
  Begleitbrief 
} from '@app/fuv/utils';

// Use enums instead of magic strings
offerte.praemienzahlung = Praemienzahlung.JAEHRLICH; // 'jaehrlich'
offerte.unterschrieben_art = UnterschriebenArt.ELEKTRONISCH; // 'elektronisch'
offerte.begleitbrief = Begleitbrief.YES; // 'yes'
```

## Performance Features

1. **Caching**: Code validation results cached per gruppe
2. **Session Storage**: Code tables cached for 24 hours
3. **Batch Validation**: Preloads all required gruppes at once
4. **Signal-Based**: Automatic memoization via computed()
5. **Lazy Loading**: Gruppes loaded on first use only

## Best Practices

1. ✅ **Always use OfferteDateHelper** for date conversions
2. ✅ **Validate codes before storing** to prevent invalid data
3. ✅ **Update statusab on every change** using `OfferteDateHelper.now()`
4. ✅ **Use signal-based code options** for better performance
5. ✅ **Batch validate codes** when validating multiple fields
6. ✅ **Store validation errors in metadata** with the offerte
7. ✅ **Use enums instead of magic strings** for type safety

## Quick Reference

### Import

```typescript
import { 
  OfferteDateHelper,        // Static date helper
  OfferteCodeHelper,        // Injectable code validator
  OfferteFieldValidator,    // Injectable batch validator
  Praemienzahlung,          // Enum
  UnterschriebenArt,        // Enum
  Begleitbrief,             // Enum
  OfferteCodeGruppen,       // Constants
  DateFormat                // Enum
} from '@app/fuv/utils';
```

### Common Patterns

```typescript
// Date conversion
const gueltab = OfferteDateHelper.toDateOnly(new Date());
const statusab = OfferteDateHelper.now();

// Code validation (inject first)
const validArt = await this.codeHelper.validateArt(art);

// Get options (inject first)
const options = this.codeHelper.getCodeOptionsSignal('OfferteArt');

// Batch validation (inject first)
const errors = await this.validator.validateAllCodeFields(offerte);
```

## Documentation Links

- **Quick Start**: `src/app/fuv/utils/README.md`
- **Detailed Usage**: `src/app/fuv/utils/offerte-field-helpers.usage.md`
- **Implementation**: `src/app/fuv/utils/offerte-field-helpers.ts`

## Status

✅ **Complete and Production-Ready**
- All date formats supported
- All code fields validated
- All enum fields validated
- Signal-based reactive options
- Comprehensive caching
- Full TypeScript type safety
- Complete documentation
- Integration examples

## Next Steps

1. **Update existing forms** to use `OfferteDateHelper` for date conversions
2. **Add code validation** before storing offerte fields
3. **Use signal-based dropdowns** for better performance
4. **Add validation to save operations** to ensure data integrity
5. **Store validation errors** in offerte metadata

## Example: Complete Form Implementation

See `src/app/fuv/utils/README.md` for a complete example showing:
- Date field with auto-formatting
- Code dropdown with validation
- Validation error display
- Save button with validation check
- Signal-based reactive UI
