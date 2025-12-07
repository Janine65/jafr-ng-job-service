#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Copy all environment files to assets/config for runtime access
 * The mock version is kept as the main environment.json
 */
function copyEnvironments(stage = 'mock') {
    const envDir = path.join(__dirname, '../src/environments');
    const assetsDir = path.join(__dirname, '../src/assets/config');

    // Ensure assets/config directory exists
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    console.log('📁 Copying environment files to assets/config/...');

    // Get all JSON files from environments folder (excluding environment.ts and environment.json)
    const envFiles = fs
        .readdirSync(envDir)
        .filter((file) => file.endsWith('.json'))
        .filter((file) => file.startsWith('environment.') && file !== 'environment.json');

    // Copy specific environment files to assets/config (these will be git-ignored)
    envFiles.forEach((file) => {
        const source = path.join(envDir, file);
        const destination = path.join(assetsDir, file);

        fs.copyFileSync(source, destination);
        console.log(`  ✅ Copied ${file} (git-ignored)`);
    });

    // Only copy the specific stage as environment.json if it's not mock (since mock is already the default)
    if (stage !== 'mock') {
        const stageFile = `environment.${stage}.json`;
        const stagePath = path.join(envDir, stageFile);
        const mainEnvPath = path.join(assetsDir, 'environment.json');

        if (fs.existsSync(stagePath)) {
            fs.copyFileSync(stagePath, mainEnvPath);
        } else {
            console.error(`❌ Error: Stage file ${stageFile} not found!`);
            process.exit(1);
        }
    }

    // List available environments for reference
    const availableEnvs = envFiles.filter((file) => file.startsWith('environment.') && file !== 'environment.json').map((file) => file.replace('environment.', '').replace('.json', ''));

    console.log(`\n📋 Available environments: ${availableEnvs.join(', ')}`);
    console.log(`🚀 Current active environment: ${stage}\n`);
}

// Get stage from command line argument
const stage = process.argv[2] || 'mock';
copyEnvironments(stage);
