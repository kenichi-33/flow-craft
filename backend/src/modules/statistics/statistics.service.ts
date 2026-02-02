import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class StatisticsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

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
    const summary = await Promise.all(
      defs.map(async (def) => {
        // 総申請数
        const totalCount = await this.prisma.application.count({
          where: {
            applicationDefinitionId: def.id,
            status: { not: 'DRAFT' },
          },
        });

        // 進行中
        const activeCount = await this.prisma.application.count({
          where: {
            applicationDefinitionId: def.id,
            status: 'IN_PROGRESS',
          },
        });

        // 完了(承認済み)
        const approvedCount = await this.prisma.application.count({
          where: {
            applicationDefinitionId: def.id,
            status: 'APPROVED',
          },
        });

        return {
          ...def,
          stats: {
            totalCount,
            activeCount,
            approvedCount,
          },
        };
      }),
    );

    return summary;
  }

  async getApplicationStats(id: string) {
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id },
      include: {
        flowDefinition: true, // フロー定義が必要（ノードマップ用）
      },
    });

    if (!appDef) return null;

    // ステータス分布
    const statusDistribution = await this.prisma.application.groupBy({
      by: ['status'],
      where: { applicationDefinitionId: id },
      _count: { _all: true },
    });

    // 詳細統計の取得
    // 1. 下書き(Draft)と完了(Approved)
    const draftCount = await this.prisma.application.count({
      where: { applicationDefinitionId: id, status: 'DRAFT' },
    });
    const approvedCount = await this.prisma.application.count({
      where: { applicationDefinitionId: id, status: 'APPROVED' },
    });

    // 2. 進行中(IN_PROGRESS)のノード分布
    const activeNodes = await this.prisma.application.groupBy({
      by: ['currentNodeId'],
      where: {
        applicationDefinitionId: id,
        status: 'IN_PROGRESS',
        currentNodeId: { not: null },
      },
      _count: { _all: true },
    });

    // 3. Task Assignment Details (Assigned vs Unassigned)
    const pendingTasks = await this.prisma.workflowTask.findMany({
      where: {
        application: { applicationDefinitionId: id, status: 'IN_PROGRESS' },
        status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
      },
      select: { stepId: true, claimedBy: true, assignedTo: true },
    });

    const taskBreakdown = new Map<
      string,
      { assigned: number; unassigned: number }
    >();
    for (const task of pendingTasks) {
      if (!task.stepId) continue;
      if (!taskBreakdown.has(task.stepId)) {
        taskBreakdown.set(task.stepId, { assigned: 0, unassigned: 0 });
      }
      const stat = taskBreakdown.get(task.stepId)!;

      // Determine if task is effectively assigned to a specific user
      // assignedTo can be 'user:xxx', 'group:xxx', 'role:xxx', or just 'xxx' (assuming user if no prefix)
      // We consider it "Unassigned" (waiting for claim) if it is assigned to a group or role AND not claimed yet.
      // If claimedBy is set, it is definitely Assigned.
      const isExplicitUserAssignment =
        task.assignedTo &&
        (task.assignedTo.startsWith('user:') ||
          (!task.assignedTo.startsWith('group:') &&
            !task.assignedTo.startsWith('role:')));

      if (task.claimedBy || isExplicitUserAssignment) {
        stat.assigned++;
      } else {
        stat.unassigned++;
      }
    }

    // 4. ノードへのマッピング
    const flowNodes = (appDef.flowDefinition?.nodes as any[]) || [];
    const startNode = flowNodes.find((n) => n.type === 'start');
    const endNode = flowNodes.find((n) => n.type === 'end');

    const nodeStatsMap = new Map<string, any>();

    // Active Nodes
    for (const an of activeNodes) {
      if (!an.currentNodeId) continue;

      const activeCount = an._count._all;
      const breakdown = taskBreakdown.get(an.currentNodeId) || {
        assigned: 0,
        unassigned: 0,
      };

      // Calculate derived stats
      // assigned: Explicitly assigned active tasks
      const finalAssigned = breakdown.assigned;

      // unassigned: Total Active Apps - Assigned Tasks
      // This ensures that any application sitting at this node (regardless of task state) is counted as 'Unassigned' if not explicitly assigned.
      const finalUnassigned = Math.max(0, activeCount - finalAssigned);

      nodeStatsMap.set(an.currentNodeId, {
        count: activeCount,
        breakdown: {
          active: activeCount,
          assigned: finalAssigned,
          unassigned: finalUnassigned,
        },
      });
    }

    // Start Node (Draft)
    if (startNode) {
      const stats = nodeStatsMap.get(startNode.id) || {
        count: 0,
        breakdown: { active: 0, assigned: 0, unassigned: 0 },
      };
      stats.breakdown.draft = draftCount;
      nodeStatsMap.set(startNode.id, stats);
    }

    // End Node (Completed)
    if (endNode) {
      const stats = nodeStatsMap.get(endNode.id) || {
        count: 0,
        breakdown: { active: 0, assigned: 0, unassigned: 0 },
      };
      stats.breakdown.completed = approvedCount;
      nodeStatsMap.set(endNode.id, stats);
    }

    // 過去30日の日次推移
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // PrismaのgroupByで日付ごとは難しいので、簡易的に取得してJSで加工するか、rawQueryを使う
    // ここでは rawQuery を使用して効率的に取得
    const dailyStats = await this.prisma.$queryRaw<
      { date: Date; count: number }[]
    >`
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
      count: Number(d.count), // BigInt対策
    }));

    return {
      definition: appDef,
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      nodeDistribution: Array.from(nodeStatsMap.entries()).map(
        ([nodeId, stats]) => ({
          nodeId,
          count: stats.count,
          breakdown: stats.breakdown,
        }),
      ),
      dailyStats: formattedDailyStats,
    };
  }
  async getTaskPerformanceStats(appId: string) {
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id: appId },
      include: {
        flowDefinition: true,
      },
    });

    if (!appDef) return null;

    // 完了したタスクの統計を取得
    // stepIdごとにグループ化
    const taskStats = await this.prisma.workflowTask.groupBy({
      by: ['stepId'],
      where: {
        application: {
          applicationDefinitionId: appId,
        },
        status: 'COMPLETED',
      },
      _count: {
        _all: true,
      },
    });

    // 平均・最小・最大時間を計算するために詳細データを取得
    // PrismaのgroupByではavg/min/maxが数値型フィールドにしか使えないため、
    // 日付差分の計算はDB依存またはアプリ側で行う必要がある。
    // ここでは rawQuery を使用して効率的に計算する (PostgreSQL想定)
    const rawStats = await this.prisma.$queryRaw<
      {
        step_id: string;
        avg_seconds: number; // Total duration
        min_seconds: number;
        max_seconds: number;
        avg_wait_seconds: number; // Created -> Claimed
        avg_execution_seconds: number; // Claimed -> Completed
      }[]
    >`
      SELECT 
        step_id,
        AVG(EXTRACT(EPOCH FROM (wt.updated_at - wt.created_at))) as avg_seconds,
        MIN(EXTRACT(EPOCH FROM (wt.updated_at - wt.created_at))) as min_seconds,
        MAX(EXTRACT(EPOCH FROM (wt.updated_at - wt.created_at))) as max_seconds,
        AVG(COALESCE(EXTRACT(EPOCH FROM (wt.claimed_at - wt.created_at)), 0)) as avg_wait_seconds,
        AVG(CASE 
          WHEN wt.claimed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (wt.updated_at - wt.claimed_at)) 
          ELSE EXTRACT(EPOCH FROM (wt.updated_at - wt.created_at)) 
        END) as avg_execution_seconds
      FROM workflow_tasks wt
      JOIN applications a ON wt.application_id = a.id
      WHERE a.application_definition_id = ${appId}
      AND wt.status = 'COMPLETED'
      GROUP BY step_id
    `;

    // フロー定義からノード名を取得
    const nodeMap = new Map<
      string,
      { label?: string; title?: string; type?: string }
    >();
    if (appDef.flowDefinition && Array.isArray(appDef.flowDefinition.nodes)) {
      (appDef.flowDefinition.nodes as any[]).forEach((node) => {
        nodeMap.set(node.id, node.data);
      });
    }

    return rawStats.map((stat) => {
      const nodeData = nodeMap.get(stat.step_id);
      return {
        stepId: stat.step_id,
        stepName: nodeData?.label || nodeData?.title || stat.step_id,
        avgSeconds: Number(stat.avg_seconds || 0),
        minSeconds: Number(stat.min_seconds || 0),
        maxSeconds: Number(stat.max_seconds || 0),
        avgWaitSeconds: Number(stat.avg_wait_seconds || 0),
        avgExecutionSeconds: Number(stat.avg_execution_seconds || 0),
        count:
          taskStats.find((t) => t.stepId === stat.step_id)?._count._all || 0,
      };
    });
  }

  async getApplicationRates(appId: string) {
    const stats = await this.prisma.application.groupBy({
      by: ['status'],
      where: {
        applicationDefinitionId: appId,
      },
      _count: {
        _all: true,
      },
    });

    const counts = stats.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 承認済み
    const approved = counts['APPROVED'] || 0;
    // 却下
    const rejected = counts['REJECTED'] || 0;
    // 取下げ
    const canceled = counts['CANCELED'] || 0; // CANCELEDがあるか確認が必要だが一旦仮定
    // 進行中
    const inProgress = counts['IN_PROGRESS'] || 0;
    // 完了とみなす総数 (承認 + 却下 + 取下げ) ※進行中は含めないのが一般的だが、分母をどうするかは要件次第
    // ここでは「完了した申請のうちの割合」とする
    const completedTotal = approved + rejected + canceled;

    // 差戻し率について: 履歴にREMANDがある申請の数 / 総申請数
    // これは別途集計が必要
    // サブクエリが必要だが、Prismaだとcountでfilteringできる
    const remandedCount = await this.prisma.application.count({
      where: {
        applicationDefinitionId: appId,
        history: {
          some: {
            action: 'REMAND',
          },
        },
      },
    });

    const totalApplications = approved + rejected + canceled + inProgress;

    return {
      approvalRate: completedTotal > 0 ? (approved / completedTotal) * 100 : 0,
      rejectionRate: completedTotal > 0 ? (rejected / completedTotal) * 100 : 0,
      withdrawalRate:
        completedTotal > 0 ? (canceled / completedTotal) * 100 : 0,
      remandRate:
        totalApplications > 0 ? (remandedCount / totalApplications) * 100 : 0,
      counts: {
        approved,
        rejected,
        canceled,
        remanded: remandedCount,
        total: totalApplications,
      },
    };
  }

  async getAssigneeStats(appId: string) {
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id: appId },
      include: {
        flowDefinition: true,
      },
    });

    if (!appDef) return [];

    // フロー定義からノード名を取得
    const nodeMap = new Map<string, { label?: string; title?: string }>();
    if (appDef.flowDefinition && Array.isArray(appDef.flowDefinition.nodes)) {
      (appDef.flowDefinition.nodes as any[]).forEach((node) => {
        nodeMap.set(node.id, node.data);
      });
    }

    // 担当者・ステップごとの統計
    const rawStats = await this.prisma.$queryRaw<
      {
        effective_assignee: string;
        step_id: string;
        task_count: number;
        avg_seconds: number;
      }[]
    >`
      SELECT 
        COALESCE(wt.claimed_by, CASE WHEN wt.assigned_to LIKE 'user:%' THEN SUBSTRING(wt.assigned_to FROM 6) ELSE wt.assigned_to END) as effective_assignee,
        wt.step_id,
        COUNT(*) as task_count,
        AVG(EXTRACT(EPOCH FROM (wt.updated_at - wt.created_at))) as avg_seconds
      FROM workflow_tasks wt
      JOIN applications a ON wt.application_id = a.id
      WHERE a.application_definition_id = ${appId}
      AND wt.status = 'COMPLETED'
      AND (wt.claimed_by IS NOT NULL OR wt.assigned_to IS NOT NULL)
      GROUP BY effective_assignee, wt.step_id
    `;

    // ユーザー情報の解決
    const userIds = [...new Set(rawStats.map((s) => s.effective_assignee))];
    const userMap = new Map<string, any>();

    await Promise.all(
      userIds.map(async (uid) => {
        // システム的なIDやロールIDでない場合のみ検索
        if (!uid.includes(':') && uid !== 'system' && uid !== 'applicant') {
          try {
            const info = await this.usersService.getUserSnapshotByUsername(uid);
            if (info) userMap.set(uid, info);
          } catch {
            // Ignore
          }
        }
      }),
    );

    return rawStats.map((s) => {
      const nodeData = nodeMap.get(s.step_id);
      return {
        assignedTo: s.effective_assignee,
        assignedToInfo: userMap.get(s.effective_assignee),
        stepId: s.step_id,
        stepName: nodeData?.label || nodeData?.title || s.step_id,
        taskCount: Number(s.task_count),
        avgSeconds: Number(s.avg_seconds || 0),
      };
    });
  }

  async getServiceTaskErrorStats(appId: string) {
    const appDef = await this.prisma.applicationDefinition.findUnique({
      where: { id: appId },
      include: {
        flowDefinition: true,
      },
    });

    if (!appDef) return [];

    const nodeMap = new Map<string, { label?: string; title?: string }>();
    if (appDef.flowDefinition && Array.isArray(appDef.flowDefinition.nodes)) {
      (appDef.flowDefinition.nodes as any[]).forEach((node) => {
        nodeMap.set(node.id, node.data);
      });
    }

    const rawStats = await this.prisma.$queryRaw<
      {
        step_id: string;
        total_count: number;
        failed_count: number;
      }[]
    >`
      SELECT 
        step_id,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE wt.status = 'FAILED') as failed_count
      FROM workflow_tasks wt
      JOIN applications a ON wt.application_id = a.id
      WHERE a.application_definition_id = ${appId}
      AND wt.type IN ('apiCall', 'llmCall', 'pythonScript', 'createApplication')
      GROUP BY step_id
    `;

    return rawStats.map((s) => {
      const nodeData = nodeMap.get(s.step_id);
      const total = Number(s.total_count);
      const failed = Number(s.failed_count);
      return {
        stepId: s.step_id,
        stepName: nodeData?.label || nodeData?.title || s.step_id,
        totalCount: total,
        failedCount: failed,
        errorRate: total > 0 ? (failed / total) * 100 : 0,
      };
    });
  }
}
