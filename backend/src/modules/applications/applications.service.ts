import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface FindAllOptions {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: string;
    applicationNumber?: number;
    dateFrom?: string;
    dateTo?: string;
    applicantId?: string;
    requestUserId?: string; // アクセス制御用
}

@Injectable()
export class ApplicationsService {
    private keycloakUrl: string;
    private realm: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        this.keycloakUrl = this.configService.get('KEYCLOAK_URL') || 'http://localhost:8081';
        this.realm = this.configService.get('KEYCLOAK_REALM') || 'workflow';
    }

    private async getAdminToken(): Promise<string> {
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
    }

    private async getDepartmentsMap(): Promise<Record<string, string>> {
        try {
            const token = await this.getAdminToken();
            const response = await axios.get(`${this.keycloakUrl}/admin/realms/${this.realm}/groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const deptMap: Record<string, string> = {};
            
            const processGroups = async (groups: any[], parentToken: string) => {
                for (const group of groups) {
                    // グループ詳細を取得してcode属性を取得
                    const detailResponse = await axios.get(
                        `${this.keycloakUrl}/admin/realms/${this.realm}/groups/${group.id}`,
                        { headers: { Authorization: `Bearer ${parentToken}` } }
                    );
                    const code = detailResponse.data.attributes?.code?.[0];
                    if (code) {
                        deptMap[code] = group.name;
                    }
                    deptMap[group.path] = group.name;
                    
                    // サブグループを再帰的に処理
                    if (group.subGroupCount > 0) {
                        const childrenResponse = await axios.get(
                            `${this.keycloakUrl}/admin/realms/${this.realm}/groups/${group.id}/children`,
                            { headers: { Authorization: `Bearer ${parentToken}` } }
                        );
                        await processGroups(childrenResponse.data, parentToken);
                    }
                }
            };
            
            await processGroups(response.data, token);
            return deptMap;
        } catch (error) {
            console.error('Failed to get departments map:', error);
            return {};
        }
    }

    private resolveAssignedToDisplay(assignedTo: string, deptMap: Record<string, string>): string {
        if (!assignedTo) return '';
        
        const assignments = assignedTo.split(',').map(s => s.trim());
        const displays = assignments.map(a => {
            if (a.startsWith('user:')) {
                return a.substring(5);
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
        
        return displays.join(', ');
    }

    create(createApplicationDto: CreateApplicationDto) {
        return this.prisma.application.create({
            data: {
                formDefinitionId: createApplicationDto.formDefinitionId,
                flowDefinitionId: createApplicationDto.flowDefinitionId,
                applicantId: createApplicationDto.applicantId,
                inputData: (createApplicationDto.inputData || {}) as Prisma.InputJsonValue,
                status: 'DRAFT',
            },
            include: {
                formDefinition: true,
                flowDefinition: true,
            },
        });
    }

    async findAll(params: FindAllOptions = {}) {
        const { page, limit, search, sortBy = 'createdAt', sortOrder = 'desc', status, applicationNumber, dateFrom, dateTo, applicantId, requestUserId } = params;

        // 基本検索条件
        const where: Prisma.ApplicationWhereInput = {};

        // 申請者フィルタ（自分の申請のみ）
        if (applicantId) {
            where.applicantId = applicantId;
        }

        // アクセス制御: 
        // 1. 自分の申請は全て見える
        // 2. 他人の申請は DRAFT, REMANDED (一時保存、差し戻し) は見えない
        if (requestUserId) {
            // 明示的に自分の申請のみを表示する場合は上の criteria でカバーされるが、
            // 全体表示の際にフィルタリングが必要
            if (!applicantId) {
                where.OR = [
                    { applicantId: requestUserId }, // 自分の申請
                    { 
                        status: { 
                            notIn: ['DRAFT', 'REMANDED'] 
                        } 
                    } // 他人の申請等は公開ステータスのみ
                ];
            }
        }

        // ステータスフィルタ
        if (status) {
            where.status = status as any;
        }

        // 申請IDフィルタ
        if (applicationNumber) {
            where.applicationNumber = applicationNumber;
        }

        // 日付範囲フィルタ
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                (where.createdAt as any).gte = new Date(dateFrom);
            }
            if (dateTo) {
                // dateToはその日の終わりまで含む
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                (where.createdAt as any).lte = endDate;
            }
        }

        // テキスト検索条件を追加
        if (search) {
            where.OR = [
                { applicantId: { contains: search, mode: 'insensitive' } },
                { applicationDefinition: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        // ソート条件
        const orderBy: Prisma.ApplicationOrderByWithRelationInput = {};
        if (sortBy === 'applicationNumber' || sortBy === 'status' || sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'applicantId') {
            orderBy[sortBy] = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        // ページネーションなしの場合は単純な配列を返す（後方互換性）
        if (!page && !limit) {
            return this.prisma.application.findMany({
                where,
                orderBy,
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                    applicationDefinition: true,
                },
            });
        }

        // ページネーションありの場合
        const pageNum = page || 1;
        const limitNum = limit || 50;
        const skip = (pageNum - 1) * limitNum;

        const [data, total] = await Promise.all([
            this.prisma.application.findMany({
                where,
                orderBy,
                skip,
                take: limitNum,
                include: {
                    formDefinition: true,
                    flowDefinition: true,
                    applicationDefinition: true,
                },
            }),
            this.prisma.application.count({ where }),
        ]);

        return {
            data,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    }

    async findOne(id: string) {
        const application = await this.prisma.application.findUnique({
            where: { id },
            include: {
                formDefinition: true,
                flowDefinition: true,
                applicationDefinition: true,
                tasks: true,
                history: {
                    orderBy: { actedAt: 'asc' },
                },
                serviceTasks: {
                    include: {
                        history: {
                            orderBy: { executedAt: 'asc' },
                        },
                    },
                },
            },
        });
        if (!application) throw new NotFoundException(`Application with ID ${id} not found`);
        
        // タスクにassignedToDisplayを付与
        const deptMap = await this.getDepartmentsMap();
        const tasksWithDisplay = application.tasks.map(task => ({
            ...task,
            assignedToDisplay: this.resolveAssignedToDisplay(task.assignedTo || '', deptMap),
        }));
        
        return {
            ...application,
            tasks: tasksWithDisplay,
        };
    }

    async update(id: string, updateData: { inputData: any }) {
        const application = await this.prisma.application.findUnique({
            where: { id },
        });

        if (!application) {
            throw new NotFoundException(`Application with ID ${id} not found`);
        }

        return this.prisma.application.update({
            where: { id },
            data: {
                inputData: updateData.inputData as Prisma.InputJsonValue,
            },
            include: {
                applicationDefinition: true,
            },
        });
    }
}
