import { SvNrFormatPipe } from './sv-nr-format.pipe';

describe('SvNrFormatPipe', () => {
    let pipe: SvNrFormatPipe;

    beforeEach(() => {
        pipe = new SvNrFormatPipe();
    });

    it('should create an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('should format valid 13-digit SV number correctly', () => {
        const input = '7568048680071';
        const expected = '756.8048.6800.71';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should format already formatted SV number correctly', () => {
        const input = '756.8048.6800.71';
        const expected = '756.8048.6800.71';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should handle SV number with spaces', () => {
        const input = '756 8048 6800 71';
        const expected = '756.8048.6800.71';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should handle SV number with mixed separators', () => {
        const input = '756-8048.6800 71';
        const expected = '756.8048.6800.71';
        expect(pipe.transform(input)).toBe(expected);
    });

    it('should return original value for invalid length', () => {
        const input = '12345';
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
        const input = '7561234567890';
        const expected = '756.1234.5678.90';
        expect(pipe.transform(input)).toBe(expected);
    });
});
