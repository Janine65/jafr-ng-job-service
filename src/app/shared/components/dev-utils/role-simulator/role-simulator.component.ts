import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
    EnvironmentService, InternalRole, MenuService, RolesService, UserRole
} from '@syrius/core';

@Component({
    selector: 'app-role-simulator',
    standalone: true,
    imports: [CommonModule, FormsModule, CardModule, CheckboxModule, ButtonModule, TagModule, MessageModule, DividerModule, ToolbarModule, TooltipModule, TranslateModule],
    templateUrl: './role-simulator.component.html'
})
export class RoleSimulatorComponent implements OnInit, OnDestroy {
    private menuFilterService = inject(MenuService);
    private environmentService = inject(EnvironmentService);
    private rolesService = inject(RolesService);
    private destroy$ = new Subject<void>();

    availableRoles: UserRole[] = [];
    internalRoles: InternalRole[] = [];
    roleMappingsList: Array<{ keycloakRole: string; internalRole: string; roleInfo?: InternalRole }> = [];
    selectedRoles: string[] = [];
    currentUserRoles: string[] = [];
    isMockMode = false;
    isLoading = true;

    // Expose RolesService constants to template
    readonly RolesService = RolesService;

    // Predefined role combinations for quick testing
    roleCombinations = [
        { name: 'Admin (All Access)', roles: [RolesService.ADMIN_ROLE] },
        { name: 'FUV Offerte', roles: ['fuv_offerte'] },
        { name: 'VT Aktenentscheid', roles: ['aktenentscheid'] },
        { name: 'VT Betriebsbeschreibung', roles: ['aktenentscheid_bbakt'] },
        { name: 'INEX Medirück', roles: ['medirueck'] },
        { name: 'INEX Regress', roles: ['ie_auswertung'] },
        { name: 'System Admin', roles: [RolesService.SYSTEM_ROLE] },
        { name: 'FUV + VT', roles: ['fuv_offerte', 'aktenentscheid'] },
        { name: 'All INEX', roles: ['medirueck', 'ie_auswertung'] },
        { name: 'All VT', roles: ['aktenentscheid', 'aktenentscheid_bbakt'] },
        { name: 'Super User', roles: ['fuv_offerte', 'aktenentscheid', 'aktenentscheid_bbakt', 'medirueck', 'ie_auswertung', RolesService.SYSTEM_ROLE] }
    ];

    ngOnInit(): void {
        this.isMockMode = this.environmentService.isMock();

        // Always load roles from API to show mappings
        this.loadRoleMappingsFromAPI();

        // Load current roles if available
        if (this.isMockMode) {
            this.currentUserRoles = this.menuFilterService.getCurrentUserRoles();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadRoleMappingsFromAPI(): void {
        this.isLoading = true;

        this.rolesService
            .getAvailableInternalRoles()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (roles: InternalRole[]) => {
                    this.internalRoles = roles;
                    this.buildAvailableRoles(roles);
                    this.buildRoleMappingsList(roles);
                    this.isLoading = false;
                },
                error: (error: unknown) => {
                    console.error('Error loading role mappings:', error);
                    this.isLoading = false;
                }
            });
    }

    private buildAvailableRoles(internalRoles: InternalRole[]): void {
        this.availableRoles = internalRoles.map((role) => ({
            name: role.name,
            displayName: role.displayName,
            description: role.description,
            isActive: false,
            source: 'mock' as const
        }));
    }

    private buildRoleMappingsList(internalRoles: InternalRole[]): void {
        // Build list of individual Keycloak role -> Internal role mappings
        this.roleMappingsList = [];

        internalRoles.forEach((internalRole) => {
            internalRole.keycloakRoles.forEach((keycloakRole) => {
                this.roleMappingsList.push({
                    keycloakRole,
                    internalRole: internalRole.name,
                    roleInfo: internalRole
                });
            });
        });
    }

    onRoleToggle(roleName: string, checked: boolean): void {
        if (checked) {
            if (!this.selectedRoles.includes(roleName)) {
                this.selectedRoles.push(roleName);
            }
        } else {
            this.selectedRoles = this.selectedRoles.filter((role) => role !== roleName);
        }
        this.applyRoleChanges();
    }

    applyRoleCombination(combination: { name: string; roles: string[] }): void {
        this.selectedRoles = [...combination.roles];
        this.applyRoleChanges();
    }

    clearAllRoles(): void {
        this.selectedRoles = [];
        this.applyRoleChanges();
    }

    resetToAdmin(): void {
        this.selectedRoles = [RolesService.ADMIN_ROLE];
        this.applyRoleChanges();
    }

    private applyRoleChanges(): void {
        this.currentUserRoles = this.menuFilterService.getCurrentUserRoles();
    }

    isRoleSelected(roleName: string): boolean {
        return this.selectedRoles.includes(roleName);
    }

    getRoleSeverity(roleName: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
        if (roleName.includes('berechtigung')) return 'danger';
        if (roleName.includes('kpm_tool')) return 'warn';
        if (roleName.includes('fuv')) return 'success';
        if (roleName.includes('aktenentscheid')) return 'info';
        if (roleName.includes('medirueck') || roleName.includes('ie_auswertung')) return 'secondary';
        return 'secondary';
    }

    getAccessibleRoutes(): string[] {
        const routes: string[] = [];
        this.availableRoles
            .filter((role) => this.currentUserRoles.includes(role.name))
            .forEach((role) => {
                // This would need to be enhanced to show actual routes from role mappings
                routes.push(`Routes for ${role.displayName}`);
            });
        return routes;
    }
}
