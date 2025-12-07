# @syrius/job-service Usage Guide

The job service library is now completely self-contained and does not depend on external services like Excel processing or authorization. Consuming components must handle these concerns themselves.

## Key Changes

### 1. Excel Processing
The library no longer handles Excel parsing. Consuming components must parse Excel files and pass the data:

**Before:**
```typescript
// Old method - required ExcelService injection
this.jobService.processExcelFileAndCreateJob(file);
```

**After:**
```typescript
// New method - component handles Excel parsing
async processFile(file: File) {
  try {
    // Component parses Excel file (using xlsx, @angular/excel, etc.)
    const excelData = await this.excelService.parseExcel(file);
    
    // Pass parsed data to job service
    this.jobService.processFileAndCreateJob(file, excelData).subscribe({
      next: (job) => console.log('Job created:', job),
      error: (error) => console.error('Job failed:', error)
    });
  } catch (error) {
    console.error('Excel parsing failed:', error);
  }
}
```

### 2. Authorization
The library no longer checks user roles. Consuming components should handle authorization:

**Before:**
```typescript
// Old - library checked user roles automatically
this.jobPollingService.registerJobService({
  name: 'einladung',
  displayName: 'Einladung Service', 
  serviceClass: EinladungService,
  requiredRoles: ['BB_AKTUALISIERUNG'] // Library handled this
});
```

**After:**
```typescript
// New - component checks roles before registering
if (this.authService.hasRole('BB_AKTUALISIERUNG')) {
  this.jobPollingService.registerJobService({
    name: 'einladung',
    displayName: 'Einladung Service',
    serviceClass: EinladungService
    // No requiredRoles - component already checked
  });
}
```

### 3. Logging (Optional)
Logging is optional and falls back to console if not provided:

**Optional - Provide Custom Logger:**
```typescript
// Provide custom logger factory
providers: [
  {
    provide: JOB_LOGGER_FACTORY,
    useValue: {
      createLogger: (name: string) => ({
        debug: (msg, ...args) => this.customLogger.debug(`[${name}]`, msg, ...args),
        error: (msg, ...args) => this.customLogger.error(`[${name}]`, msg, ...args),
        warn: (msg, ...args) => this.customLogger.warn(`[${name}]`, msg, ...args)
      })
    }
  }
]
```

**Default - Uses Console:**
```typescript
// No logger provided = automatic console fallback
// No configuration needed, works out of the box
```

## Complete Example

```typescript
import { Component, inject } from '@angular/core';
import { JobBaseService, JobProgress } from '@syrius/job-service';

@Component({
  selector: 'app-job-processor',
  template: `
    <input type="file" (change)="onFileSelected($event)" accept=".xlsx,.xls">
    <div *ngIf="currentJob">
      Job Progress: {{currentJob.progress}}%
    </div>
  `
})
export class JobProcessorComponent {
  private jobService = inject(JobBaseService);
  private excelService = inject(ExcelService);
  private authService = inject(AuthorizationService);
  
  currentJob?: JobProgress;

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // 1. Check authorization (component's responsibility)
    if (!this.authService.hasRole('JOB_PROCESSOR')) {
      alert('Not authorized');
      return;
    }

    try {
      // 2. Parse Excel (component's responsibility)
      const excelData = await this.excelService.parseExcel(file);
      
      // 3. Validate data (optional - can be done by component or service)
      if (!this.isValidData(excelData)) {
        alert('Invalid Excel data');
        return;
      }

      // 4. Pass to job service (library handles job creation and tracking)
      this.jobService.processFileAndCreateJob(file, excelData).subscribe({
        next: (job) => {
          this.currentJob = job;
          console.log('Job created successfully:', job);
        },
        error: (error) => {
          console.error('Job creation failed:', error);
          alert('Job creation failed: ' + error.message);
        }
      });

    } catch (error) {
      console.error('Excel processing failed:', error);
      alert('Excel processing failed: ' + error);
    }
  }

  private isValidData(data: Record<string, unknown>[]): boolean {
    // Component-specific validation logic
    return data && data.length > 0;
  }
}
```

## Benefits of This Approach

1. **Self-Contained Library**: No external dependencies beyond Angular and RxJS
2. **Flexibility**: Consuming components can use any Excel library (xlsx, @angular/excel, etc.)
3. **Authorization Control**: Components have full control over authorization logic
4. **Simpler Integration**: No need to inject complex service adapters
5. **Optional Logging**: Works out-of-the-box with console, custom loggers optional
6. **Better Testing**: Easier to mock and test without complex dependency injection

## Migration Strategy

1. Update consuming components to handle Excel parsing
2. Move authorization checks from service registration to component logic
3. Remove ExcelService and AuthorizationService injection tokens
4. Optional: Replace custom loggers with JOB_LOGGER_FACTORY or use console fallback
