import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getApplicationsSummary() {
    // 全アプリ定義を取得
    const defs = await this.prisma.applicationDefinition.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // アプリごとの集計を並列実行
    const summary = await Promise.all(defs.map(async (def) => {
      // 総申請数
      const totalCount = await this.prisma.application.count({
        where: { applicationDefinitionId: def.id },
      });

      // 進行中
      const activeCount = await this.prisma.application.count({
        where: { 
          applicationDefinitionId: def.id,
          status: 'IN_PROGRESS'
        },
      });

      // 完了(承認済み)
      const approvedCount = await this.prisma.application.count({
        where: { 
          applicationDefinitionId: def.id,
          status: 'APPROVED'
        },
      });

      return {
        ...def,
        stats: {
          totalCount,
          activeCount,
          approvedCount,
        }
      };
    }));

    return summary;
  }

  async getApplicationStats(id: string) {
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id },
      include: {
        flowDefinition: true, // フロー定義が必要（ノードマップ用）
      }
    });

    if (!appDef) return null;

    // ステータス分布
    const statusDistribution = await this.prisma.application.groupBy({
      by: ['status'],
      where: { applicationDefinitionId: id },
      _count: { _all: true },
    });

    // ノード別滞留数 (IN_PROGRESSのみ)
    const nodeDistribution = await this.prisma.application.groupBy({
      by: ['currentNodeId'],
      where: { 
        applicationDefinitionId: id,
        status: 'IN_PROGRESS',
        currentNodeId: { not: null }
      },
      _count: { _all: true },
    });

    // 過去30日の日次推移
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // PrismaのgroupByで日付ごとは難しいので、簡易的に取得してJSで加工するか、rawQueryを使う
    // ここでは rawQuery を使用して効率的に取得
    const dailyStats = await this.prisma.$queryRaw<{ date: Date, count: number }[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM applications
      WHERE application_definition_id = ${id}
      AND created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // 呼び出し元で扱いやすい形に整形
    const formattedDailyStats = dailyStats.map((d: any) => ({
      date: new Date(d.date).toISOString().split('T')[0],
      count: Number(d.count) // BigInt対策
    }));

    return {
      definition: appDef,
      statusDistribution: statusDistribution.map(s => ({ status: s.status, count: s._count._all })),
      nodeDistribution: nodeDistribution.map(n => ({ nodeId: n.currentNodeId, count: n._count._all })),
      dailyStats: formattedDailyStats
    };
  }
}
