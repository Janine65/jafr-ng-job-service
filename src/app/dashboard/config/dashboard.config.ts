import { MedikamentenrueckforderungService } from '@app/inex/medirueck/medirueck.service';
import { AktenentscheidService } from '@app/vt/aktenentscheid/aktenentscheid.service';
import { AufgabeService } from '@app/vt/aufgabe/aufgabe.service';
import { EinladungService } from '@app/vt/einladung/einladung.service';
import { ErinnerungService } from '@app/vt/erinnerung/erinnerung.service';
import { MahnungService } from '@app/vt/mahnung/mahnung.service';
import { RolesService } from '@syrius/core';

import { DashboardServiceConfig } from '../interfaces/dashboard-service.interface';

import type { JobPollingService } from '@syrius/job-service';
/**
 * Central configuration for all dashboard services
 *
 * To add a new service to the dashboard:
 * 1. Import the service class
 * 2. Add a new entry to this array with the configuration
 * 3. Call registerDashboardServices() to register with JobPollingService
 * 4. The dashboard will automatically pick it up and display it
 *
 * No changes needed in dashboard.service.ts!
 */
export const DASHBOARD_SERVICES: DashboardServiceConfig[] = [
    {
        name: 'medikamentenrueckforderung',
        displayName: 'Medikamentenrückforderung',
        route: '/inex/medirueck',
        icon: 'pi pi-money-bill',
        description: 'Rückforderung von Medikamentenkosten',
        requiredRoles: ['medirueck_leistungsabrechnung', RolesService.ADMIN_ROLE],
        serviceClass: MedikamentenrueckforderungService,
        jobType: 'medikamentenrueckforderung'
    },
    {
        name: 'einladung',
        displayName: 'BB Einladung',
        route: '/vt/betriebsbeschreibung/einladung',
        icon: 'pi pi-send',
        description: 'Neue Betriebsbeschreibung Einladung senden',
        requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE],
        serviceClass: EinladungService,
        jobType: 'einladung'
    },
    {
        name: 'erinnerung',
        displayName: 'BB Erinnerung',
        route: '/vt/betriebsbeschreibung/erinnerung',
        icon: 'pi pi-bell',
        description: 'Neue Betriebsbeschreibung Erinnerung senden',
        requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE],
        serviceClass: ErinnerungService,
        jobType: 'erinnerung'
    },
    {
        name: 'mahnung',
        displayName: 'BB Mahnung',
        route: '/vt/betriebsbeschreibung/mahnung',
        icon: 'pi pi-exclamation-triangle',
        description: 'Neue Betriebsbeschreibung Mahnung senden',
        requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE],
        serviceClass: MahnungService,
        jobType: 'mahnung'
    },
    {
        name: 'aufgabe',
        displayName: 'BB Aufgabe',
        route: '/vt/betriebsbeschreibung/aufgabe',
        icon: 'pi pi-list-check',
        description: 'Neue Betriebsbeschreibung Aufgabe erstellen',
        requiredRoles: ['aktenentscheid_bbakt', RolesService.ADMIN_ROLE],
        serviceClass: AufgabeService,
        jobType: 'aufgabe'
    },
    {
        name: 'aktenentscheid',
        displayName: 'Aktenentscheid',
        route: '/vt/aktenentscheid',
        icon: 'pi pi-file-check',
        description: 'Aktenentscheid für Betriebsbeschreibung verwalten',
        requiredRoles: ['aktenentscheid', 'aktenentscheid_bbakt', RolesService.ADMIN_ROLE],
        serviceClass: AktenentscheidService,
        jobType: 'aktenentscheid'
    }
];

/**
 * Register all dashboard services with JobPollingService for automatic polling.
 * This function should be called during app initialization (from APP_INITIALIZER or DashboardService constructor).
 *
 * This pattern allows feature modules to register themselves with core services
 * without core importing from feature modules (proper dependency inversion).
 *
 * @param jobPollingService - The JobPollingService instance to register with
 */
export function registerDashboardServices(jobPollingService: JobPollingService): void {
    DASHBOARD_SERVICES.forEach((config) => {
        jobPollingService.registerJobService({
            name: config.name,
            displayName: config.displayName,
            serviceClass: config.serviceClass,
            requiredRoles: config.requiredRoles
        });
    });
}
