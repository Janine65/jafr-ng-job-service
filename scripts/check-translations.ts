import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.resolve(__dirname, '../src/assets/i18n');
const referenceLang = 'de';

function getKeys(obj: any, prefix = ''): string[] {
    return Object.keys(obj).reduce((res, el) => {
        if (typeof obj[el] === 'object' && obj[el] !== null) {
            return [...res, ...getKeys(obj[el], prefix + el + '.')];
        } else {
            return [...res, prefix + el];
        }
    }, [] as string[]);
}

function checkTranslations() {
    const referenceFilePath = path.join(i18nDir, `${referenceLang}.json`);
    const referenceContent = fs.readFileSync(referenceFilePath, 'utf-8');
    const referenceKeys = getKeys(JSON.parse(referenceContent));

    let issueFound = false;

    fs.readdirSync(i18nDir)
        .filter((file) => file.endsWith('.json'))
        .forEach((file) => {
            const filePath = path.join(i18nDir, file);
            const lang = file.split('.')[0];
            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content.trim()) {
                console.warn(`[Warning] The file ${file} is empty and will be skipped.`);
                return;
            }
            const keys = getKeys(JSON.parse(content));

            // Check for missing keys
            if (lang !== referenceLang) {
                const missing = referenceKeys.filter((key) => !keys.includes(key));
                if (missing.length > 0) {
                    issueFound = true;
                    console.error(`Missing keys in ${lang}.json:`);
                    missing.forEach((key) => console.error(`  - ${key}`));
                }
            }

            // Check for unused keys
            const unused = keys.filter((key) => !referenceKeys.includes(key));
            if (unused.length > 0) {
                issueFound = true;
                console.error(`Unused keys in ${lang}.json:`);
                unused.forEach((key) => console.error(`  - ${key}`));
            }
        });

    if (issueFound) {
        console.error('\nTranslation check failed. Please address the issues.');
        process.exit(1);
    }

    console.log('Translation check passed.');
}

checkTranslations();
