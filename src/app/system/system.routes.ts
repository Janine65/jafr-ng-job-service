import { Routes } from '@angular/router';

export const SYSTEM_ROUTES: Routes = [
    {
        path: '',
        redirectTo: 'steuertabelle', // Or your preferred default system page
        pathMatch: 'full'
    },
    {
        path: 'steuertabelle',
        loadComponent: () => import('./steuertabelle/steuertabelle.component').then((m) => m.SteuertabelleComponent),
        data: { breadcrumb: 'Steuertabelle' }
    },
    {
        path: 'scheduler',
        loadComponent: () => import('./scheduler/scheduler.component').then((m) => m.SchedulerComponent),
        data: { breadcrumb: 'Scheduler' }
    },
    {
        path: 'codetabelle',
        loadComponent: () => import('./codetabelle/codetabelle.component').then((m) => m.CodetabelleComponent),
        data: { breadcrumb: 'Codetabelle' }
    },
    {
        path: 'berechtigungen',
        loadComponent: () => import('./berechtigungen/berechtigungen.component').then((m) => m.BerechtigungenComponent),
        data: { breadcrumb: 'Berechtigungen' }
    }
];
