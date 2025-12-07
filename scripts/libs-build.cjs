#!/usr/bin/env node

/**
 * Build all Syrius libraries sequentially
 * Usage:
 *   node scripts/libs-build.cjs          # Normal build
 *   node scripts/libs-build.cjs --clean  # Clean cache and reinstall after build
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const libraries = [
    { name: 'core', path: '../../syr-ng-core' },
    { name: 'data-table', path: '../../syr-ng-data-table' },
    { name: 'job-service', path: '../../syr-ng-job-service' }
];

// Check for --clean flag
const shouldClean = process.argv.includes('--clean');

if (shouldClean) {
    console.log('🧹 Cleaning cache before build...\n');

    // Clean local caches
    const cleanDirs = ['node_modules', '.angular', 'dist'];
    for (const dir of cleanDirs) {
        const dirPath = path.resolve(__dirname, '..', dir);
        if (fs.existsSync(dirPath)) {
            console.log(`   Removing ${dir}...`);
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }

    // Clean pnpm temporary cache
    const pnpmTmpPath = path.join(require('os').homedir(), '.pnpm-store', 'v3', 'tmp');
    if (fs.existsSync(pnpmTmpPath)) {
        console.log('   Clearing pnpm temporary cache...');
        fs.rmSync(pnpmTmpPath, { recursive: true, force: true });
    }

    console.log('✔ Cache cleaned\n');
}

console.log('🔨 Building all libraries...\n');

for (const lib of libraries) {
    const libPath = path.resolve(__dirname, lib.path);
    const distPath = path.join(libPath, 'dist');

    console.log(`▶ Building ${lib.name}...`);

    // Remove any existing dist directory first
    if (fs.existsSync(distPath)) {
        fs.rmSync(distPath, { recursive: true, force: true });
    }

    const result = spawnSync('/usr/bin/bash', ['-c', 'pnpm run build'], {
        cwd: libPath,
        stdio: 'inherit'
    });

    // Check for errors
    if (result.error) {
        console.error(`✘ Failed to build ${lib.name}`);
        console.error(`   ${result.error.message}`);
        process.exit(1);
    }

    // Verify dist was created
    if (!fs.existsSync(distPath)) {
        console.error(`✘ Failed to build ${lib.name}`);
        console.error(`   Build completed but dist directory was not created`);
        process.exit(1);
    }

    console.log(`✔ ${lib.name} built successfully\n`);
}

console.log('✓ All libraries built successfully!');

// If --clean flag was used, reinstall dependencies
if (shouldClean) {
    console.log('\n📦 Reinstalling dependencies to pick up rebuilt libraries...\n');

    const reinstallResult = spawnSync('pnpm', ['install'], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit'
    });

    if (reinstallResult.error) {
        console.error('\n✘ Failed to reinstall dependencies');
        console.error(`   ${reinstallResult.error.message}`);
        process.exit(1);
    }

    console.log('\n✓ Dependencies reinstalled successfully!');
    console.log('\n💡 Tip: You may need to restart your dev server to see the changes.');
}
