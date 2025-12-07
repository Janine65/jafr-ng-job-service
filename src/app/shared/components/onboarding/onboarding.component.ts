import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { Subscription } from 'rxjs';

import { CommonModule } from '@angular/common';
import {
    ChangeDetectorRef, Component, ElementRef, HostListener, inject, OnDestroy, OnInit, Renderer2
} from '@angular/core';
import { OnboardingStep } from '@app/shared/components/onboarding/onboarding.model';
import { OnboardingService } from '@app/shared/components/onboarding/onboarding.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SafeHtmlPipe } from '@syrius/core';

@Component({
    selector: 'app-onboarding',
    standalone: true,
    imports: [CommonModule, ButtonModule, TranslateModule, SafeHtmlPipe, DividerModule],
    templateUrl: './onboarding.component.html',
    styleUrls: ['./onboarding.component.scss']
})
export class OnboardingComponent implements OnInit, OnDestroy {
    onboardingService = inject(OnboardingService);
    private el = inject(ElementRef);
    private renderer = inject(Renderer2);
    private translate = inject(TranslateService);
    private cdr = inject(ChangeDetectorRef);

    private stateSubscription!: Subscription;
    currentStep: OnboardingStep | null = null;
    isActive: boolean = false;
    highlightedElementRect: DOMRect | null = null;
    descriptionBoxPosition: { top?: string; left?: string; bottom?: string; right?: string; transform?: string } = {};

    stepTitle: string = '';
    stepDescription: string = '';

    ngOnInit(): void {
        this.stateSubscription = this.onboardingService.state$.subscribe((state) => {
            this.isActive = state.isActive;
            if (state.isActive) {
                this.currentStep = this.onboardingService.getCurrentStep();
                this.updateStepContent();
                this.highlightElement();
            } else {
                this.currentStep = null;
                this.clearHighlight();
            }
            this.cdr.detectChanges(); // Ensure view updates with state changes
        });
    }

    private updateStepContent(): void {
        if (this.currentStep) {
            this.translate.get([this.currentStep.titleKey, this.currentStep.descriptionKey]).subscribe((translations) => {
                this.stepTitle = translations[this.currentStep!.titleKey];
                this.stepDescription = translations[this.currentStep!.descriptionKey];
                this.cdr.detectChanges();
            });
        }
    }

    private highlightElement(): void {
        this.clearHighlight();
        if (!this.currentStep || !this.currentStep.targetElementSelector) {
            this.highlightedElementRect = null; // For centered, non-element specific steps
            if (this.currentStep && this.currentStep.position === 'center') {
                this.positionDescriptionBox(); // Position box in center
            }
            return;
        }

        const targetElement = document.querySelector(this.currentStep.targetElementSelector) as HTMLElement;
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            this.renderer.addClass(targetElement, 'onboarding-highlighted-element');

            // Wait for scrolling and potential layout shifts
            setTimeout(() => {
                this.highlightedElementRect = targetElement.getBoundingClientRect();
                this.positionDescriptionBox();
                this.cdr.detectChanges();
            }, 300); // Delay
        }
    }

    private clearHighlight(): void {
        const highlighted = this.el.nativeElement.ownerDocument.querySelector('.onboarding-highlighted-element');
        if (highlighted) {
            this.renderer.removeClass(highlighted, 'onboarding-highlighted-element');
        }
        this.highlightedElementRect = null;
    }

    private positionDescriptionBox(): void {
        if (!this.currentStep) return;

        const boxElement = this.el.nativeElement.querySelector('.onboarding-description-box') as HTMLElement;
        if (!boxElement) return;

        const padding = this.currentStep.highlightPadding || 10;
        const boxRect = boxElement.getBoundingClientRect(); // Get actual box dimensions
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let top, left, bottom, right, transform;

        if (this.currentStep.position === 'center' || !this.highlightedElementRect) {
            top = `50%`;
            left = `50%`;
            transform = 'translate(-50%, -50%)';
        } else {
            const targetRect = this.highlightedElementRect;
            switch (this.currentStep.position) {
                case 'top':
                    top = `${targetRect.top - boxRect.height - padding}px`;
                    left = `${targetRect.left + targetRect.width / 2 - boxRect.width / 2}px`;
                    break;
                case 'bottom':
                    top = `${targetRect.bottom + padding}px`;
                    left = `${targetRect.left + targetRect.width / 2 - boxRect.width / 2}px`;
                    break;
                case 'left':
                    top = `${targetRect.top + targetRect.height / 2 - boxRect.height / 2}px`;
                    left = `${targetRect.left - boxRect.width - padding}px`;
                    break;
                case 'right':
                    top = `${targetRect.top + targetRect.height / 2 - boxRect.height / 2}px`;
                    left = `${targetRect.right + padding}px`;
                    break;
                default: // Default to bottom if not specified
                    top = `${targetRect.bottom + padding}px`;
                    left = `${targetRect.left + targetRect.width / 2 - boxRect.width / 2}px`;
                    break;
            }

            // Basic boundary collision detection and adjustment
            const parsedTop = parseFloat(top);
            const parsedLeft = parseFloat(left);

            if (parsedTop < 0) top = `${padding}px`;
            if (parsedLeft < 0) left = `${padding}px`;
            if (parsedLeft + boxRect.width > windowWidth) left = `${windowWidth - boxRect.width - padding}px`;
            if (parsedTop + boxRect.height > windowHeight) top = `${windowHeight - boxRect.height - padding}px`;
        }

        this.descriptionBoxPosition = { top, left, bottom, right, transform };
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        if (this.isActive && this.currentStep) {
            this.highlightElement(); // Re-calculate on resize
        }
    }

    next(): void {
        this.onboardingService.nextStep();
    }

    skip(): void {
        this.onboardingService.skipOnboarding();
    }

    ngOnDestroy(): void {
        if (this.stateSubscription) {
            this.stateSubscription.unsubscribe();
        }
        this.clearHighlight(); // Ensure cleanup when component is destroyed
    }
}
