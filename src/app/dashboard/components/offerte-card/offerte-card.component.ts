import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { DashboardPermissions } from '../../interfaces/dashboard-permissions.interface';
import { DashboardOffertenSummary } from '../../interfaces/dashboard.interface';
import {
    getOffertenStatusLabel, getOffertenStatusSeverity, getTimeAgo
} from '../../utils/dashboard.utils';

@Component({
    selector: 'app-offerte-section',
    standalone: true,
    imports: [CommonModule, CardModule, ButtonModule, TagModule, TooltipModule],
    templateUrl: './offerte-card.component.html'
})
export class OfferteCardComponent {
    @Input() offerten: DashboardOffertenSummary[] = [];
    @Input() permissions!: DashboardPermissions;

    @Output() navigateToOfferteCreation = new EventEmitter<void>();
    @Output() navigateToOfferteSearch = new EventEmitter<void>();
    @Output() navigateToOfferteDetail = new EventEmitter<string>();

    onNavigateToOfferteCreation(): void {
        this.navigateToOfferteCreation.emit();
    }

    onNavigateToOfferteSearch(): void {
        this.navigateToOfferteSearch.emit();
    }

    onNavigateToOfferteDetail(offertenNummer: string): void {
        this.navigateToOfferteDetail.emit(offertenNummer);
    }

    getOffertenStatusLabel(status: string): string {
        return getOffertenStatusLabel(status);
    }

    getOffertenStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
        return getOffertenStatusSeverity(status);
    }

    getTimeAgo(date: string | Date): string {
        return getTimeAgo(date);
    }
}
