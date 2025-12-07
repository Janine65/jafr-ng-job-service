#!/usr/bin/env node
import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as util from 'util';
import * as semver from 'semver';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execPromise = util.promisify(exec);
const CDN_PKG_URL = 'https://registry.npmjs.org/xlsx/latest';

interface PackageJson {
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
}

async function getLocalVersion(): Promise<string | null> {
    try {
        const pkgPath = path.join(__dirname, '../package.json');
        const pkgData = await fs.readFile(pkgPath, 'utf8');
        const pkg: PackageJson = JSON.parse(pkgData);
        const version = pkg.dependencies?.['xlsx'] || pkg.devDependencies?.['xlsx'];

        if (!version) {
            return null;
        }

        // Handle versions from tarball URLs, e.g., https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
        const tgzMatch = version.match(/xlsx-([0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?)\.tgz/);
        if (tgzMatch) {
            return tgzMatch[1];
        }

        // Handle semver ranges, e.g., ^0.20.3
        const minVersion = semver.minVersion(version);
        if (minVersion) {
            return minVersion.version;
        }

        return version; // Fallback for pinned versions, e.g., 0.20.3
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            console.error('[SheetJS Update] Error: package.json not found in the parent directory.');
            return null;
        }
        console.error('[SheetJS Update] Error reading local package.json:', err.message);
        throw err; // Rethrow for fatal error handling
    }
}

interface NpmPkg {
    version: string;
}

async function getCdnPkgVersion(): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(CDN_PKG_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[SheetJS Update] Error fetching CDN package version. Status: ${response.status}`);
            return null;
        }
        const pkg: NpmPkg = await response.json();
        return pkg.version;
    } catch (err: any) {
        console.error('[SheetJS Update] Error during CDN package version fetch:', err.message);
        if (err.name === 'AbortError') {
            console.error('[SheetJS Update] Request timed out.');
        }
        return null;
    }
}

async function updateSheetJS(cdnVersion: string): Promise<boolean> {
    const tgzUrl = `https://cdn.sheetjs.com/xlsx-${cdnVersion}/xlsx-${cdnVersion}.tgz`;
    console.log(`[SheetJS Update] Installing new version v${cdnVersion} via pnpm...`);
    const command = `pnpm install --save xlsx@${tgzUrl}`;

    try {
        console.log(`[SheetJS Update] Running: ${command}`);
        const { stdout, stderr } = await execPromise(command);
        console.log('[SheetJS Update] pnpm stdout:', stdout);
        if (stderr) {
            console.warn('[SheetJS Update] pnpm stderr:', stderr);
        }
        console.log(`[SheetJS Update] SheetJS (xlsx) successfully installed with version v${cdnVersion}!`);
        return true;
    } catch (err: any) {
        console.error('[SheetJS Update] Failed to update SheetJS via pnpm.');
        console.error(err); // Log the full error object for debugging.
        return false;
    }
}

async function warnIfOutdated(updateFlag: boolean): Promise<number> {
    const localVersion = await getLocalVersion();
    const cdnVersion = await getCdnPkgVersion();

    if (!cdnVersion) {
        console.log('[SheetJS Update] Could not fetch latest version info. Please check network connection and firewall settings.');
        return 1; // Return error code
    }

    if (!localVersion) {
        console.log(`[SheetJS Update] No local xlsx installation found. Latest available: v${cdnVersion}`);
        if (updateFlag) {
            await updateSheetJS(cdnVersion);
        } else {
            console.log(`To update, run: npm run check-sheetjs-update -- --update`);
        }
        return 0;
    }

    if (semver.gt(cdnVersion, localVersion)) {
        console.log(`\x1b[33m[SheetJS Update] Update available: local v${localVersion}, latest v${cdnVersion}.\x1b[0m`);
        if (updateFlag) {
            await updateSheetJS(cdnVersion);
        } else {
            console.log(`To update, run: npm run check-sheetjs-update -- --update`);
        }
    } else {
        console.log(`[SheetJS Update] Latest version is already installed: ${localVersion}`);
    }
    return 0;
}

(async () => {
    try {
        console.log('[SheetJS Update] Starting update/check process...');
        const updateFlag = process.argv.slice(2).includes('--update') || process.argv.slice(2).includes('-u');
        const exitCode = await warnIfOutdated(updateFlag);
        console.log('[SheetJS Update] Update/check process completed.');
        process.exit(exitCode);
    } catch (err: any) {
        console.error('[SheetJS Update] A fatal error occurred:', err);
        process.exit(1);
    }
})();
