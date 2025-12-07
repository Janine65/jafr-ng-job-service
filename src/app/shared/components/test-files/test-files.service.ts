import { inject, Injectable } from '@angular/core';
import { LogFactoryService, Logger } from '@syrius/core';

export interface TestFile {
    name: string;
    fileName: string;
    description: string;
    path: string;
    pageRoute: string; // Route where this test file is applicable
}

@Injectable({
    providedIn: 'root'
})
export class TestFileService {
    private logFactory = inject(LogFactoryService);
    private logger: Logger = this.logFactory.createLogger('TestFileService');

    private testFiles: TestFile[] = [];
    private discoveredFiles = false;

    // Common file extensions to check for fallback discovery
    private fileExtensions = ['csv', 'xlsx', 'xls'];

    // Discover test files automatically using manifest
    private async discoverTestFiles(): Promise<void> {
        if (this.discoveredFiles) return;

        this.logger.debug('Loading test files from manifest...');
        const discoveredFiles: TestFile[] = [];

        try {
            // First, try to load from manifest file
            const manifestResponse = await fetch('assets/tests/manifest.json');
            if (manifestResponse.ok) {
                const manifest = (await manifestResponse.json()) as {
                    testFiles: Array<{
                        fileName: string;
                        displayName: string;
                        description: string;
                        pageRoute: string;
                    }>;
                };

                for (const fileInfo of manifest.testFiles) {
                    const path = `assets/tests/${fileInfo.fileName}`;

                    // Verify the file actually exists
                    try {
                        const fileResponse = await fetch(path, { method: 'HEAD' });
                        if (fileResponse.ok) {
                            discoveredFiles.push({
                                name: fileInfo.displayName,
                                fileName: fileInfo.fileName,
                                description: fileInfo.description,
                                path: path,
                                pageRoute: fileInfo.pageRoute
                            });
                            this.logger.debug(`Found test file: ${fileInfo.fileName}`);
                        }
                    } catch {
                        this.logger.warn(`✗ Manifest listed ${fileInfo.fileName} but file not found`);
                    }
                }
            } else {
                this.logger.debug('No manifest found, falling back to pattern discovery...');
                await this.fallbackDiscovery(discoveredFiles);
            }
        } catch (error) {
            this.logger.debug('Error loading manifest, falling back to pattern discovery...', error);
            await this.fallbackDiscovery(discoveredFiles);
        }

        this.testFiles = discoveredFiles;
        this.discoveredFiles = true;
        this.logger.log(`Discovered ${discoveredFiles.length} test files total`);
    }

    // Fallback discovery method using file patterns - simplified to use file names directly
    private async fallbackDiscovery(discoveredFiles: TestFile[]): Promise<void> {
        // Try to discover any files by attempting common patterns
        const commonPatterns = ['test', 'sample', 'demo', 'data', 'einladung', 'erinnerung', 'aktenentscheid', 'medikamentenrueckforderung', 'regress'];
        for (const pattern of commonPatterns) {
            for (const extension of this.fileExtensions) {
                const fileName = `${pattern}.${extension}`;
                const path = `assets/tests/${fileName}`;

                try {
                    const response = await fetch(path, { method: 'HEAD' });
                    if (response.ok) {
                        // Use file name directly as display name
                        const displayName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
                        discoveredFiles.push({
                            name: displayName,
                            fileName: fileName,
                            description: `Test file: ${fileName}`,
                            path: path,
                            pageRoute: '*' // Available for all routes
                        });
                        this.logger.debug(`Found test file: ${fileName}`);
                    }
                } catch {
                    // File doesn't exist, continue
                }
            }
        }
    }

    async getAllTestFiles(): Promise<TestFile[]> {
        // Discover files if not already done
        await this.discoverTestFiles();

        // Return all test files without filtering by route
        return this.testFiles;
    }

    // Legacy methods - no longer needed as we simulate browser uploads directly
    async injectTestFile(_testFile: TestFile): Promise<void> {
        this.logger.warn('injectTestFile is deprecated - use direct browser simulation instead');
    }

    getCurrentTestFile(): TestFile | null {
        return null;
    }

    clearTestFile(): void {
        // No-op
    }
}
