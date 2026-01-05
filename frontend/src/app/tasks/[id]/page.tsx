'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Avatar,
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import PersonIcon from '@mui/icons-material/Person';
import ErrorIcon from '@mui/icons-material/Error';
import Link from 'next/link';
import FlowVisualization from '@/components/flow-designer/FlowVisualization';
import DynamicFormRenderer from '@/components/application/DynamicFormRenderer';
import ApprovalHistory from '@/components/ApprovalHistory';
import { UserDisplay } from '@/components/UserDisplay';

interface ApprovalHistoryItem {
    id: string;
    actorId: string;
    action: string;
    comment?: string;
    stepId: string;
    createdAt: string;
}

interface TaskDetail {
    id: string;
    status: string;
    stepId: string;
    assignedTo?: string;
    assignedToInfo?: any; // スナップショット追加
    createdAt: string;
    application: {
        id: string;
        applicationNumber: number;
        applicantId: string;
        applicantInfo?: any; // スナップショット追加
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
        history?: ApprovalHistoryItem[];
        tasks?: {
            id: string;
            status: string;
            stepId: string;
        }[];
    };
}

// Function to get step label
function getStepLabel(stepId: string, nodes?: any[]): string {
    if (!nodes) return stepId;
    const node = nodes.find(n => n.id === stepId);
    return node?.data?.label || stepId;
}

// 担当者表示用のフォーマット
function formatAssignedTo(assignedTo?: string): string {
    if (!assignedTo) return '未指定';

    const assignments = assignedTo.split(',').map(s => s.trim());
    return assignments.map(a => {
        if (a.startsWith('user:')) return a.substring(5);
        if (a.startsWith('role:')) return `ロール: ${a.substring(5)}`;
        if (a.startsWith('group:')) return `グループ: ${a.substring(6)}`;
        if (a === 'applicant') return '申請者';
        if (a === 'applicant_manager') return '申請者の上長';
        return a;
    }).join(', ');
}

export default function TaskDetailPage() {
    const router = useRouter();
    const params = useParams();
    const queryClient = useQueryClient();
    const taskId = params.id as string;

    const [comment, setComment] = useState('');
    const [success, setSuccess] = useState<string | null>(null);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

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
            queryClient.invalidateQueries({ queryKey: ['task', taskId] });
            setSuccess('処理が完了しました');
            setTimeout(() => router.push('/tasks'), 1500);
        },
        onError: (err: any) => {
            // エラーダイアログを表示
            const message = err instanceof ApiError
                ? err.message
                : err.message || '処理に失敗しました';
            setErrorMessage(message);
            setErrorDialogOpen(true);
        },
    });

    const handleAction = (action: 'APPROVE' | 'REJECT' | 'REMAND') => {
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

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Typography variant="h4">
                    {task.application?.applicationDefinition?.name || '承認'} - 承認確認
                </Typography>
                <Chip
                    label={`現在のステップ: ${currentStepLabel}`}
                    color="primary"
                    variant="outlined"
                />
            </Box>

            {/* 担当者情報 */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#667eea' }}>
                    <PersonIcon />
                </Avatar>
                <Box>
                    <Typography variant="body2" color="text.secondary">担当者</Typography>
                    <Box sx={{ fontWeight: 600 }}>
                        <UserDisplay user={task.assignedToInfo} fallback={formatAssignedTo(task.assignedTo)} />
                    </Box>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
                <Box>
                    <Typography variant="body2" color="text.secondary">申請者</Typography>
                    <Box sx={{ fontWeight: 600 }}>
                        <UserDisplay user={task.application?.applicantInfo} fallback={task.application?.applicantId} />
                    </Box>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
                <Box>
                    <Typography variant="body2" color="text.secondary">申請番号</Typography>
                    <Typography variant="body1" fontWeight={600}>
                        #{task.application?.applicationNumber}
                    </Typography>
                </Box>
            </Paper>

            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            {/* 1. フロー進捗 - Full Width */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>フロー進捗</Typography>
                <FlowVisualization
                    nodes={flowNodes}
                    edges={flowEdges}
                    currentNodeId={
                        // 現在のタスクだけでなく、並行して走っている他のPENDINGタスクも表示する
                        task.application?.tasks
                            ? task.application.tasks
                                .filter(t => t.status === 'PENDING')
                                .map(t => t.stepId)
                            : [task.stepId]
                    }
                    completedStepIds={
                        task.application?.history
                            ?.filter(h => h.action !== 'REMAND')
                            .map(h => h.stepId) || []
                    }
                    showBackground
                />
            </Paper>

            {/* 2. 申請内容 - 共通コンポーネント使用 */}
            <Box sx={{ mb: 3 }}>
                <DynamicFormRenderer
                    schema={schema}
                    initialData={task.application?.inputData}
                    readOnly={true}
                />
            </Box>

            {/* 3. 承認履歴 */}
            {task.application?.history && task.application.history.length > 0 && (
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>承認履歴</Typography>
                    <ApprovalHistory
                        history={task.application.history}
                    />
                </Paper>
            )}

            {/* 4. 承認アクション */}
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

            {/* エラーダイアログ */}
            <Dialog open={errorDialogOpen} onClose={() => setErrorDialogOpen(false)}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <ErrorIcon />
                    エラー
                </DialogTitle>
                <DialogContent>
                    <Typography>{errorMessage}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setErrorDialogOpen(false)} autoFocus>
                        閉じる
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
