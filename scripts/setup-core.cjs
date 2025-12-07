#!/usr/bin/env node

/**
 * Auto-setup script for @syrius/core development
 *
 * This script automatically:
 * 1. Checks if syr-ng-core exists in parent directory
 * 2. Clones it if missing (with confirmation prompt)
 * 3. Installs core dependencies
 * 4. Links core for local development
 * 5. Reinstalls frontend node_modules to apply the link
 *
 * New developers just run: pnpm install
 * Everything is set up automatically!
 *
 * To modify core library code:
 * - Open in VS Code: code /path/to/syr-ng-core
 * - Or use the core repo directly in a separate window
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CORE_REPO_URL = 'ssh://git@git.suvanet.ch:7999/scsyrius-tools/syr-ng-core.git';
const CORE_DIR = path.resolve(__dirname, '../../syr-ng-core');
const FRONTEND_DIR = path.resolve(__dirname, '..');
const USE_AUTO_CLONE = process.env.AUTO_CLONE_CORE === 'true';
const SKIP_INSTALL = process.env.SKIP_INSTALL === 'true';

function exec(command, options = {}) {
    try {
        return execSync(command, {
            stdio: 'inherit',
            ...options
        });
    } catch (error) {
        return null;
    }
}

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans);
        })
    );
}

function commandExists(command) {
    try {
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function checkNodeVersion() {
    try {
        const version = execSync('node --version', { encoding: 'utf-8' }).trim();
        const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
        return { installed: true, version, majorVersion };
    } catch {
        return { installed: false };
    }
}

function checkPnpmVersion() {
    try {
        const version = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
        return { installed: true, version };
    } catch {
        return { installed: false };
    }
}

function checkGit() {
    try {
        const version = execSync('git --version', { encoding: 'utf-8' }).trim();
        return { installed: true, version };
    } catch {
        return { installed: false };
    }
}

async function installPnpm() {
    console.log('\n📦 Installing pnpm globally...');
    console.log('   Running: npm install -g pnpm\n');

    const result = exec('npm install -g pnpm');

    if (result === null) {
        console.error('❌ Failed to install pnpm');
        console.log('\n💡 Please install manually:');
        console.log('   npm install -g pnpm');
        console.log('   or visit: https://pnpm.io/installation\n');
        return false;
    }

    console.log('✅ pnpm installed successfully!\n');
    return true;
}

async function checkPrerequisites() {
    console.log('🔍 Checking prerequisites...\n');

    let allGood = true;

    // Check Node.js
    const nodeCheck = checkNodeVersion();
    if (!nodeCheck.installed) {
        console.error('❌ Node.js is not installed');
        console.log('💡 Install Node.js from: https://nodejs.org/\n');
        allGood = false;
    } else if (nodeCheck.majorVersion < 18) {
        console.error(`❌ Node.js version ${nodeCheck.version} is too old`);
        console.log('💡 This project requires Node.js 18 or higher');
        console.log('   Install from: https://nodejs.org/\n');
        allGood = false;
    } else {
        console.log(`✅ Node.js ${nodeCheck.version}`);
    }

    // Check Git
    const gitCheck = checkGit();
    if (!gitCheck.installed) {
        console.error('❌ Git is not installed');
        console.log('💡 Install Git from: https://git-scm.com/downloads\n');
        allGood = false;
    } else {
        console.log(`✅ ${gitCheck.version}`);
    }

    // Check pnpm
    const pnpmCheck = checkPnpmVersion();
    if (!pnpmCheck.installed) {
        console.log('⚠️  pnpm is not installed');

        const answer = await askQuestion('\nWould you like to install pnpm now? (Y/n): ');

        if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
            console.log('\n💡 Please install pnpm manually:');
            console.log('   npm install -g pnpm');
            console.log('   or visit: https://pnpm.io/installation\n');
            allGood = false;
        } else {
            const installed = await installPnpm();
            if (!installed) {
                allGood = false;
            } else {
                // Verify installation
                const recheck = checkPnpmVersion();
                if (recheck.installed) {
                    console.log(`✅ pnpm ${recheck.version}`);
                } else {
                    console.error('❌ pnpm installation verification failed\n');
                    allGood = false;
                }
            }
        }
    } else {
        console.log(`✅ pnpm ${pnpmCheck.version}`);
    }

    console.log('');
    return allGood;
}

function coreExists() {
    return fs.existsSync(CORE_DIR) && fs.existsSync(path.join(CORE_DIR, 'package.json'));
}

function isCoreLinked() {
    const nodeModulesCore = path.resolve(__dirname, '../node_modules/@syrius/core');
    try {
        const stats = fs.lstatSync(nodeModulesCore);
        return stats.isSymbolicLink();
    } catch {
        return false;
    }
}

console.log('\n🔧 Setting up @syrius/core for development...\n');

// Main async function
async function main() {
    // Check prerequisites first
    const prerequisitesOk = await checkPrerequisites();

    if (!prerequisitesOk) {
        console.error('❌ Setup cannot continue without required tools.\n');
        console.log('💡 Please install the missing prerequisites and try again.\n');
        process.exit(1);
    }

    console.log('🎉 All prerequisites are met!\n');

    // Check if core repo exists
    if (!coreExists()) {
        console.log('📦 Core repository not found at:', CORE_DIR);

        if (USE_AUTO_CLONE) {
            console.log('🔄 Cloning syr-ng-core repository...');
            exec(`git clone ${CORE_REPO_URL} ${CORE_DIR}`);

            if (!coreExists()) {
                console.error('❌ Failed to clone core repository');
                console.log('💡 Please clone manually:');
                console.log(`   cd ${path.dirname(CORE_DIR)}`);
                console.log(`   git clone ${CORE_REPO_URL}`);
                process.exit(0); // Don't fail, just inform
            }
        } else {
            // Ask for confirmation
            console.log('\n💡 Would you like to clone the syr-ng-core repository now?');
            console.log(`   Location: ${CORE_DIR}`);
            console.log(`   Repository: ${CORE_REPO_URL}\n`);

            const answer = await askQuestion('Clone now? (y/N): ');

            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                console.log('\n🔄 Cloning syr-ng-core repository...');
                const result = exec(`git clone ${CORE_REPO_URL} ${CORE_DIR}`);

                if (!coreExists()) {
                    console.error('\n❌ Failed to clone core repository');
                    console.log('💡 Please clone manually:');
                    console.log(`   cd ${path.dirname(CORE_DIR)}`);
                    console.log(`   git clone ${CORE_REPO_URL}`);
                    console.log('   Then run: pnpm run link:core\n');
                    process.exit(0);
                }
                console.log('✅ Successfully cloned syr-ng-core!\n');
            } else {
                console.log('\n📦 Skipping clone.');
                console.log('💡 To clone later:');
                console.log(`   cd ${path.dirname(CORE_DIR)}`);
                console.log(`   git clone ${CORE_REPO_URL}`);
                console.log('   pnpm run link:core');
                console.log('\n📦 Using npm package @syrius/core for now.\n');
                process.exit(0);
            }
        }
    }

    // Core exists, now install its dependencies
    console.log('📦 Installing core dependencies...');
    exec('pnpm install', { cwd: CORE_DIR, stdio: 'ignore' });

    // Build the core library
    console.log('🔨 Building core library...');
    exec('pnpm build', { cwd: CORE_DIR, stdio: 'ignore' });

    // Check if already linked
    if (isCoreLinked()) {
        console.log('✅ @syrius/core is already linked!');
        console.log(`📁 Core location: ${CORE_DIR}`);
        console.log('\n💡 To modify core library code:');
        console.log(`   code ${CORE_DIR}`);
        console.log('   or open it in VS Code as a separate workspace\n');
        process.exit(0);
    }

    // Link the core
    console.log('🔗 Linking @syrius/core for local development...');

    // First, create global link in core repo
    exec('pnpm link --global', { cwd: CORE_DIR, stdio: 'ignore' });

    // Then link it in this repo
    exec('pnpm link --global @syrius/core', { cwd: FRONTEND_DIR, stdio: 'ignore' });

    if (isCoreLinked()) {
        console.log('✅ Successfully linked @syrius/core!');
        console.log(`📁 Core location: ${CORE_DIR}`);

        // Reinstall node_modules to apply the link
        if (!SKIP_INSTALL) {
            console.log('\n📦 Reinstalling frontend dependencies to apply link...');
            console.log('   (This may take a moment...)');
            exec('pnpm install', { cwd: FRONTEND_DIR, stdio: 'ignore' });
            console.log('✅ Dependencies reinstalled successfully!');
        }

        console.log('\n💡 To modify core library code:');
        console.log(`   code ${CORE_DIR}`);
        console.log('   or open it in VS Code as a separate workspace');
        console.log('\n💡 To unlink and use npm package: pnpm run unlink:core\n');
    } else {
        console.log('⚠️  Link failed, using npm package instead');
        console.log('💡 Try manually: pnpm run link:core\n');
    }
}

// Run main function
main().catch((error) => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
});
