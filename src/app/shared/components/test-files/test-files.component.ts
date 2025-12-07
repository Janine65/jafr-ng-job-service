import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PopoverModule } from 'primeng/popover';
import { ToastModule } from 'primeng/toast';

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EnvironmentService, LogFactoryService, Logger, Stage } from '@syrius/core';

import { TestFileService } from './test-files.service';

export interface TestFile {
    name: string;
    fileName: string;
    description: string;
    path: string;
    pageRoute: string; // Route where this test file is applicable
}

@Component({
    selector: 'app-test-files',
    standalone: true,
    imports: [CommonModule, TranslateModule, PopoverModule, ButtonModule, MessageModule, ToastModule],
    providers: [MessageService],
    template: `
        <button
            *ngIf="showTestBadge"
            class="fixed right-0 z-50 cursor-pointer bg-red-500 text-white px-3 py-1 rounded-l-full shadow-lg hover:bg-red-600 transition-colors duration-200 font-bold text-sm border-0 outline-none focus:ring-2 focus:ring-red-300"
            [style.top]="'33vh'"
            (click)="testPopover.toggle($event)"
            [attr.aria-label]="'Test file injection tool'"
        >
            TEST FILES
        </button>

        <p-popover #testPopover>
            <div class="w-80">
                <div class="flex flex-col justify-between items-center mb-3">
                    <h3 class="text-lg font-semibold">Test File Injection</h3>
                    <p class="text-sm text-gray-500">If you click on a file, it will be automatically injected to the app.</p>
                </div>

                <div *ngIf="availableTestFiles.length > 0; else noFiles">
                    <div class="space-y-2">
                        <button
                            *ngFor="let file of availableTestFiles"
                            (click)="onTestFileClicked(file)"
                            class="w-full p-3 text-left border border-gray-200 rounded hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <div class="font-medium text-gray-900">{{ file.name }}</div>
                            <div class="text-sm text-gray-500 mt-1">{{ file.description }}</div>
                        </button>
                    </div>
                </div>

                <ng-template #noFiles>
                    <p-message severity="info" [text]="'test.badge.noTestFiles' | translate" [closable]="false"></p-message>
                </ng-template>
            </div>
        </p-popover>

        <p-toast></p-toast>
    `,
    styles: [
        `
            :host {
                position: fixed;
                z-index: 9999;
            }
        `
    ]
})
export class TestFilesComponent implements OnInit {
    private testFileService = inject(TestFileService);
    private messageService = inject(MessageService);
    private logFactory = inject(LogFactoryService);
    private logger: Logger = this.logFactory.createLogger('TestFilesComponent');
    private environment = inject(EnvironmentService);

    showTestBadge = false;
    availableTestFiles: TestFile[] = [];
    currentRoute = '';

    ngOnInit(): void {
        // Only show in non-production environments (not PROD stage)
        // DISABLED: Test files badge feature
        // if (!this.environment.isProduction()) {
        //     this.logger.debug('Non-production environment detected. Showing test file-upload badge.');
        //     this.showTestBadge = true;
        //     this.updateAvailableTestFiles();
        // }
    }

    private async updateAvailableTestFiles(): Promise<void> {
        this.logger.debug('Loading test files...');
        this.availableTestFiles = await this.testFileService.getAllTestFiles();
        this.logger.debug('Loaded test files:', this.availableTestFiles);
    }

    async onTestFileClicked(selectedFile: TestFile): Promise<void> {
        this.logger.debug('File clicked:', selectedFile);
        if (selectedFile) {
            this.logger.debug('Starting file upload simulation for:', selectedFile.fileName);
            await this.simulateFileUpload(selectedFile);
        } else {
            this.logger.warn('No file selected');
        }
    }

    private async simulateFileUpload(testFile: TestFile): Promise<void> {
        this.logger.debug('Starting simulateFileUpload for:', testFile.fileName);
        try {
            // Fetch the test file
            this.logger.debug('Fetching file from:', testFile.path);
            const response = await fetch(testFile.path);
            if (!response.ok) {
                throw new Error(`Failed to load test file: ${testFile.fileName} (${response.status})`);
            }

            const blob = await response.blob();
            this.logger.debug('File blob created, size:', blob.size);
            const file = new File([blob], testFile.fileName, {
                type: testFile.fileName.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            this.logger.debug('File object created:', file.name, file.size, file.type);

            // Find file input elements on the page
            const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
            this.logger.debug('Found file inputs:', fileInputs.length);

            if (fileInputs.length === 0) {
                this.logger.warn('No file input found on page');
                this.messageService.add({
                    severity: 'warn',
                    summary: 'No File Input Found',
                    detail: 'No file upload component found on this page',
                    life: 4000
                });
                return;
            }

            // Use the first visible file input (or first one if none are visible)
            let targetInput =
                Array.from(fileInputs).find((input) => {
                    const style = window.getComputedStyle(input);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }) || fileInputs[0];

            this.logger.debug('Target input element:', targetInput);

            // Create a DataTransfer object to simulate file drop/selection
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Set the files property
            targetInput.files = dataTransfer.files;
            this.logger.debug('Files set on input:', targetInput.files.length);

            // Trigger change event to notify the component
            const changeEvent = new Event('change', { bubbles: true });
            this.logger.debug('Dispatching change event');
            targetInput.dispatchEvent(changeEvent);

            // Also trigger input event for additional compatibility
            const inputEvent = new Event('input', { bubbles: true });
            this.logger.debug('Dispatching input event');
            targetInput.dispatchEvent(inputEvent);

            this.logger.log('File upload simulation completed successfully');
            this.messageService.add({
                severity: 'success',
                summary: 'Test File Uploaded',
                detail: `${testFile.fileName} has been uploaded to the page`,
                life: 3000
            });
        } catch (error) {
            this.logger.error('Failed to simulate file upload:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Upload Failed',
                detail: 'Failed to simulate file upload',
                life: 4000
            });
        }
    }
}
