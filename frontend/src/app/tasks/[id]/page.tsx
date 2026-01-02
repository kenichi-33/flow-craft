'use client';

import React, { useState } from 'react';
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
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import Link from 'next/link';
import FlowVisualization from '@/components/flow-designer/FlowVisualization';
import ApplicationFormViewer from '@/components/ApplicationFormViewer';

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

    // フロー表示用のデータを取得
    const flowNodes = task?.application?.flowDefinition?.nodes || [];
    const flowEdges = task?.application?.flowDefinition?.edges || [];
    const currentStepId = task?.application?.currentNodeId || task?.stepId;

    // Get schema data for form display
    const schema = task?.application?.formDefinition?.schema || {};
    const currentStepLabel = getStepLabel(task?.stepId || '', task?.application?.flowDefinition?.nodes);

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
                <FlowVisualization
                    nodes={flowNodes}
                    edges={flowEdges}
                    currentNodeId={currentStepId}
                    showBackground
                />
            </Paper>

            {/* 2. 申請内容 - 共通コンポーネント使用 */}
            <Box sx={{ mb: 3 }}>
                <ApplicationFormViewer
                    schema={schema}
                    inputData={task.application?.inputData}
                />
            </Box>

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
