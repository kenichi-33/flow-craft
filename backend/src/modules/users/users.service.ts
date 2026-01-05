import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface UserSnapshot {
    username: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    department?: string;
    type?: 'user' | 'group' | 'role' | 'other';
}

interface KeycloakUser {
    id: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    attributes?: Record<string, string[]>;
}

@Injectable()
export class UsersService {
    private keycloakUrl: string;
    private realm: string;
    private tokenCache: { token: string; expiresAt: number } | null = null;
    private deptMapCache: { map: Record<string, string>; expiresAt: number } | null = null;

    constructor(private configService: ConfigService) {
        this.keycloakUrl = this.configService.get('KEYCLOAK_URL') || 'http://localhost:8081';
        this.realm = this.configService.get('KEYCLOAK_REALM') || 'workflow';
    }

    private async getAdminToken(): Promise<string> {
        // トークンは頻繁に呼ばれる可能性があるため、単純な期限管理のみ残す
        if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
            return this.tokenCache.token;
        }

        try {
            const response = await axios.post(
                `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: 'admin-cli',
                    username: this.configService.get('KEYCLOAK_ADMIN_USER') || 'admin',
                    password: this.configService.get('KEYCLOAK_ADMIN_PASSWORD') || 'admin',
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            
            const expiresIn = response.data.expires_in;
            this.tokenCache = {
                token: response.data.access_token,
                expiresAt: Date.now() + (expiresIn - 30) * 1000,
            };
            
            return response.data.access_token;
        } catch (error) {
            console.error('Failed to get admin token:', error);
            throw error;
        }
    }

    private async getDepartmentsMap(): Promise<Record<string, string>> {
        // デパートメントマップは頻繁に変更されないため、短いTTL等でメモリ保持しても良いが、
        // 今回はリクエストごとの整合性を重視し、キャッシュなし（または呼出元の判断）とするか、
        // サービス内の簡易変数キャッシュのみ残す（DB保存時は厳密なリアルタイム性は不要なことが多いため）。
        // ここではトークン同様、メモリ変数に簡易キャッシュのみ残します。
        
        if (this.deptMapCache && this.deptMapCache.expiresAt > Date.now()) {
            return this.deptMapCache.map;
        }

        try {
            const token = await this.getAdminToken();
            const response = await axios.get(`${this.keycloakUrl}/admin/realms/${this.realm}/groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const deptMap: Record<string, string> = {};
            
            const processGroups = async (groups: any[], parentToken: string) => {
                for (const group of groups) {
                    try {
                        const detailResponse = await axios.get(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/groups/${group.id}`,
                            { headers: { Authorization: `Bearer ${parentToken}` } }
                        );
                        const code = detailResponse.data.attributes?.code?.[0];
                        if (code) {
                            deptMap[code] = group.name;
                        }
                        deptMap[group.path] = group.name;
                    } catch (e) {
                         console.warn(`Failed to fetch group detail for ${group.id}`);
                    }
                    
                    if (group.subGroupCount > 0) {
                        try {
                            const childrenResponse = await axios.get(
                                `${this.keycloakUrl}/admin/realms/${this.realm}/groups/${group.id}/children`,
                                { headers: { Authorization: `Bearer ${parentToken}` } }
                            );
                            await processGroups(childrenResponse.data, parentToken);
                        } catch (e) {
                            console.warn(`Failed to fetch children for ${group.id}`);
                        }
                    }
                }
            };
            
            await processGroups(response.data, token);

            this.deptMapCache = {
                map: deptMap,
                expiresAt: Date.now() + 1000 * 60 * 60, // 1時間
            };

            return deptMap;
        } catch (error) {
            console.error('Failed to get departments map:', error);
            return this.deptMapCache ? this.deptMapCache.map : {};
        }
    }

    /**
     * ユーザーIDからスナップショット情報を取得
     */
    async getUserSnapshot(userId: string): Promise<UserSnapshot> {
        try {
            const token = await this.getAdminToken();
            const userResponse = await axios.get<KeycloakUser>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const user = userResponse.data;

            const groupsResponse = await axios.get<any[]>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userId}/groups`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            let department = '';
            // 部署マップを使ってpathから解決する方が正確だが、ここでは簡易的に保存
            // 必要なら getDepartmentsMap を使って path -> name 変換を行う
            const deptMap = await this.getDepartmentsMap();
            
            if (groupsResponse.data.length > 0) {
                 // 所属グループの中で最も深いものや、特定の条件に合うものを選ぶロジックが必要だが
                 // ここではとりあえず先頭のグループを使用
                 const group = groupsResponse.data[0];
                 department = deptMap[group.path] || group.name;
            }

            return {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                department,
                type: 'user',
            };
        } catch (error) {
            console.error(`Failed to fetch user ${userId}:`, error);
            return {
                username: 'unknown',
                type: 'user',
            };
        }
    }

    /**
     * assignedTo文字列からスナップショット情報を解決
     */
    async resolveAssignedToSnapshot(assignedTo: string): Promise<UserSnapshot> {
        if (!assignedTo) {
             return { username: 'unassigned', type: 'other' };
        }

        if (assignedTo.startsWith('user:')) {
            const userIdOrName = assignedTo.substring(5);
            return this.getUserSnapshotByUsername(userIdOrName);
        }

        if (assignedTo.startsWith('group:')) {
            const groupCodeOrPath = assignedTo.substring(6);
            const deptMap = await this.getDepartmentsMap();
            const name = deptMap[groupCodeOrPath] || groupCodeOrPath.split('/').pop() || groupCodeOrPath;
            return {
                username: name,
                type: 'group',
                department: name, 
            };
        }

        if (assignedTo.startsWith('role:')) {
             const role = assignedTo.substring(5);
             const roleMap: Record<string, string> = {
                'wf_admin': '管理者',
                'wf_manager': 'マネージャー',
                'wf_approver': '承認者',
                'wf_user': 'ユーザー',
             };
             const name = roleMap[role] || role;
             return {
                 username: name,
                 type: 'role'
             };
        }
        
        if (assignedTo === 'applicant_manager') {
            return {
                username: '申請者の上長',
                type: 'other'
            };
        }
        
        if (assignedTo === 'applicant') {
            return {
                username: '申請者',
                type: 'other'
            };
        }

        return {
            username: assignedTo,
            type: 'other'
        };
    }

    async getUserSnapshotByUsername(username: string): Promise<UserSnapshot> {
         try {
            const token = await this.getAdminToken();
            const userResponse = await axios.get<KeycloakUser[]>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
                { 
                    params: { username, exact: true },
                    headers: { Authorization: `Bearer ${token}` } 
                }
            );

            if (userResponse.data.length === 0) {
                return { username, type: 'user' };
            }

            const user = userResponse.data[0];
            return this.getUserSnapshot(user.id);
         } catch (e) {
             console.error(`Failed to resolving username ${username}:`, e);
             return { username, type: 'user' };
         }
    }
}
