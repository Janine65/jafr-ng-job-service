import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { validateFile } from './file-upload.validation';

@Component({
    selector: 'app-file-upload',
    templateUrl: './file-upload.component.html',
    imports: [CommonModule, TranslateModule]
})
export class FileUploadComponent {
    private translate = inject(TranslateService);

    @Input() iconPath!: string;
    @Input() acceptedFileTypes: string[] = ['*'];
    @Input() isLoading!: boolean;
    @Input() maxFileSize = 10; // MB
    @Input() titleKey = 'common.fileUpload.title';
    @Input() subtitleKey = 'common.fileUpload.subtitle';
    @Input() fileTypesKey = 'common.fileUpload.supportedFileTypes';

    @Output() fileSelected = new EventEmitter<File>();

    get accept(): string {
        return this.acceptedFileTypes.join(',');
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            this.validateAndEmit(file);
            input.value = ''; // Reset input
        }
    }

    private validateAndEmit(file: File) {
        if (!file) return;

        const validationResult = validateFile(file, {
            maxFileSize: this.maxFileSize,
            acceptedFileTypes: this.acceptedFileTypes
        });

        if (!validationResult.success) {
            console.error(validationResult.error);
            return;
        }

        this.fileSelected.emit(file);
    }
}
