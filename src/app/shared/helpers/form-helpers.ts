export interface EmptyCheckOptions {
    /**
     * Treat numeric/string zero as empty.
     * Defaults to true to keep existing UI highlight behaviour.
     */
    treatZeroAsEmpty?: boolean;

    /**
     * Treat boolean false as empty.
     * Defaults to false to avoid flagging valid false values.
     */
    treatFalseAsEmpty?: boolean;
}

/**
 * Check if a form field value should be considered empty for styling/validation hints.
 */
export function isEmptyFieldValue(value: unknown, options: EmptyCheckOptions = {}): boolean {
    const { treatZeroAsEmpty = true, treatFalseAsEmpty = false } = options;

    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === 'boolean') {
        return treatFalseAsEmpty ? value === false : false;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return true;
        }
        if (treatZeroAsEmpty && trimmed === '0') {
            return true;
        }
        return false;
    }

    if (typeof value === 'number') {
        if (Number.isNaN(value)) {
            return true;
        }
        return treatZeroAsEmpty ? value === 0 : false;
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    // Dates and other object types are treated as filled
    return false;
}
