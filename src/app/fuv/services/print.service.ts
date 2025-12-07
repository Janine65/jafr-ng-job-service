import { Observable } from 'rxjs';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
    FUV_OFFERTE_VORLAGE_ANTRAG, FUV_OFFERTE_VORLAGE_UNVERBINDLICH
} from '@app/fuv/components/offerte-police/police.constants';
import { Offerte } from '@app/fuv/models/offerte.model';
import { OpusSoapApiRequest, PrintOfferteApiRequest } from '@app/fuv/models/print.model';
import { TranslateService } from '@ngx-translate/core';
import { LogFactoryService, Logger } from '@syrius/core';

/**
 * Map praemienzahlung text to numeric code for API
 * @param praemienzahlung Text value (jaehrlich, halbjaehrlich, etc.)
 * @returns Numeric code as string
 */
function mapPraemienzahlungToCode(praemienzahlung?: string): string {
    if (!praemienzahlung) return '1'; // Default to jaehrlich

    const mapping: Record<string, string> = {
        jaehrlich: '1',
        halbjaehrlich: '2',
        vierteljaehrlich: '4',
        monatlich: '12'
    };

    return mapping[praemienzahlung.toLowerCase()] || '1';
}

/**
 * Service for printing FUV Offertes
 * Handles PDF generation and OPUS SOAP service integration
 */
@Injectable({
    providedIn: 'root'
})
export class PrintService {
    private http = inject(HttpClient);
    private logFactory = inject(LogFactoryService);
    private translate = inject(TranslateService);
    private logger: Logger;

    constructor() {
        this.logger = this.logFactory.createLogger('PrintService');
    }

    /**
     * Print FUV Offerte - Sends print request to backend
     * Maps to POST /api/offerte/fuvxml/printFuvOfferte
     *
     * @param params Print parameters including offerte data
     * @returns Observable of the print result (base64 encoded string)
     */
    printFuvOfferte(params: PrintOfferteApiRequest): Observable<string> {
        this.logger.log('Printing FUV Offerte - Full payload structure:', {
            vorlage: params.vorlage,
            sprache: params.sprache,
            art: params.art,
            antragsfragen: params.antragsfragen,
            variante: params.variante,
            unterschrift: params.unterschrift,
            begleitbrief: params.begleitbrief,
            offerte: {
                offertenr: params.offerte.offertenr,
                gueltab: params.offerte.gueltab,
                gueltab_date: (params.offerte as any).gueltab_date,
                begleitbrief: (params.offerte as any).begleitbrief,
                bb_boid: (params.offerte as any).bb_boid,
                hasBB: !!(params.offerte as any).bb,
                bruttopraemiensatz: (params.offerte as any).bb?.bruttopraemiensatz
            }
        });

        const url = '/api/offerte/fuvxml/printFuvOfferte';

        // Send params as JSON in request body (POST)
        return this.http.post<string>(url, params);
    }

    /**
     * Call OPUS SOAP service for document processing
     * Maps to POST /opus-soap
     *
     * @param base64Payload Base64 encoded XML payload from printFuvOfferte
     * @returns Observable of SOAP response (text/xml)
     */
    callOpusSoap(base64Payload: string): Observable<string> {
        this.logger.debug('Calling OPUS SOAP service', { payloadLength: base64Payload.length });

        const url = '/opus-soap';

        // Build SOAP envelope with the base64 payload
        const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:sap-com:document:sap:rfc:functions">
            <soapenv:Header/>
            <soapenv:Body>
              <urn:ZS_CA_OPUS_KPM_ONLINE_WS>
                <IV_PAYLOAD>${base64Payload}</IV_PAYLOAD>
                <IV_PROZESSID>KPM</IV_PROZESSID>
              </urn:ZS_CA_OPUS_KPM_ONLINE_WS>
            </soapenv:Body>
          </soapenv:Envelope>`;

        // Set headers for SOAP request
        const headers = new HttpHeaders().set('Content-Type', 'text/xml; charset=utf-8').set('Accept', 'text/xml').set('SOAPAction', 'OPUS_WS/FUV');

        return this.http.post(url, soapEnvelope, { headers, responseType: 'text' });
    }

    /**
     * Parse OPUS SOAP response and extract the OPUS URL
     *
     * @param soapResponse Raw SOAP XML response string
     * @returns OPUS URL or null if not found
     */
    parseOpusUrl(soapResponse: string): string | null {
        try {
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(soapResponse, 'text/xml');

            // Find EV_OPUS_URL element
            const opusUrlElement = xmlDoc.getElementsByTagName('EV_OPUS_URL')[0];

            if (opusUrlElement && opusUrlElement.textContent) {
                const url = opusUrlElement.textContent.trim();
                this.logger.debug('Extracted OPUS URL', { url });
                return url;
            }

            this.logger.warn('EV_OPUS_URL not found in SOAP response');
            return null;
        } catch (error) {
            this.logger.error('Failed to parse OPUS SOAP response', error);
            return null;
        }
    }

    /**
     * Build print parameters from offerte data
     * Helper method to construct the PrintFuvOfferteParams object
     *
     * @param offerte The offerte from store
     * @param selectedVarianteNr Selected variante number (defaults to "0" for Variante A, "1" for B, "2" for C)
     * @param hasAntragsfragen Whether antragsfragen are saved/answered
     * @param isOffertantrag Whether this is for Offertantrag (true) or Unverbindliche Offerte (false)
     * @returns Constructed print parameters
     */
    buildPrintParams(offerte: Offerte, selectedVarianteNr: string = '0', hasAntragsfragen: boolean = false, isOffertantrag: boolean = false): PrintOfferteApiRequest {
        // Get current language from TranslateService (uppercase)
        const currentLang = this.translate.currentLang || this.translate.defaultLang || 'de';
        const sprache = currentLang.toUpperCase();

        // Prepare offerte data for print API
        const printOfferte = this.prepareOfferteForPrint(offerte);

        // Get begleitbrief value from offerte (boolean -> "0" or "1")
        const begleitbrief = offerte.begleitbrief ? '1' : '0';

        // Choose vorlage based on document type
        const vorlage = isOffertantrag ? FUV_OFFERTE_VORLAGE_ANTRAG : FUV_OFFERTE_VORLAGE_UNVERBINDLICH;

        const params = {
            vorlage,
            sprache,
            art: offerte.art || 'OfferteArtUnv',
            antragsfragen: hasAntragsfragen ? 'mit' : 'ohne',
            variante: selectedVarianteNr,
            unterschrift: '0',
            begleitbrief,
            offerte: printOfferte
        };

        this.logger.log('Built print params', {
            vorlage: params.vorlage,
            sprache: params.sprache,
            art: params.art,
            antragsfragen: params.antragsfragen,
            variante: params.variante,
            unterschrift: params.unterschrift,
            begleitbrief: params.begleitbrief,
            offerteHasGueltabDate: !!printOfferte.gueltab_date,
            offerteGueltab: printOfferte.gueltab,
            offerteGueltabDate: printOfferte.gueltab_date
        });

        return params;
    }

    /**
     * Prepare offerte data for print API
     * Ensures fields like praemienzahlung are in the correct format
     *
     * @param offerte The offerte from store
     * @returns Offerte data formatted for print API
     */
    private prepareOfferteForPrint(offerte: Offerte): any {
        const prepared: any = { ...offerte };

        // Convert praemienzahlung from text to numeric code
        if (prepared.praemienzahlung) {
            prepared.praemienzahlung = mapPraemienzahlungToCode(prepared.praemienzahlung);
        }

        // Convert begleitbrief from boolean to string "0" or "1"
        if (typeof prepared.begleitbrief === 'boolean') {
            prepared.begleitbrief = prepared.begleitbrief ? '1' : '0';
        }

        // IMPORTANT: gueltab_date must be added at the root level of offerte
        // It should be in ISO format: "YYYY-MM-DDTHH:mm:ss.sssZ"
        if (prepared.gueltab) {
            // Always create gueltab_date from gueltab to ensure correct format
            const date = new Date(prepared.gueltab);
            // Set time to midnight UTC
            date.setUTCHours(0, 0, 0, 0);
            prepared.gueltab_date = date.toISOString();
        }

        // Log prepared offerte structure for debugging
        this.logger.log('Prepared offerte for print', {
            offertenr: prepared.offertenr,
            gueltab: prepared.gueltab,
            gueltab_date: prepared.gueltab_date,
            praemienzahlung: prepared.praemienzahlung,
            begleitbrief: prepared.begleitbrief,
            hasVariante: !!prepared.variante,
            varianteCount: prepared.variante?.length
        });

        return prepared;
    }

    /**
     * Complete print workflow: Call print service and OPUS SOAP service
     * Opens the OPUS URL in a new tab when successful
     *
     * @param offerte The offerte to print
     * @param selectedVarianteNr Selected variante number ("0" for A, "1" for B, "2" for C)
     * @param hasAntragsfragen Whether antragsfragen are answered
     * @param isOffertantrag Whether this is for Offertantrag (true) or Unverbindliche Offerte (false)
     * @returns Observable that completes when both services have been called
     */
    printAndProcessOfferte(offerte: Offerte, selectedVarianteNr: string = '0', hasAntragsfragen: boolean = false, isOffertantrag: boolean = false): Observable<void> {
        this.logger.log('Starting print and process workflow', {
            offertenr: offerte.offertenr,
            selectedVarianteNr,
            hasAntragsfragen,
            isOffertantrag
        });

        // Build print parameters
        const params = this.buildPrintParams(offerte, selectedVarianteNr, hasAntragsfragen, isOffertantrag);

        // Call printFuvOfferte first - this returns a base64 encoded string
        return new Observable<void>((observer) => {
            this.printFuvOfferte(params).subscribe({
                next: (base64Payload) => {
                    this.logger.log('Print service returned payload', {
                        payloadLength: base64Payload.length
                    });

                    // Call OPUS SOAP service with the base64 payload
                    this.callOpusSoap(base64Payload).subscribe({
                        next: (soapResponse) => {
                            this.logger.debug('OPUS service called successfully');

                            // Parse and extract OPUS URL
                            const opusUrl = this.parseOpusUrl(soapResponse);

                            if (opusUrl) {
                                // Open OPUS URL in new tab
                                this.logger.log('Opening OPUS URL in new tab', { opusUrl });
                                window.open(opusUrl, '_blank');
                            } else {
                                this.logger.warn('No OPUS URL found in response, cannot open document');
                            }

                            observer.next();
                            observer.complete();
                        },
                        error: (error) => {
                            this.logger.error('OPUS service call failed', error);
                            observer.error(error);
                        }
                    });
                },
                error: (error) => {
                    this.logger.error('Print service call failed', error);
                    observer.error(error);
                }
            });
        });
    }
}
