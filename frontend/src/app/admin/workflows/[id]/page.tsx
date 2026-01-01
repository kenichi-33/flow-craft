'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Chip,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Button,
    Grid,
} from '@mui/material';
import { useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Link from 'next/link';
import FlowVisualization from '@/components/flow-designer/FlowVisualization';

interface ApplicationDetail {
    id: string;
    status: string;
    inputData: any;
    currentNodeId: string | null;
    createdAt: string;
    updatedAt: string;
    applicantId: string;
    flowNodes?: any[];
    flowEdges?: any[];
    applicationDefinition?: {
        id: string;
        name: string;
    };
    formDefinition?: {
        schema: any;
    };
    flowDefinition?: {
        nodes: any[];
        edges: any[];
        swimlanes?: any[];
    };
    tasks: Array<{
        id: string;
        status: string;
        stepId: string;
        createdAt: string;
    }>;
    history: Array<{
        id: string;
        action: string;
        actorId: string;
        comment?: string;
        stepId: string;
        actedAt: string;
    }>;
}

export default function WorkflowDetailPage() {
    const params = useParams();
    const id = params.id as string;

    const { data: application, isLoading } = useQuery<ApplicationDetail>({
        queryKey: ['workflow-detail', id],
        queryFn: () => api.get(`/workflow/applications/${id}/status`),
        enabled: !!id,
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'success';
            case 'IN_PROGRESS': return 'info';
            case 'REJECTED': return 'error';
            case 'REMANDED': return 'warning';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'APPROVED': return '完了';
            case 'IN_PROGRESS': return '処理中';
            case 'REJECTED': return '却下';
            case 'REMANDED': return '差戻し';
            default: return status;
        }
    };

    if (isLoading) {
        return <Box sx={{ p: 3 }}>読み込み中...</Box>;
    }

    if (!application) {
        return <Box sx={{ p: 3 }}>ワークフローが見つかりません</Box>;
    }

    // フロー定義（スナップショット優先）
    const nodes = application.flowNodes || application.flowDefinition?.nodes || [];
    const edges = application.flowEdges || application.flowDefinition?.edges || [];

    // 完了ステップをhistoryから取得
    const completedStepIds = new Set(
        (application.history || []).map(h => h.stepId)
    );
    // 開始ノードも追加
    if (completedStepIds.size > 0) {
        const startNode = nodes.find((n: any) => n.type === 'start');
        if (startNode) completedStepIds.add(startNode.id);
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href="/admin/workflows">
                    一覧に戻る
                </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Typography variant="h4">{application.applicationDefinition?.name || 'ワークフロー詳細'}</Typography>
                <Chip
                    label={getStatusLabel(application.status)}
                    color={getStatusColor(application.status) as any}
                />
                <Button
                    variant="outlined"
                    size="small"
                    component={Link}
                    href={`/applications/${application.id}`}
                >
                    申請詳細を見る
                </Button>
            </Box>

            {/* フロー可視化 - 共通コンポーネント使用 */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>フロー進捗</Typography>
                <FlowVisualization
                    nodes={nodes}
                    edges={edges}
                    currentNodeId={application.currentNodeId}
                    completedStepIds={completedStepIds}
                    height={400}
                />
            </Paper>

            <Grid container spacing={3}>
                {/* 申請情報 */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>申請情報</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', width: 150 }}>申請者</TableCell>
                                    <TableCell>{application.applicantId}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>申請日時</TableCell>
                                    <TableCell suppressHydrationWarning>{new Date(application.createdAt).toLocaleString('ja-JP')}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>最終更新</TableCell>
                                    <TableCell suppressHydrationWarning>{new Date(application.updatedAt).toLocaleString('ja-JP')}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>ステータス</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={getStatusLabel(application.status)}
                                            color={getStatusColor(application.status) as any}
                                            size="small"
                                        />
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>

                {/* 承認履歴 */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>承認履歴</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {application.history?.length === 0 ? (
                            <Typography color="text.secondary">履歴がありません</Typography>
                        ) : (
                            <Table size="small">
                                <TableBody>
                                    {application.history?.map((h) => {
                                        const getActionLabel = (action: string) => {
                                            switch (action) {
                                                case 'APPROVE': return '承認';
                                                case 'REJECT': return '却下';
                                                case 'REMAND': return '差戻し';
                                                case 'RESUBMIT': return '再申請';
                                                case 'BRANCH': return '条件分岐';
                                                case 'SERVICE_TASK': return 'システム処理開始';
                                                case 'SERVICE_TASK_COMPLETE': return 'システム処理完了';
                                                case 'APPLICATION_COMPLETE': return '申請完了';
                                                default: return action;
                                            }
                                        };
                                        const getActionColor = (action: string) => {
                                            switch (action) {
                                                case 'APPROVE': return 'success';
                                                case 'REJECT': return 'error';
                                                case 'REMAND': return 'warning';
                                                case 'RESUBMIT': return 'info';
                                                case 'BRANCH': return 'info';
                                                case 'SERVICE_TASK': return 'secondary';
                                                case 'SERVICE_TASK_COMPLETE': return 'success';
                                                case 'APPLICATION_COMPLETE': return 'success';
                                                default: return 'default';
                                            }
                                        };
                                        return (
                                            <TableRow key={h.id}>
                                                <TableCell suppressHydrationWarning sx={{ whiteSpace: 'nowrap' }}>
                                                    {new Date(h.actedAt).toLocaleString('ja-JP')}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={getActionLabel(h.action)}
                                                        color={getActionColor(h.action) as any}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>{h.actorId === 'SYSTEM' ? 'システム' : h.actorId}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
