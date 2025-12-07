import { BehaviorSubject, Observable } from 'rxjs';

import { inject, Injectable } from '@angular/core';
import {
    OnboardingState, OnboardingStep
} from '@app/shared/components/onboarding/onboarding.model';
import { TranslateService } from '@ngx-translate/core';
import { BrowserStorageService } from '@syrius/core';

import { onboardingSteps } from './onboarding.steps';

const ONBOARDING_STORAGE_KEY = 'onboardingCompleted';

@Injectable({
    providedIn: 'root'
})
export class OnboardingService {
    private translate = inject(TranslateService);
    private storageService = inject(BrowserStorageService);

    public steps: OnboardingStep[] = [];

    public state = new BehaviorSubject<OnboardingState>({
        isActive: false,
        currentStepIndex: -1,
        hasCompleted: false
    });

    public state$: Observable<OnboardingState> = this.state.asObservable();

    constructor() {
        this.loadInitialState();
    }

    private loadInitialState(): void {
        const hasCompleted = this.storageService.getLocal<boolean>(ONBOARDING_STORAGE_KEY) === true;
        this.state.next({ ...this.state.value, hasCompleted });
    }

    public registerSteps(steps: OnboardingStep[]): void {
        this.steps = steps;
    }

    public startOnboarding(): void {
        this.state.next({
            ...this.state.value,
            isActive: true,
            currentStepIndex: 0
        });
    }

    public startOnboardingWithRoles(userRoles: string[]): void {
        const filteredSteps = onboardingSteps.filter((step: OnboardingStep) => {
            if (!step.requiredRoles || step.requiredRoles.length === 0) return true;
            return step.requiredRoles.some((role: string) => userRoles.includes(role));
        });
        this.steps = filteredSteps;
        this.state.next({
            ...this.state.value,
            isActive: true,
            currentStepIndex: 0
        });
    }

    public nextStep(): void {
        const currentIdx = this.state.value.currentStepIndex;
        if (currentIdx < this.steps.length - 1) {
            this.state.next({ ...this.state.value, currentStepIndex: currentIdx + 1 });
        } else {
            this.completeOnboarding();
        }
    }

    public previousStep(): void {
        const currentIdx = this.state.value.currentStepIndex;
        if (currentIdx > 0) {
            this.state.next({ ...this.state.value, currentStepIndex: currentIdx - 1 });
        }
    }

    public skipOnboarding(): void {
        this.completeOnboarding();
    }

    private completeOnboarding(): void {
        this.state.next({
            isActive: false,
            currentStepIndex: -1,
            hasCompleted: true
        });
        this.storageService.setLocal(ONBOARDING_STORAGE_KEY, true);
    }

    public resetOnboardingState(): void {
        this.storageService.removeLocal(ONBOARDING_STORAGE_KEY);
        this.state.next({
            isActive: false,
            currentStepIndex: -1,
            hasCompleted: false
        });
    }

    public getCurrentStep(): OnboardingStep | null {
        const { isActive, currentStepIndex } = this.state.value;
        if (!isActive || currentStepIndex < 0 || currentStepIndex >= this.steps.length) {
            return null;
        }
        return this.steps[currentStepIndex];
    }

    public isFirstVisit(): boolean {
        // Check if the onboardingCompleted flag is explicitly set in localStorage.
        const onboardingCompleted = this.storageService.getLocal<boolean>(ONBOARDING_STORAGE_KEY);
        // If the flag is not present or not true, it's considered a first visit for onboarding purposes.
        return onboardingCompleted !== true;
    }

    public getFilteredSteps(userRoles: string[]): OnboardingStep[] {
        return this.steps.filter((step) => {
            if (!step.requiredRoles || step.requiredRoles.length === 0) return true;
            return step.requiredRoles.some((role) => userRoles.includes(role));
        });
    }

    getStepTitle(step: OnboardingStep): Observable<string> {
        return this.translate.get(step.titleKey);
    }

    getStepDescription(step: OnboardingStep): Observable<string> {
        return this.translate.get(step.descriptionKey);
    }
}
