'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Alert,
    Divider,
    ButtonGroup,
    Chip,
    Grid,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Checkbox,
    Select,
    MenuItem,
    InputLabel,
    FormGroup,
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import Link from 'next/link';
import ReactFlow, { Background, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

interface TaskDetail {
    id: string;
    status: string;
    stepId: string;
    createdAt: string;
    application: {
        id: string;
        applicationNumber: number;
        inputData: any;
        currentNodeId: string | null;
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
    };
}

// Function to get step label
function getStepLabel(stepId: string, nodes?: any[]): string {
    if (!nodes) return stepId;
    const node = nodes.find(n => n.id === stepId);
    return node?.data?.label || stepId;
}

export default function TaskDetailPage() {
    const router = useRouter();
    const params = useParams();
    const queryClient = useQueryClient();
    const taskId = params.id as string;

    const [comment, setComment] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { data: task, isLoading } = useQuery<TaskDetail>({
        queryKey: ['task', taskId],
        queryFn: () => api.get(`/tasks/${taskId}`),
        enabled: !!taskId,
    });

    const completeMutation = useMutation({
        mutationFn: (action: 'APPROVE' | 'REJECT' | 'REMAND') =>
            api.post(`/workflow/tasks/${taskId}/complete`, {
                action,
                actorId: 'current-user',
                comment: comment || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
            setSuccess('処理が完了しました');
            setTimeout(() => router.push('/tasks'), 1500);
        },
        onError: (err: any) => {
            setError(err.message || '処理に失敗しました');
        },
    });

    const handleAction = (action: 'APPROVE' | 'REJECT' | 'REMAND') => {
        setError(null);
        completeMutation.mutate(action);
    };

    // Prepare flow visualization nodes
    const { flowNodes, flowEdges } = useMemo(() => {
        const rawNodes = task?.application?.flowDefinition?.nodes || [];
        const rawEdges = task?.application?.flowDefinition?.edges || [];
        // Use application's currentNodeId (more accurate) with fallback to task's stepId
        const currentStepId = task?.application?.currentNodeId || task?.stepId;

        const flowNodes = rawNodes.map((node: any) => {
            const isCurrent = node.id === currentStepId;

            let bgColor = '#f5f5f5';
            let borderColor = '#ccc';

            if (isCurrent) {
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
                            <Typography variant="body2" fontWeight={isCurrent ? 'bold' : 'normal'}>
                                {node.data?.label || node.type}
                            </Typography>
                            {isCurrent && (
                                <Chip label="現在" size="small" color="primary" sx={{ mt: 0.5, height: 18 }} />
                            )}
                        </Box>
                    ),
                },
            };
        });

        const flowEdges = rawEdges.map((edge: any) => ({
            ...edge,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
        }));

        return { flowNodes, flowEdges };
    }, [task]);

    // Get schema data for form display
    const schema = task?.application?.formDefinition?.schema || {};
    const properties = schema.properties || {};
    const layout = schema['x-layout'] || [];
    const currentStepLabel = getStepLabel(task?.stepId || '', task?.application?.flowDefinition?.nodes);

    // Get layout-sorted fields
    const sortedFields = useMemo(() => {
        interface FieldDef {
            type: string;
            title: string;
            options?: string[];
        }
        const fields = Object.entries(properties as Record<string, FieldDef>)
            .map(([id, prop]) => {
                const layoutItem = layout.find((l: any) => l.i === id);
                return {
                    id,
                    ...prop,
                    x: layoutItem?.x ?? 0,
                    y: layoutItem?.y ?? 0,
                    w: layoutItem?.w ?? 12,
                };
            });
        fields.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
        return fields;
    }, [properties, layout]);

    // Group fields by row
    const rows = useMemo(() => {
        const rowMap: Record<number, typeof sortedFields> = {};
        for (const field of sortedFields) {
            if (!rowMap[field.y]) rowMap[field.y] = [];
            rowMap[field.y].push(field);
        }
        return Object.entries(rowMap)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, fields]) => fields.sort((a, b) => a.x - b.x));
    }, [sortedFields]);

    // Read-only field rendering function
    const renderReadOnlyField = (field: any) => {
        const value = task?.application?.inputData?.[field.id] ?? '';
        const gridWidth = Math.min(12, Math.max(1, field.w));

        if (field.type === 'divider') {
            return <Grid key={field.id} size={12}><Divider sx={{ my: 1 }} /></Grid>;
        }
        if (field.type === 'label') {
            return (
                <Grid key={field.id} size={12}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>{field.title}</Typography>
                </Grid>
            );
        }

        let displayValue = value;
        if (Array.isArray(value)) displayValue = value.join(', ');
        if (typeof value === 'boolean') displayValue = value ? 'はい' : 'いいえ';

        return (
            <Grid key={field.id} size={{ xs: 12, md: gridWidth }}>
                <TextField
                    label={field.title}
                    value={displayValue}
                    fullWidth
                    size="small"
                    slotProps={{ input: { readOnly: true } }}
                    sx={{ '& .MuiInputBase-input': { bgcolor: '#f5f5f5' } }}
                />
            </Grid>
        );
    };

    if (isLoading) {
        return <Box sx={{ p: 3 }}>読み込み中...</Box>;
    }

    if (!task) {
        return <Box sx={{ p: 3 }}>タスクが見つかりません</Box>;
    }

    if (task.status !== 'PENDING') {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="info">このタスクは既に処理済みです</Alert>
                <Button sx={{ mt: 2 }} component={Link} href="/tasks">タスク一覧に戻る</Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href="/tasks">
                    タスク一覧に戻る
                </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Typography variant="h4">
                    {task.application?.applicationDefinition?.name || '承認'} - 承認確認
                </Typography>
                <Chip
                    label={`現在のステップ: ${currentStepLabel}`}
                    color="primary"
                    variant="outlined"
                />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            {/* 1. フロー進捗 - Full Width */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>フロー進捗</Typography>
                <Box sx={{ height: 280, bgcolor: '#fafafa', borderRadius: 1 }}>
                    {flowNodes.length > 0 ? (
                        <ReactFlow
                            nodes={flowNodes}
                            edges={flowEdges}
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
                            <Typography color="text.secondary">フロー情報なし</Typography>
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* 2. 申請内容 - Full Width, Form-style Layout */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>申請内容</Typography>
                <Divider sx={{ mb: 2 }} />
                {rows.map((rowFields, rowIdx) => (
                    <Grid container spacing={2} key={rowIdx} sx={{ mb: 1 }}>
                        {rowFields.map(renderReadOnlyField)}
                    </Grid>
                ))}
            </Paper>

            {/* 3. 承認アクション */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>承認アクション</Typography>
                <Divider sx={{ mb: 2 }} />

                <TextField
                    label="コメント（任意）"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="承認・差戻し理由など"
                    sx={{ mb: 3 }}
                />

                <ButtonGroup size="large" fullWidth>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<CheckIcon />}
                        onClick={() => handleAction('APPROVE')}
                        disabled={completeMutation.isPending}
                    >
                        承認
                    </Button>
                    <Button
                        variant="contained"
                        color="warning"
                        startIcon={<UndoIcon />}
                        onClick={() => handleAction('REMAND')}
                        disabled={completeMutation.isPending}
                    >
                        差戻し
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<CloseIcon />}
                        onClick={() => handleAction('REJECT')}
                        disabled={completeMutation.isPending}
                    >
                        却下
                    </Button>
                </ButtonGroup>
            </Paper>
        </Box>
    );
}
