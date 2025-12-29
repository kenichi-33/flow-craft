'use client';

import React, { useMemo } from 'react';
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
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

interface ApplicationDetail {
    id: string;
    status: string;
    inputData: any;
    currentNodeId: string | null;
    createdAt: string;
    updatedAt: string;
    applicantId: string;
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

// Function to compute traversal order from start node
function getTraversalOrder(nodes: any[], edges: any[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const startNode = nodes.find(n => n.type === 'start');

    if (!startNode) return nodes.map(n => n.id);

    const queue = [startNode.id];
    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        order.push(nodeId);

        // Find outgoing edges
        const outgoing = edges.filter((e: any) => e.source === nodeId);
        for (const edge of outgoing) {
            if (!visited.has(edge.target)) {
                queue.push(edge.target);
            }
        }
    }

    return order;
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

    // Prepare nodes with visual styles based on status
    const { displayNodes, displayEdges, orderedSteps } = useMemo(() => {
        if (!application?.flowDefinition) {
            return { displayNodes: [], displayEdges: [], orderedSteps: [] };
        }

        const rawNodes = application.flowDefinition.nodes || [];
        const rawEdges = application.flowDefinition.edges || [];
        const currentNodeId = application.currentNodeId;
        const traversalOrder = getTraversalOrder(rawNodes, rawEdges);
        const currentIndex = traversalOrder.indexOf(currentNodeId || '');

        // Transform nodes for display
        const displayNodes = rawNodes.map((node: any) => {
            const isCompleted = traversalOrder.indexOf(node.id) < currentIndex;
            const isCurrent = node.id === currentNodeId;
            const isApproved = application.status === 'APPROVED';

            let bgColor = '#f5f5f5';
            let borderColor = '#ccc';

            if (isCompleted || (isApproved && node.type === 'end')) {
                bgColor = '#c8e6c9';
                borderColor = '#4caf50';
            } else if (isCurrent) {
                bgColor = '#bbdefb';
                borderColor = '#2196f3';
            }

            return {
                ...node,
                style: {
                    background: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: 10,
                },
                data: {
                    ...node.data,
                    label: (
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" fontWeight="bold">
                                {node.data?.label || node.type}
                            </Typography>
                            {isCurrent && (
                                <Chip label="現在" size="small" color="primary" sx={{ mt: 0.5 }} />
                            )}
                            {isCompleted && (
                                <Chip label="完了" size="small" color="success" sx={{ mt: 0.5 }} />
                            )}
                        </Box>
                    ),
                },
            };
        });

        // Transform edges
        const displayEdges = rawEdges.map((edge: any) => ({
            ...edge,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
        }));

        // Create ordered steps for stepper
        const orderedSteps = traversalOrder.map(nodeId => {
            const node = rawNodes.find((n: any) => n.id === nodeId);
            return {
                id: nodeId,
                label: node?.data?.label || node?.type || nodeId,
                type: node?.type,
            };
        });

        return { displayNodes, displayEdges, orderedSteps };
    }, [application]);

    if (isLoading) {
        return <Box sx={{ p: 3 }}>読み込み中...</Box>;
    }

    if (!application) {
        return <Box sx={{ p: 3 }}>ワークフローが見つかりません</Box>;
    }

    const currentStepIndex = orderedSteps.findIndex(s => s.id === application.currentNodeId);

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

            <Grid container spacing={3}>
                {/* フロー可視化 */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>フロー進捗</Typography>
                        <Box sx={{ height: 350, bgcolor: '#fafafa', borderRadius: 1 }}>
                            {displayNodes.length > 0 ? (
                                <ReactFlow
                                    nodes={displayNodes}
                                    edges={displayEdges}
                                    fitView
                                    nodesDraggable={false}
                                    nodesConnectable={false}
                                    elementsSelectable={false}
                                    panOnDrag={false}
                                    zoomOnScroll={false}
                                >
                                    <Background />
                                </ReactFlow>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <Typography color="text.secondary">フロー情報がありません</Typography>
                                </Box>
                            )}
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Chip icon={<Box sx={{ width: 12, height: 12, bgcolor: '#c8e6c9', borderRadius: '50%' }} />} label="完了" size="small" variant="outlined" />
                            <Chip icon={<Box sx={{ width: 12, height: 12, bgcolor: '#bbdefb', borderRadius: '50%' }} />} label="現在" size="small" variant="outlined" />
                            <Chip icon={<Box sx={{ width: 12, height: 12, bgcolor: '#f5f5f5', borderRadius: '50%' }} />} label="未処理" size="small" variant="outlined" />
                        </Box>
                    </Paper>
                </Grid>

                {/* ステップ一覧 */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>ステップ一覧</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {orderedSteps.map((step, idx) => {
                            const isCompleted = idx < currentStepIndex || application.status === 'APPROVED';
                            const isCurrent = step.id === application.currentNodeId;
                            return (
                                <Box
                                    key={step.id}
                                    sx={{
                                        p: 1.5,
                                        mb: 1,
                                        borderRadius: 1,
                                        bgcolor: isCurrent ? 'primary.light' : isCompleted ? 'success.light' : 'grey.100',
                                        color: isCurrent || isCompleted ? 'white' : 'inherit',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    <Typography variant="body2" sx={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
                                        {idx + 1}. {step.label}
                                    </Typography>
                                    {isCurrent && <Chip label="現在" size="small" sx={{ bgcolor: 'white', color: 'primary.main' }} />}
                                </Box>
                            );
                        })}
                    </Paper>
                </Grid>
            </Grid>

            {/* 申請情報 */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>申請情報</Typography>
                <Divider sx={{ mb: 2 }} />
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', width: 200 }}>申請者</TableCell>
                            <TableCell>{application.applicantId}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>申請日時</TableCell>
                            <TableCell>{new Date(application.createdAt).toLocaleString('ja-JP')}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>最終更新</TableCell>
                            <TableCell>{new Date(application.updatedAt).toLocaleString('ja-JP')}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Paper>

            {/* 承認履歴 */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>承認履歴</Typography>
                <Divider sx={{ mb: 2 }} />
                {application.history?.length === 0 ? (
                    <Typography color="text.secondary">履歴がありません</Typography>
                ) : (
                    <Table>
                        <TableBody>
                            {application.history?.map((h) => (
                                <TableRow key={h.id}>
                                    <TableCell>{new Date(h.actedAt).toLocaleString('ja-JP')}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={h.action === 'APPROVE' ? '承認' : h.action === 'REJECT' ? '却下' : '差戻し'}
                                            color={h.action === 'APPROVE' ? 'success' : h.action === 'REJECT' ? 'error' : 'warning'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{h.actorId}</TableCell>
                                    <TableCell>{h.comment || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Paper>
        </Box>
    );
}
