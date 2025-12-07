import { Observable } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
    AddKommentarSyriusAufgabeRequest, AddKommentarSyriusAufgabeResponse, AufgabeDetails, ParamAttr,
    SyriusAufgabeRequest, SyriusAufgabeResponse, UserInfo
} from '@app/fuv/models/aufgabe.model';
import { LogFactoryService, Logger } from '@syrius/core';

/**
 * Service for managing KPM tasks and workflows
 * Handles Syrius task creation, modification, and retrieval
 */
@Injectable({
    providedIn: 'root'
})
export class KpmService {
    private http = inject(HttpClient);
    private logFactory = inject(LogFactoryService);
    private logger: Logger;
    private apiUrl = '/api/kpm';

    constructor() {
        this.logger = this.logFactory.createLogger('KpmService');
    }

    /**
     * Create a new Syrius task (Aufgabe)
     * Maps to POST /kpm/createSyriusAufgabe
     *
     * @param request Task creation request with all required fields
     * @returns Observable of the created task response
     */
    createSyriusAufgabe(request: SyriusAufgabeRequest): Observable<SyriusAufgabeResponse> {
        this.logger.debug('Creating Syrius Aufgabe', { request });
        return this.http.post<SyriusAufgabeResponse>(`${this.apiUrl}/createSyriusAufgabe`, request);
    }

    /**
     * Change a Syrius task
     * Maps to POST /kpm/changeSyriusAufgabe?aufgabe_boid={boid}
     * @param aufgabeBoid - The business object ID of the task to update
     * @param request - Request data for changing the task (same structure as create)
     * @returns Observable of the change response
     */
    changeSyriusAufgabe(aufgabeBoid: string, request: SyriusAufgabeRequest): Observable<SyriusAufgabeResponse> {
        this.logger.debug('Changing Syrius Aufgabe', { aufgabeBoid, request });
        return this.http.post<SyriusAufgabeResponse>(`${this.apiUrl}/changeSyriusAufgabe?aufgabe_boid=${encodeURIComponent(aufgabeBoid)}`, request);
    }

    /**
     * Add a comment to a Syrius task (Aufgabe)
     * Maps to POST /kpm/addKommentarSyriusAufgabe
     *
     * TODO: Define actual request structure
     * @param request Comment addition request
     * @returns Observable of the response
     */
    addKommentarSyriusAufgabe(request: AddKommentarSyriusAufgabeRequest): Observable<AddKommentarSyriusAufgabeResponse> {
        this.logger.debug('Adding Kommentar to Syrius Aufgabe', { request });
        // TODO: Implement actual request structure
        this.logger.warn('addKommentarSyriusAufgabe: Request structure needs to be defined');
        return this.http.post<AddKommentarSyriusAufgabeResponse>(`${this.apiUrl}/addKommentarSyriusAufgabe`, request);
    }

    /**
     * Get task details by ID
     * Maps to GET /kpm/getAufgabeDetails?aufgabe_boid={boid}
     *
     * @param aufgabeBoid - The BOID of the task to retrieve details for
     * @returns Observable of task details
     */
    getAufgabeDetails(aufgabeBoid: string): Observable<AufgabeDetails> {
        this.logger.debug('Getting Aufgabe Details for:', aufgabeBoid);
        return this.http.get<AufgabeDetails>(`${this.apiUrl}/getAufgabeDetails?aufgabe_boid=${encodeURIComponent(aufgabeBoid)}`);
    }

    /**
     * Get user information
     * Maps to GET /kpm/getUserInfo
     *
     * TODO: Define query parameters and response structure
     * @returns Observable of user information
     */
    getUserInfo(): Observable<UserInfo> {
        this.logger.debug('Getting User Info');
        // TODO: Add query parameters when structure is known
        this.logger.warn('getUserInfo: Query parameters need to be defined');
        return this.http.get<UserInfo>(`${this.apiUrl}/getUserInfo`);
    }

    /**
     * Builds a CreateSyriusAufgabeRequest from the provided parameters
     * @param params - Object containing necessary parameters (some with defaults)
     * @returns A properly structured CreateSyriusAufgabeRequest object
     */
    buildCreateAufgabeRequest(params: {
        workflowDef: string;
        titel: string;
        beschreibung: string;
        faelligkeitsDatum: string;
        ausfuehrender: string;
        partnernr?: string;
        partnerId?: string;
        objektId?: string;
        objektMetaId?: string;
        kategorie?: string;
        prioritaet?: string;
        postkorbDef?: string;
        kommentarText?: string;
        status?: string;
        paramAttrList?: ParamAttr[];
    }): SyriusAufgabeRequest {
        return {
            workflow_def: params.workflowDef,
            partnernr: params.partnernr || '',
            partner_id: params.partnerId || '',
            objekt_id: params.objektId || '',
            objekt_meta_id: params.objektMetaId || '',
            ausfuehrender: params.ausfuehrender,
            beschreibung: params.beschreibung,
            kategorie: params.kategorie || '',
            prioritaet: params.prioritaet || '',
            postkorb_def: params.postkorbDef || '',
            titel: params.titel,
            kommentar_text: params.kommentarText || '',
            faelligkeits_datum: params.faelligkeitsDatum,
            status: params.status || '',
            param_attr_list: params.paramAttrList || []
        };
    }

    /**
     * Builds a request for updating a Syrius task
     * Note: The request body structure is the same as create, but aufgabe_boid is passed as a query parameter
     * @param params - Object containing parameters to update (same as create)
     * @returns A properly structured CreateSyriusAufgabeRequest object (same as create)
     */
    buildChangeAufgabeRequest(params: {
        workflowDef: string;
        titel: string;
        beschreibung: string;
        faelligkeitsDatum: string;
        ausfuehrender: string;
        partnernr?: string;
        partnerId?: string;
        objektId?: string;
        objektMetaId?: string;
        kategorie?: string;
        prioritaet?: string;
        postkorbDef?: string;
        kommentarText?: string;
        status?: string;
        paramAttrList?: ParamAttr[];
    }): SyriusAufgabeRequest {
        // Use the same builder as create since the body structure is identical
        return this.buildCreateAufgabeRequest(params);
    }
}
