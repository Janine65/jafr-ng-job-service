import { RolesService } from '@syrius/core';

import { OnboardingStep } from './onboarding.model';

export const onboardingSteps: OnboardingStep[] = [
    {
        id: 'menuActions',
        titleKey: 'onboarding.steps.menuActions.title',
        descriptionKey: 'onboarding.steps.menuActions.description',
        targetElementSelector: '.layout-config-menu',
        position: 'bottom'
    },
    {
        id: 'lightSwitch',
        titleKey: 'onboarding.steps.lightSwitch.title',
        descriptionKey: 'onboarding.steps.lightSwitch.description',
        targetElementSelector: '#menu-dark-mode > button',
        position: 'bottom',
        requiredRoles: []
    },
    {
        id: 'textSwitch',
        titleKey: 'onboarding.steps.textSwitch.title',
        descriptionKey: 'onboarding.steps.textSwitch.description',
        targetElementSelector: '#menu-language > button',
        position: 'bottom',
        requiredRoles: []
    },
    {
        id: 'userProfile',
        titleKey: 'onboarding.steps.userProfile.title',
        descriptionKey: 'onboarding.steps.userProfile.description',
        targetElementSelector: '#menu-profile > button',
        position: 'bottom',
        requiredRoles: []
    },
    {
        id: 'bugReport',
        titleKey: 'onboarding.steps.bugReport.title',
        descriptionKey: 'onboarding.steps.bugReport.description',
        targetElementSelector: '#menu-bug-report > button',
        position: 'bottom',
        requiredRoles: []
    }
];
