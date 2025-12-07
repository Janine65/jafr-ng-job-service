# KPM NG

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.0.6.

## Quick Start for New Developers

### Prerequisites

The setup script will automatically check and help install:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **pnpm** - Installed automatically if missing

### Initial Setup

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd syr-kpm-ng-frontend
   ```

1. Run the installation (everything is automated):

   ```bash
   pnpm install
   ```

The setup script will:

- ✅ Check prerequisites (Node.js, Git, pnpm)
- ✅ Prompt to install pnpm if missing
- ✅ Ask if you want to clone the `syr-ng-core` library
- ✅ Install dependencies
- ✅ Build and link the core library for local development

### Working with Syrius Libraries

This project depends on three local libraries: `@syrius/core`, `@syrius/data-table`, and `@syrius/job-service`.

**Development Workflow:**

```bash
# Watch all libraries (auto-rebuild on changes)
pnpm run libs:watch

# Build all libraries once
pnpm run libs:build

# Rebuild with cache clearing (use when libraries don't update properly)
pnpm run libs:rebuild

# Clear all caches and reinstall (nuclear option)
pnpm run cache:clear

# Then start dev server
pnpm run serve:mock
```

The dev server uses TypeScript source files directly via `tsconfig.json` paths, so changes in libraries reflect immediately without rebuilds. However, running `libs:watch` ensures the built `dist/` artifacts stay up-to-date for production builds.

## Available Commands

### Library Management

| Command | Description |
|---------|-------------|
| `pnpm run libs:watch` | Watch all libraries (auto-rebuild on changes) |
| `pnpm run libs:build` | Build all libraries once |
| `pnpm run libs:rebuild` | Build all libraries with cache clearing and reinstall |
| `pnpm run cache:clear` | Clear all caches (node_modules, .angular, dist) and reinstall |

> **💡 Tip:** Use `libs:rebuild` when library changes aren't being picked up by the dev server. This clears Angular's cache and reinstalls dependencies to ensure the latest library versions are used.

### Development Server

| Command | Description |
|---------|-------------|
| `nx serve:mock` | Start dev server with mock environment |
| `nx serve:dev` | Start dev server with dev environment |
| `nx serve:syst` | Start dev server with syst environment |
| `nx serve:intg` | Start dev server with intg environment |
| `nx serve:prod` | Start dev server with prod environment |

### Building

| Command | Description |
|---------|-------------|
| `nx build` | Build with mock configuration |
| `nx build --configuration dev` | Build with dev configuration |
| `nx build --configuration syst` | Build with syst configuration |
| `nx build --configuration intg` | Build with intg configuration |
| `nx build --configuration prod` | Build with prod configuration |
| `nx build:prod` | Production build (checks translations first) |

### Quality Checks

| Command | Description |
|---------|-------------|
| `nx check:i18n` | Check for missing translations |
| `nx check:sheetjs` | Check for SheetJS updates |
| `nx update:sheetjs` | Update SheetJS to latest version |
| `nx test` | Run unit tests |
| `nx lint` | Run ESLint |

### Core Library Management

| Command | Description |
|---------|-------------|
| `nx core:setup` | Interactive setup with prompts |
| `nx core:setup:auto` | Auto-setup without prompts |
| `nx core:status` | Check link status |
| `nx core:link` | Link for local development |
| `nx core:unlink` | Use npm package version |
| `nx core:build` | Build the core library |

### Code Generation

| Command | Description |
|---------|-------------|
| `nx generate-models` | Generate TypeScript models from API specs |
| `nx generate-services` | Generate API services |

**Environment Variables for Setup:**

- `AUTO_CLONE_CORE=true` - Skip clone confirmation prompt
- `SKIP_INSTALL=true` - Skip automatic `pnpm install` after linking

## Angular CLI Reference

### Starting a Development Server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### Code Scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

### Building Projects

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

### Running Unit Tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
