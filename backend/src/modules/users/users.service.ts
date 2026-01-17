import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

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

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService
    ) {
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
        } catch (error: any) {
            console.error('Failed to get admin token:', error.message);
            if (error.response) {
                console.error('Error Status:', error.response.status);
                console.error('Error Data:', JSON.stringify(error.response.data));
            }
            throw error;
        }
    }

    private deptCache: { data: any[]; expiresAt: number } | null = null;

    /**
     * 指定されたルートパス直下のグループツリーを取得する
     * @param rootPath e.g. "/company" or "/teams". If undefined, returns all.
     */
    public async getGroups(rootPath?: string): Promise<{ id: string; name: string; path: string; deptCode?: string }[]> {
        // キャッシュキーを分けるべきだが、簡易的に既存キャッシュを使うか、あるいは都度取得するか。
        // ここでは都度取得のロジックを構成する（既存のgetAllDepartmentsをリファクタリングして再利用）
        
        // 既存キャッシュがあればそれを使う（全量キャッシュされている前提）
        // Disabled for debugging to ensure freshness of deptCode
        /*
        if (this.deptCache && this.deptCache.expiresAt > Date.now()) {
            const all = this.deptCache.data;
            if (!rootPath) return all;
            return all.filter(g => g.path.startsWith(rootPath));
        }
        */

        try {
            const token = await this.getAdminToken();
            const response = await axios.get(`${this.keycloakUrl}/admin/realms/${this.realm}/groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const results: { id: string; name: string; path: string; deptCode?: string }[] = [];
            
            // 再帰処理関数
            const processGroups = async (groups: any[], parentToken: string) => {
                for (const group of groups) {
                    // グループ詳細取得
                    let deptCode = undefined;
                    try {
                        const detailResponse = await axios.get(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/groups/${group.id}`,
                            { headers: { Authorization: `Bearer ${parentToken}` } }
                        );
                        const attrs = detailResponse.data.attributes || {};
                        deptCode = attrs.deptCode?.[0];
                    } catch (e) {
                        console.warn(`Failed to fetch group detail for ${group.id}`);
                    }

                    results.push({
                        id: group.id,
                        name: group.name,
                        path: group.path,
                        deptCode: deptCode
                    });
                    
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

            // キャッシュ保存
            this.deptCache = {
                data: results,
                expiresAt: Date.now() + 1000 * 60 * 60, // 1時間
            };

            if (!rootPath) return results;
            return results.filter(g => g.path.startsWith(rootPath));

        } catch (error) {
            console.error('Failed to get groups:', error);
            // エラー時はキャッシュがあれば返す
            if (this.deptCache) {
                const all = this.deptCache.data;
                if (!rootPath) return all;
                return all.filter(g => g.path.startsWith(rootPath));
            }
            return [];
        }
    }

    /**
     * 指定されたグループのメンバーを取得する
     */
    public async getGroupMembers(groupId: string): Promise<UserSnapshot[]> {
        try {
            const token = await this.getAdminToken();
            const response = await axios.get<KeycloakUser[]>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/groups/${groupId}/members`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // 簡易的に変換して返す
            return response.data.map(u => ({
                username: u.username,
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
                type: 'user',
                // departmentはここからは分からない（別途解決が必要だが、一旦省略）
            }));
        } catch (error) {
            console.error(`Failed to fetch members for group ${groupId}:`, error);
            return [];
        }
    }



    // 既存互換用
    public async getAllDepartments(): Promise<{ id: string; name: string; path: string; deptCode?: string }[]> {
        return this.getGroups();
    }

    public async getDepartmentsMap(): Promise<Record<string, string>> {
        const depts = await this.getAllDepartments();
        const map: Record<string, string> = {};
        depts.forEach(d => {
            if (d.deptCode) map[d.deptCode] = d.name;
        });
        return map;
    }

    public async findGroupByIdentifier(identifier: string): Promise<{ path: string; name: string; deptCode?: string } | null> {
        const depts = await this.getAllDepartments();
        // deptCode または path で検索
        const found = depts.find(d => d.deptCode === identifier);
        return found || null;
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
            
            // 1. Try Department Map
            if (deptMap[groupCodeOrPath]) {
                 return {
                    username: deptMap[groupCodeOrPath],
                    type: 'group',
                    department: deptMap[groupCodeOrPath],
                };
            }

            // 2. Try Team Lookup
            try {
                const team = await this.prisma.team.findUnique({
                    where: { id: groupCodeOrPath },
                    select: { name: true }
                });
                if (team) {
                    return {
                        username: team.name,
                        type: 'group',
                        department: team.name
                    };
                }
            } catch (e) {
                console.warn(`[UsersService] Failed to lookup team for ${groupCodeOrPath}`, e);
            }

            const name = groupCodeOrPath.split('/').pop() || groupCodeOrPath;
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
                'wf_app_admin': 'アプリ管理者',
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
    async getManager(userIdOrUsername: string): Promise<UserSnapshot | null> {
         try {
            const token = await this.getAdminToken();
            let user: KeycloakUser | null = null;

            // まずIDとしての取得を試みる (UUID形式かどうかのチェックは簡易的に省略し、エラーハンドリングでカバー)
            try {
                const userResponse = await axios.get<KeycloakUser>(
                    `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userIdOrUsername}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                user = userResponse.data;
            } catch (e) {
                // IDで見つからない場合、ユーザー名検索を試みる
                const searchResponse = await axios.get<KeycloakUser[]>(
                    `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
                    { 
                        params: { username: userIdOrUsername, exact: true },
                        headers: { Authorization: `Bearer ${token}` } 
                    }
                );
                if (searchResponse.data.length > 0) {
                    user = searchResponse.data[0];
                }
            }

            if (!user) {
                console.warn(`User not found for getManager: ${userIdOrUsername}`);
                return null;
            }

            const attributes = user.attributes || {};
            
            // managerId 属性があればそれをキーに検索
            const managerId = attributes['managerId']?.[0];
            if (managerId) {
                return this.getUserSnapshot(managerId);
            }

            // manager (username) 属性があればそれをキーに検索
            const managerUsername = attributes['manager']?.[0];
            if (managerUsername) {
                return this.getUserSnapshotByUsername(managerUsername);
            }

            return null;
         } catch (e) {
             console.error(`Failed to get manager for user ${userIdOrUsername}`, e);
             return null;
         }
    }

    /**
     * ユーザーの所属グループとそのdeptCodeを取得
     * グループ認可チェック用
     */
    /**
     * ユーザーの所属グループとそのdeptCodeを取得
     * グループ認可チェック用
     */
    async getUserGroupsWithDeptCode(userIdOrUsername: string): Promise<{ id: string; path: string; name: string; deptCode?: string }[]> {
        try {
            const token = await this.getAdminToken();
            let userId = userIdOrUsername;

            // ユーザー名の場合はIDを取得
            if (!userIdOrUsername.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                const searchResponse = await axios.get<KeycloakUser[]>(
                    `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
                    {
                        params: { username: userIdOrUsername, exact: true },
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                if (searchResponse.data.length === 0) {
                    console.warn(`User not found: ${userIdOrUsername}`);
                    return [];
                }
                userId = searchResponse.data[0].id;
            }

            // ユーザーの所属グループを取得
            const groupsResponse = await axios.get<any[]>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userId}/groups`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // 各グループのdeptCodeを取得
            const results: { id: string; path: string; name: string; deptCode?: string }[] = [];
            for (const group of groupsResponse.data) {
                let deptCode: string | undefined;
                try {
                    const detailResponse = await axios.get(
                        `${this.keycloakUrl}/admin/realms/${this.realm}/groups/${group.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    deptCode = detailResponse.data.attributes?.deptCode?.[0];
                    // console.log(`[UsersService] User ${userIdOrUsername} belongs to Group: ${group.path}, DeptCode: ${deptCode}`);
                } catch (e) {
                    console.warn(`Failed to fetch group detail for ${group.id}`);
                }
                results.push({
                    id: group.id,
                    path: group.path,
                    name: group.name,
                    deptCode,
                });
            }

            return results;
        } catch (error) {
            console.error(`Failed to get groups for user ${userIdOrUsername}:`, error);
            return [];
        }
    }
}
