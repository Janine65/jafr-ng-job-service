import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { SplitButtonModule } from 'primeng/splitbutton';
import { TableModule } from 'primeng/table';
import { Subscription } from 'rxjs';

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-translation-manager',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, TableModule, TranslateModule, SplitButtonModule, DividerModule],
    templateUrl: './translation-manager.component.html'
})
export class TranslationManagerComponent implements OnInit, OnDestroy {
    languages: { label: string; value: string }[] = [];
    languageItems: MenuItem[] = [];
    currentLang: string = '';
    missingKeys: { lang: string; key: string }[] = [];
    unusedKeys: { lang: string; key: string }[] = [];

    private translate = inject(TranslateService);
    private langChangeSubscription: Subscription | undefined;

    ngOnInit(): void {
        this.languages = this.translate.getLangs().map((lang) => ({ label: lang, value: lang }));
        this.languageItems = this.translate.getLangs().map((lang) => ({
            label: lang,
            command: () => {
                this.switchLanguage(lang);
            }
        }));
        this.currentLang = this.translate.currentLang;
        this.checkMissingTranslations();

        this.langChangeSubscription = this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
            this.currentLang = event.lang;
            this.checkMissingTranslations();
        });
    }

    ngOnDestroy(): void {
        this.langChangeSubscription?.unsubscribe();
    }

    private getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
        if (!obj) {
            return [];
        }
        return Object.keys(obj).reduce((res, el) => {
            if (typeof obj[el] === 'object' && obj[el] !== null) {
                return [...res, ...this.getKeys(obj[el] as Record<string, unknown>, prefix + el + '.')];
            } else {
                return [...res, prefix + el];
            }
        }, [] as string[]);
    }

    switchLanguage(lang: string) {
        this.translate.use(lang);
        this.currentLang = lang;
    }

    reloadTranslations() {
        this.translate.reloadLang(this.currentLang).subscribe(() => {
            this.checkMissingTranslations();
        });
    }

    checkMissingTranslations() {
        this.missingKeys = [];
        this.unusedKeys = [];
        const referenceLang = 'de';

        // Use currentLang's translation as a workaround since store is private
        const currentLangBefore = this.translate.currentLang;
        this.translate.use(referenceLang);
        const referenceTranslations = (this.translate as any).store?.translations?.[referenceLang] || {};
        const referenceKeys = this.getKeys(referenceTranslations);

        this.translate.getLangs().forEach((lang) => {
            const langTranslations = (this.translate as any).store?.translations?.[lang] || {};
            const langKeys = this.getKeys(langTranslations);

            if (lang !== referenceLang) {
                const missing = referenceKeys.filter((key) => !langKeys.includes(key));
                missing.forEach((key) => {
                    this.missingKeys.push({ lang, key });
                });
            }

            const unused = langKeys.filter((key) => !referenceKeys.includes(key));
            unused.forEach((key) => {
                this.unusedKeys.push({ lang, key });
            });
        });

        // Restore previous language
        if (currentLangBefore !== referenceLang) {
            this.translate.use(currentLangBefore);
        }
    }
}
