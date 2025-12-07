import { Component, effect, WritableSignal, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { BugReportService } from '@app/shared/components/bug-report/bug-report.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BugReport } from './bug-report.model';
import { BUG_REPORT_CONFIG } from './bug-report.config';

interface DialogReportData {
    collectedInfo: BugReport['collectedInfo'] | null;
    screenshotPreview: string | undefined | null;
    screenshotProhibited?: boolean;
    screenshotProhibitedReason?: string;
}

@Component({
    selector: 'app-bug-report-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, Textarea, ProgressSpinnerModule, ToastModule, CheckboxModule, TranslateModule],
    templateUrl: './bug-report.component.html'
})
export class BugReportDialogComponent {
    bugReportService = inject(BugReportService);
    private messageService = inject(MessageService);
    private translate = inject(TranslateService);

    description = '';
    reportData: WritableSignal<DialogReportData | null> = signal(null);
    isSubmitting = false;
    submissionError: string | null = null;
    includeScreenshot = true;

    // Computed properties for UI
    isScreenshotProhibited = computed(() => this.reportData()?.screenshotProhibited ?? false);
    screenshotProhibitedMessage = computed(() => this.reportData()?.screenshotProhibitedReason || BUG_REPORT_CONFIG.screenshotProhibitedMessage);
    canToggleScreenshot = computed(() => !this.isScreenshotProhibited() && BUG_REPORT_CONFIG.allowManualScreenshotToggle && !!this.reportData()?.screenshotPreview);

    constructor() {
        effect(() => {
            if (this.bugReportService.showDialogSignal()) {
                this.resetForm();
            }
        });

        effect(() => {
            const serviceData = this.bugReportService.reportDataSignal();
            if (serviceData) {
                this.reportData.set({
                    collectedInfo: serviceData.collectedInfo,
                    screenshotPreview: serviceData.screenshot,
                    screenshotProhibited: serviceData.screenshotProhibited,
                    screenshotProhibitedReason: serviceData.screenshotProhibitedReason
                });
            } else {
                this.reportData.set(null);
            }
        });
    }

    resetForm(): void {
        this.description = '';
        this.isSubmitting = false;
        this.submissionError = null;
        this.includeScreenshot = true;
    }

    async submitReport(): Promise<void> {
        if (!this.description.trim()) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('bugReport.warnNoDescriptionSummary'),
                detail: this.translate.instant('bugReport.warnNoDescriptionDetail')
            });
            return;
        }

        this.isSubmitting = true;
        this.submissionError = null;

        const currentReportData = this.reportData();
        if (!currentReportData || !currentReportData.collectedInfo) {
            this.submissionError = this.translate.instant('bugReport.missingDataError');
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('bugReport.errorSummary'),
                detail: this.submissionError ?? undefined
            });
            this.isSubmitting = false;
            return;
        }

        const bugReportToSubmit: BugReport = {
            userDescription: this.description.trim(),
            collectedInfo: currentReportData.collectedInfo,
            screenshot: this.includeScreenshot ? currentReportData.screenshotPreview || undefined : undefined
        };

        try {
            this.bugReportService.submitBugReport(bugReportToSubmit).subscribe({
                next: (_response) => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translate.instant('bugReport.successSummary'),
                        detail: this.translate.instant('bugReport.successDetail')
                    });
                    this.closeDialog();
                },
                error: (error) => {
                    this.submissionError = error.message || this.translate.instant('bugReport.submissionError');
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translate.instant('bugReport.errorSummary'),
                        detail: this.submissionError ?? undefined
                    });
                    this.isSubmitting = false;
                },
                complete: () => {
                    this.isSubmitting = false;
                }
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.submissionError = message || this.translate.instant('bugReport.submissionError');
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('bugReport.errorSummary'),
                detail: this.submissionError ?? undefined
            });
            this.isSubmitting = false;
        }
    }

    closeDialog(): void {
        this.bugReportService.closeBugReportDialog();
    }
}
