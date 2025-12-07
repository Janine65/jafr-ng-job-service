# @syrius/jo- 🏗️ **Modern Stack**: Built for Angular 20+ with NgRx Signals and Tailwind CSS-service

A self-contained Angular library for managing background job processing and tracking.

## Features

- 🚀 **Job Creation & Tracking**: Upload files and monitor processing progress
- 📊 **Real-time Progress**: Observable streams for job status updates
- 💾 **Session Persistence**: Jobs persist across page refreshes using sessionStorage
- 🔄 **Polling Management**: Automatic background polling with lifecycle management
- 📝 **Optional Logging**: Built-in console logging with optional custom logger support
- � **Pre-built UI Components**: Ready-to-use job details component with Tailwind CSS styling

## Installation

```bash
npm install @syrius/job-service
```

### Requirements

This library has the following peer dependencies that must be installed in your Angular project:

#### Angular Dependencies

- **Angular 20+**: `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`, `@angular/animations` (^20.0.0)
- **NgRx Signals**: `@ngrx/signals` (^20.0.0)
- **RxJS**: `rxjs` (~7.8.0)
- **Angular Translate**: `@ngx-translate/core` (^16.0.0 || ^17.0.0)

#### Styling Dependencies

- **Tailwind CSS**: Required for proper styling of the job details component

#### Setting up Dependencies

Install the required peer dependencies:

```bash
npm install @angular/core@^20.0.0 @angular/common@^20.0.0 @angular/forms@^20.0.0
npm install @angular/router@^20.0.0 @angular/animations@^20.0.0
npm install @ngrx/signals@^20.0.0 rxjs@~7.8.0 @ngx-translate/core@^17.0.0
```

#### Setting up Tailwind CSS

If you haven't already set up Tailwind CSS in your Angular project:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

Configure your `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
    "./node_modules/@syrius/job-service/**/*.{html,js}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Add Tailwind directives to your global styles (`src/styles.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Quick Start

### 1. Basic Job Service

```typescript
import { JobBaseService, JobServiceConfig } from "@syrius/job-service";

// Extend the base service for your specific job type
@Injectable()
export class MyJobService extends JobBaseService<MyJobEntry> {
  constructor() {
    super({
      serviceName: "MyJob",
      apiBasePath: "/api/jobs",
      endpointName: "process",
      searchEndpointName: "search",
      searchExcelFileEndpointName: "searchFiles",
      translationPrefix: "MY_JOB",
      requiredColumns: ["column1", "column2"],
      rowTranslationKey: "MY_JOB.ROW",
    });
  }

  loadJobDetailsById(jobId: string): Observable<JobDetailsResponse> {
    // Implement job details loading logic
    return this.getJobEntries(jobId).pipe(
      map((entries) => ({
        jobId,
        jobName: entries[0]?.excelfile || "Unknown",
        status: this.calculateStatus(entries),
        // ... map other fields
      }))
    );
  }
}
```

### 2. Process Files in Components

```typescript
@Component({
  template: `
    <input type="file" (change)="onFileSelected($event)" accept=".xlsx" />
    <div *ngIf="currentJob">Progress: {{ currentJob.progress }}%</div>
  `,
})
export class JobProcessorComponent {
  private jobService = inject(MyJobService);
  private excelService = inject(ExcelService); // Your Excel service

  currentJob?: JobProgress;

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      // 1. Parse Excel file (component responsibility)
      const excelData = await this.excelService.parseExcel(file);

      // 2. Create job with parsed data
      this.jobService.processFileAndCreateJob(file, excelData).subscribe({
        next: (job) => (this.currentJob = job),
        error: (error) => console.error("Job failed:", error),
      });
    } catch (error) {
      console.error("Excel parsing failed:", error);
    }
  }
}
```

### 3. Use Pre-built UI Components

```typescript
import { JobDetailsComponent } from "@syrius/job-service";

@Component({
  selector: "app-job-monitor",
  standalone: true,
  imports: [JobDetailsComponent],
  template: `
    <syr-job-details
      [jobDetails]="currentJobDetails"
      [isLoading]="isLoading"
      (refresh)="onRefreshJob()"
    >
    </syr-job-details>
  `,
})
export class JobMonitorComponent {
  currentJobDetails?: JobDetailsResponse;
  isLoading = false;

  onRefreshJob() {
    // Handle refresh logic
    this.loadJobDetails();
  }
}
```

### 4. Optional: Custom Logging

```typescript
// Optional: Provide custom logger
providers: [
  {
    provide: JOB_LOGGER_FACTORY,
    useValue: {
      createLogger: (name: string) => ({
        debug: (msg, ...args) => customLogger.debug(`[${name}]`, msg, ...args),
        error: (msg, ...args) => customLogger.error(`[${name}]`, msg, ...args),
        warn: (msg, ...args) => customLogger.warn(`[${name}]`, msg, ...args),
      }),
    },
  },
];

// Default: Uses console.log automatically (no configuration needed)
```

## UI Components

### JobDetailsComponent

A pre-built Angular component for displaying job progress and details with modern Tailwind CSS styling.

**Features:**

- Real-time job progress display
- Color-coded status indicators
- Detailed entry listing with error messages
- Responsive design for mobile and desktop
- Loading states and empty states

**Inputs:**

- `jobDetails: JobDetailsResponse | null` - The job details to display
- `isLoading: boolean` - Shows loading state when true

**Outputs:**

- `refresh: EventEmitter<void>` - Emitted when user requests a refresh

**Styling:**

- Uses Tailwind CSS utility classes
- Fully responsive with mobile-first design
- Consistent color palette for status indicators

## Core Concepts

### JobBaseService<TEntry>

Abstract base class that provides:

- File upload and processing workflow
- Job progress calculation and tracking
- Session storage persistence
- Polling management
- Cache management

### JobProgress Interface

```typescript
interface JobProgress {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
  progress: number;
  total: number;
  processed: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
}
```

### Key Methods

#### `processFileAndCreateJob(file: File, parsedData: Record<string, unknown>[])`

Main method to create a job. Components must:

1. Parse Excel file themselves
2. Pass both file and parsed data
3. Handle authorization checking

#### `createJobFromUploadedFile(filename: string, validatedData: Record<string, unknown>[])`

Alternative method for pre-uploaded files.

#### `getRunningJobs(): Observable<JobProgress[]>`

Get all currently active jobs.

#### `startPolling() / stopPolling()`

Control background polling lifecycle.

## Benefits

- **Modern Angular**: Built for Angular 20+ with latest features and patterns
- **State Management**: Leverages NgRx Signals for reactive state management
- **No External Services**: No backend service dependencies required
- **Flexible**: Use any Excel library or authorization system
- **Testable**: Easy to mock and unit test with Angular testing utilities
- **Optional Logging**: Works with console by default, custom loggers optional
- **Modern Styling**: Uses Tailwind CSS for consistent, responsive design
- **Type Safe**: Full TypeScript support with generic job entry types
- **Internationalization**: Built-in support for @ngx-translate

## API Reference

See [USAGE.md](./USAGE.md) for detailed examples and migration guide.
