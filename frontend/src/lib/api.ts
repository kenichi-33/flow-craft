import { getKeycloak } from './keycloak';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';

export class ApiError extends Error {
    constructor(public status: number, public message: string, public data?: any) {
        super(message);
        this.name = 'ApiError';
    }
}

// トークン更新を試みる（有効期限30秒前に更新）
async function refreshTokenIfNeeded(): Promise<boolean> {
    try {
        const keycloak = getKeycloak();
        if (!keycloak.authenticated) {
            return false;
        }
        // トークンの有効期限が30秒未満なら更新
        const updated = await keycloak.updateToken(30);
        if (updated) {
            console.log('[Auth] Token refreshed successfully');
        }
        return true;
    } catch (error) {
        console.error('[Auth] Token refresh failed:', error);
        return false;
    }
}

// 強制的にトークン更新
async function forceRefreshToken(): Promise<boolean> {
    try {
        const keycloak = getKeycloak();
        if (!keycloak.authenticated) {
            return false;
        }
        // 0秒を指定して強制更新
        await keycloak.updateToken(-1);
        console.log('[Auth] Token force refreshed');
        return true;
    } catch (error) {
        console.error('[Auth] Force token refresh failed:', error);
        // リフレッシュに失敗した場合は再ログイン
        try {
            const keycloak = getKeycloak();
            keycloak.login();
        } catch {
            // ログインも失敗した場合は無視
        }
        return false;
    }
}

// 現在のアクセストークンを取得
function getAccessToken(): string | null {
    try {
        const keycloak = getKeycloak();
        return keycloak.token || null;
    } catch {
        return null;
    }
}

async function request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // リクエスト前にトークン更新チェック
    await refreshTokenIfNeeded();

    const token = getAccessToken();

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });

        // 401エラーの場合、トークン更新して1回だけリトライ
        if (response.status === 401 && retryCount < 1) {
            console.log('[API] 401 Unauthorized - attempting token refresh...');
            const refreshed = await forceRefreshToken();
            if (refreshed) {
                // リトライ
                return request<T>(endpoint, options, retryCount + 1);
            }
        }

        if (!response.ok) {
            let errorMessage = 'An error occurred';
            let data;
            try {
                data = await response.json();
                errorMessage = data.message || errorMessage;
            } catch {
                // ignore
            }
            throw new ApiError(response.status, errorMessage, data);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : {} as any;

    } catch (e) {
        // 401エラーの場合はリトライを試みてからログを出力
        if (e instanceof ApiError && e.status === 401 && retryCount < 1) {
            console.log('[API] 401 error caught - attempting recovery...');
            const refreshed = await forceRefreshToken();
            if (refreshed) {
                return request<T>(endpoint, options, retryCount + 1);
            }
        }
        console.error('[API] Error:', e);
        throw e;
    }
}

export const api = {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// トークン更新関数をエクスポート（AuthProviderで使用）
export { refreshTokenIfNeeded, forceRefreshToken };
