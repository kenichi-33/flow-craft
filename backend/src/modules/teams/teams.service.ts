import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class TeamsService {
    constructor(
        private prisma: PrismaService,
        private usersService: UsersService,
    ) { }

    // チーム一覧
    async findAll() {
        const teams = await this.prisma.team.findMany({
            include: {
                members: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Enrich user members with Keycloak info
        const enrichedTeams = await Promise.all(teams.map(async (team) => {
            const enrichedMembers = await Promise.all(team.members.map(async (member) => {
                if (member.memberType === 'user') {
                    try {
                        const userInfo = await this.usersService.getUserSnapshotByUsername(member.memberId);
                        return {
                            ...member,
                            memberInfo: {
                                displayName: [userInfo.lastName, userInfo.firstName].filter(Boolean).join(' ') || userInfo.username,
                                department: userInfo.department,
                                username: userInfo.username,
                            },
                        };
                    } catch {
                        return member;
                    }
                }
                return member;
            }));
            return { ...team, members: enrichedMembers };
        }));

        return enrichedTeams;
    }

    // チーム詳細
    async findOne(id: string) {
        const team = await this.prisma.team.findUnique({
            where: { id },
            include: {
                members: true,
            },
        });
        if (!team) throw new NotFoundException(`Team ${id} not found`);
        return team;
    }

    // チーム作成
    async create(data: { name: string; description?: string }) {
        return this.prisma.team.create({
            data: {
                name: data.name,
                description: data.description,
            },
        });
    }

    // チーム更新
    async update(id: string, data: { name?: string; description?: string }) {
        await this.findOne(id);
        return this.prisma.team.update({
            where: { id },
            data,
        });
    }

    // チーム削除
    async delete(id: string) {
        await this.findOne(id);
        return this.prisma.team.delete({
            where: { id },
        });
    }

    // メンバー追加
    async addMember(teamId: string, memberType: 'user' | 'department', memberId: string) {
        await this.findOne(teamId);
        return this.prisma.teamMember.create({
            data: {
                teamId,
                memberType,
                memberId,
            },
        });
    }

    // メンバー削除
    async removeMember(teamId: string, memberId: string) {
        const member = await this.prisma.teamMember.findFirst({
            where: { teamId, memberId },
        });
        if (!member) throw new NotFoundException('Member not found');
        return this.prisma.teamMember.delete({
            where: { id: member.id },
        });
    }

    /**
     * メンバー一括更新 (トランザクション)
     */
    async updateMembers(teamId: string, members: { memberType: 'user' | 'department'; memberId: string }[]) {
        await this.findOne(teamId);
        
        return this.prisma.$transaction(async (tx) => {
            // 1. Delete all existing members
            await tx.teamMember.deleteMany({
                where: { teamId }
            });

            // 2. Create new members
            if (members.length > 0) {
                await tx.teamMember.createMany({
                    data: members.map(m => ({
                        teamId,
                        memberType: m.memberType,
                        memberId: m.memberId
                    }))
                });
            }
            
            return this.findOne(teamId);
        });
    }

    /**
     * ユーザーが所属するチームを取得（個人指定 または 部署指定）
     */
    async getMyTeams(username: string) {
        // 1. Get user's department info
        const userGroups = await this.usersService.getUserGroupsWithDeptCode(username);
        const userDeptCodes = userGroups.map(g => g.deptCode).filter((c): c is string => !!c);
        
        // console.log(`[TeamsService] getMyTeams for ${username}. User DeptCodes: ${userDeptCodes.join(', ')}`);

        // 2. Find teams where user is member OR user's department is member
        // User Request: Strictly use deptCode for verification.
        const teams = await this.prisma.team.findMany({
            where: {
                members: {
                    some: {
                        OR: [
                            { memberType: 'user', memberId: username },
                            // Check against DeptCodes only for department members
                            { memberType: 'department', memberId: { in: userDeptCodes } } 
                        ]
                    }
                }
            }
        });

        // console.log(`[TeamsService] Found ${teams.length} teams for user ${username}: ${teams.map(t => t.name).join(', ')}`);

        return teams;
    }
}
