'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import Keycloak from 'keycloak-js';
import { getKeycloak, AuthUser, parseToken } from '@/lib/keycloak';

interface AuthContextValue {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AuthUser | null;
    token: string | null;
    login: () => void;
    logout: () => void;
    hasRole: (role: string) => boolean;
    hasAnyRole: (roles: string[]) => boolean;
    isInGroup: (group: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const initKeycloak = async () => {
            try {
                const kc = getKeycloak();
                const authenticated = await kc.init({
                    onLoad: 'login-required',
                    checkLoginIframe: false,
                    pkceMethod: 'S256',
                });

                setKeycloak(kc);
                setIsAuthenticated(authenticated);

                if (authenticated && kc.token) {
                    setToken(kc.token);
                    setUser(parseToken(kc.token));
                }

                // トークン自動更新
                kc.onTokenExpired = () => {
                    kc.updateToken(30).then((refreshed) => {
                        if (refreshed && kc.token) {
                            setToken(kc.token);
                            setUser(parseToken(kc.token));
                        }
                    }).catch(() => {
                        console.error('Failed to refresh token');
                        kc.logout();
                    });
                };
            } catch (error) {
                console.error('Keycloak init failed:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initKeycloak();
    }, []);

    const login = useCallback(() => {
        keycloak?.login();
    }, [keycloak]);

    const logout = useCallback(() => {
        keycloak?.logout({ redirectUri: window.location.origin });
    }, [keycloak]);

    const hasRole = useCallback((role: string): boolean => {
        if (!user) return false;
        // wf_adminは全て許可
        if (user.roles.includes('wf_admin')) return true;
        return user.roles.includes(role);
    }, [user]);

    const hasAnyRole = useCallback((roles: string[]): boolean => {
        return roles.some(role => hasRole(role));
    }, [hasRole]);

    const isInGroup = useCallback((group: string): boolean => {
        if (!user) return false;
        return user.groups.some(g => g.includes(group));
    }, [user]);

    const value: AuthContextValue = {
        isAuthenticated,
        isLoading,
        user,
        token,
        login,
        logout,
        hasRole,
        hasAnyRole,
        isInGroup,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
