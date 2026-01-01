'use client';

import React, { useCallback } from 'react';
import { api } from '@/lib/api';
import { Box, Chip, Button, IconButton, Tooltip } from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

interface Application {
    id: string;
    applicationNumber: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    applicationDefinition?: {
        id: string;
        name: string;
    };
    inputData: any;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'APPROVED': return 'success';
        case 'IN_PROGRESS': return 'info';
        case 'REJECTED': return 'error';
        case 'REMANDED': return 'warning';
        case 'DRAFT': return 'default';
        default: return 'default';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'APPROVED': return '承認済';
        case 'IN_PROGRESS': return '処理中';
        case 'REJECTED': return '却下';
        case 'REMANDED': return '差戻し';
        case 'DRAFT': return '下書き';
        default: return status;
    }
};

export default function ApplicationsListPage() {
    const fetchApplications = useCallback(async (params: FetchParams): Promise<PaginatedResponse<Application>> => {
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
            minWidth: 180,
            format: (_, row) => row.applicationDefinition?.name || '不明',
        },
        {
            id: 'status',
            label: 'ステータス',
            minWidth: 120,
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
            minWidth: 140,
            sortable: false,
            searchable: false,
            format: (_, row) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {row.status === 'REMANDED' && (
                        <Tooltip title="内容を再編集して再申請">
                            <Button
                                size="small"
                                variant="contained"
                                component={Link}
                                href={`/applications/${row.id}/edit`}
                                startIcon={<EditIcon />}
                                sx={{
                                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                }}
                            >
                                再編集
                            </Button>
                        </Tooltip>
                    )}
                    <Tooltip title="詳細を見る">
                        <IconButton
                            size="small"
                            component={Link}
                            href={`/applications/${row.id}`}
                            sx={{ color: '#667eea' }}
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
            <DataTable
                title="申請一覧"
                subtitle="あなたの申請履歴を確認できます"
                columns={columns}
                serverSide
                onFetch={fetchApplications}
                emptyMessage="申請がありません"
                rowKey="id"
                actions={
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        component={Link}
                        href="/applications/new"
                        sx={{
                            background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                            color: '#667eea',
                            fontWeight: 700,
                            textTransform: 'none',
                            '&:hover': {
                                background: '#fff',
                            },
                        }}
                    >
                        新規申請
                    </Button>
                }
            />
        </Box>
    );
}
