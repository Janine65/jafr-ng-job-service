import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';

import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Betrieb } from '@app/fuv/models/betrieb.model';
import { CodeLabelPipe } from '@app/fuv/pipes/code-label.pipe';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { UidNrFormatPipe } from '@app/shared/pipes/uid-nr-format.pipe';
import { ExternalService } from '@app/shared/services/external.service';
import { TranslateModule } from '@ngx-translate/core';

import { BetriebSearchComponent } from '../../betrieb-search/betrieb-search.component';

@Component({
    selector: 'app-fuv-betrieb',
    standalone: true,
    imports: [CommonModule, FormsModule, PanelModule, ButtonModule, DialogModule, InputTextModule, TranslateModule, BetriebSearchComponent, UidNrFormatPipe, CodeLabelPipe],
    templateUrl: './fuv-betrieb.component.html'
})
export class FuvBetriebComponent {
    private offerteStore = inject(OfferteTypedStore);
    private externalService = inject(ExternalService);

    displaySearchDialog = false;

    // Current betrieb from store
    readonly betrieb = computed(() => this.offerteStore.currentOfferte()?.betrieb ?? null);

    // View mode signal from store metadata
    readonly viewMode = this.offerteStore.isReadOnly;

    showSearchDialog() {
        this.displaySearchDialog = true;
    }

    onBetriebSelected(betrieb: Betrieb) {
        this.persistBetriebToStore(betrieb);
        this.displaySearchDialog = false;
    }

    /**
     * Persist selected betrieb to the offerte store
     */
    private persistBetriebToStore(betrieb: Betrieb): void {
        this.offerteStore.updateOfferte(null, {
            betrieb_boid: betrieb.partnernr,
            betrieb: betrieb
        });
    }

    /**
     * Opens CRM for the selected betrieb
     */
    onOpenCrm(): void {
        const betrieb = this.betrieb();
        if (betrieb?.partnernr) {
            this.externalService.openCrm(betrieb.partnernr);
        }
    }

    /**
     * Opens SYRIUS for the selected betrieb
     */
    onOpenSyrius(): void {
        const betrieb = this.betrieb();
        if (betrieb?.partnernr) {
            this.externalService.openSyrius(betrieb.partnernr);
        }
    }

    /**
     * Opens eDossier (IDMS) for the selected betrieb
     */
    onOpenIdms(): void {
        const betrieb = this.betrieb();
        if (betrieb?.partnernr) {
            this.externalService.openIdms(betrieb.partnernr);
        }
    }

    /**
     * Opens CRIF for the selected betrieb
     */
    onOpenCrif(): void {
        const betrieb = this.betrieb();
        if (betrieb) {
            this.externalService.openCrifBetrieb(betrieb);
        }
    }

    /**
     * Opens Documents (eDossier) for the selected betrieb
     */
    onOpenDocuments(): void {
        const betrieb = this.betrieb();
        if (betrieb?.partnernr) {
            this.externalService.openIdms(betrieb.partnernr);
        }
    }
}
