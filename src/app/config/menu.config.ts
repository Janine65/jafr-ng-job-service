import { MenuItemWithRoles, RolesService } from '@syrius/core';

export const menuStructure: MenuItemWithRoles[] = [
    {
        label: 'menu.dashboard.title',
        icon: 'pi pi-fw pi-table',
        routerLink: ['/dashboard']
        // No roles specified: Dashboard is accessible to all users (but we show only the cards the user has the right to see)
    },

    {
        // FUV Menu
        label: 'menu.fuv.title',
        icon: 'pi pi-fw pi-calculator',
        roles: { requiredRoles: ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt', 'fuv_offerte_antragsfragen', RolesService.ADMIN_ROLE] },
        items: [
            {
                label: 'menu.fuv.searchPerson',
                icon: 'pi pi-fw pi-user',
                routerLink: ['/fuv/search/partner'],
                roles: { requiredRoles: ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt', RolesService.ADMIN_ROLE] }
            },
            {
                label: 'menu.fuv.searchBetrieb',
                icon: 'pi pi-fw pi-building',
                routerLink: ['/fuv/search/betrieb'],
                roles: { requiredRoles: ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt', RolesService.ADMIN_ROLE] }
            },
            {
                label: 'menu.fuv.searchOfferte',
                icon: 'pi pi-fw pi-calculator',
                routerLink: ['/fuv/search/offerte'],
                roles: { requiredRoles: ['fuv_offerte_offerte', 'fuv_offerte_offerte_vtt', RolesService.ADMIN_ROLE] }
            }
        ]
    },
    {
        // VT Menu
        label: 'menu.vt.title',
        icon: 'pi pi-fw pi-shield',
        roles: { requiredRoles: ['aktenentscheid', 'aktenentscheid_bbakt', RolesService.ADMIN_ROLE] },
        items: [
            {
                label: 'menu.vt.decision',
                icon: 'pi pi-fw pi-file',
                routerLink: ['/vt/aktenentscheid'],
                roles: { requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE] }
            },
            {
                label: 'menu.vt.bb.title',
                icon: 'pi pi-fw pi-refresh',
                roles: { requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE] },
                items: [
                    {
                        label: 'menu.vt.bb.einladung',
                        icon: 'pi pi-fw pi-user-plus',
                        routerLink: ['/vt/betriebsbeschreibung/einladung'],
                        roles: { requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE] }
                    },
                    {
                        label: 'menu.vt.bb.erinnerung',
                        icon: 'pi pi-fw pi-user-edit',
                        routerLink: ['/vt/betriebsbeschreibung/erinnerung'],
                        roles: { requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE] }
                    },
                    {
                        label: 'menu.vt.bb.mahnung',
                        icon: 'pi pi-fw pi-user-minus',
                        routerLink: ['/vt/betriebsbeschreibung/mahnung'],
                        roles: { requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE] }
                    },
                    {
                        label: 'menu.vt.bb.aufgabe',
                        icon: 'pi pi-fw pi-users',
                        routerLink: ['/vt/betriebsbeschreibung/aufgabe'],
                        roles: { requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE] }
                    }
                ]
            }
        ]
    },
    {
        // INEX Menu
        label: 'menu.inex.title',
        icon: 'pi pi-fw pi-dollar',
        roles: { requiredRoles: ['medirueck_leistungsabrechnung', 'ie_auswertung_regress', RolesService.ADMIN_ROLE] },
        items: [
            {
                label: 'menu.inex.medirueck',
                icon: 'pi pi-fw pi-money-bill',
                routerLink: ['/inex/medirueck'],
                roles: { requiredRoles: ['medirueck_leistungsabrechnung', RolesService.ADMIN_ROLE] }
            },
            {
                label: 'menu.inex.regress',
                icon: 'pi pi-fw pi-chart-line',
                routerLink: ['/inex/regress'],
                roles: { requiredRoles: ['ie_auswertung_regress', RolesService.ADMIN_ROLE] }
            }
        ]
    },
    {
        // System Menu
        label: 'menu.system.main',
        icon: 'pi pi-fw pi-cog',
        roles: { requiredRoles: [RolesService.ADMIN_ROLE, RolesService.SYSTEM_ROLE] },
        items: [
            {
                label: 'menu.system.manageSettings',
                icon: 'pi pi-fw pi-table',
                routerLink: ['/system/steuertabelle'],
                roles: { requiredRoles: [RolesService.ADMIN_ROLE, RolesService.SYSTEM_ROLE] }
            },
            {
                label: 'menu.system.manageScheduler',
                icon: 'pi pi-fw pi-calendar',
                routerLink: ['/system/scheduler'],
                roles: { requiredRoles: [RolesService.ADMIN_ROLE, RolesService.SYSTEM_ROLE] }
            },
            {
                label: 'menu.system.manageCodeTable',
                icon: 'pi pi-fw pi-list',
                routerLink: ['/system/codetabelle'],
                roles: { requiredRoles: [RolesService.ADMIN_ROLE, RolesService.SYSTEM_ROLE] }
            },
            {
                label: 'menu.system.managePermissions',
                icon: 'pi pi-fw pi-users',
                routerLink: ['/system/berechtigungen'],
                roles: { requiredRoles: [RolesService.ADMIN_ROLE] }
            }
        ]
    }
];
