import { Routes } from '@angular/router';

export const DEV_UTILS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./dev-utils.component').then((m) => m.DevUtilsComponent)
    }
];
