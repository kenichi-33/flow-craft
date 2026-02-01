import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './useAuthStore';

describe('useAuthStore', () => {
    beforeEach(() => {
        // Reset store to initial state
        useAuthStore.setState({
            keycloak: null,
            isAuthenticated: false,
            isLoading: true,
            user: null,
            token: null,
        });
    });

    it('should initialize with default state', () => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(true);
        expect(state.user).toBeNull();
        expect(state.token).toBeNull();
    });

    it('hasRole should return false when user is null', () => {
        const result = useAuthStore.getState().hasRole('admin');
        expect(result).toBe(false);
    });

    it('hasRole should return true if user has wf_admin role', () => {
        useAuthStore.setState({
            user: {
                sub: '1',
                email_verified: true,
                name: 'Test',
                preferred_username: 'test',
                given_name: 'Test',
                family_name: 'User',
                email: 'test@test.com',
                roles: ['wf_admin'],
                groups: [],
                groupCodes: [],
                firstName: 'Test',
                lastName: 'User',
                username: 'test',
            },
        });
        
        const result = useAuthStore.getState().hasRole('some_role');
        expect(result).toBe(true); // wf_admin grants all roles
    });

    it('hasRole should check specific role', () => {
        useAuthStore.setState({
            user: {
                sub: '1',
                email_verified: true,
                name: 'Test',
                preferred_username: 'test',
                given_name: 'Test',
                family_name: 'User',
                email: 'test@test.com',
                roles: ['user', 'editor'],
                groups: [],
                groupCodes: [],
                firstName: 'Test',
                lastName: 'User',
                username: 'test',
            },
        });
        
        expect(useAuthStore.getState().hasRole('editor')).toBe(true);
        expect(useAuthStore.getState().hasRole('admin')).toBe(false);
    });
});
