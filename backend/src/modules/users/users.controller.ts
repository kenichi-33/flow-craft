import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import axios from 'axios';

interface KeycloakUser {
    id: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
    attributes?: Record<string, string[]>;
}

interface KeycloakGroup {
    id: string;
    name: string;
    path: string;
    subGroups?: KeycloakGroup[];
}

interface KeycloakRole {
    id: string;
    name: string;
    description?: string;
}

@Controller('users')
export class UsersController {
    private keycloakUrl: string;
    private realm: string;

    constructor(
        private configService: ConfigService,
        private usersService: UsersService
    ) {
        this.keycloakUrl = this.configService.get('KEYCLOAK_URL') || 'http://localhost:8081';
        this.realm = this.configService.get('KEYCLOAK_REALM') || 'workflow';
    }

    private async getAdminToken(): Promise<string> {
        try {
            const response = await axios.post(
                `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: 'admin-cli',
                    username: 'admin',
                    password: 'admin',
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            return response.data.access_token;
        } catch (error) {
            console.error('Failed to get admin token:', error);
            throw error;
        }
    }

    @Get('search')
    async search(
        @Query('q') query: string,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
    ) {
        try {
            const token = await this.getAdminToken();
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 20;
            const first = (pageNum - 1) * limitNum;

            // 検索パラメータ
            const searchParams: any = {
                first,
                max: limitNum,
            };
            if (query && query !== '*' && query.length > 0) {
                searchParams.search = query;
            }

            console.log('[Users] Searching with params:', searchParams);

            // ユーザー一覧取得
            const response = await axios.get<KeycloakUser[]>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
                {
                    params: searchParams,
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            // 総件数取得
            const countParams: any = {};
            if (query && query !== '*' && query.length > 0) {
                countParams.search = query;
            }
            const countResponse = await axios.get<number>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/users/count`,
                {
                    params: countParams,
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            console.log('[Users] Found', response.data.length, 'users, total:', countResponse.data);

            // 各ユーザーのグループと権限を取得
            const usersWithDetails = await Promise.all(
                response.data.map(async (user) => {
                    try {
                        // グループ取得
                        const groupsResponse = await axios.get<KeycloakGroup[]>(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/users/${user.id}/groups`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );

                        // ロール取得
                        const rolesResponse = await axios.get<KeycloakRole[]>(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/users/${user.id}/role-mappings/realm`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );

                        return {
                            id: user.id,
                            username: user.username,
                            displayName: user.attributes?.displayName?.[0] || `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.username,
                            email: user.email,
                            enabled: user.enabled,
                            position: user.attributes?.position?.[0] || '',
                            groups: groupsResponse.data.map(g => g.path),
                            roles: rolesResponse.data.map(r => r.name).filter(r => r.startsWith('wf_')),
                        };
                    } catch {
                        return {
                            id: user.id,
                            username: user.username,
                            displayName: user.attributes?.displayName?.[0] || `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.username,
                            email: user.email,
                            enabled: user.enabled,
                            position: user.attributes?.position?.[0] || '',
                            groups: [],
                            roles: [],
                        };
                    }
                })
            );

            return {
                data: usersWithDetails,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: countResponse.data,
                    totalPages: Math.ceil(countResponse.data / limitNum),
                },
            };
        } catch (error) {
            console.error('User search failed:', error);
            return {
                data: [],
                pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
            };
        }
    }

    @Post('resolve')
    async resolveUsers(@Body() body: { ids: string[] }) {
        if (!body.ids || !Array.isArray(body.ids)) return [];
        const uniqueIds = Array.from(new Set(body.ids));
        
        const results = await Promise.all(uniqueIds.map(async (id) => {
            try {
                // Check if it's a UUID (simple check)
                if (!id || typeof id !== 'string') return null;
                
                const snapshot = await this.usersService.getUserSnapshot(id);
                // Fallback check if user not found (Service returns 'unknown' username)
                if (snapshot.username === 'unknown') return null;
                
                return {
                    id,
                    username: snapshot.username,
                    displayName: `${snapshot.lastName || ''} ${snapshot.firstName || ''}`.trim() || snapshot.username,
                    email: snapshot.email
                };
            } catch (e) {
                return null;
            }
        }));
        
        return results.filter((u): u is NonNullable<typeof u> => u !== null);
    }

    @Get('departments')
    getDepartments(@Query('root') root?: string) {
        return this.usersService.getGroups(root);
    }

    @Get('groups/:id/members')
    async getGroupMembers(@Param('id') id: string) {
        console.log(`[UsersController] Fetching members for group ID: ${id}`);
        return this.usersService.getGroupMembers(id);
    }

    @Get('check-assignment')
    async checkUserAssignment(
        @Query('username') username: string,
        @Query('assignedTo') assignedTo: string,
    ) {
        try {
            const token = await this.getAdminToken();
            const assignments = assignedTo.split(',').map(s => s.trim());

            for (const a of assignments) {
                // ユーザー指定: user:username
                if (a.startsWith('user:')) {
                    if (a.substring(5) === username) {
                        return { isAssigned: true, matchType: 'user' };
                    }
                }

                // ロール指定: role:roleName
                if (a.startsWith('role:')) {
                    const roleName = a.substring(5);
                    const userResponse = await axios.get<KeycloakUser[]>(
                        `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
                        {
                            params: { username, exact: true },
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    if (userResponse.data.length > 0) {
                        const userId = userResponse.data[0].id;
                        const rolesResponse = await axios.get<KeycloakRole[]>(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        if (rolesResponse.data.some(r => r.name === roleName)) {
                            return { isAssigned: true, matchType: 'role' };
                        }
                    }
                }

                // グループ指定: group:deptCode
                if (a.startsWith('group:')) {
                    const groupIdentifier = a.substring(6);
                    
                    // ユーザーのグループを取得
                    const userResponse = await axios.get<KeycloakUser[]>(
                        `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
                        {
                            params: { username, exact: true },
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    
                    if (userResponse.data.length > 0) {
                        const userId = userResponse.data[0].id;
                        
                        // ターゲットグループのパスを解決 (deptCodeから)
                        // ここでパスfallbackを行わない (strict check)
                        const targetGroup = await this.usersService.findGroupByIdentifier(groupIdentifier);
                        
                        if (targetGroup) {
                            const targetPath = targetGroup.path;
                            
                            // ユーザーの全グループを取得
                            const groupsResponse = await axios.get<KeycloakGroup[]>(
                                `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userId}/groups`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            
                            // パスの一致（またはサブグループ）を確認
                            const isMatch = groupsResponse.data.some(g => 
                                g.path === targetPath || g.path.startsWith(targetPath + '/')
                            );
                            
                            if (isMatch) {
                                return { isAssigned: true, matchType: 'group' };
                            }
                        } else {
                            console.warn(`[Users] Group with deptCode '${groupIdentifier}' not found`);
                        }
                    }
                }
            }

            return { isAssigned: false };
        } catch (error) {
            console.error('Check assignment failed:', error);
            return { isAssigned: false, error: 'Check failed' };
        }
    }

    /**
     * assignedTo文字列を表示用の名前に変換
     * 例: "group:sales-1" → "営業第一課"
     */
    @Get('resolve-display')
    async resolveDisplay(@Query('assignedTo') assignedTo: string) {
        if (!assignedTo) {
            return { display: '' };
        }

        try {
            // 部署情報を取得 (Service委譲)
            const departments = await this.usersService.getAllDepartments();
            const deptMap: Record<string, string> = {};
            for (const dept of departments) {
                if (dept.deptCode) {
                    deptMap[dept.deptCode] = dept.name;
                }
            }

            // 担当者タイプに応じて表示名を解決
            const assignments = assignedTo.split(',').map(s => s.trim());
            const displays = assignments.map(a => {
                if (a.startsWith('user:')) {
                    return a.substring(5); // ユーザー名をそのまま返す
                }
                if (a.startsWith('role:')) {
                    const role = a.substring(5);
                    const roleMap: Record<string, string> = {
                        'wf_admin': '管理者',
                        'wf_manager': 'マネージャー',
                        'wf_approver': '承認者',
                        'wf_user': 'ユーザー',
                    };
                    return roleMap[role] || role;
                }
                if (a.startsWith('group:')) {
                    const code = a.substring(6);
                    return deptMap[code] || code;
                }
                if (a === 'applicant_manager') {
                    return '申請者の上長';
                }
                return a;
            });

            return { display: displays.join(', ') };
        } catch (error) {
            console.error('Resolve display failed:', error);
            return { display: assignedTo };
        }
    }
}
