import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TableModule } from 'primeng/table';
import { Subscription } from 'rxjs';

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ApiLogEntry, ApiLogService } from '@syrius/core';

@Component({
    selector: 'app-api-inspector',
    standalone: true,
    imports: [CommonModule, TableModule, ButtonModule, RippleModule],
    templateUrl: './api-inspector.component.html',
    styleUrls: ['./api-inspector.component.scss']
})
export class ApiInspectorComponent implements OnInit, OnDestroy {
    private apiLogService = inject(ApiLogService);
    private subscription: Subscription | undefined;

    logs: ApiLogEntry[] = [];

    ngOnInit() {
        this.subscription = this.apiLogService.getLogs().subscribe((logs) => {
            this.logs = logs.map((log) => ({
                ...log,
                expanded: false,
                showRequestHeaders: false,
                showResponseHeaders: false
            }));
        });
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    clearLogs() {
        this.apiLogService.clearLogs();
    }

    toggleRow(log: ApiLogEntry) {
        log.expanded = !log.expanded;
    }

    prettyPrint(obj: unknown): string {
        if (obj === null || obj === undefined) {
            return 'null';
        }
        return JSON.stringify(obj, null, 2);
    }

    getStatusClass(status: 'succeeded' | 'failed' | 'pending'): string {
        if (status === 'succeeded') return 'status-succeeded';
        if (status === 'failed') return 'status-failed';
        return 'status-pending';
    }

    getStatusSeverity(status: 'succeeded' | 'failed' | 'pending'): string {
        if (status === 'succeeded') return 'success';
        if (status === 'failed') return 'danger';
        return 'warning';
    }

    getMethodSeverity(method: string): string {
        switch (method.toUpperCase()) {
            case 'GET':
                return 'info';
            case 'POST':
                return 'success';
            case 'PUT':
            case 'PATCH':
                return 'warning';
            case 'DELETE':
                return 'danger';
            default:
                return 'secondary';
        }
    }

    formatTimestamp(timestamp: Date): string {
        return new Date(timestamp).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }
}
