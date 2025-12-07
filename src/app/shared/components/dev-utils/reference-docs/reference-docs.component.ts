import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';

@Component({
    selector: 'app-reference-docs',
    standalone: true,
    imports: [CardModule, ButtonModule, TooltipModule, DividerModule],
    templateUrl: './reference-docs.component.html'
})
export class ReferenceDocsComponent {
    openLink(url: string): void {
        window.open(url, '_blank');
    }
}
