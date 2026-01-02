import { getKeycloak } from './keycloak';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';

export class ApiError extends Error {
    constructor(public status: number, public message: string, public data?: any) {
        super(message);
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
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
