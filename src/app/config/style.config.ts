import { LayoutConfig } from '@syrius/core';

/**
 * Default style configuration for the application.
 * This configuration is used as the fallback when settings are reset
 * or when the application is initialized for the first time.
 */
export const DEFAULT_STYLE_CONFIG: LayoutConfig = {
    ripple: true,
    inputStyle: 'outlined',
    menuMode: 'overlay',
    menuType: 'horizontal',
    colorScheme: 'light',
    theme: 'aura-light-orange',
    scale: 12,
    staticMenuDesktopInactive: false,
    staticMenuMobileActive: false,
    overlayMenuActive: true,
    topbarTheme: 'primary',
    menuTheme: 'primary',
    layoutTheme: 'colorScheme',
    primary: 'orange',
    surface: undefined,
    preset: 'Aura',
    componentTheme: 'aura',
    darkTheme: false,
    staticMenuNoMargin: true,
    fontSize: '14px',
    menuHoverActive: false
};

/**
 * Custom orange primary color palette
 */
export const SUVA_COLOR_PALETTE = {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#ff8100', // SUVA Primary: rgba(255, 129, 0)
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    950: '#431407'
};

/**
 * Custom theme configuration for PrimeNG with orange primary color
 */
export const SUVA_THEME_CONFIG = {
    semantic: {
        primary: SUVA_COLOR_PALETTE,
        colorScheme: {
            light: {
                primary: {
                    color: '{primary.500}',
                    contrastColor: '#ffffff',
                    hoverColor: '{primary.600}',
                    activeColor: '{primary.700}'
                },
                highlight: {
                    background: '{primary.50}',
                    focusBackground: '{primary.100}',
                    color: '{primary.700}',
                    focusColor: '{primary.800}'
                }
            },
            dark: {
                primary: {
                    color: '{primary.400}',
                    contrastColor: '{surface.900}',
                    hoverColor: '{primary.300}',
                    activeColor: '{primary.200}'
                },
                highlight: {
                    background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
                    focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
                    color: 'rgba(255,255,255,.87)',
                    focusColor: 'rgba(255,255,255,.87)'
                }
            }
        }
    }
};

/**
 * Menu configuration options
 */
export const MENU_CONFIG_OPTIONS = {
    modes: ['static', 'overlay'] as const,
    types: ['vertical', 'horizontal'] as const,
    defaultMode: 'overlay' as const,
    defaultType: 'horizontal' as const
};

/**
 * Color scheme options
 */
export const COLOR_SCHEME_OPTIONS = {
    schemes: ['light', 'dark'] as const,
    defaultScheme: 'light' as const
};

/**
 * Available presets
 */
export const AVAILABLE_PRESETS = ['Aura', 'Lara', 'Nora'] as const;

/**
 * Scale options (font sizes)
 */
export const SCALE_OPTIONS = [12, 13, 14, 15, 16] as const;
