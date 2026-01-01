'use client';

import React, { useCallback } from 'react';
import { api } from '@/lib/api';
import { Box, Chip, Button, IconButton, Tooltip, Typography } from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

interface ApplicationDefinition {
    id: string;
    name: string;
    description?: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    version: number;
    publishedAt: string | null;
    formDefinition: { id: string; name: string } | null;
    flowDefinition: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'ACTIVE': return 'success';
        case 'DRAFT': return 'warning';
        case 'ARCHIVED': return 'default';
        default: return 'default';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'ACTIVE': return '公開中';
        case 'DRAFT': return '下書き';
        case 'ARCHIVED': return 'アーカイブ';
        default: return status;
    }
};

export default function AppsListPage() {
    const fetchApps = useCallback(async (params: FetchParams): Promise<PaginatedResponse<ApplicationDefinition>> => {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(params.page));
        queryParams.set('limit', String(params.limit));
        if (params.search) queryParams.set('search', params.search);
        if (params.sortBy) queryParams.set('sortBy', params.sortBy);
        if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

        return api.get(`/application-definitions?${queryParams.toString()}`);
    }, []);

    const columns: Column<ApplicationDefinition>[] = [
        {
            id: 'name',
            label: 'アプリ名',
            minWidth: 200,
            format: (value, row) => (
                <Box>
                    <Link href={`/designer/apps/${row.id}`} style={{ textDecoration: 'none', color: '#667eea', fontWeight: 700 }}>
                        {value}
                    </Link>
                    {row.description && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {row.description.length > 40 ? row.description.substring(0, 40) + '...' : row.description}
                        </Typography>
                    )}
                </Box>
            ),
        },
        {
            id: 'version',
            label: 'バージョン',
            minWidth: 100,
            format: (value, row) => (
                <Box>
                    <Chip
                        label={`v${value}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600, color: '#667eea', borderColor: '#667eea' }}
                    />
                    {row.publishedAt && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }} suppressHydrationWarning>
                            {new Date(row.publishedAt).toLocaleDateString('ja-JP')}
                        </Typography>
                    )}
                </Box>
            ),
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
            id: 'formDefinition',
            label: 'フォーム',
            minWidth: 120,
            searchable: false,
            format: (value) => value ? (
                <Chip label={value.name} size="small" variant="outlined" />
            ) : (
                <Chip label="未設定" size="small" color="error" variant="outlined" />
            ),
        },
        {
            id: 'flowDefinition',
            label: 'フロー',
            minWidth: 120,
            searchable: false,
            format: (value) => value ? (
                <Chip label={value.name} size="small" variant="outlined" />
            ) : (
                <Chip label="未設定" size="small" color="error" variant="outlined" />
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
                    <Tooltip title="編集">
                        <IconButton
                            size="small"
                            component={Link}
                            href={`/designer/apps/${row.id}`}
                            sx={{ color: '#667eea' }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="バージョン履歴">
                        <IconButton
                            size="small"
                            component={Link}
                            href={`/designer/apps/${row.id}/versions`}
                            sx={{ color: '#764ba2' }}
                        >
                            <HistoryIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        },
    ];

    return (
        <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
            <DataTable
                title="アプリ管理"
                subtitle="ワークフローアプリの作成・管理ができます"
                columns={columns}
                serverSide
                onFetch={fetchApps}
                emptyMessage="アプリがありません。「新規アプリ作成」から作成してください。"
                rowKey="id"
                actions={
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        component={Link}
                        href="/designer/apps/new"
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
                        新規アプリ作成
                    </Button>
                }
            />
        </Box>
    );
}
