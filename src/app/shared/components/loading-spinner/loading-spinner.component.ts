import { Component, Input } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-loading-spinner',
    templateUrl: './loading-spinner.component.html',
    styleUrls: ['./loading-spinner.component.scss'],
    standalone: true,
    imports: [CommonModule, ProgressSpinnerModule]
})
export class LoadingSpinnerComponent {
    @Input() loadingText: string = 'Lade Daten. Bitte warten...';
    @Input() ariaLabel: string = 'Ladeanzeige';
    @Input() spinnerVisible: boolean = true;
    @Input() strokeWidth: string = '2';
    @Input() animationDuration: string = '2s';
    @Input() spinnerSize: string = '50px';
}
