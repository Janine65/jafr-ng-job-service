import { Routes } from '@angular/router';

export const FUV_ROUTES: Routes = [
    {
        path: 'search/partner',
        loadComponent: () => import('./components/person-search/person-search.component').then((m) => m.PersonSearchComponent)
    },
    {
        path: 'search/betrieb',
        loadComponent: () => import('./components/betrieb-search/betrieb-search.component').then((m) => m.BetriebSearchComponent)
    },
    {
        path: 'search/offerte',
        loadComponent: () => import('./components/offerte-search/offerte-search.component').then((m) => m.OfferteSearchComponent)
    },
    {
        path: 'person/detail/:partnernr',
        loadComponent: () => import('./components/person-detail/person-detail.component').then((m) => m.PersonDetailComponent)
    },
    {
        path: 'betrieb/detail/:partnernr',
        loadComponent: () => import('./components/betrieb-detail/betrieb-detail.component').then((m) => m.BetriebDetailComponent)
    },
    {
        path: 'offerte/police/:offertenr',
        loadChildren: () => import('./components/offerte-police/police.routes').then((m) => m.POLICE_ROUTES)
    },
    {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full'
    }
];
