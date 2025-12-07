#!/usr/bin/env node

/**
 * Auto-generate test files manifest based on files in assets/tests folder
 * Run this script whenever you add new test files to automatically update the manifest
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '../src/assets/tests');
const manifestPath = path.join(testsDir, 'manifest.json');

// Route mapping based on file names
const routeMapping = {
    einladung: '/vt/bb/invite',
    erinnerung: '/vt/bb/reminder',
    aktenentscheid: '/vt/decision',
    medikamentenrueckforderung: '/inex/medication-refunds',
    regress: '/inex/payment-recourse'
};

function generateManifest() {
    try {
        const files = fs.readdirSync(testsDir);
        const testFiles = [];

        for (const fileName of files) {
            // Skip manifest.json and directories
            if (fileName === 'manifest.json' || fs.statSync(path.join(testsDir, fileName)).isDirectory()) {
                continue;
            }

            const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();

            // Try to match route based on filename patterns
            let pageRoute = '*'; // Default to available for all pages
            for (const [pattern, route] of Object.entries(routeMapping)) {
                if (baseName.includes(pattern)) {
                    pageRoute = route;
                    break;
                }
            }

            testFiles.push({
                fileName: fileName,
                displayName: `${fileName}`,
                description: `Test ${path.extname(fileName).slice(1).toUpperCase()} file for testing`,
                pageRoute: pageRoute
            });
        }

        const manifest = {
            testFiles: testFiles,
            generated: new Date().toISOString(),
            note: "This file is auto-generated. Run 'node scripts/generate-test-manifest.js' to update."
        };

        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`✓ Generated manifest with ${testFiles.length} test files:`);
        testFiles.forEach((file) => {
            console.log(`  - ${file.fileName} → ${file.pageRoute}`);
        });
    } catch (error) {
        console.error('Error generating manifest:', error);
        process.exit(1);
    }
}

generateManifest();
