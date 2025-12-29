'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Chip,
    Button,
} from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface Task {
    id: string;
    status: string;
    stepId: string;
    assignedTo: string | null;
    createdAt: string;
    application: {
        id: string;
        applicationNumber: number;
        applicantId: string;
        applicationDefinition?: {
            id: string;
            name: string;
        };
        flowDefinition?: {
            nodes: any[];
        };
    };
}

// Helper to get step name from flow nodes
function getStepName(stepId: string, nodes?: any[]): string {
    if (!nodes) return stepId;
    const node = nodes.find(n => n.id === stepId);
    return node?.data?.label || stepId;
}

export default function AdminTasksPage() {
    const { data: tasks, isLoading } = useQuery<Task[]>({
        queryKey: ['admin-all-tasks'],
        queryFn: () => api.get('/tasks'),
    });

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href="/admin">
                    ダッシュボードに戻る
                </Button>
            </Box>

            <Typography variant="h4" gutterBottom>全タスク管理</Typography>
            <Typography color="text.secondary" paragraph>
                システム内の全承認タスクを管理できます。
            </Typography>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>申請ID</TableCell>
                            <TableCell>アプリ名</TableCell>
                            <TableCell>ステップ</TableCell>
                            <TableCell>担当者</TableCell>
                            <TableCell>ステータス</TableCell>
                            <TableCell>作成日</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7}>読み込み中...</TableCell>
                            </TableRow>
                        ) : tasks?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7}>タスクがありません</TableCell>
                            </TableRow>
                        ) : (
                            tasks?.map((task) => (
                                <TableRow key={task.id} hover>
                                    <TableCell>
                                        <strong>#{task.application?.applicationNumber}</strong>
                                    </TableCell>
                                    <TableCell>
                                        {task.application?.applicationDefinition?.name || '不明'}
                                    </TableCell>
                                    <TableCell>{getStepName(task.stepId, task.application?.flowDefinition?.nodes)}</TableCell>
                                    <TableCell>{task.assignedTo || '未割当'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={task.status === 'PENDING' ? '承認待ち' : '完了'}
                                            color={task.status === 'PENDING' ? 'warning' : 'success'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{new Date(task.createdAt).toLocaleString('ja-JP')}</TableCell>
                                    <TableCell>
                                        {task.status === 'PENDING' && (
                                            <Button
                                                size="small"
                                                variant="contained"
                                                component={Link}
                                                href={`/tasks/${task.id}`}
                                            >
                                                承認画面へ
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
