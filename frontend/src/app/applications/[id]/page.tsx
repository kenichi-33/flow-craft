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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import CancelIcon from '@mui/icons-material/Cancel';
import Link from 'next/link';
import ReactFlow, { MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

interface ApplicationDetail {
    id: string;
    applicationNumber: number;
    status: string;
    inputData: any;
    createdAt: string;
    updatedAt: string;
    currentNodeId?: string;
    currentNode?: any;
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

export default function ApplicationDetailPage() {
    const params = useParams();
    const id = params.id as string;

    const { data: application, isLoading } = useQuery<ApplicationDetail>({
        queryKey: ['application', id],
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
            case 'APPROVED': return '承認済';
            case 'IN_PROGRESS': return '処理中';
            case 'REJECTED': return '却下';
            case 'REMANDED': return '差戻し';
            default: return status;
        }
    };

    // Prepare flow visualization
    const { displayNodes, displayEdges, completedSteps } = useMemo(() => {
        const rawNodes = application?.flowDefinition?.nodes || [];
        const rawEdges = application?.flowDefinition?.edges || [];
        const currentNodeId = application?.currentNodeId;

        // Get completed step IDs from history
        const completedStepIds = new Set(
            (application?.history || []).map(h => h.stepId)
        );

        const displayNodes = rawNodes.map((node: any) => {
            const isCurrent = node.id === currentNodeId;
            const isCompleted = completedStepIds.has(node.id);
            const isStart = node.type === 'start';
            const isEnd = node.type === 'end';

            let bgColor = '#f5f5f5';
            let borderColor = '#ccc';

            if (isStart) {
                bgColor = '#e8f5e9';
                borderColor = '#4caf50';
            } else if (isEnd) {
                bgColor = '#ffebee';
                borderColor = '#f44336';
            } else if (isCurrent) {
                bgColor = '#e3f2fd';
                borderColor = '#2196f3';
            } else if (isCompleted) {
                bgColor = '#e8f5e9';
                borderColor = '#4caf50';
            }

            return {
                ...node,
                style: {
                    background: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: 10,
                    minWidth: 100,
                },
                data: {
                    ...node.data,
                    label: (
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" fontWeight={isCurrent ? 'bold' : 'normal'}>
                                {node.data?.label || node.type}
                            </Typography>
                            {isCurrent && (
                                <Chip label="現在" size="small" color="primary" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
                            )}
                            {isCompleted && !isCurrent && (
                                <Chip label="完了" size="small" color="success" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
                            )}
                        </Box>
                    ),
                },
            };
        });

        const displayEdges = rawEdges.map((edge: any) => ({
            ...edge,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
        }));

        return { displayNodes, displayEdges, completedSteps: completedStepIds };
    }, [application]);

    if (isLoading) {
        return <Box sx={{ p: 3 }}>読み込み中...</Box>;
    }

    if (!application) {
        return <Box sx={{ p: 3 }}>申請が見つかりません</Box>;
    }

    const schema = application.formDefinition?.schema || {};
    const properties = schema.properties || {};

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href="/applications">
                    申請一覧に戻る
                </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Typography variant="h4">
                    #{application.applicationNumber} {application.applicationDefinition?.name || '申請詳細'}
                </Typography>
                <Chip
                    label={getStatusLabel(application.status)}
                    color={getStatusColor(application.status) as any}
                />
            </Box>

            <Grid container spacing={3}>
                {/* Flow Visualization */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>フロー進捗</Typography>
                        <Box sx={{ height: 300, bgcolor: '#fafafa', borderRadius: 1 }}>
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
                                />
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <Typography color="text.secondary">フロー情報がありません</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Application Data */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>申請内容</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Table size="small">
                            <TableBody>
                                {Object.entries(application.inputData || {}).map(([key, value]) => (
                                    <TableRow key={key}>
                                        <TableCell sx={{ fontWeight: 'bold', width: 150 }}>
                                            {properties[key]?.title || key}
                                        </TableCell>
                                        <TableCell>{String(value)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>申請日</TableCell>
                                    <TableCell>{new Date(application.createdAt).toLocaleString('ja-JP')}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>

                {/* Current Status & History */}
                <Grid size={{ xs: 12, md: 6 }}>
                    {application.currentNode && (
                        <Paper sx={{ p: 3, mb: 2 }}>
                            <Typography variant="h6" gutterBottom>現在のステップ</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Chip
                                icon={<PendingIcon />}
                                label={application.currentNode.data?.label || application.currentNode.id}
                                color="info"
                            />
                        </Paper>
                    )}

                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>承認履歴</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {application.history && application.history.length > 0 ? (
                            application.history.map((h) => (
                                <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                                    {h.action === 'APPROVE' ? (
                                        <CheckCircleIcon color="success" />
                                    ) : h.action === 'REJECT' ? (
                                        <CancelIcon color="error" />
                                    ) : (
                                        <PendingIcon color="warning" />
                                    )}
                                    <Box>
                                        <Typography variant="body2">
                                            {h.action === 'APPROVE' ? '承認' : h.action === 'REJECT' ? '却下' : '差戻し'}
                                            {h.comment && ` - ${h.comment}`}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {h.actorId} - {new Date(h.actedAt).toLocaleString('ja-JP')}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))
                        ) : (
                            <Typography color="text.secondary" variant="body2">
                                まだ承認アクションがありません
                            </Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
