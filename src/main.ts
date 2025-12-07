import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { AppComponent } from './app.component';

// Standard Angular bootstrap with APP_INITIALIZER handling runtime configuration
bootstrapApplication(AppComponent, appConfig)
    .then((appRef) => {
        console.log('✅ Application bootstrapped successfully');
    })
    .catch((err) => {
        console.error('❌ Failed to bootstrap application:', err);
    });
