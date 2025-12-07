import { KeycloakProfile, KeycloakTokenParsed } from 'keycloak-js';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { DividerModule } from 'primeng/divider';
import { Subscription } from 'rxjs';

import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '@syrius/core';

@Component({
    selector: 'app-keycloak-info',
    standalone: true,
    imports: [CommonModule, ButtonModule, DividerModule, CardModule, ClipboardModule, BadgeModule, ChipModule],
    templateUrl: './keycloak-info.component.html'
})
export class KeycloakInfoComponent implements OnInit, OnDestroy {
    public userProfile: KeycloakProfile | null = null;
    public roles: string[] = [];
    public accessToken = '';
    public refreshToken = '';
    public parsedAccessToken: KeycloakTokenParsed | undefined;

    // Toggle states for showing raw tokens
    public showAccessToken = false;
    public showRefreshToken = false;

    private userProfileSubscription: Subscription | undefined;
    private accessTokenSubscription: Subscription | undefined;

    private authService = inject(AuthService);
    private clipboard = inject(Clipboard);

    ngOnInit(): void {
        this.userProfileSubscription = this.authService.userProfile$.subscribe((profile) => {
            this.userProfile = profile;
        });

        this.accessTokenSubscription = this.authService.accessToken$.subscribe((token) => {
            if (token) {
                this.accessToken = token;
                this.parsedAccessToken = this.authService.getParsedToken();
            }
        });

        this.roles = this.authService.getRoles();

        // Try to get refresh token if available
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const keycloak = (this.authService as any).keycloak;
            if (keycloak?.refreshToken) {
                this.refreshToken = keycloak.refreshToken;
            }
        } catch {
            // Refresh token not available
        }
    }

    ngOnDestroy() {
        if (this.userProfileSubscription) {
            this.userProfileSubscription.unsubscribe();
        }
        if (this.accessTokenSubscription) {
            this.accessTokenSubscription.unsubscribe();
        }
    }

    public copyToClipboard(text: string): void {
        this.clipboard.copy(text);
    }

    /**
     * Format Unix timestamp to readable date/time
     */
    public formatTimestamp(timestamp: number | undefined): string {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }

    /**
     * Check if token is expired
     */
    public isExpired(expTimestamp: number | undefined): boolean {
        if (!expTimestamp) return false;
        return Date.now() > expTimestamp * 1000;
    }
}
