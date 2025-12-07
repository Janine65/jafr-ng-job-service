import { PanelModule } from 'primeng/panel';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import {
    DEFAULT_PROGRESS_LIST_CONFIG, ProgressItem, ProgressListConfiguration
} from './progress-list.model';

// Define local interface for job details request since it might be component-specific
interface JobDetailsRequest {
    jobId: string;
    jobName?: string;
}

@Component({
    selector: 'app-progress-list',
    standalone: true,
    imports: [CommonModule, TranslateModule, PanelModule, PopoverModule, TooltipModule],
    templateUrl: './progress-list.component.html',
    styleUrls: ['./progress-list.component.scss']
})
export class ProgressListComponent implements OnInit {
    @Input() runningJobs: ProgressItem[] = [];
    @Input() completedJobs: ProgressItem[] = [];
    @Input() isLoading = false;
    @Input() completedLoading = false; // Loading state for completed jobs
    @Input() config: ProgressListConfiguration = DEFAULT_PROGRESS_LIST_CONFIG;
    @Input() title?: string;
    @Input() hasMoreCompleted = false;
    @Input() loadingMoreCompleted = false;

    @Output() itemSelected = new EventEmitter<ProgressItem>();
    @Output() completedToggled = new EventEmitter<boolean>();
    @Output() loadMoreRequested = new EventEmitter<void>();
    @Output() jobDetailsRequested = new EventEmitter<JobDetailsRequest>();

    selectedItem: ProgressItem | null = null;
    showCompletedJobs = false;

    // Merged configuration with defaults
    protected mergedConfig: ProgressListConfiguration = {};

    ngOnInit(): void {
        this.mergedConfig = { ...DEFAULT_PROGRESS_LIST_CONFIG, ...this.config };
    }

    // Progress calculation methods
    getSuccessPercentage(job: ProgressItem): number {
        return job.total > 0 ? Math.round((job.successful / job.total) * 100) : 0;
    }

    getFailedPercentage(job: ProgressItem): number {
        return job.total > 0 ? Math.round((job.failed / job.total) * 100) : 0;
    }

    getRunningPercentage(job: ProgressItem): number {
        return job.total > 0 ? Math.round((job.running / job.total) * 100) : 0;
    }

    getPendingCount(job: ProgressItem): number {
        return job.total - job.successful - job.failed - job.running;
    }

    getEstimatedCompletion(job: ProgressItem): Date | null {
        if (job.status !== 'running' || job.running === 0) {
            return null;
        }

        const elapsedMs = Date.now() - job.startTime.getTime();
        const processedItems = job.successful + job.failed;

        if (processedItems === 0) {
            return null;
        }

        const itemsPerMs = processedItems / elapsedMs;
        const remainingItems = job.running + this.getPendingCount(job);
        const estimatedRemainingMs = remainingItems / itemsPerMs;

        return new Date(Date.now() + estimatedRemainingMs);
    }

    // Event handlers
    selectJob(job: ProgressItem): void {
        if (!this.mergedConfig.selectable) {
            return;
        }

        this.selectedItem = job;
        this.itemSelected.emit(job);
    }

    showJobDetails(job: ProgressItem): void {
        const detailsRequest: JobDetailsRequest = {
            jobId: job.id,
            jobName: job.name
        };
        this.jobDetailsRequested.emit(detailsRequest);
    }

    toggleCompletedJobs(): void {
        this.showCompletedJobs = !this.showCompletedJobs;
        this.completedToggled.emit(this.showCompletedJobs);
    }

    loadMoreCompletedJobs(): void {
        if (this.loadingMoreCompleted || !this.hasMoreCompleted) {
            return;
        }
        this.loadMoreRequested.emit();
    }

    // Getter methods for template
    get shouldShowCompletedToggle(): boolean {
        return this.mergedConfig.showCompletedJobs === true;
    }

    get shouldShowLoadMore(): boolean {
        return this.mergedConfig.showLoadMore === true && this.hasMoreCompleted && this.completedJobs.length > 0;
    }

    get shouldShowScrollableContainer(): boolean {
        return this.completedJobs.length > (this.mergedConfig.maxVisibleCompleted || 20);
    }

    get maxHeight(): string {
        const maxVisible = this.mergedConfig.maxVisibleCompleted || 20;
        return this.shouldShowScrollableContainer ? `${maxVisible * 20}px` : 'auto';
    }

    get overflowY(): string {
        return this.shouldShowScrollableContainer ? 'auto' : 'visible';
    }
}
