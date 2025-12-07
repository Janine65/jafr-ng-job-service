import { Routes } from '@angular/router';

import { AktenentscheidComponent } from './aktenentscheid/aktenentscheid.component';
import { AufgabeComponent } from './aufgabe/aufgabe.component';
import { EinladungComponent } from './einladung/einladung.component';
import { ErinnerungComponent } from './erinnerung/erinnerung.component';
import { MahnungComponent } from './mahnung/mahnung.component';

export const VT_ROUTES: Routes = [
    { path: 'aktenentscheid', component: AktenentscheidComponent, title: 'Aktenentscheid verwalten' },
    { path: 'betriebsbeschreibung/einladung', component: EinladungComponent, title: 'Einladung' },
    { path: 'betriebsbeschreibung/erinnerung', component: ErinnerungComponent, title: 'Erinnerung' },
    { path: 'betriebsbeschreibung/mahnung', component: MahnungComponent, title: 'Mahnung' },
    { path: 'betriebsbeschreibung/aufgabe', component: AufgabeComponent, title: 'Aufgabe' }
];
