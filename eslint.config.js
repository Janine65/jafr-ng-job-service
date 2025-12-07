// @ts-check
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
// Note: eslint-plugin-deprecation has compatibility issues with ESLint 9
// Keeping it installed for future use when compatibility is fixed
// import deprecationPlugin from 'eslint-plugin-deprecation';

export default tseslint.config(
    {
        files: ['src/app/**/*.ts'],
        extends: [...angular.configs.tsRecommended],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            '@angular-eslint': angular.tsPlugin
            // 'deprecation': deprecationPlugin,
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        processor: angular.processInlineTemplates,
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@angular-eslint/use-lifecycle-interface': 'warn',
            '@angular-eslint/no-lifecycle-call': 'error',
            // 'deprecation/deprecation': 'warn', // Disabled: ESLint 9 compatibility issue
            '@angular-eslint/directive-selector': [
                'error',
                {
                    type: 'attribute',
                    prefix: 'app',
                    style: 'camelCase'
                }
            ],
            '@angular-eslint/component-selector': [
                'error',
                {
                    type: 'element',
                    prefix: 'app',
                    style: 'kebab-case'
                }
            ]
        }
    },
    {
        files: ['src/app/**/*.html'],
        extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
        plugins: {
            '@angular-eslint/template': angular.templatePlugin
        },
        rules: {
            '@angular-eslint/template/elements-content': 'off'
        }
    }
);
