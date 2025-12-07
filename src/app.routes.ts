import { Routes } from '@angular/router';
import { AppLayout, AuthGuard, RoleGuard } from '@syrius/core';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [AuthGuard, RoleGuard],
        children: [
            { path: '', loadChildren: () => import('@app/dashboard/dashboard.routes').then((m) => m.dashboardRoutes) },
            { path: 'dashboard', loadChildren: () => import('@app/dashboard/dashboard.routes').then((m) => m.dashboardRoutes) },
            { path: 'fuv', loadChildren: () => import('@app/fuv/fuv.routes').then((m) => m.FUV_ROUTES) },
            { path: 'vt', loadChildren: () => import('@app/vt/vt.routes').then((m) => m.VT_ROUTES) },
            { path: 'inex', loadChildren: () => import('@app/inex/inex.routes').then((m) => m.INEX_ROUTES) },
            { path: 'system', loadChildren: () => import('@app/system/system.routes').then((m) => m.SYSTEM_ROUTES) },
            { path: 'dev', loadChildren: () => import('@app/shared/components/dev-utils/dev-utils.routes').then((m) => m.DEV_UTILS_ROUTES) }
        ]
    },
    {
        path: 'status',
        loadChildren: () => import('@syrius/core').then((m) => m.STATUS_PAGE_ROUTES)
    },
    { path: '**', redirectTo: '/status/404' }
];
