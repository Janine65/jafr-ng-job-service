import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TextareaModule } from 'primeng/textarea';

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RolesService } from '@syrius/core';

@Component({
    selector: 'app-stored-data',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DividerModule, TextareaModule],
    templateUrl: './stored-data.component.html'
})
export class StoredDataComponent implements OnInit {
    private rolesService = inject(RolesService);

    sessionStorageData: string = '';
    localStorageData: string = '';

    ngOnInit(): void {
        this.loadSessionStorage();
        this.loadLocalStorage();
    }

    loadSessionStorage() {
        const data: { [key: string]: unknown } = {};
        Object.keys(sessionStorage).forEach((key) => {
            const value = sessionStorage.getItem(key);
            try {
                data[key] = JSON.parse(value || '');
            } catch {
                data[key] = value;
            }
        });
        this.sessionStorageData = JSON.stringify(data, null, 2);
    }

    saveSessionStorage() {
        const data = JSON.parse(this.sessionStorageData);
        Object.keys(data).forEach((key) => {
            const value = data[key];
            if (typeof value === 'object') {
                sessionStorage.setItem(key, JSON.stringify(value));
            } else {
                sessionStorage.setItem(key, value);
            }
        });
    }

    clearAllSessionStorage() {
        sessionStorage.clear();
        this.loadSessionStorage();
    }

    clearRoleMappingsCache() {
        this.rolesService.clearCache();
    }

    loadLocalStorage() {
        const data: { [key: string]: unknown } = {};
        Object.keys(localStorage).forEach((key) => {
            const value = localStorage.getItem(key);
            try {
                data[key] = JSON.parse(value || '');
            } catch {
                data[key] = value;
            }
        });
        this.localStorageData = JSON.stringify(data, null, 2);
    }

    saveLocalStorage() {
        const data = JSON.parse(this.localStorageData);
        Object.keys(data).forEach((key) => {
            const value = data[key];
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
        });
    }

    clearAllLocalStorage() {
        localStorage.clear();
        this.loadLocalStorage();
    }
}
