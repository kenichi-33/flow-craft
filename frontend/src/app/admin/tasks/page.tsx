'use client';

import React, { useCallback } from 'react';
import { api } from '@/lib/api';
import { Box, Chip, Button, IconButton, Tooltip } from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

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
            name: string;
        };
        flowDefinition?: {
            nodes: any[];
        };
    };
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

export default function AdminTasksPage() {
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
            id: 'assignedTo',
            label: '担当者',
            minWidth: 120,
            format: (value) => value || '-',
        },
        {
            id: 'stepId',
            label: 'ステップ',
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
            label: '作成日時',
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
                <Tooltip title="詳細を見る">
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
            <Box sx={{ mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/admin"
                    sx={{ color: '#667eea' }}
                >
                    ダッシュボードに戻る
                </Button>
            </Box>

            <DataTable
                title="全タスク管理"
                subtitle="全てのタスクを管理できます"
                columns={columns}
                serverSide
                onFetch={fetchTasks}
                emptyMessage="タスクがありません"
                rowKey="id"
            />
        </Box>
    );
}
