'use client';

import React, { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Box, Chip, IconButton, Tooltip, Alert, Button, Paper, Typography, Divider } from '@mui/material';
import Link from 'next/link';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

interface Task {
    id: string;
    status: string;
    stepId: string;
    createdAt: string;
    application: {
        id: string;
        applicationNumber: number;
        applicantId: string;
        applicationDefinition?: {
            name: string;
        };
        flowDefinition?: {
            nodes: any[];
        };
    };
}

interface RemandedApplication {
    id: string;
    applicationNumber: number;
    status: string;
    applicationDefinition?: {
        name: string;
    };
    updatedAt: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'PENDING': return 'warning';
        case 'APPROVED': return 'success';
        case 'REJECTED': return 'error';
        default: return 'default';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'PENDING': return '保留中';
        case 'APPROVED': return '承認済';
        case 'REJECTED': return '却下';
        default: return status;
    }
};

function getStepLabel(stepId: string, nodes?: any[]): string {
    if (!nodes) return stepId;
    const node = nodes.find(n => n.id === stepId);
    return node?.data?.label || stepId;
}

export default function TasksListPage() {
    // 差し戻しされた申請を取得
    const { data: remandedApps } = useQuery<RemandedApplication[]>({
        queryKey: ['remanded-applications'],
        queryFn: async () => {
            const response: any = await api.get('/applications?status=REMANDED');
            // レスポンスが配列かPaginatedResponseかをチェック
            return Array.isArray(response) ? response : response.data || [];
        },
    });

    const fetchTasks = useCallback(async (params: FetchParams): Promise<PaginatedResponse<Task>> => {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(params.page));
        queryParams.set('limit', String(params.limit));
        queryParams.set('status', 'PENDING'); // PENDINGのタスクのみ取得
        if (params.search) queryParams.set('search', params.search);
        if (params.sortBy) queryParams.set('sortBy', params.sortBy);
        if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

        return api.get(`/tasks?${queryParams.toString()}`);
    }, []);

    const columns: Column<Task>[] = [
        {
            id: 'applicationNumber',
            label: '申請ID',
            minWidth: 100,
            format: (_, row) => <strong>#{row.application?.applicationNumber}</strong>,
        },
        {
            id: 'appName',
            label: 'アプリ名',
            minWidth: 150,
            format: (_, row) => row.application?.applicationDefinition?.name || '不明',
        },
        {
            id: 'applicantId',
            label: '申請者',
            minWidth: 120,
            format: (_, row) => row.application?.applicantId,
        },
        {
            id: 'stepId',
            label: '現在のステップ',
            minWidth: 140,
            format: (value, row) => getStepLabel(value, row.application?.flowDefinition?.nodes),
        },
        {
            id: 'status',
            label: 'ステータス',
            minWidth: 100,
            format: (value) => (
                <Chip
                    label={getStatusLabel(value)}
                    color={getStatusColor(value) as any}
                    size="small"
                    sx={{ fontWeight: 600 }}
                />
            ),
        },
        {
            id: 'createdAt',
            label: 'タスク作成日時',
            minWidth: 160,
            format: (value) => (
                <span suppressHydrationWarning>
                    {new Date(value).toLocaleString('ja-JP')}
                </span>
            ),
        },
        {
            id: 'actions',
            label: '操作',
            minWidth: 100,
            sortable: false,
            searchable: false,
            format: (_, row) => (
                <Tooltip title="承認・差戻し">
                    <IconButton
                        size="small"
                        component={Link}
                        href={`/tasks/${row.id}`}
                        sx={{ color: '#667eea' }}
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            {/* 差し戻しされた申請がある場合のアラート */}
            {remandedApps && remandedApps.length > 0 && (
                <Paper sx={{ mb: 3, p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <RefreshIcon color="warning" />
                        <Typography variant="h6" color="warning.dark">
                            差し戻しされた申請があります
                        </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {remandedApps.map((app) => (
                            <Box key={app.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="body2">
                                    <strong>#{app.applicationNumber}</strong> - {app.applicationDefinition?.name || '申請'}
                                </Typography>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="warning"
                                    startIcon={<EditIcon />}
                                    component={Link}
                                    href={`/applications/${app.id}/edit`}
                                >
                                    再編集
                                </Button>
                            </Box>
                        ))}
                    </Box>
                </Paper>
            )}

            <DataTable
                title="承認タスク"
                subtitle="あなたに割り当てられたタスク一覧"
                columns={columns}
                serverSide
                onFetch={fetchTasks}
                emptyMessage="タスクがありません"
                rowKey="id"
            />
        </Box>
    );
}
