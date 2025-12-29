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

interface Task {
    id: string;
    status: string;
    stepId: string;
    createdAt: string;
    application: {
        id: string;
        inputData: any;
        applicationDefinition?: {
            id: string;
            name: string;
        };
    };
}

export default function TasksListPage() {
    const { data: tasks, isLoading } = useQuery<Task[]>({
        queryKey: ['my-tasks'],
        queryFn: () => api.get('/tasks'),
    });

    const pendingTasks = tasks?.filter(t => t.status === 'PENDING') || [];

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>承認タスク</Typography>
            <Typography color="text.secondary" paragraph>
                あなたに割り当てられた承認待ちタスクの一覧です。
            </Typography>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>アプリ名</TableCell>
                            <TableCell>ステップ</TableCell>
                            <TableCell>ステータス</TableCell>
                            <TableCell>受付日</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5}>読み込み中...</TableCell>
                            </TableRow>
                        ) : pendingTasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5}>承認待ちのタスクはありません</TableCell>
                            </TableRow>
                        ) : (
                            pendingTasks.map((task) => (
                                <TableRow key={task.id} hover>
                                    <TableCell>
                                        <strong>{task.application?.applicationDefinition?.name || '不明'}</strong>
                                    </TableCell>
                                    <TableCell>{task.stepId}</TableCell>
                                    <TableCell>
                                        <Chip label="承認待ち" color="warning" size="small" />
                                    </TableCell>
                                    <TableCell>{new Date(task.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            component={Link}
                                            href={`/tasks/${task.id}`}
                                        >
                                            承認する
                                        </Button>
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
