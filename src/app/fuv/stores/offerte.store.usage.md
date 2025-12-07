# OfferteTypedStore Usage Guide

## Overview

The `OfferteTypedStore` is a modern Angular 20 signal-based store that provides typed access to complete offerte data with automatic change tracking, validation state, and metadata management.

## Features

- ✅ **Fully Typed**: Complete type safety for all offerte fields and nested structures
- ✅ **Multi-Offerte Support**: Store and manage multiple offerten simultaneously
- ✅ **Automatic Change Detection**: Tracks which fields have been modified
- ✅ **Metadata Tracking**: Loading, saving, validation states per offerte
- ✅ **Signal-Based**: Reactive with Angular signals for optimal performance
- ✅ **Session Persistence**: Automatic save/load from sessionStorage
- ✅ **Nested Structure Updates**: Easy updates to betrieb, person, bb, etc.

## Basic Usage

### 1. Inject the Store

```typescript
import { Component, inject } from '@angular/core';
import { OfferteTypedStore } from '@app/fuv/stores/offerte-typed.store';

@Component({
  selector: 'app-offerte-detail',
  templateUrl: './offerte-detail.component.html',
})
export class OfferteDetailComponent {
  readonly offerteStore = inject(OfferteTypedStore);
}
```

### 2. Set an Offerte

```typescript
// Load offerte from API
const offerteData: OfferteComplete = {
  id: 466,
  offertenr: 'O.0259777000.001',
  art: 'OfferteArtVer',
  status: 'Offerte_Abschluss',
  betrieb: { /* ... */ },
  person: { /* ... */ },
  variante: [/* ... */],
  // ... other fields
};

// Store it with key (typically offertenr)
this.offerteStore.setOfferte('O.0259777000.001', offerteData);
```

### 3. Access Current Offerte (Signal-Based)

```typescript
// In your component
readonly currentOfferte = this.offerteStore.currentOfferte;
readonly isModified = this.offerteStore.isCurrentModified;
readonly isValid = this.offerteStore.isCurrentValid;
readonly isLoading = this.offerteStore.isCurrentLoading;

// In template
@if (currentOfferte()) {
  <div>
    <h2>{{ currentOfferte()?.offertenr }}</h2>
    <p>Status: {{ currentOfferte()?.status }}</p>
    @if (isModified()) {
      <span class="badge">Modified</span>
    }
  </div>
}
```

## Advanced Usage

### Update Offerte Fields

```typescript
// Update specific fields
this.offerteStore.updateCurrentOfferte({
  status: 'Offerte_Abschluss',
  praemienzahlung: 'jaehrlich',
  kundengeschenk: true,
});

// Or update by key
this.offerteStore.updateOfferte('O.0259777000.001', {
  unterschrieben_am: new Date().toISOString(),
  unterschrieben_art: 'elektronisch',
});
```

### Update Nested Structures

```typescript
// Update betrieb data
this.offerteStore.updateCurrentNestedStructure('betrieb', {
  name1: 'New Company Name',
  plz: '8000',
  ort: 'Zürich',
});

// Update person data
this.offerteStore.updateCurrentNestedStructure('person', {
  email: 'new.email@example.com',
  mobiltelefon: '+41 79 123 45 67',
});

// Update BB data
this.offerteStore.updateCurrentNestedStructure('bb', {
  taetigkeit: 'Neue Tätigkeit',
  anzahlma: 'COD_groesser_10_weniger_20_Mitarbeiter',
});

// Update checkliste
this.offerteStore.updateCurrentNestedStructure('checkliste', {
  alter_versicherter: 48,
  bonitaet_crif: 'CRIF_HOCH',
});
```

### Metadata Management

```typescript
// Update metadata
this.offerteStore.updateCurrentMeta({
  isLoading: true,
  isValid: false,
  validationErrors: {
    betrieb: ['PLZ is required'],
    person: ['Email is invalid'],
  },
});

// Access metadata
const meta = this.offerteStore.currentMeta();
console.log('Last modified:', meta?.lastModified);
console.log('Modified fields:', meta?.modifiedFields);
console.log('Validation errors:', meta?.validationErrors);
```

### Change Detection

```typescript
// Check if offerte is modified
if (this.offerteStore.isCurrentModified()) {
  console.log('Offerte has unsaved changes');
}

// Get modified fields
const modifiedFields = this.offerteStore.getCurrentModifiedFields();
console.log('Modified fields:', Array.from(modifiedFields));

// Reset to original state (discard changes)
this.offerteStore.resetCurrentOfferte();
```

### Save/Sync Operations

```typescript
// Before saving to API
const offerteData = this.offerteStore.currentOfferte();
if (offerteData) {
  this.offerteStore.updateCurrentMeta({ isSaving: true });
  
  try {
    // Prepare for API
    const apiData = OfferteCompleteUtils.prepareForApi(offerteData);
    
    // Save to backend
    await this.offerteService.save(apiData);
    
    // Mark as synced (resets isModified flag)
    this.offerteStore.markCurrentAsSynced();
    
    this.offerteStore.updateCurrentMeta({ 
      isSaving: false,
      syncError: null,
    });
  } catch (error) {
    this.offerteStore.updateCurrentMeta({ 
      isSaving: false,
      syncError: error.message,
    });
  }
}
```

### Multiple Offerten Management

```typescript
// Set multiple offerten
this.offerteStore.setOfferte('O.001', offerte1, false); // Don't set as current
this.offerteStore.setOfferte('O.002', offerte2, false);
this.offerteStore.setOfferte('O.003', offerte3, true);  // Set as current

// Switch between offerten
this.offerteStore.setCurrentKey('O.001');

// Get all offerte keys
const keys = this.offerteStore.offerteKeys();
console.log('Available offerten:', keys);

// Get count
const count = this.offerteStore.offertenCount();
console.log('Total offerten:', count);

// Get all modified offerten
const modifiedKeys = this.offerteStore.modifiedOfferteKeys();
console.log('Modified offerten:', modifiedKeys);

// Check if offerte exists
if (this.offerteStore.hasOfferte('O.001')) {
  // Do something
}
```

### Navigation State

```typescript
// Store previous URL for back navigation
this.offerteStore.setPreviousUrl('/offerten/list');

// Later, navigate back
const previousUrl = this.offerteStore.previousUrl();
if (previousUrl) {
  this.router.navigateByUrl(previousUrl);
}
```

### View Mode

```typescript
// Set read-only mode
this.offerteStore.setViewMode(true);

// Check view mode in template
@if (offerteStore.viewMode()) {
  <p>This offerte is read-only</p>
} @else {
  <button>Edit</button>
}
```

### Cleanup

```typescript
// Delete specific offerte
this.offerteStore.deleteOfferte('O.001');

// Delete current offerte
this.offerteStore.deleteCurrentOfferte();

// Clear all offerten
this.offerteStore.clearAll();

// Clear persisted state
this.offerteStore.clearPersistedState();
```

## Signal Composition

```typescript
// Computed values based on store signals
readonly hasUnsavedChanges = computed(() => 
  this.offerteStore.isCurrentModified() && 
  !this.offerteStore.isCurrentSaving()
);

readonly canSave = computed(() => 
  this.offerteStore.isCurrentModified() &&
  this.offerteStore.isCurrentValid() &&
  !this.offerteStore.isCurrentSaving()
);

readonly betriebName = computed(() => 
  this.offerteStore.currentOfferte()?.betrieb?.name1 || ''
);

readonly personFullName = computed(() => {
  const person = this.offerteStore.currentOfferte()?.person;
  return person ? `${person.name} ${person.vorname}` : '';
});
```

## Effects

```typescript
import { effect } from '@angular/core';

constructor() {
  // React to offerte changes
  effect(() => {
    const offerte = this.offerteStore.currentOfferte();
    if (offerte) {
      console.log('Current offerte changed:', offerte.offertenr);
    }
  });

  // Auto-save on changes
  effect(() => {
    const isModified = this.offerteStore.isCurrentModified();
    if (isModified) {
      // Debounce and auto-save logic
      this.scheduledAutoSave();
    }
  });
}
```

## Type Safety Examples

```typescript
// Full type safety for nested structures
const betrieb: Betrieb | undefined = this.offerteStore.currentOfferte()?.betrieb;
const person: Person | undefined = this.offerteStore.currentOfferte()?.person;
const bb: BB | undefined = this.offerteStore.currentOfferte()?.bb;
const varianten: OfferteVarianteComplete[] | undefined = this.offerteStore.currentOfferte()?.variante;

// TypeScript will enforce correct types
this.offerteStore.updateCurrentNestedStructure('betrieb', {
  name1: 'Valid string',
  // name1: 123, // ❌ TypeScript error: Type 'number' is not assignable to type 'string'
});
```

## Best Practices

1. **Always use signals in templates** for automatic change detection
2. **Use `markAsSynced()` after successful API saves** to reset modification state
3. **Store metadata alongside data** for comprehensive state management
4. **Use computed signals** for derived values instead of manual subscriptions
5. **Leverage nested structure updates** for better performance and cleaner code
6. **Handle errors in metadata** to keep error state with the offerte
7. **Use keys consistently** (typically offertenr) for all operations

## Migration from Old Store

If migrating from the old `OfferteStore`:

```typescript
// Old way
this.offerteStore.updateCurrentOfferte({ 
  taetigkeit: { /* ... */ } 
});

// New way - direct structure mapping
this.offerteTypedStore.updateCurrentOfferte({
  klasse: '44D',
  basisstufe: 121,
  // Access nested structures directly
  betrieb: { /* ... */ },
});

// Or update nested structures separately
this.offerteTypedStore.updateCurrentNestedStructure('betrieb', {
  name1: 'Updated name',
});
```
