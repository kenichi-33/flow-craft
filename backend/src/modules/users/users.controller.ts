import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

    constructor(private configService: ConfigService) {
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

    @Get('departments')
    async getDepartments() {
        try {
            const token = await this.getAdminToken();
            const response = await axios.get<KeycloakGroup[]>(
                `${this.keycloakUrl}/admin/realms/${this.realm}/groups`,
                {
                    params: { briefRepresentation: false },
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            console.log('[Users] Groups response:', JSON.stringify(response.data, null, 2));

            const flattenGroups = (groups: KeycloakGroup[]): { path: string; name: string }[] => {
                const result: { path: string; name: string }[] = [];
                for (const group of groups) {
                    result.push({ path: group.path, name: group.name });
                    if (group.subGroups && group.subGroups.length > 0) {
                        result.push(...flattenGroups(group.subGroups));
                    }
                }
                return result;
            };

            const departments = flattenGroups(response.data);
            console.log('[Users] Flattened departments:', departments);
            return departments;
        } catch (error) {
            console.error('Get departments failed:', error);
            return [];
        }
    }
}
