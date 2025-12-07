import { computed, Injectable, signal } from "@angular/core";

import { JobProgress } from "../services/job-base.service";

/**
 * Job type identifier for categorizing different job workflows
 * Fully dynamic - any string can be used as job type
 */
export type JobType = string;

/**
 * State for a specific job type containing running and completed jobs
 */
export interface JobTypeState {
  running: JobProgress[];
  completed: JobProgress[];
  loading: boolean;
  error: string | null;
}

/**
 * Root job state containing all job types
 * Fully dynamic - job types are added at runtime
 */
export type JobState = Record<JobType, JobTypeState>;

/**
 * Initial state for a single job type
 */
const initialJobTypeState: JobTypeState = {
  running: [],
  completed: [],
  loading: false,
  error: null,
};

/**
 * Session storage key for job state persistence
 */
const STORAGE_KEY = "job_state";

/**
 * Dynamic Job Store using Angular Signals
 *
 * Fully dynamic store that can handle any job type at runtime.
 * No hardcoded job types - everything is registered dynamically.
 */
@Injectable({
  providedIn: "root",
})
export class DynamicJobStore {
  // Internal reactive state
  private state = signal<JobState>(this.loadFromStorage());

  // Computed selectors
  readonly allRunningJobs = computed(() => {
    const result: Record<JobType, JobProgress[]> = {};
    const currentState = this.state();
    Object.keys(currentState).forEach((jobType) => {
      result[jobType] = currentState[jobType].running;
    });
    return result;
  });

  readonly allCompletedJobs = computed(() => {
    const result: Record<JobType, JobProgress[]> = {};
    const currentState = this.state();
    Object.keys(currentState).forEach((jobType) => {
      result[jobType] = currentState[jobType].completed;
    });
    return result;
  });

  readonly totalRunningJobsCount = computed(() => {
    const currentState = this.state();
    return Object.values(currentState).reduce(
      (total, jobTypeState) => total + jobTypeState.running.length,
      0
    );
  });

  readonly totalCompletedJobsCount = computed(() => {
    const currentState = this.state();
    return Object.values(currentState).reduce(
      (total, jobTypeState) => total + jobTypeState.completed.length,
      0
    );
  });

  /**
   * Get running jobs for a specific job type
   */
  runningJobs(jobType: JobType) {
    return computed(() => {
      const currentState = this.state();
      return currentState[jobType]?.running || [];
    });
  }

  /**
   * Get completed jobs for a specific job type
   */
  completedJobs(jobType: JobType) {
    return computed(() => {
      const currentState = this.state();
      return currentState[jobType]?.completed || [];
    });
  }

  /**
   * Get all jobs (running + completed) for a specific job type
   */
  allJobs(jobType: JobType) {
    return computed(() => {
      const currentState = this.state();
      const jobTypeState = currentState[jobType];
      if (!jobTypeState) return [];
      return [...jobTypeState.running, ...jobTypeState.completed];
    });
  }

  /**
   * Get loading state for a specific job type
   */
  loading(jobType: JobType) {
    return computed(() => {
      const currentState = this.state();
      return currentState[jobType]?.loading || false;
    });
  }

  /**
   * Get error for a specific job type
   */
  error(jobType: JobType) {
    return computed(() => {
      const currentState = this.state();
      return currentState[jobType]?.error || null;
    });
  }

  /**
   * Get running jobs count for a specific job type
   */
  runningJobsCount(jobType: JobType) {
    return computed(() => {
      const currentState = this.state();
      return currentState[jobType]?.running.length || 0;
    });
  }

  /**
   * Get completed jobs count for a specific job type
   */
  completedJobsCount(jobType: JobType) {
    return computed(() => {
      const currentState = this.state();
      return currentState[jobType]?.completed.length || 0;
    });
  }

  /**
   * Ensure job type exists in state
   */
  private ensureJobType(jobType: JobType): void {
    const currentState = this.state();
    if (!currentState[jobType]) {
      this.state.update((state) => ({
        ...state,
        [jobType]: { ...initialJobTypeState },
      }));
    }
  }

  /**
   * Set running jobs for a specific job type
   */
  setRunningJobs(jobType: JobType, jobs: JobProgress[]): void {
    this.ensureJobType(jobType);
    this.state.update((state) => ({
      ...state,
      [jobType]: {
        ...state[jobType],
        running: jobs,
        loading: false,
        error: null,
      },
    }));
    this.saveToStorage();
  }

  /**
   * Set completed jobs for a specific job type
   */
  setCompletedJobs(jobType: JobType, jobs: JobProgress[]): void {
    this.ensureJobType(jobType);
    this.state.update((state) => ({
      ...state,
      [jobType]: {
        ...state[jobType],
        completed: jobs,
        loading: false,
        error: null,
      },
    }));
    this.saveToStorage();
  }

  /**
   * Add a new running job
   */
  addRunningJob(jobType: JobType, job: JobProgress): void {
    this.ensureJobType(jobType);
    this.state.update((state) => ({
      ...state,
      [jobType]: {
        ...state[jobType],
        running: [...state[jobType].running, job],
      },
    }));
    this.saveToStorage();
  }

  /**
   * Update a specific job (searches in both running and completed)
   */
  updateJob(jobType: JobType, job: JobProgress): void {
    this.ensureJobType(jobType);
    this.state.update((state) => {
      const currentJobState = state[jobType];
      const runningIndex = currentJobState.running.findIndex(
        (j) => j.id === job.id
      );
      const completedIndex = currentJobState.completed.findIndex(
        (j) => j.id === job.id
      );

      if (runningIndex !== -1) {
        const updatedRunning = [...currentJobState.running];
        updatedRunning[runningIndex] = job;
        return {
          ...state,
          [jobType]: {
            ...currentJobState,
            running: updatedRunning,
          },
        };
      } else if (completedIndex !== -1) {
        const updatedCompleted = [...currentJobState.completed];
        updatedCompleted[completedIndex] = job;
        return {
          ...state,
          [jobType]: {
            ...currentJobState,
            completed: updatedCompleted,
          },
        };
      }
      return state;
    });
    this.saveToStorage();
  }

  /**
   * Move a job from running to completed
   */
  moveJobToCompleted(jobType: JobType, jobId: string): void {
    this.ensureJobType(jobType);
    this.state.update((state: JobState) => {
      const currentJobState = state[jobType];
      const jobIndex = currentJobState.running.findIndex(
        (j: JobProgress) => j.id === jobId
      );

      if (jobIndex !== -1) {
        const job = currentJobState.running[jobIndex];
        const updatedRunning = currentJobState.running.filter(
          (j: JobProgress) => j.id !== jobId
        );
        const updatedCompleted = [job, ...currentJobState.completed];

        return {
          ...state,
          [jobType]: {
            ...currentJobState,
            running: updatedRunning,
            completed: updatedCompleted,
          },
        };
      }
      return state;
    });
    this.saveToStorage();
  }

  /**
   * Remove a job from running jobs
   */
  removeRunningJob(jobType: JobType, jobId: string): void {
    this.ensureJobType(jobType);
    this.state.update((state: JobState) => ({
      ...state,
      [jobType]: {
        ...state[jobType],
        running: state[jobType].running.filter(
          (j: JobProgress) => j.id !== jobId
        ),
      },
    }));
    this.saveToStorage();
  }

  /**
   * Clear all jobs for a specific job type
   */
  clearJobs(jobType: JobType): void {
    this.state.update((state: JobState) => ({
      ...state,
      [jobType]: { ...initialJobTypeState },
    }));
    this.saveToStorage();
  }

  /**
   * Clear all jobs (all types)
   */
  clearAllJobs(): void {
    this.state.set({});
    this.saveToStorage();
  }

  /**
   * Set loading state for a job type
   */
  setLoading(jobType: JobType, loading: boolean): void {
    this.ensureJobType(jobType);
    this.state.update((state: JobState) => ({
      ...state,
      [jobType]: {
        ...state[jobType],
        loading,
      },
    }));
  }

  /**
   * Set error for a job type
   */
  setError(jobType: JobType, error: string | null): void {
    this.ensureJobType(jobType);
    this.state.update((state: JobState) => ({
      ...state,
      [jobType]: {
        ...state[jobType],
        error,
        loading: false,
      },
    }));
  }

  /**
   * Load state from sessionStorage
   */
  private loadFromStorage(): JobState {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as JobState;
        // Convert date strings back to Date objects
        Object.values(parsed).forEach((jobTypeState) => {
          jobTypeState.running.forEach((job: JobProgress) => {
            job.startTime = new Date(job.startTime);
            if (job.endTime) job.endTime = new Date(job.endTime);
          });
          jobTypeState.completed.forEach((job: JobProgress) => {
            job.startTime = new Date(job.startTime);
            if (job.endTime) job.endTime = new Date(job.endTime);
          });
        });
        return parsed;
      }
    } catch (error) {
      console.error(
        "[DynamicJobStore] Failed to load state from storage:",
        error
      );
    }
    return {};
  }

  /**
   * Save state to sessionStorage
   */
  private saveToStorage(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch (error) {
      console.error(
        "[DynamicJobStore] Failed to save state to storage:",
        error
      );
    }
  }

  /**
   * Clear all persisted state from sessionStorage
   */
  clearPersistedState(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      this.state.set({});
    } catch (error) {
      console.error(
        "[DynamicJobStore] Failed to clear persisted state:",
        error
      );
    }
  }
}

// Re-export as JobStore for compatibility
export const JobStore = DynamicJobStore;
