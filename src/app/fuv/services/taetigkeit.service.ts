import { inject, Injectable } from '@angular/core';
import { LogFactoryService } from '@syrius/core';

/**
 * Service for handling taetigkeit-specific business logic
 * Responsible for enriching and transforming taetigkeit data
 */
@Injectable({
    providedIn: 'root'
})
export class TaetigkeitService {
    private logger = inject(LogFactoryService).createLogger('TaetigkeitService');
    /**
     * Enrich taetigkeit data with merkmal metadata and prepare for persistence
     * This method enriches tätigkeiten items with merkmal metadata needed for BB calculation
     * @param taetigkeitData The taetigkeit data to enrich
     * @param merkmalCache Cache of merkmal metadata (internalname, statefrom)
     * @param fullMerkmalCache Cache of full merkmal objects
     * @returns Enriched taetigkeit data ready for persistence
     */
    enrichTaetigkeitData(taetigkeitData: any, merkmalCache: Map<string, { internalname: string; statefrom: string }>, fullMerkmalCache: Map<string, any>): any {
        if (!taetigkeitData.taetigkeiten) {
            return taetigkeitData;
        }

        const enrichedTaetigkeiten = taetigkeitData.taetigkeiten.map((item: any) => {
            const merkmalData = merkmalCache.get(item.taetigkeit);
            const fullMerkmal = fullMerkmalCache.get(item.taetigkeit);

            if (!merkmalData) {
                this.logger.warn('No merkmal data found in cache for:', item.taetigkeit);
            } else {
                this.logger.log('Found merkmal data:', {
                    boid: item.taetigkeit,
                    id: fullMerkmal?.id,
                    internalname: merkmalData.internalname,
                    statefrom: merkmalData.statefrom
                });
            }

            return {
                ...item,
                merkmal_id: fullMerkmal?.id,
                merkmal_internalname: merkmalData?.internalname,
                merkmal_statefrom: merkmalData?.statefrom
            };
        });

        return {
            ...taetigkeitData,
            taetigkeiten: enrichedTaetigkeiten
        };
    }
}
