import { AvailableStage, Stage } from "@syrius/core";

/**
 * Available stages for environment switching in *LOCAL* developer mode
 */
export const AVAILABLE_STAGES: AvailableStage[] = [
    {
        key: 'mock',
        label: 'Mock',
        stage: Stage.MOCK,
        description: 'Local development with mock data'
    },
    {
        key: 'dev',
        label: 'Local Development',
        stage: Stage.DEV,
        description: 'Local development environment'
    },
    {
        key: 'syst',
        label: 'Systemtest',
        stage: Stage.SYST,
        description: 'System testing environment'
    },
    {
        key: 'intg',
        label: 'Integrationstest',
        stage: Stage.INTG,
        description: 'Integration testing environment'
    }
];
