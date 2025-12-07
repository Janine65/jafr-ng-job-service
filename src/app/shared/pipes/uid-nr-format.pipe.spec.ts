import { UidNrFormatPipe } from './uid-nr-format.pipe';

describe('UidNrFormatPipe', () => {
    let pipe: UidNrFormatPipe;

    beforeEach(() => {
        pipe = new UidNrFormatPipe();
    });

    it('should create an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('should format valid UID number correctly', () => {
        const input = 'CHE480430214';
        const expected = 'CHE-480.430.214';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should format already formatted UID number correctly', () => {
        const input = 'CHE-480.430.214';
        const expected = 'CHE-480.430.214';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should handle lowercase input', () => {
        const input = 'che480430214';
        const expected = 'CHE-480.430.214';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should handle UID with spaces', () => {
        const input = 'CHE 480 430 214';
        const expected = 'CHE-480.430.214';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should handle UID with mixed separators', () => {
        const input = 'CHE-480 430.214';
        const expected = 'CHE-480.430.214';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should return original value for invalid format (no CHE prefix)', () => {
        const input = 'ABC123456789';
        expect(pipe.transform(input)).toBe(input);
    });

    it('should return original value for invalid format (wrong number of digits)', () => {
        const input = 'CHE12345';
        expect(pipe.transform(input)).toBe(input);
    });

    it('should return "-" for null value', () => {
        expect(pipe.transform(null)).toBe('-');
    });

    it('should return "-" for undefined value', () => {
        expect(pipe.transform(undefined)).toBe('-');
    });

    it('should return "-" for empty string', () => {
        expect(pipe.transform('')).toBe('-');
    });

    it('should handle another valid example', () => {
        const input = 'CHE123456789';
        const expected = 'CHE-123.456.789';
        expect(pipe.transform(input)).toBe(expected);
    });
});
