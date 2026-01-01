'use client';

import React, { useCallback } from 'react';
import { api } from '@/lib/api';
import { Box, Chip, Button, IconButton, Tooltip } from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TimelineIcon from '@mui/icons-material/Timeline';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

interface Application {
    id: string;
    applicationNumber: number;
    status: string;
    currentNodeId: string | null;
    createdAt: string;
    updatedAt: string;
    applicationDefinition?: {
        id: string;
        name: string;
    };
    flowDefinition?: {
        nodes: any[];
    };
    applicantId: string;
}

function getStepLabel(nodeId: string | null, nodes?: any[]): string {
    if (!nodeId || !nodes) return nodeId || '-';
    const node = nodes.find(n => n.id === nodeId);
    return node?.data?.label || nodeId;
}

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
        case 'DRAFT': return '下書き';
        default: return status;
    }
};

export default function WorkflowsListPage() {
    const fetchWorkflows = useCallback(async (params: FetchParams): Promise<PaginatedResponse<Application>> => {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(params.page));
        queryParams.set('limit', String(params.limit));
        if (params.search) queryParams.set('search', params.search);
        if (params.sortBy) queryParams.set('sortBy', params.sortBy);
        if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

        return api.get(`/applications?${queryParams.toString()}`);
    }, []);

    const columns: Column<Application>[] = [
        {
            id: 'applicationNumber',
            label: '申請ID',
            minWidth: 100,
            format: (value) => <strong>#{value}</strong>,
        },
        {
            id: 'appName',
            label: 'アプリ名',
            minWidth: 150,
            format: (_, row) => row.applicationDefinition?.name || '不明',
        },
        {
            id: 'applicantId',
            label: '申請者',
            minWidth: 120,
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
            id: 'currentStep',
            label: '現在のステップ',
            minWidth: 140,
            format: (_, row) => getStepLabel(row.currentNodeId, row.flowDefinition?.nodes),
            searchable: false,
        },
        {
            id: 'createdAt',
            label: '申請日時',
            minWidth: 160,
            format: (value) => (
                <span suppressHydrationWarning>
                    {new Date(value).toLocaleString('ja-JP')}
                </span>
            ),
        },
        {
            id: 'updatedAt',
            label: '更新日時',
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
            minWidth: 120,
            sortable: false,
            searchable: false,
            format: (_, row) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="進捗を見る">
                        <IconButton
                            size="small"
                            component={Link}
                            href={`/admin/workflows/${row.id}`}
                            sx={{ color: '#667eea' }}
                        >
                            <TimelineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="詳細を見る">
                        <IconButton
                            size="small"
                            component={Link}
                            href={`/applications/${row.id}`}
                            sx={{ color: '#764ba2' }}
                        >
                            <VisibilityIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
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
                title="ワークフロー進捗一覧"
                subtitle="全ての申請の進捗状況を確認できます"
                columns={columns}
                serverSide
                onFetch={fetchWorkflows}
                emptyMessage="ワークフローがありません"
                rowKey="id"
            />
        </Box>
    );
}
