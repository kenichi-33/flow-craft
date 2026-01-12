import { create } from 'zustand';
import Keycloak from 'keycloak-js';

export interface AuthUser {
    sub: string;
    email_verified: boolean;
    name: string;
    preferred_username: string;
    given_name: string;
    family_name: string;
    email: string;
    realm_access?: {
        roles: string[];
    };
    resource_access?: {
        [key: string]: {
            roles: string[];
        };
    };
    groups: string[];
    groupCodes: string[];
    roles: string[];
    firstName: string;
    lastName: string;
    username: string;
}

interface AuthState {
    keycloak: Keycloak | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AuthUser | null;
    token: string | null;
    
    // Actions
    initKeycloak: () => Promise<void>;
    login: () => void;
    logout: () => void;
    refreshToken: () => Promise<boolean>;
    hasRole: (role: string) => boolean;
}

// Keycloak config
const keycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'workflow',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'workflow-app',
};

// Helper to parse token
const parseToken = (token: string): AuthUser => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const decoded = JSON.parse(jsonPayload);
        
        const groupCodes = decoded.groupCodes || decoded.group_code || [];

        return {
            ...decoded,
            roles: decoded.realm_access?.roles || [],
            firstName: decoded.given_name,
            lastName: decoded.family_name,
            username: decoded.preferred_username,
            groups: decoded.groups || [], // Mapper required in Keycloak
            groupCodes,
        };
    } catch (e) {
        console.error('Failed to parse token', e);
        return {} as AuthUser;
    }
};

export const useAuthStore = create<AuthState>((set, get) => ({
    keycloak: null,
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,

    initKeycloak: async () => {
        try {
            // Check if already initialized to prevent double init
            if (get().keycloak) return;

            const kc = new Keycloak(keycloakConfig);
            const authenticated = await kc.init({
                onLoad: 'login-required',
                checkLoginIframe: false,
                pkceMethod: 'S256',
            });

            if (authenticated && kc.token) {
                set({
                    keycloak: kc,
                    isAuthenticated: true,
                    token: kc.token,
                    user: parseToken(kc.token),
                    isLoading: false
                });

                // Set up auto refresh
                kc.onTokenExpired = () => {
                    console.log('[Auth] Token expired - refreshing...');
                    get().refreshToken();
                };
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            console.error('Keycloak init failed:', error);
            set({ isLoading: false });
        }
    },

    login: () => {
        get().keycloak?.login();
    },

    logout: () => {
        get().keycloak?.logout({ redirectUri: window.location.origin });
    },

    refreshToken: async () => {
        const kc = get().keycloak;
        if (!kc) return false;
        
        try {
            const refreshed = await kc.updateToken(30); // 30s min validity
            if (refreshed && kc.token) {
                set({ token: kc.token, user: parseToken(kc.token) });
                return true;
            }
            // If not refreshed (valid > 30s), it returns false but still valid
            return true; 
        } catch (e) {
            console.error('Failed to refresh token', e);
            get().logout();
            return false;
        }
    },

    hasRole: (role: string) => {
        const user = get().user;
        if (!user) return false;
        if (user.roles.includes('wf_admin')) return true;
        return user.roles.includes(role);
    }
}));
