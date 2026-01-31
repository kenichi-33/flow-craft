import { useAuthStore } from '@/stores/useAuthStore';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';

export class ApiError extends Error {
    public status: number;
    public message: string;
    public data?: any;

    constructor(status: number, message: string, data?: any) {
        super(message);
        this.status = status;
        this.message = message;
        this.data = data;
        this.name = 'ApiError';
    }
}

async function request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const { refreshToken, logout } = useAuthStore.getState();

    // Refresh if needed before request (e.g. if token is about to expire)
    // For now, reliance on 401 retry might be sufficient, but we can call refreshToken() if we track expiry.
    // However, Keycloak-js usually manages this. usage of refreshToken() here checks expiry internal to keycloak-js.
    await refreshToken(); 

    const currentToken = useAuthStore.getState().token;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
                ...options.headers,
            },
        });

        // 401 retry logic
        if (response.status === 401 && retryCount < 1) {
            console.log('[API] 401 Unauthorized - attempting token refresh...');
            const refreshed = await refreshToken();
            if (refreshed) {
                return request<T>(endpoint, options, retryCount + 1);
            } else {
                logout(); // Logout if refresh fails on 401
                throw new ApiError(401, 'Session expired');
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
        if (e instanceof ApiError && e.status === 401 && retryCount < 1) {
             console.log('[API] 401 error caught - attempting recovery...');
             const refreshed = await refreshToken();
             if (refreshed) {
                 return request<T>(endpoint, options, retryCount + 1);
             } else {
                 logout();
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
    patch: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
