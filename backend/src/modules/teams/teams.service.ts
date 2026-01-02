import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamsService {
    constructor(private prisma: PrismaService) { }

    // チーム一覧
    async findAll() {
        return this.prisma.team.findMany({
            include: {
                members: true,
            },
            orderBy: { createdAt: 'desc' },
        });
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
}
