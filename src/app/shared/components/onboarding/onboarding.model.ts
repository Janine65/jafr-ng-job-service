export interface OnboardingStep {
  id: string; // Unique identifier for the step
  targetElementSelector?: string; // CSS selector for the element to highlight
  titleKey: string; // Translation key for the step title
  descriptionKey: string; // Translation key for the step description
  highlightPadding?: number; // Optional padding around the highlighted element
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // Preferred position of the description box relative to the element
  showOverlay?: boolean; // Whether to show the semi-transparent overlay
  requiredRoles?: string[]; // If set, step is only shown if user has one of these roles
}

export interface OnboardingState {
  isActive: boolean;
  currentStepIndex: number;
  hasCompleted: boolean;
}
