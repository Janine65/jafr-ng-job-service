# Bug Report Component

## Overview

The bug report component allows users to submit bug reports with automatic system information collection and optional screenshots. It includes **two methods** to protect sensitive user data from screenshots:

1. **HTML Markers** (Recommended) - Mark sensitive content directly in templates
2. **Route-Based** - Configure specific routes in config file

## Files

- **`bug-report.config.ts`** - Configuration for screenshot restrictions and report specifications
- **`bug-report.service.ts`** - Service for managing bug report dialog and data collection
- **`bug-report.component.ts`** - Dialog component for user input
- **`bug-report.component.html`** - Template for bug report dialog
- **`bug-report.model.ts`** - TypeScript interfaces for bug report data

## Key Features

✅ Automatic screenshot capture (configurable)  
✅ **Content-based protection via HTML markers**  
✅ Route-based screenshot prohibition  
✅ Comprehensive system info collection  
✅ User-friendly dialog interface  
✅ Configurable required fields  
✅ Multi-language support  

## Quick Usage

### Protect Sensitive Content (Recommended)

Simply add `data-sensitive` attribute to any HTML element:

```html
<!-- Protect entire component -->
<p-panel header="Health Data" data-sensitive>
  <!-- All content here is protected -->
</p-panel>

<!-- Protect specific section -->
<div data-sensitive>
  <h3>Sensitive Information</h3>
  <p>This will not be screenshot</p>
</div>
```

### Prohibit Screenshots on a Route

Edit `bug-report.config.ts`:

```typescript
screenshotProhibitedRoutes: [
  {
    pattern: '/your/sensitive/route',
    matchType: 'startsWith',
    reason: 'Contains sensitive information'
  }
]
```

### Call from Component

```typescript
// Simple usage
this.bugReportService.openBugReportDialog();

// With context (for custom route logic)
this.bugReportService.openBugReportDialog({
  activeStepIndex: this.currentStep
});
```

## Documentation

📘 **[Content Marking Guide](../../../docs/bug-report-content-marking.md)** - HTML marker examples  
📘 **[Bug Report Service](../../../docs/bug-report-service.md)** - Service API and usage  
📘 **[Screenshot Configuration](../../../docs/bug-report-screenshot-config.md)** - Complete config guide  
📘 **[Quick Reference](../../../docs/bug-report-config-quickref.md)** - Quick config examples  

## Current Protected Content

- **Police Antragsfragen** - Health questionnaire marked with `data-sensitive` attribute
  - Location: `/fuv/police` (step 4)
  - Method: Content-based HTML marker

## Examples

### Example 1: Protect Health Questionnaire

```html
<p-panel header="{{ 'fuv.police.steps.antragsfragen' | translate }}" data-sensitive>
  <div class="space-y-6">
    <!-- All health questions here are protected -->
  </div>
</p-panel>
```

### Example 2: Protect Sensitive Table Data

```html
<p-table [value]="patientRecords" data-sensitive>
  <!-- Patient data protected -->
</p-table>
```

### Example 3: Partial Page Protection

```html
<div>
  <h2>Public Information</h2>
  <p>This section can be screenshot</p>
  
  <div data-sensitive>
    <h3>Medical History</h3>
    <p>This section cannot be screenshot</p>
  </div>
  
  <h2>General Notes</h2>
  <p>This section can be screenshot again</p>
</div>
```

## Support

For questions or issues, refer to the documentation above or contact the development team.
