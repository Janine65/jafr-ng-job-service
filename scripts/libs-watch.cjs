#!/usr/bin/env node

/**
 * Watch all Syrius libraries in parallel with color-coded output
 * Usage: node scripts/libs-watch.cjs
 */

const { spawn } = require('child_process');
const path = require('path');

const libraries = [
    { name: 'core', path: '../../syr-ng-core', color: '\x1b[36m' }, // Cyan
    { name: 'data-table', path: '../../syr-ng-data-table', color: '\x1b[33m' }, // Yellow
    { name: 'job-service', path: '../../syr-ng-job-service', color: '\x1b[35m' } // Magenta
];

const reset = '\x1b[0m';
const processes = [];

console.log('🔄 Starting watch mode for all libraries...\n');

libraries.forEach((lib) => {
    const libPath = path.resolve(__dirname, lib.path);

    const proc = spawn('pnpm', ['run', 'build:watch'], {
        cwd: libPath,
        stdio: 'pipe',
        shell: true
    });

    processes.push(proc);

    proc.stdout.on('data', (data) => {
        process.stdout.write(`${lib.color}[${lib.name}]${reset} ${data}`);
    });

    proc.stderr.on('data', (data) => {
        process.stderr.write(`${lib.color}[${lib.name}]${reset} ${data}`);
    });

    proc.on('error', (error) => {
        console.error(`${lib.color}[${lib.name}]${reset} Failed to start: ${error.message}`);
    });

    proc.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            console.error(`${lib.color}[${lib.name}]${reset} Exited with code ${code}`);
        }
    });

    console.log(`${lib.color}▶ Started watching ${lib.name}${reset}`);
});

// Handle graceful shutdown
const cleanup = () => {
    console.log('\n\n🛑 Stopping all watchers...');
    processes.forEach((proc) => {
        if (!proc.killed) {
            proc.kill('SIGTERM');
        }
    });
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('\n✨ All watchers started. Press Ctrl+C to stop.\n');
