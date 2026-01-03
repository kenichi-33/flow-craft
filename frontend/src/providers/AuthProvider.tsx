'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
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
    refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

// トークン更新間隔（4分 = 240秒）
// Keycloakのデフォルトaccess_token有効期限は5分なので、余裕を持って4分ごとに更新
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000;

export function AuthProvider({ children }: AuthProviderProps) {
    const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // トークン更新関数
    const doRefreshToken = useCallback(async (kc: Keycloak): Promise<boolean> => {
        try {
            // 30秒未満で期限切れなら更新
            const refreshed = await kc.updateToken(30);
            if (refreshed && kc.token) {
                console.log('[Auth] Token refreshed at', new Date().toLocaleTimeString());
                setToken(kc.token);
                setUser(parseToken(kc.token));
            }
            return true;
        } catch (error) {
            console.error('[Auth] Token refresh failed:', error);
            return false;
        }
    }, []);

    // 公開用のトークン更新関数
    const refreshToken = useCallback(async (): Promise<boolean> => {
        if (!keycloak) return false;
        return doRefreshToken(keycloak);
    }, [keycloak, doRefreshToken]);

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

                    // 定期的なトークン更新を開始
                    console.log('[Auth] Starting periodic token refresh (every 4 minutes)');
                    refreshIntervalRef.current = setInterval(() => {
                        console.log('[Auth] Periodic token refresh triggered');
                        doRefreshToken(kc);
                    }, TOKEN_REFRESH_INTERVAL);
                }

                // トークン期限切れイベントのハンドラ
                kc.onTokenExpired = () => {
                    console.log('[Auth] Token expired event - refreshing...');
                    kc.updateToken(30).then((refreshed) => {
                        if (refreshed && kc.token) {
                            setToken(kc.token);
                            setUser(parseToken(kc.token));
                            console.log('[Auth] Token refreshed after expiry');
                        }
                    }).catch((error) => {
                        console.error('[Auth] Failed to refresh token on expiry:', error);
                        // リフレッシュトークンも期限切れの場合は再ログイン
                        kc.logout();
                    });
                };

                // 認証状態変更イベント
                kc.onAuthRefreshSuccess = () => {
                    if (kc.token) {
                        setToken(kc.token);
                        setUser(parseToken(kc.token));
                    }
                };

                kc.onAuthRefreshError = () => {
                    console.error('[Auth] Auth refresh error');
                };

            } catch (error) {
                console.error('Keycloak init failed:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initKeycloak();

        // クリーンアップ
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [doRefreshToken]);

    const login = useCallback(() => {
        keycloak?.login();
    }, [keycloak]);

    const logout = useCallback(() => {
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
        }
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
        refreshToken,
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
