import { inject, Injectable } from '@angular/core';
import { EnvironmentService } from '@syrius/core';

import { KpmEnvironment } from '../interfaces/environment.interface';
import { CrifBetriebEntity, CrifPersonEntity } from '../interfaces/external.interface';

/**
 * KMP-specific service for external system integrations.
 * Handles opening external systems: CRM, SYRIUS, eDossier (IDMS), and CRIF.
 * This service is completely KMP-specific and contains all the business logic
 * for URL construction and external system protocols.
 */
@Injectable({
    providedIn: 'root'
})
export class ExternalService {
    private environmentService = inject(EnvironmentService);

    /**
     * Get KMP environment with app-specific URLs
     */
    private get kmpEnvironment(): KpmEnvironment {
        return this.environmentService.environment as KpmEnvironment;
    }

    /**
     * Opens CRM (Customer Relationship Management) for a partner
     * URL Pattern: {crmUrl}/irj/portal/BPX_BP?iv_partner={partnernr}
     */
    openCrm(partnernr: string): void {
        if (!partnernr) {
            console.warn('Cannot open CRM: partnernr is required');
            return;
        }

        const crmUrl = this.kmpEnvironment.crmUrl;
        if (!crmUrl) {
            console.warn('Cannot open CRM: crmUrl not configured in environment');
            return;
        }

        const url = `${crmUrl}/irj/portal/BPX_BP?iv_partner=${encodeURIComponent(partnernr)}`;
        this.openExternalUrl(url, 'CRM');
    }

    /**
     * Opens SYRIUS for a partner
     * URL Pattern: syriuspush://suva%20ases01%20reference%20type%20Partner%20key%20{partnernr}%20tab%201
     */
    openSyrius(partnernr: string): void {
        if (!partnernr) {
            console.warn('Cannot open SYRIUS: partnernr is required');
            return;
        }

        const syriusUrl = this.kmpEnvironment.syriusUrl;
        if (!syriusUrl) {
            console.warn('Cannot open SYRIUS: syriusUrl not configured in environment');
            return;
        }

        const url = `${syriusUrl}%20reference%20type%20Partner%20key%20${encodeURIComponent(partnernr)}%20tab%201`;
        this.openExternalUrl(url, 'SYRIUS');
    }

    /**
     * Opens SYRIUS for a specific activity/task
     * URL Pattern: syriuspush://suva%20ases01%20reference%20type%20Activity%20boid%20{aufgabeBoid}
     */
    openSyriusAufgabe(aufgabeBoid: string): void {
        if (!aufgabeBoid) {
            console.warn('Cannot open SYRIUS task: aufgabeBoid is required');
            return;
        }

        const syriusUrl = this.kmpEnvironment.syriusUrl;
        if (!syriusUrl) {
            console.warn('Cannot open SYRIUS task: syriusUrl not configured in environment');
            return;
        }

        const url = `${syriusUrl}%20reference%20type%20Activity%20boid%20${encodeURIComponent(aufgabeBoid)}`;
        this.openExternalUrl(url, 'SYRIUS Task');
    }

    /**
     * Opens eDossier (IDMS) for a partner using their partner number
     * URL Pattern: {idmsUrl}/#/permalink?source=syrius&dossierNummer={partnernr}
     */
    openIdms(partnernr: string): void {
        if (!partnernr) {
            console.warn('Cannot open IDMS: partnernr is required');
            return;
        }

        const idmsUrl = this.kmpEnvironment.idmsUrl;
        if (!idmsUrl) {
            console.warn('Cannot open IDMS: idmsUrl not configured in environment');
            return;
        }

        const url = `${idmsUrl}/#/permalink?source=syrius&dossierNummer=${encodeURIComponent(partnernr)}`;
        this.openExternalUrl(url, 'IDMS');
    }

    /**
     * Opens eDossier (IDMS) document search for a specific document
     * URL Pattern: {idmsUrl}/#/document-search?documentId={docNr}
     */
    openIdmsDocument(docNr: string): void {
        if (!docNr) {
            console.warn('Cannot open IDMS document: docNr is required');
            return;
        }

        const idmsUrl = this.kmpEnvironment.idmsUrl;
        if (!idmsUrl) {
            console.warn('Cannot open IDMS document: idmsUrl not configured in environment');
            return;
        }

        const url = `${idmsUrl}/#/document-search?documentId=${encodeURIComponent(docNr)}`;
        this.openExternalUrl(url, 'IDMS Document');
    }

    /**
     * Opens CRIF for a Betrieb (company) using UID number
     * URL Pattern: {crifUrl}/crif/login/{uidnr}
     */
    openCrifBetrieb(betrieb: CrifBetriebEntity): void {
        if (!betrieb?.uidnr) {
            console.warn('Cannot open CRIF for Betrieb: UID number is required');
            return;
        }

        const crifUrl = this.kmpEnvironment.crifUrl;
        if (!crifUrl) {
            console.warn('Cannot open CRIF: crifUrl not configured in environment');
            return;
        }

        // Clean UID number (remove separators)
        const cleanUidnr = betrieb.uidnr.replace(/[-\.\s]/g, '');
        const url = `${crifUrl}/crif/login/${encodeURIComponent(cleanUidnr)}`;
        this.openExternalUrl(url, 'CRIF Betrieb');
    }

    /**
     * Opens CRIF for a Person with detailed search parameters
     * URL Pattern: {crifUrl}/#/?lastName={name}&street={strasse}&city={plz}&birthdate={geburtstag}&countryCode=CHE&ts={timestamp}
     */
    openCrifPerson(person: CrifPersonEntity): void {
        if (!person?.name) {
            console.warn('Cannot open CRIF for Person: name is required');
            return;
        }

        const crifUrl = this.kmpEnvironment.crifUrl;
        if (!crifUrl) {
            console.warn('Cannot open CRIF: crifUrl not configured in environment');
            return;
        }

        const params: string[] = [];

        // Build query parameters
        if (person.name && person.vorname) {
            params.push(`lastName=${encodeURIComponent(`${person.name} ${person.vorname}`)}`);
        } else if (person.name) {
            params.push(`lastName=${encodeURIComponent(person.name)}`);
        }

        if (person.strasse) {
            const street = person.hausnr ? `${person.strasse} ${person.hausnr}` : person.strasse;
            params.push(`street=${encodeURIComponent(street)}`);
        }

        if (person.plz) {
            params.push(`city=${encodeURIComponent(person.plz)}`);
        }

        if (person.geburtstag) {
            // Format date as DD.MM.YYYY
            const date = person.geburtstag instanceof Date ? person.geburtstag : new Date(person.geburtstag);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            params.push(`birthdate=${day}.${month}.${year}`);
        }

        // Always add country code and timestamp
        params.push('countryCode=CHE');
        params.push(`ts=${Date.now()}`);

        const url = `${crifUrl}/#/?${params.join('&')}`;
        this.openExternalUrl(url, 'CRIF Person');
    }

    /**
     * Opens a URL in a new window/tab
     * For custom protocols (like syriuspush://), the browser will handle them appropriately
     */
    openExternalUrl(url: string, systemName: string): void {
        if (!url) {
            console.warn(`Cannot open ${systemName}: URL is empty`);
            return;
        }

        try {
            const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
            if (!newWindow) {
                console.error(`Failed to open ${systemName}: popup blocked or window.open failed`);
                // Fallback: try to navigate in the same window
                window.location.href = url;
            } else {
                console.info(`Opened ${systemName}: ${url}`);
            }
        } catch (error) {
            console.error(`Error opening ${systemName}:`, error);
        }
    }
}
