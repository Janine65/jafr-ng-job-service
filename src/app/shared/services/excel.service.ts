import * as XLSX from 'xlsx';

import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Service for Excel file operations including parsing, styling, and export.
 * Provides methods for reading, displaying, and downloading Excel files.
 */
@Injectable({ providedIn: 'root' })
export class ExcelService {
    constructor(private sanitizer: DomSanitizer) {}

    /**
     * Parses an Excel file and returns the data as an array of objects.
     * Column headers are normalized to lowercase for consistent validation.
     *
     * @param file - The Excel file to parse (.xlsx or .xls)
     * @returns Promise resolving to array of row objects with lowercase keys
     */
    parseExcel(file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    // This will read the workbook even if columns are hidden or resized
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                    // Normalize keys to lowercase for consistent validation
                    const lowercasedJson = json.map((row) => {
                        const newRow: { [key: string]: any } = {};
                        for (const key in row) {
                            if (Object.prototype.hasOwnProperty.call(row, key)) {
                                newRow[key.toLowerCase()] = row[key];
                            }
                        }
                        return newRow;
                    });

                    resolve(lowercasedJson);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Creates a styled HTML preview of an Excel sheet.
     * Useful for displaying example tables with Excel-like formatting.
     *
     * @param data - 2D array of data (rows and columns)
     * @param sheetName - Name of the sheet (default: 'Sheet1')
     * @returns SafeHtml containing styled table with Excel-like appearance
     */
    createStyledPreview(data: unknown[][], sheetName: string = 'Sheet1'): SafeHtml {
        const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const html = XLSX.write(wb, { type: 'string', bookType: 'html' });
        return this.sanitizer.bypassSecurityTrustHtml(this.applyExcelStyling(html));
    }

    /**
     * Downloads an Excel file with the given data.
     * Creates a .xlsx file from a 2D array of values.
     *
     * @param data - 2D array of data (rows and columns)
     * @param fileName - Name of the file to download (without extension)
     * @param sheetName - Name of the sheet (default: 'Sheet1')
     */
    downloadExcelFile(data: unknown[][], fileName: string, sheetName: string = 'Sheet1'): void {
        const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }

    /**
     * Exports JSON data as an Excel file.
     * Creates a .xlsx file from an array of objects with timestamp.
     *
     * @param json - Array of objects to export
     * @param excelFileName - Base name of the file (without extension)
     */
    exportAsExcelFile(json: any[], excelFileName: string): void {
        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(json);
        const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
        XLSX.writeFile(workbook, `${excelFileName}_export_${new Date().getTime()}.xlsx`);
    }

    /**
     * Applies Excel-like styling to HTML table output.
     * Adds CSS for borders, colors, and hover effects.
     *
     * @param html - HTML string containing table
     * @returns Styled HTML string with embedded CSS and excel-table class
     */
    private applyExcelStyling(html: string): string {
        return `
            <style>
                .excel-table {
                    border-collapse: collapse;
                    font-family: Arial, sans-serif;
                    font-size: 11pt;
                    width: 100%;
                }
                .excel-table th,
                .excel-table td {
                    border: 1px solid #d0d7de;
                    padding: 8px 12px;
                    text-align: left;
                }
                .excel-table th {
                    background-color: #4472C4;
                    color: white;
                    font-weight: bold;
                }
                .excel-table tr:nth-child(even) {
                    background-color: #f6f8fa;
                }
                .excel-table tr:hover {
                    background-color: #eef2f7;
                }
            </style>
            ${html.replace(/<table/g, '<table class="excel-table"')}
        `;
    }
}
