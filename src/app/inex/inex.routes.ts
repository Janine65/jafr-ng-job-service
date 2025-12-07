import { Routes } from '@angular/router';

import { MedikamentenrueckforderungComponent } from './medirueck/medirueck.component';
import { RegressComponent } from './regress/regress.component';

export const INEX_ROUTES: Routes = [
    { path: 'medirueck', component: MedikamentenrueckforderungComponent, title: 'Medikamentenrückforderung' },
    { path: 'regress', component: RegressComponent, title: 'OP Regress' }
];
