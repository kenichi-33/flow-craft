import Keycloak from 'keycloak-js';

const keycloakConfig = {
    url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8081',
    realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'workflow',
    clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'workflow-app',
};

// Keycloakインスタンス（シングルトン）
let keycloakInstance: Keycloak | null = null;

export const getKeycloak = (): Keycloak => {
    if (typeof window === 'undefined') {
        throw new Error('Keycloak can only be used in browser');
    }
    if (!keycloakInstance) {
        keycloakInstance = new Keycloak(keycloakConfig);
    }
    return keycloakInstance;
};

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
    groups: string[];
    groupCodes: string[];  // グループのcode属性（codeベースの比較用）
    employeeId?: string;
    displayName?: string;
}

// Base64URLをBase64に変換
function base64UrlToBase64(base64Url: string): string {
    // Base64URL → Base64変換
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // パディング追加
    const pad = base64.length % 4;
    if (pad) {
        base64 += '='.repeat(4 - pad);
    }
    return base64;
}

// Base64をUTF-8文字列にデコード（日本語対応）
function decodeBase64Utf8(base64: string): string {
    // atob()でバイナリ文字列に変換
    const binaryString = atob(base64);
    // バイナリ文字列をUint8Arrayに変換
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    // TextDecoderでUTF-8としてデコード
    return new TextDecoder('utf-8').decode(bytes);
}

// トークンからユーザー情報を抽出
export const parseToken = (token: string): AuthUser | null => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.error('[Keycloak] Invalid token format');
            return null;
        }

        const payloadBase64 = base64UrlToBase64(parts[1]);
        const payloadJson = decodeBase64Utf8(payloadBase64);
        const payload = JSON.parse(payloadJson);

        // ロールの取得（複数の場所をチェック）
        // 1. カスタムmapperで設定した"roles"クレーム
        // 2. realm_access.roles (デフォルト)
        let roles: string[] = [];
        if (payload.roles && Array.isArray(payload.roles)) {
            roles = payload.roles;
        } else if (payload.realm_access?.roles) {
            roles = payload.realm_access.roles;
        }

        // グループの取得
        const groups = payload.groups || [];
        // グループのcode属性（mapperから取得）
        // Script Mapper使用時: groupCodes
        // ユーザー属性マッパー使用時: group_code
        const groupCodes = payload.groupCodes || payload.group_code || [];

        console.log('[Keycloak] Parsed token:', {
            username: payload.preferred_username,
            roles,
            groups,
            groupCodes,
        });

        return {
            id: payload.sub,
            username: payload.preferred_username,
            email: payload.email,
            name: payload.name,
            firstName: payload.given_name,
            lastName: payload.family_name,
            roles,
            groups,
            groupCodes,
            employeeId: payload.employeeId,
            displayName: payload.displayName,
        };
    } catch (e) {
        console.error('[Keycloak] Failed to parse token:', e);
        return null;
    }
};

export default keycloakConfig;
