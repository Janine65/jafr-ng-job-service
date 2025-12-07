import { TabsModule } from 'primeng/tabs';

import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { EnvironmentService } from '@syrius/core';

import { ApiInspectorComponent } from './api-inspector/api-inspector.component';
import { ComponentTestingComponent } from './component-testing/component-testing.component';
import { KeycloakInfoComponent } from './keycloak-info/keycloak-info.component';
import { ReferenceDocsComponent } from './reference-docs/reference-docs.component';
import { RoleSimulatorComponent } from './role-simulator/role-simulator.component';
import { StateViewerComponent } from './state-viewer/state-viewer.component';
import { StoredDataComponent } from './stored-data/stored-data.component';
import { TranslationManagerComponent } from './translation-manager/translation-manager.component';

@Component({
    selector: 'app-dev-utils',
    standalone: true,
    imports: [CommonModule, TabsModule, TranslationManagerComponent, ReferenceDocsComponent, StoredDataComponent, ComponentTestingComponent, KeycloakInfoComponent, ApiInspectorComponent, StateViewerComponent, RoleSimulatorComponent],
    templateUrl: './dev-utils.component.html',
    styleUrls: ['./dev-utils.component.scss']
})
export class DevUtilsComponent {
    private environmentService = inject(EnvironmentService);

    isMockMode: boolean = false;

    constructor() {
        this.isMockMode = this.environmentService.isMock();
    }
}
