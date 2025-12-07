import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ApiLogService, AuthService, EnvironmentService, LayoutService } from '@syrius/core';

@Component({
    selector: 'app-state-viewer',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './state-viewer.component.html'
})
export class StateViewerComponent {
    authService = inject(AuthService);
    environmentService = inject(EnvironmentService);
    apiLogService = inject(ApiLogService);
    layoutService = inject(LayoutService);

    prettyPrint(obj: unknown): string {
        return JSON.stringify(obj, null, 2);
    }
}
