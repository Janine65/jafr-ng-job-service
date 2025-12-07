/**
 * File Upload Validation
 *
 * Validates file size and type for file uploads
 */

export interface FileValidationOptions {
    maxFileSize: number; // In MB
    acceptedFileTypes: string[];
}

export interface FileValidationResult {
    success: boolean;
    error?: string;
}

/**
 * Validate file size
 *
 * @param file - File to validate
 * @param maxFileSize - Maximum file size in MB
 * @returns Validation result
 */
export function validateFileSize(file: File, maxFileSize: number): FileValidationResult {
    const fileSizeInMb = file.size / 1024 / 1024;

    if (fileSizeInMb > maxFileSize) {
        return {
            success: false,
            error: `File size exceeds the limit of ${maxFileSize}MB.`
        };
    }

    return { success: true };
}

/**
 * Validate file type
 *
 * @param file - File to validate
 * @param acceptedFileTypes - Array of accepted file extensions (e.g., ['.pdf', '.jpg']) or ['*'] for all types
 * @returns Validation result
 */
export function validateFileType(file: File, acceptedFileTypes: string[]): FileValidationResult {
    // If wildcard is allowed, accept all types
    if (acceptedFileTypes.includes('*')) {
        return { success: true };
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (acceptedFileTypes.includes(fileExtension)) {
        return { success: true };
    }

    return {
        success: false,
        error: `Invalid file type. Accepted types are: ${acceptedFileTypes.join(', ')}`
    };
}

/**
 * Validate file (size and type)
 *
 * @param file - File to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateFile(file: File, options: FileValidationOptions): FileValidationResult {
    if (!file) {
        return {
            success: false,
            error: 'No file provided'
        };
    }

    // Validate file size
    const sizeResult = validateFileSize(file, options.maxFileSize);
    if (!sizeResult.success) {
        return sizeResult;
    }

    // Validate file type
    const typeResult = validateFileType(file, options.acceptedFileTypes);
    if (!typeResult.success) {
        return typeResult;
    }

    return { success: true };
}
