import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { inject, Injectable, InjectionToken, Injector, OnDestroy } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';

import { JOB_LIBRARY_CONFIG, JobLibraryConfig } from '../config/job-tokens';
import { JOB_LOGGER_FACTORY, LoggerInterface } from './job-base.service';

/**
 * Configuration for a registered job service
 */
export interface JobServiceConfig {
  /** Unique identifier for the service */
  name: string;
  /** Display name for logging */
  displayName: string;
  /** Service class constructor/token for dependency injection */
  serviceClass: any;
  /** Required roles to access this service */
  requiredRoles?: string[];
}

/**
 * Simplified job polling service for the library.
 * This service manages polling lifecycle for multiple job services.
 */
@Injectable({
  providedIn: "root",
})
export class JobPollingService implements OnDestroy {
  // Inject pluggable dependencies with fallbacks
  private logFactory = inject(JOB_LOGGER_FACTORY, { optional: true });
  private libraryConfig = inject(JOB_LIBRARY_CONFIG, { optional: true });
  private router = inject(Router, { optional: true });
  private injector = inject(Injector);
  private logger!: LoggerInterface;

  // Service instances - injected directly (not lazy-loaded)
  private serviceInstances = new Map<string, any>();

  // Registered service configurations (populated by feature modules)
  private registeredServices: JobServiceConfig[] = [];

  private isPollingStarted = false;
  private navigationSubscription?: Subscription;

  constructor() {
    // Initialize logger with fallback
    if (this.logFactory) {
      this.logger = this.logFactory.createLogger("JobPollingService");
    } else {
      this.logger = {
        debug: (message: string, ...args: any[]) =>
          console.debug("[JobPollingService]", message, ...args),
        error: (message: string, ...args: any[]) =>
          console.error("[JobPollingService]", message, ...args),
        warn: (message: string, ...args: any[]) =>
          console.warn("[JobPollingService]", message, ...args),
      };
    }

    // Setup navigation listener if router is available
    this.setupNavigationListener();
  }

  /**
   * Register a job service for polling.
   * Should be called by feature modules during initialization.
   *
   * @param config - Service configuration
   */
  registerJobService(config: JobServiceConfig): void {
    this.logger.debug(`Registering job service: ${config.displayName}`);
    this.registeredServices.push(config);

    // If polling already started, start polling for this new service immediately
    if (this.isPollingStarted) {
      this.startPollingForService(config, 600000);
    }
  }

  /**
   * Get or create a service instance from the registry
   */
  private getServiceInstance(config: JobServiceConfig): any {
    if (!this.serviceInstances.has(config.name)) {
      const instance = this.injector.get(config.serviceClass);
      this.serviceInstances.set(config.name, instance);
    }
    return this.serviceInstances.get(config.name);
  }

  /**
   * Initialize polling for all authorized job services.
   *
   * @returns Promise that resolves when polling is set up
   */
  async initializePolling(): Promise<void> {
    if (this.isPollingStarted) {
      this.logger.debug("Polling already started, skipping initialization");
      return;
    }

    this.logger.debug("Initializing job polling service...");
    this.startPollingForAuthorizedServices();
  }

  /**
   * Setup navigation listener to cancel pending HTTP requests.
   * This prevents navigation delays caused by pending polling requests.
   */
  private setupNavigationListener(): void {
    if (!this.router) {
      return; // No router available
    }

    this.navigationSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => {
        this.logger.debug(
          "Navigation detected, cancelling pending HTTP requests"
        );
        this.cancelAllPendingRequests();
      });
  }

  /**
   * Cancel pending HTTP requests in all services.
   * Called automatically on navigation to prevent blocking.
   */
  private cancelAllPendingRequests(): void {
    this.logger.debug("Cancelling all pending HTTP requests for navigation");

    // Stop all polling and cancel requests in all cached service instances
    for (const [name, service] of this.serviceInstances) {
      if (service.stopPolling) service.stopPolling();
      if (service.stopRunningJobsPolling) service.stopRunningJobsPolling();
    }

    // Restart polling after navigation completes
    setTimeout(() => {
      if (this.isPollingStarted) {
        this.logger.debug("Restarting polling after navigation");
        this.startPollingForAuthorizedServices();
      }
    }, 1000);
  }

  /**
   * Start polling for all registered services.
   * Authorization is handled by consuming components.
   *
   * @param intervalMs - Polling interval (default: 600000ms = 10 minutes)
   */
  private startPollingForAuthorizedServices(intervalMs: number = 600000): void {
    this.logger.debug("Starting polling for all registered job services...");

    const registeredServiceNames: string[] = [];

    // Start polling for all registered services
    this.registeredServices.forEach((config: JobServiceConfig) => {
      registeredServiceNames.push(config.name);
      this.startPollingForService(config, intervalMs);
    });

    this.isPollingStarted = true;
    this.logger.debug(
      `Polling started for ${registeredServiceNames.length} services:`,
      registeredServiceNames
    );
  }

  /**
   * Start polling for a specific service.
   *
   * @param config - Service configuration from registry
   * @param intervalMs - Polling interval for completed jobs
   */
  private startPollingForService(
    config: JobServiceConfig,
    intervalMs: number
  ): void {
    this.logger.debug(`Starting polling for ${config.displayName}`);

    const service = this.getServiceInstance(config);
    if (service.startPolling) service.startPolling(intervalMs);
    // Start running jobs polling with configured interval (default 30 seconds)
    const runningJobsInterval =
      this.libraryConfig?.runningJobsPollingInterval ?? 30000;
    if (service.startRunningJobsPolling) {
      this.logger.debug(
        `Starting running jobs polling for ${config.displayName} (interval: ${runningJobsInterval}ms)`
      );
      service.startRunningJobsPolling(runningJobsInterval);
    }
  }

  /**
   * Stop polling for all services.
   * Useful for cleanup (e.g., user logout).
   */
  stopAllPolling(): void {
    this.logger.debug("Stopping all job polling");

    // Stop all polling in all cached service instances
    for (const [name, service] of this.serviceInstances) {
      if (service.stopPolling) service.stopPolling();
      if (service.stopRunningJobsPolling) service.stopRunningJobsPolling();
    }

    this.isPollingStarted = false;
  }

  /**
   * Resume polling for all registered services.
   * Restarts polling if it was previously stopped.
   *
   * @param intervalMs - Optional polling interval (default: 600000ms = 10 minutes)
   */
  resumePolling(intervalMs: number = 600000): void {
    if (!this.isPollingStarted) {
      this.logger.debug("Resuming job polling");
      this.startPollingForAuthorizedServices(intervalMs);
    } else {
      this.logger.debug("Polling already started, skipping resume");
    }
  }

  /**
   * Cleanup on service destruction
   */
  ngOnDestroy(): void {
    this.logger.debug("JobPollingService destroyed, cleaning up");
    this.stopAllPolling();

    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
  }
}
