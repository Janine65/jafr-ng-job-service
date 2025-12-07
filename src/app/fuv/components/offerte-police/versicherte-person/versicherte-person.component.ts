import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';

import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Person } from '@app/fuv/models/person.model';
import { OfferteTypedStore } from '@app/fuv/stores/offerte.store';
import { SvNrFormatPipe } from '@app/shared/pipes/sv-nr-format.pipe';
import { ExternalService } from '@app/shared/services/external.service';
import { TranslateModule } from '@ngx-translate/core';

import { PersonSearchComponent } from '../../person-search/person-search.component';

@Component({
    selector: 'app-versicherte-person',
    standalone: true,
    imports: [CommonModule, FormsModule, PanelModule, ButtonModule, DialogModule, InputTextModule, TranslateModule, PersonSearchComponent, DatePipe, SvNrFormatPipe],
    templateUrl: './versicherte-person.component.html'
})
export class VersichertePersonComponent {
    private offerteStore = inject(OfferteTypedStore);
    private externalService = inject(ExternalService);

    displaySearchDialog = false;

    // Current person from store
    readonly person = computed(() => this.offerteStore.currentOfferte()?.person ?? null);

    // View mode signal from store metadata
    readonly viewMode = this.offerteStore.isReadOnly;

    showSearchDialog() {
        this.displaySearchDialog = true;
    }

    onPersonSelected(person: Person) {
        this.persistPersonToStore(person);
        this.displaySearchDialog = false;
    }

    /**
     * Persist selected person to the offerte store
     */
    private persistPersonToStore(person: Person): void {
        this.offerteStore.updateOfferte(null, {
            person_boid: person.partnernr,
            person: person
        });
    }

    /**
     * Opens CRM for the selected person
     */
    onOpenCrm(): void {
        const person = this.person();
        if (person?.partnernr) {
            this.externalService.openCrm(person.partnernr);
        }
    }

    /**
     * Opens SYRIUS for the selected person
     */
    onOpenSyrius(): void {
        const person = this.person();
        if (person?.partnernr) {
            this.externalService.openSyrius(person.partnernr);
        }
    }

    /**
     * Opens eDossier (IDMS) for the selected person
     */
    onOpenIdms(): void {
        const person = this.person();
        if (person?.partnernr) {
            this.externalService.openIdms(person.partnernr);
        }
    }

    /**
     * Opens CRIF for the selected person
     */
    onOpenCrif(): void {
        const person = this.person();
        if (person) {
            this.externalService.openCrifPerson(person);
        }
    }
}
